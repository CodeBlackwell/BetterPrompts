package middleware_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/auth"
	"github.com/betterprompts/api-gateway/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type AuthMiddlewareTestSuite struct {
	suite.Suite
	router     *gin.Engine
	jwtManager *auth.JWTManager
	logger     *logrus.Logger
}

func (suite *AuthMiddlewareTestSuite) SetupTest() {
	gin.SetMode(gin.TestMode)
	
	// Create JWT manager with test config
	suite.jwtManager = auth.NewJWTManager(auth.JWTConfig{
		SecretKey:        "test-secret-key",
		RefreshSecretKey: "test-refresh-secret-key",
		AccessExpiry:     15 * time.Minute,
		RefreshExpiry:    7 * 24 * time.Hour,
		Issuer:           "test-issuer",
	})
	
	// Create logger
	suite.logger = logrus.New()
	suite.logger.Out = nil // Disable logging during tests
	
	// Setup router
	suite.router = gin.New()
}

func (suite *AuthMiddlewareTestSuite) TearDownTest() {
	// Reset environment variables
	os.Unsetenv("NODE_ENV")
}

// Helper functions
func (suite *AuthMiddlewareTestSuite) makeRequest(method, path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	return rec
}

func (suite *AuthMiddlewareTestSuite) generateTestToken(userID, email string, roles []string) string {
	token, _, err := suite.jwtManager.GenerateTokenPair(userID, email, roles)
	require.NoError(suite.T(), err)
	return token
}

// Test Cases - AuthMiddleware

