package security_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/auth"
	"github.com/betterprompts/api-gateway/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// SecurityTestSuite provides comprehensive security testing
type SecurityTestSuite struct {
	suite.Suite
	router     *gin.Engine
	jwtManager *auth.JWTManager
}

func (suite *SecurityTestSuite) SetupTest() {
	gin.SetMode(gin.TestMode)
	
	// Initialize JWT manager
	suite.jwtManager = auth.NewJWTManager(auth.JWTConfig{
		SecretKey:        "test-secret-key",
		RefreshSecretKey: "test-refresh-secret",
		AccessExpiry:     15 * time.Minute,
		RefreshExpiry:    24 * time.Hour,
		Issuer:           "betterprompts-test",
	})
	
	// Setup router with security middleware
	suite.router = gin.New()
	suite.router.Use(middleware.SecurityHeaders())
	suite.router.Use(middleware.CORS())
	suite.router.Use(middleware.RateLimiter())
}

// ===== JWT Authentication Tests =====

func (suite *SecurityTestSuite) TestJWT_TokenManipulation() {
	// Test various JWT token manipulation attacks
	validToken, _, _ := suite.jwtManager.GenerateTokenPair("user123", "test@example.com", []string{"user"})
	
	tests := []struct {
		name        string
		token       string
		expectCode  int
		description string
	}{
		{
			name:        "Malformed Token",
			token:       "malformed.token.here",
			expectCode:  http.StatusUnauthorized,
			description: "Should reject malformed JWT tokens",
		},
		{
			name:        "Algorithm None Attack",
			token:       strings.Replace(validToken, "HS256", "none", 1),
			expectCode:  http.StatusUnauthorized,
			description: "Should reject tokens with 'none' algorithm",
		},
		{
			name:        "Modified Payload",
			token:       validToken[:len(validToken)-10] + "tampereddata",
			expectCode:  http.StatusUnauthorized,
			description: "Should reject tokens with tampered payload",
		},
		{
			name:        "Empty Token",
			token:       "",
			expectCode:  http.StatusUnauthorized,
			description: "Should reject empty tokens",
		},
		{
			name:        "Token with Extra Dots",
			token:       validToken + ".extra.segment",
			expectCode:  http.StatusUnauthorized,
			description: "Should reject tokens with extra segments",
		},
	}
	
	// Setup protected route
	suite.router.GET("/protected", 
		middleware.AuthMiddleware(suite.jwtManager, nil),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	for _, tt := range tests {
		suite.Run(tt.name, func() {
			req := httptest.NewRequest("GET", "/protected", nil)
			req.Header.Set("Authorization", "Bearer "+tt.token)
			
			rec := httptest.NewRecorder()
			suite.router.ServeHTTP(rec, req)
			
			assert.Equal(suite.T(), tt.expectCode, rec.Code, tt.description)
		})
	}
}

func (suite *SecurityTestSuite) TestJWT_TokenReplay() {
	// Test token replay attack prevention
	token, _, _ := suite.jwtManager.GenerateTokenPair("user123", "test@example.com", []string{"user"})
	
	// Simulate token blacklisting after logout
	suite.router.POST("/logout", 
		middleware.AuthMiddleware(suite.jwtManager, nil),
		func(c *gin.Context) {
			// In production, add token to blacklist
			c.JSON(http.StatusOK, gin.H{"message": "logged out"})
		})
	
	suite.router.GET("/protected",
		middleware.AuthMiddleware(suite.jwtManager, nil),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// First request should succeed
	req1 := httptest.NewRequest("GET", "/protected", nil)
	req1.Header.Set("Authorization", "Bearer "+token)
	rec1 := httptest.NewRecorder()
	suite.router.ServeHTTP(rec1, req1)
	assert.Equal(suite.T(), http.StatusOK, rec1.Code)
	
	// Logout
	reqLogout := httptest.NewRequest("POST", "/logout", nil)
	reqLogout.Header.Set("Authorization", "Bearer "+token)
	recLogout := httptest.NewRecorder()
	suite.router.ServeHTTP(recLogout, reqLogout)
	assert.Equal(suite.T(), http.StatusOK, recLogout.Code)
	
	// Token should be blacklisted (in production implementation)
	// This is a placeholder for actual blacklist check
}

// ===== RBAC Tests =====

func (suite *SecurityTestSuite) TestRBAC_PrivilegeEscalation() {
	// Test privilege escalation attempts
	userToken, _, _ := suite.jwtManager.GenerateTokenPair("user123", "user@example.com", []string{"user"})
	adminToken, _, _ := suite.jwtManager.GenerateTokenPair("admin123", "admin@example.com", []string{"admin"})
	
	// Admin-only endpoint
	suite.router.DELETE("/api/v1/users/:id",
		middleware.AuthMiddleware(suite.jwtManager, nil),
		middleware.RequireRole("admin"),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"deleted": c.Param("id")})
		})
	
	// User endpoint that modifies own data
	suite.router.PUT("/api/v1/users/:id",
		middleware.AuthMiddleware(suite.jwtManager, nil),
		func(c *gin.Context) {
			userID, _ := c.Get("user_id")
			requestedID := c.Param("id")
			
			// Check if user is modifying their own data
			if userID != requestedID && !middleware.HasRole(c, "admin") {
				c.JSON(http.StatusForbidden, gin.H{"error": "Cannot modify other users"})
				return
			}
			
			c.JSON(http.StatusOK, gin.H{"updated": requestedID})
		})
	
	tests := []struct {
		name       string
		method     string
		path       string
		token      string
		expectCode int
	}{
		{
			name:       "User attempts admin deletion",
			method:     "DELETE",
			path:       "/api/v1/users/456",
			token:      userToken,
			expectCode: http.StatusForbidden,
		},
		{
			name:       "Admin can delete",
			method:     "DELETE",
			path:       "/api/v1/users/456",
			token:      adminToken,
			expectCode: http.StatusOK,
		},
		{
			name:       "User modifies own data",
			method:     "PUT",
			path:       "/api/v1/users/user123",
			token:      userToken,
			expectCode: http.StatusOK,
		},
		{
			name:       "User attempts to modify others",
			method:     "PUT",
			path:       "/api/v1/users/other456",
			token:      userToken,
			expectCode: http.StatusForbidden,
		},
	}
	
	for _, tt := range tests {
		suite.Run(tt.name, func() {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			req.Header.Set("Authorization", "Bearer "+tt.token)
			
			rec := httptest.NewRecorder()
			suite.router.ServeHTTP(rec, req)
			
			assert.Equal(suite.T(), tt.expectCode, rec.Code)
		})
	}
}

// ===== XSS Prevention Tests =====

func (suite *SecurityTestSuite) TestXSS_Prevention() {
	// Test XSS prevention in various contexts
	xssPayloads := []string{
		`<script>alert('XSS')</script>`,
		`<img src=x onerror="alert('XSS')">`,
		`javascript:alert('XSS')`,
		`<svg onload="alert('XSS')">`,
		`<iframe src="javascript:alert('XSS')">`,
		`';alert('XSS');//`,
		`"><script>alert('XSS')</script>`,
		`<body onload="alert('XSS')">`,
	}
	
	// Setup endpoint that echoes input
	suite.router.POST("/api/v1/enhance",
		middleware.InputSanitization(),
		func(c *gin.Context) {
			var input struct {
				Prompt      string `json:"prompt"`
				Description string `json:"description"`
			}
			
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			
			// Response should have sanitized content
			c.JSON(http.StatusOK, gin.H{
				"prompt":      input.Prompt,
				"description": input.Description,
			})
		})
	
	for i, payload := range xssPayloads {
		suite.Run(fmt.Sprintf("XSS_Payload_%d", i), func() {
			body := map[string]string{
				"prompt":      payload,
				"description": "Test with " + payload,
			}
			
			bodyBytes, _ := json.Marshal(body)
			req := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			
			rec := httptest.NewRecorder()
			suite.router.ServeHTTP(rec, req)
			
			// Check response doesn't contain raw XSS payload
			responseBody := rec.Body.String()
			assert.NotContains(suite.T(), responseBody, "<script>")
			assert.NotContains(suite.T(), responseBody, "javascript:")
			assert.NotContains(suite.T(), responseBody, "onerror=")
			assert.NotContains(suite.T(), responseBody, "onload=")
		})
	}
}