func (suite *AuthMiddlewareTestSuite) TestAuthMiddleware_ValidToken() {
	// Setup route with auth middleware
	suite.router.GET("/protected", 
		middleware.AuthMiddleware(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			email, _ := c.Get("user_email")
			roles, _ := c.Get("user_roles")
			claims, _ := c.Get("auth_claims")
			
			c.JSON(http.StatusOK, gin.H{
				"user_id":    userID,
				"user_email": email,
				"user_roles": roles,
				"has_claims": claims != nil,
			})
		})
	
	// Generate valid token
	token := suite.generateTestToken("user-123", "test@example.com", []string{"user", "admin"})
	
	// Make request
	rec := suite.makeRequest("GET", "/protected", map[string]string{
		"Authorization": "Bearer " + token,
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "user-123", resp["user_id"])
	assert.Equal(suite.T(), "test@example.com", resp["user_email"])
	assert.Equal(suite.T(), []interface{}{"user", "admin"}, resp["user_roles"])
	assert.True(suite.T(), resp["has_claims"].(bool))
}

func (suite *AuthMiddlewareTestSuite) TestAuthMiddleware_InvalidToken() {
	// Setup route with auth middleware
	suite.router.GET("/protected", 
		middleware.AuthMiddleware(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Make request with invalid token
	rec := suite.makeRequest("GET", "/protected", map[string]string{
		"Authorization": "Bearer invalid-token",
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid or expired token", resp["error"])
}

func (suite *AuthMiddlewareTestSuite) TestAuthMiddleware_ExpiredToken() {
	// Create JWT manager with very short expiry
	shortJwtManager := auth.NewJWTManager(auth.JWTConfig{
		SecretKey:        "test-secret-key",
		RefreshSecretKey: "test-refresh-secret-key",
		AccessExpiry:     1 * time.Nanosecond, // Expires immediately
		RefreshExpiry:    7 * 24 * time.Hour,
		Issuer:           "test-issuer",
	})
	
	// Setup route
	suite.router.GET("/protected", 
		middleware.AuthMiddleware(shortJwtManager, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Generate token that will expire
	token, _, err := shortJwtManager.GenerateTokenPair("user-123", "test@example.com", []string{"user"})
	require.NoError(suite.T(), err)
	
	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)
	
	// Make request
	rec := suite.makeRequest("GET", "/protected", map[string]string{
		"Authorization": "Bearer " + token,
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid or expired token", resp["error"])
}

func (suite *AuthMiddlewareTestSuite) TestAuthMiddleware_MissingToken() {
	// Setup route with auth middleware
	suite.router.GET("/protected", 
		middleware.AuthMiddleware(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Make request without token
	rec := suite.makeRequest("GET", "/protected", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Authorization required", resp["error"])
}

func (suite *AuthMiddlewareTestSuite) TestAuthMiddleware_TokenFromCookie() {
	// Setup route with auth middleware
	suite.router.GET("/protected", 
		middleware.AuthMiddleware(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			c.JSON(http.StatusOK, gin.H{"user_id": userID})
		})
	
	// Generate valid token
	token := suite.generateTestToken("user-123", "test@example.com", []string{"user"})
	
	// Make request with token in cookie
	req := httptest.NewRequest("GET", "/protected", nil)
	req.AddCookie(&http.Cookie{
		Name:  "access_token",
		Value: token,
	})
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "user-123", resp["user_id"])
}

func (suite *AuthMiddlewareTestSuite) TestAuthMiddleware_DevelopmentBypass() {
	// Set development mode
	os.Setenv("NODE_ENV", "development")
	
	// Setup route with auth middleware
	suite.router.GET("/api/v1/enhance", 
		middleware.AuthMiddleware(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			email, _ := c.Get("user_email")
			roles, _ := c.Get("user_roles")
			
			c.JSON(http.StatusOK, gin.H{
				"user_id":    userID,
				"user_email": email,
				"user_roles": roles,
			})
		})
	
	// Make request without token but with bypass header
	rec := suite.makeRequest("GET", "/api/v1/enhance", map[string]string{
		"X-Test-Mode": "true",
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "dev-user-123", resp["user_id"])
	assert.Equal(suite.T(), "dev@betterprompts.test", resp["user_email"])
	assert.Equal(suite.T(), []interface{}{"developer", "user"}, resp["user_roles"])
}

func (suite *AuthMiddlewareTestSuite) TestAuthMiddleware_DevelopmentBypassQuery() {
	// Set development mode
	os.Setenv("NODE_ENV", "development")
	
	// Setup route with auth middleware
	suite.router.GET("/protected", 
		middleware.AuthMiddleware(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			c.JSON(http.StatusOK, gin.H{"user_id": userID})
		})
	
	// Make request with bypass query parameter
	rec := suite.makeRequest("GET", "/protected?dev_bypass_auth=true", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "dev-user-123", resp["user_id"])
}

// Test Cases - RequireAuth

func (suite *AuthMiddlewareTestSuite) TestRequireAuth_Authenticated() {
	// Setup route with RequireAuth
	suite.router.GET("/protected", 
		func(c *gin.Context) {
			// Simulate authenticated user
			c.Set("user_id", "user-123")
			c.Next()
		},
		middleware.RequireAuth(),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Make request
	rec := suite.makeRequest("GET", "/protected", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

func (suite *AuthMiddlewareTestSuite) TestRequireAuth_Unauthenticated() {
	// Setup route with RequireAuth
	suite.router.GET("/protected", 
		middleware.RequireAuth(),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Make request
	rec := suite.makeRequest("GET", "/protected", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Authentication required", resp["error"])
}

// Test Cases - RequireRole

func (suite *AuthMiddlewareTestSuite) TestRequireRole_HasRole() {
	// Setup route with RequireRole
	suite.router.GET("/admin", 
		func(c *gin.Context) {
			// Simulate authenticated admin user
			c.Set("user_id", "user-123")
			c.Set("user_roles", []string{"user", "admin"})
			c.Next()
		},
		middleware.RequireRole("admin"),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "admin access granted"})
		})
	
	// Make request
	rec := suite.makeRequest("GET", "/admin", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

func (suite *AuthMiddlewareTestSuite) TestRequireRole_MissingRole() {
	// Setup route with RequireRole
	suite.router.GET("/admin", 
		func(c *gin.Context) {
			// Simulate authenticated non-admin user
			c.Set("user_id", "user-123")
			c.Set("user_roles", []string{"user"})
			c.Next()
		},
		middleware.RequireRole("admin"),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "admin access granted"})
		})
	
	// Make request
	rec := suite.makeRequest("GET", "/admin", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusForbidden, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Insufficient permissions", resp["error"])
	assert.Equal(suite.T(), []interface{}{"admin"}, resp["required_roles"])
}

func (suite *AuthMiddlewareTestSuite) TestRequireRole_MultipleRoles() {
	// Setup route that requires either admin or moderator role
	suite.router.GET("/restricted", 
		func(c *gin.Context) {
			// Simulate authenticated moderator user
			c.Set("user_id", "user-123")
			c.Set("user_roles", []string{"user", "moderator"})
			c.Next()
		},
		middleware.RequireRole("admin", "moderator"),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "access granted"})
		})
	
	// Make request
	rec := suite.makeRequest("GET", "/restricted", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

// Test Cases - RequirePermission

func (suite *AuthMiddlewareTestSuite) TestRequirePermission_HasPermission() {
	// Setup route with RequirePermission
	suite.router.GET("/prompts", 
		func(c *gin.Context) {
			// Simulate authenticated admin user
			c.Set("user_id", "user-123")
			c.Set("user_roles", []string{"admin"})
			c.Next()
		},
		middleware.RequirePermission("prompt:read:all"),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "permission granted"})
		})
	
	// Make request
	rec := suite.makeRequest("GET", "/prompts", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

func (suite *AuthMiddlewareTestSuite) TestRequirePermission_MissingPermission() {
	// Setup route with RequirePermission
	suite.router.DELETE("/prompts/123", 
		func(c *gin.Context) {
			// Simulate authenticated user (not admin)
			c.Set("user_id", "user-123")
			c.Set("user_roles", []string{"user"})
			c.Next()
		},
		middleware.RequirePermission("prompt:delete:all"),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "deleted"})
		})
	
	// Make request
	rec := suite.makeRequest("DELETE", "/prompts/123", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusForbidden, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Insufficient permissions", resp["error"])
	assert.Equal(suite.T(), "prompt:delete:all", resp["required_permission"])
}

// Test Cases - OptionalAuth

func (suite *AuthMiddlewareTestSuite) TestOptionalAuth_WithValidToken() {
	// Setup route with OptionalAuth
	suite.router.GET("/public", 
		middleware.OptionalAuth(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			userID, exists := c.Get("user_id")
			if exists {
				c.JSON(http.StatusOK, gin.H{
					"message": "authenticated",
					"user_id": userID,
				})
			} else {
				c.JSON(http.StatusOK, gin.H{
					"message": "anonymous",
				})
			}
		})
	
	// Generate valid token
	token := suite.generateTestToken("user-123", "test@example.com", []string{"user"})
	
	// Make request with token
	rec := suite.makeRequest("GET", "/public", map[string]string{
		"Authorization": "Bearer " + token,
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "authenticated", resp["message"])
	assert.Equal(suite.T(), "user-123", resp["user_id"])
}

func (suite *AuthMiddlewareTestSuite) TestOptionalAuth_WithoutToken() {
	// Setup route with OptionalAuth
	suite.router.GET("/public", 
		middleware.OptionalAuth(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			userID, exists := c.Get("user_id")
			if exists {
				c.JSON(http.StatusOK, gin.H{
					"message": "authenticated",
					"user_id": userID,
				})
			} else {
				c.JSON(http.StatusOK, gin.H{
					"message": "anonymous",
				})
			}
		})
	
	// Make request without token
	rec := suite.makeRequest("GET", "/public", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "anonymous", resp["message"])
}

func (suite *AuthMiddlewareTestSuite) TestOptionalAuth_WithInvalidToken() {
	// Setup route with OptionalAuth
	suite.router.GET("/public", 
		middleware.OptionalAuth(suite.jwtManager, suite.logger),
		func(c *gin.Context) {
			userID, exists := c.Get("user_id")
			if exists {
				c.JSON(http.StatusOK, gin.H{
					"message": "authenticated",
					"user_id": userID,
				})
			} else {
				c.JSON(http.StatusOK, gin.H{
					"message": "anonymous",
				})
			}
		})
	
	// Make request with invalid token
	rec := suite.makeRequest("GET", "/public", map[string]string{
		"Authorization": "Bearer invalid-token",
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "anonymous", resp["message"])
}

// Test Cases - Helper Functions

func (suite *AuthMiddlewareTestSuite) TestGetUserID() {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	
	// Test when user ID exists
	c.Set("user_id", "user-123")
	userID, exists := middleware.GetUserID(c)
	assert.True(suite.T(), exists)
	assert.Equal(suite.T(), "user-123", userID)
	
	// Test when user ID doesn't exist
	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	userID, exists = middleware.GetUserID(c2)
	assert.False(suite.T(), exists)
	assert.Equal(suite.T(), "", userID)
}

func (suite *AuthMiddlewareTestSuite) TestGetUserRoles() {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	
	// Test when roles exist
	c.Set("user_roles", []string{"user", "admin"})
	roles, exists := middleware.GetUserRoles(c)
	assert.True(suite.T(), exists)
	assert.Equal(suite.T(), []string{"user", "admin"}, roles)
	
	// Test when roles don't exist
	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	roles, exists = middleware.GetUserRoles(c2)
	assert.False(suite.T(), exists)
	assert.Nil(suite.T(), roles)
}

func (suite *AuthMiddlewareTestSuite) TestHasRole() {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("user_roles", []string{"user", "admin"})
	
	// Test existing role
	assert.True(suite.T(), middleware.HasRole(c, "admin"))
	assert.True(suite.T(), middleware.HasRole(c, "user"))
	
	// Test non-existing role
	assert.False(suite.T(), middleware.HasRole(c, "moderator"))
	
	// Test with no roles set
	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	assert.False(suite.T(), middleware.HasRole(c2, "admin"))
}

func (suite *AuthMiddlewareTestSuite) TestIsAdmin() {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	
	// Test admin user
	c.Set("user_roles", []string{"user", "admin"})
	assert.True(suite.T(), middleware.IsAdmin(c))
	
	// Test non-admin user
	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	c2.Set("user_roles", []string{"user"})
	assert.False(suite.T(), middleware.IsAdmin(c2))
}

func (suite *AuthMiddlewareTestSuite) TestIsDeveloper() {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	
	// Test developer user
	c.Set("user_roles", []string{"user", "developer"})
	assert.True(suite.T(), middleware.IsDeveloper(c))
	
	// Test non-developer user
	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	c2.Set("user_roles", []string{"user"})
	assert.False(suite.T(), middleware.IsDeveloper(c2))
}

// Test Runner
func TestAuthMiddlewareTestSuite(t *testing.T) {
	suite.Run(t, new(AuthMiddlewareTestSuite))
}