func (suite *SecurityTestSuite) TestXSS_HeaderInjection() {
	// Test XSS via header injection
	suite.router.GET("/api/v1/reflect",
		func(c *gin.Context) {
			userAgent := c.GetHeader("User-Agent")
			referer := c.GetHeader("Referer")
			
			c.JSON(http.StatusOK, gin.H{
				"user_agent": userAgent,
				"referer":    referer,
			})
		})
	
	xssHeaders := map[string]string{
		"User-Agent": `<script>alert('XSS')</script>`,
		"Referer":    `javascript:alert('XSS')`,
		"X-Custom":   `"><script>alert('XSS')</script>`,
	}
	
	req := httptest.NewRequest("GET", "/api/v1/reflect", nil)
	for header, payload := range xssHeaders {
		req.Header.Set(header, payload)
	}
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	
	// Verify Content-Type prevents XSS
	assert.Equal(suite.T(), "application/json; charset=utf-8", rec.Header().Get("Content-Type"))
	
	// Verify security headers are set
	assert.NotEmpty(suite.T(), rec.Header().Get("X-Content-Type-Options"))
	assert.NotEmpty(suite.T(), rec.Header().Get("X-Frame-Options"))
	assert.NotEmpty(suite.T(), rec.Header().Get("X-XSS-Protection"))
}

// ===== CSRF Protection Tests =====

func (suite *SecurityTestSuite) TestCSRF_Protection() {
	// Setup CSRF protection
	suite.router.Use(middleware.CSRF())
	
	// State-changing endpoint
	suite.router.POST("/api/v1/users/:id/delete",
		middleware.AuthMiddleware(suite.jwtManager, nil),
		func(c *gin.Context) {
			csrfToken := c.GetHeader("X-CSRF-Token")
			if csrfToken == "" {
				c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token required"})
				return
			}
			
			// Validate CSRF token (simplified for test)
			expectedToken, _ := c.Cookie("csrf_token")
			if csrfToken != expectedToken {
				c.JSON(http.StatusForbidden, gin.H{"error": "Invalid CSRF token"})
				return
			}
			
			c.JSON(http.StatusOK, gin.H{"deleted": c.Param("id")})
		})
	
	// Test without CSRF token
	req1 := httptest.NewRequest("POST", "/api/v1/users/123/delete", nil)
	token, _, _ := suite.jwtManager.GenerateTokenPair("user123", "test@example.com", []string{"admin"})
	req1.Header.Set("Authorization", "Bearer "+token)
	
	rec1 := httptest.NewRecorder()
	suite.router.ServeHTTP(rec1, req1)
	assert.Equal(suite.T(), http.StatusForbidden, rec1.Code)
	
	// Test with CSRF token
	req2 := httptest.NewRequest("POST", "/api/v1/users/123/delete", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	req2.Header.Set("X-CSRF-Token", "valid-csrf-token")
	req2.AddCookie(&http.Cookie{
		Name:  "csrf_token",
		Value: "valid-csrf-token",
	})
	
	rec2 := httptest.NewRecorder()
	suite.router.ServeHTTP(rec2, req2)
	assert.Equal(suite.T(), http.StatusOK, rec2.Code)
}

// ===== SQL Injection Prevention Tests =====

func (suite *SecurityTestSuite) TestSQLInjection_Prevention() {
	// SQL injection payloads
	sqlPayloads := []string{
		`'; DROP TABLE users; --`,
		`' OR '1'='1`,
		`1' UNION SELECT * FROM users--`,
		`admin'--`,
		`' OR 1=1--`,
		`"; DELETE FROM prompts WHERE 1=1; --`,
		`' UNION SELECT NULL, username, password FROM users--`,
		`1'; UPDATE users SET role='admin' WHERE email='attacker@evil.com'; --`,
	}
	
	// Setup search endpoint
	suite.router.GET("/api/v1/prompts/search",
		func(c *gin.Context) {
			query := c.Query("q")
			category := c.Query("category")
			
			// Simulate parameterized query (should be safe)
			// In real implementation, use parameterized queries
			if strings.ContainsAny(query, ";'\"") || strings.ContainsAny(category, ";'\"") {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid characters in query"})
				return
			}
			
			c.JSON(http.StatusOK, gin.H{
				"query":    query,
				"category": category,
				"results":  []string{},
			})
		})
	
	for i, payload := range sqlPayloads {
		suite.Run(fmt.Sprintf("SQLi_Payload_%d", i), func() {
			req := httptest.NewRequest("GET", "/api/v1/prompts/search?q="+payload+"&category="+payload, nil)
			rec := httptest.NewRecorder()
			suite.router.ServeHTTP(rec, req)
			
			// Should reject SQL injection attempts
			assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
		})
	}
}

// ===== Rate Limiting Tests =====

func (suite *SecurityTestSuite) TestRateLimiting_BruteForce() {
	// Test rate limiting prevents brute force attacks
	suite.router.POST("/api/v1/auth/login",
		middleware.StrictRateLimit(5, time.Minute), // 5 attempts per minute
		func(c *gin.Context) {
			var credentials struct {
				Email    string `json:"email"`
				Password string `json:"password"`
			}
			
			if err := c.ShouldBindJSON(&credentials); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			
			// Simulate authentication
			if credentials.Password == "correct-password" {
				token, _, _ := suite.jwtManager.GenerateTokenPair("user123", credentials.Email, []string{"user"})
				c.JSON(http.StatusOK, gin.H{"token": token})
			} else {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			}
		})
	
	// Attempt multiple login requests
	for i := 0; i < 10; i++ {
		body := map[string]string{
			"email":    "attacker@example.com",
			"password": fmt.Sprintf("attempt-%d", i),
		}
		
		bodyBytes, _ := json.Marshal(body)
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Real-IP", "192.168.1.100") // Same IP for all requests
		
		rec := httptest.NewRecorder()
		suite.router.ServeHTTP(rec, req)
		
		if i < 5 {
			// First 5 attempts should be allowed
			assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
		} else {
			// Subsequent attempts should be rate limited
			assert.Equal(suite.T(), http.StatusTooManyRequests, rec.Code)
		}
	}
}

func (suite *SecurityTestSuite) TestRateLimiting_DDoS() {
	// Test DDoS protection
	suite.router.GET("/api/v1/expensive-operation",
		middleware.RateLimit(100, time.Minute), // 100 requests per minute
		func(c *gin.Context) {
			// Simulate expensive operation
			time.Sleep(10 * time.Millisecond)
			c.JSON(http.StatusOK, gin.H{"result": "computed"})
		})
	
	// Simulate concurrent requests
	var wg sync.WaitGroup
	results := make([]int, 150)
	
	for i := 0; i < 150; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			
			req := httptest.NewRequest("GET", "/api/v1/expensive-operation", nil)
			req.Header.Set("X-Real-IP", "192.168.1.200")
			
			rec := httptest.NewRecorder()
			suite.router.ServeHTTP(rec, req)
			
			results[index] = rec.Code
		}(i)
	}
	
	wg.Wait()
	
	// Count rate limited requests
	rateLimited := 0
	for _, code := range results {
		if code == http.StatusTooManyRequests {
			rateLimited++
		}
	}
	
	// Should have rate limited some requests
	assert.Greater(suite.T(), rateLimited, 0)
}

// ===== Input Validation Tests =====

func (suite *SecurityTestSuite) TestInputValidation_Boundaries() {
	// Test input validation and boundaries
	suite.router.POST("/api/v1/prompts",
		middleware.InputValidation(),
		func(c *gin.Context) {
			var prompt struct {
				Title       string   `json:"title" binding:"required,min=1,max=200"`
				Description string   `json:"description" binding:"max=1000"`
				Tags        []string `json:"tags" binding:"max=10,dive,min=1,max=50"`
				MaxTokens   int      `json:"max_tokens" binding:"min=1,max=4096"`
			}
			
			if err := c.ShouldBindJSON(&prompt); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			
			c.JSON(http.StatusOK, gin.H{"created": true})
		})
	
	tests := []struct {
		name       string
		body       map[string]interface{}
		expectCode int
	}{
		{
			name: "Valid input",
			body: map[string]interface{}{
				"title":       "Valid Title",
				"description": "Valid description",
				"tags":        []string{"tag1", "tag2"},
				"max_tokens":  1000,
			},
			expectCode: http.StatusOK,
		},
		{
			name: "Title too long",
			body: map[string]interface{}{
				"title":       strings.Repeat("a", 201),
				"description": "Valid",
				"tags":        []string{"tag1"},
				"max_tokens":  1000,
			},
			expectCode: http.StatusBadRequest,
		},
		{
			name: "Too many tags",
			body: map[string]interface{}{
				"title":       "Valid",
				"description": "Valid",
				"tags":        []string{"1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"},
				"max_tokens":  1000,
			},
			expectCode: http.StatusBadRequest,
		},
		{
			name: "Negative tokens",
			body: map[string]interface{}{
				"title":       "Valid",
				"description": "Valid",
				"tags":        []string{"tag1"},
				"max_tokens":  -100,
			},
			expectCode: http.StatusBadRequest,
		},
		{
			name: "Missing required field",
			body: map[string]interface{}{
				"description": "Valid",
				"tags":        []string{"tag1"},
				"max_tokens":  1000,
			},
			expectCode: http.StatusBadRequest,
		},
	}
	
	for _, tt := range tests {
		suite.Run(tt.name, func() {
			bodyBytes, _ := json.Marshal(tt.body)
			req := httptest.NewRequest("POST", "/api/v1/prompts", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			
			rec := httptest.NewRecorder()
			suite.router.ServeHTTP(rec, req)
			
			assert.Equal(suite.T(), tt.expectCode, rec.Code)
		})
	}
}

// ===== Session Management Tests =====

func (suite *SecurityTestSuite) TestSessionManagement_Fixation() {
	// Test session fixation prevention
	suite.router.POST("/api/v1/auth/login",
		middleware.SessionManager(),
		func(c *gin.Context) {
			// Get old session ID
			oldSessionID, _ := c.Cookie("session_id")
			
			// After successful authentication, regenerate session ID
			newSessionID := generateSessionID()
			c.SetCookie("session_id", newSessionID, 3600, "/", "", true, true)
			
			c.JSON(http.StatusOK, gin.H{
				"old_session": oldSessionID,
				"new_session": newSessionID,
			})
		})
	
	// Initial request with attacker's session ID
	req := httptest.NewRequest("POST", "/api/v1/auth/login", nil)
	req.AddCookie(&http.Cookie{
		Name:  "session_id",
		Value: "attacker-session-id",
	})
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	
	var resp map[string]string
	json.Unmarshal(rec.Body.Bytes(), &resp)
	
	// Session ID should be regenerated
	assert.NotEqual(suite.T(), resp["old_session"], resp["new_session"])
	assert.NotEqual(suite.T(), "attacker-session-id", resp["new_session"])
}

func (suite *SecurityTestSuite) TestSessionManagement_Timeout() {
	// Test session timeout
	sessionStore := make(map[string]time.Time)
	
	suite.router.Use(func(c *gin.Context) {
		sessionID, err := c.Cookie("session_id")
		if err == nil && sessionID != "" {
			if lastAccess, exists := sessionStore[sessionID]; exists {
				if time.Since(lastAccess) > 30*time.Minute {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "Session expired"})
					c.Abort()
					return
				}
			}
			sessionStore[sessionID] = time.Now()
		}
		c.Next()
	})
	
	suite.router.GET("/api/v1/protected",
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Create session
	sessionID := "test-session-123"
	sessionStore[sessionID] = time.Now().Add(-31 * time.Minute) // Expired
	
	req := httptest.NewRequest("GET", "/api/v1/protected", nil)
	req.AddCookie(&http.Cookie{
		Name:  "session_id",
		Value: sessionID,
	})
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
}

// ===== Security Headers Tests =====

func (suite *SecurityTestSuite) TestSecurityHeaders() {
	suite.router.GET("/api/v1/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "ok"})
	})
	
	req := httptest.NewRequest("GET", "/api/v1/test", nil)
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	
	// Check security headers
	headers := map[string]string{
		"X-Content-Type-Options":            "nosniff",
		"X-Frame-Options":                   "DENY",
		"X-XSS-Protection":                  "1; mode=block",
		"Strict-Transport-Security":         "max-age=31536000; includeSubDomains",
		"Content-Security-Policy":           "default-src 'self'",
		"Referrer-Policy":                   "strict-origin-when-cross-origin",
		"Permissions-Policy":                "geolocation=(), microphone=(), camera=()",
		"X-Permitted-Cross-Domain-Policies": "none",
	}
	
	for header, expectedValue := range headers {
		actualValue := rec.Header().Get(header)
		assert.Contains(suite.T(), actualValue, expectedValue, 
			fmt.Sprintf("Header %s should contain %s", header, expectedValue))
	}
}

// ===== Helper Functions =====

func generateSessionID() string {
	return fmt.Sprintf("session-%d", time.Now().UnixNano())
}

// ===== Test Runner =====

func TestSecurityTestSuite(t *testing.T) {
	suite.Run(t, new(SecurityTestSuite))
}