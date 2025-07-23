package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/auth"
	"github.com/betterprompts/api-gateway/internal/handlers"
	"github.com/betterprompts/api-gateway/internal/middleware"
	"github.com/betterprompts/api-gateway/internal/models"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// Mock Services

type MockUserService struct {
	mock.Mock
}

func (m *MockUserService) CreateUser(ctx context.Context, req models.UserRegistrationRequest) (*models.User, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) GetUserByEmailOrUsername(ctx context.Context, emailOrUsername string) (*models.User, error) {
	args := m.Called(ctx, emailOrUsername)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) GetUserByID(ctx context.Context, userID string) (*models.User, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) UpdateUser(ctx context.Context, userID string, req models.UserUpdateRequest) (*models.User, error) {
	args := m.Called(ctx, userID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserService) UpdateLastLoginAt(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserService) IncrementFailedLogin(ctx context.Context, userID string) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockUserService) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	args := m.Called(ctx, userID, currentPassword, newPassword)
	return args.Error(0)
}

func (m *MockUserService) VerifyEmail(ctx context.Context, token string) error {
	args := m.Called(ctx, token)
	return args.Error(0)
}

type MockJWTManager struct {
	mock.Mock
}

func (m *MockJWTManager) GenerateTokenPair(userID, email string, roles []string) (string, string, error) {
	args := m.Called(userID, email, roles)
	return args.String(0), args.String(1), args.Error(2)
}

func (m *MockJWTManager) ValidateRefreshToken(token string) (*auth.Claims, error) {
	args := m.Called(token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*auth.Claims), args.Error(1)
}

func (m *MockJWTManager) RefreshAccessToken(refreshToken, email string, roles []string) (string, error) {
	args := m.Called(refreshToken, email, roles)
	return args.String(0), args.Error(1)
}

func (m *MockJWTManager) GetConfig() auth.JWTConfig {
	args := m.Called()
	return args.Get(0).(auth.JWTConfig)
}

type MockCacheService struct {
	mock.Mock
}

func (m *MockCacheService) Key(parts ...string) string {
	args := m.Called(parts)
	return args.String(0)
}

func (m *MockCacheService) StoreSession(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	args := m.Called(ctx, key, value, ttl)
	return args.Error(0)
}

func (m *MockCacheService) GetSession(ctx context.Context, key string, dest interface{}) error {
	args := m.Called(ctx, key, dest)
	return args.Error(0)
}

func (m *MockCacheService) DeleteSession(ctx context.Context, key string) error {
	args := m.Called(ctx, key)
	return args.Error(0)
}

// Test Suite

type AuthHandlerTestSuite struct {
	suite.Suite
	handler         *handlers.AuthHandler
	userService     *MockUserService
	jwtManager      *MockJWTManager
	cacheService    *MockCacheService
	logger          *logrus.Logger
	router          *gin.Engine
}

func (suite *AuthHandlerTestSuite) SetupTest() {
	// Set gin to test mode
	gin.SetMode(gin.TestMode)

	// Create mocks
	suite.userService = new(MockUserService)
	suite.jwtManager = new(MockJWTManager)
	suite.cacheService = new(MockCacheService)
	suite.logger = logrus.New()
	suite.logger.Out = nil // Disable logging during tests

	// Create handler
	suite.handler = handlers.NewAuthHandler(
		suite.userService,
		suite.jwtManager,
		suite.cacheService,
		suite.logger,
	)

	// Setup router
	suite.router = gin.New()
	suite.router.Use(gin.Recovery())
}

func (suite *AuthHandlerTestSuite) TearDownTest() {
	suite.userService.AssertExpectations(suite.T())
	suite.jwtManager.AssertExpectations(suite.T())
	suite.cacheService.AssertExpectations(suite.T())
}

// Helper Functions

func (suite *AuthHandlerTestSuite) makeRequest(method, path string, body interface{}) *httptest.ResponseRecorder {
	var req *http.Request
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		req = httptest.NewRequest(method, path, bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}

	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	return rec
}

func (suite *AuthHandlerTestSuite) createTestUser() *models.User {
	return &models.User{
		ID:           "test-user-id",
		Email:        "test@example.com",
		Username:     "testuser",
		PasswordHash: "$2a$10$hashedpassword",
		FirstName:    sql.NullString{String: "Test", Valid: true},
		LastName:     sql.NullString{String: "User", Valid: true},
		IsActive:     true,
		IsVerified:   true,
		Roles:        []string{"user"},
		Tier:         "free",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// Test Cases - Registration

func (suite *AuthHandlerTestSuite) TestRegister_Success() {
	suite.router.POST("/auth/register", suite.handler.Register)

	req := models.UserRegistrationRequest{
		Email:           "newuser@example.com",
		Username:        "newuser",
		Password:        "StrongPassword123!",
		ConfirmPassword: "StrongPassword123!",
		FirstName:       "New",
		LastName:        "User",
	}

	expectedUser := &models.User{
		ID:        "new-user-id",
		Email:     req.Email,
		Username:  req.Username,
		FirstName: sql.NullString{String: req.FirstName, Valid: true},
		LastName:  sql.NullString{String: req.LastName, Valid: true},
		IsActive:  true,
		Roles:     []string{"user"},
		Tier:      "free",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Mock expectations
	suite.userService.On("CreateUser", mock.Anything, req).Return(expectedUser, nil)
	suite.jwtManager.On("GenerateTokenPair", expectedUser.ID, expectedUser.Email, expectedUser.Roles).
		Return("access-token", "refresh-token", nil)
	suite.jwtManager.On("GetConfig").Return(auth.JWTConfig{AccessExpiry: 15 * time.Minute})
	suite.cacheService.On("Key", []string{"refresh_token", expectedUser.ID, "refresh-token"[:16]}).
		Return("cache-key")
	suite.cacheService.On("StoreSession", mock.Anything, "cache-key", mock.Anything, 7*24*time.Hour).
		Return(nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/register", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusCreated, rec.Code)
	
	var resp models.UserLoginResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), expectedUser.ID, resp.User.ID)
	assert.Equal(suite.T(), "access-token", resp.AccessToken)
	assert.Equal(suite.T(), "refresh-token", resp.RefreshToken)
	assert.Equal(suite.T(), int64(900), resp.ExpiresIn) // 15 minutes
}

func (suite *AuthHandlerTestSuite) TestRegister_PasswordMismatch() {
	suite.router.POST("/auth/register", suite.handler.Register)

	req := models.UserRegistrationRequest{
		Email:           "newuser@example.com",
		Username:        "newuser",
		Password:        "StrongPassword123!",
		ConfirmPassword: "DifferentPassword123!",
		FirstName:       "New",
		LastName:        "User",
	}

	// Make request
	rec := suite.makeRequest("POST", "/auth/register", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Passwords do not match", resp["error"])
}

func (suite *AuthHandlerTestSuite) TestRegister_DuplicateEmail() {
	suite.router.POST("/auth/register", suite.handler.Register)

	req := models.UserRegistrationRequest{
		Email:           "existing@example.com",
		Username:        "newuser",
		Password:        "StrongPassword123!",
		ConfirmPassword: "StrongPassword123!",
		FirstName:       "New",
		LastName:        "User",
	}

	// Mock expectations
	suite.userService.On("CreateUser", mock.Anything, req).
		Return(nil, errors.New("email already exists"))

	// Make request
	rec := suite.makeRequest("POST", "/auth/register", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusConflict, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "email already exists", resp["error"])
}

// Test Cases - Login

func (suite *AuthHandlerTestSuite) TestLogin_Success() {
	suite.router.POST("/auth/login", suite.handler.Login)

	req := models.UserLoginRequest{
		EmailOrUsername: "test@example.com",
		Password:        "password123",
		RememberMe:      false,
	}

	user := suite.createTestUser()
	// Set password hash for valid password
	user.PasswordHash = "$2a$10$9Y0cXMdgpPMj2YqQdNIoFuEJfBVP.60g9V7HvJogFKnKMKdIKtHXq"

	// Mock expectations
	suite.userService.On("GetUserByEmailOrUsername", mock.Anything, req.EmailOrUsername).
		Return(user, nil)
	suite.userService.On("UpdateLastLoginAt", mock.Anything, user.ID).Return(nil)
	suite.jwtManager.On("GetConfig").Return(auth.JWTConfig{AccessExpiry: 15 * time.Minute})
	suite.jwtManager.On("GenerateTokenPair", user.ID, user.Email, user.Roles).
		Return("access-token", "refresh-token", nil)
	suite.cacheService.On("Key", []string{"refresh_token", user.ID, "refresh-token"[:16]}).
		Return("cache-key")
	suite.cacheService.On("StoreSession", mock.Anything, "cache-key", mock.Anything, 7*24*time.Hour).
		Return(nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/login", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp models.UserLoginResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), user.ID, resp.User.ID)
	assert.Equal(suite.T(), "access-token", resp.AccessToken)
	assert.Equal(suite.T(), "refresh-token", resp.RefreshToken)
	assert.Equal(suite.T(), int64(900), resp.ExpiresIn) // 15 minutes
}

func (suite *AuthHandlerTestSuite) TestLogin_InvalidCredentials() {
	suite.router.POST("/auth/login", suite.handler.Login)

	req := models.UserLoginRequest{
		EmailOrUsername: "test@example.com",
		Password:        "wrongpassword",
		RememberMe:      false,
	}

	user := suite.createTestUser()
	// Set password hash that won't match
	user.PasswordHash = "$2a$10$differenthash"

	// Mock expectations
	suite.userService.On("GetUserByEmailOrUsername", mock.Anything, req.EmailOrUsername).
		Return(user, nil)
	suite.userService.On("IncrementFailedLogin", mock.Anything, user.ID).Return(nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/login", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid credentials", resp["error"])
}

func (suite *AuthHandlerTestSuite) TestLogin_AccountLocked() {
	suite.router.POST("/auth/login", suite.handler.Login)

	req := models.UserLoginRequest{
		EmailOrUsername: "test@example.com",
		Password:        "password123",
		RememberMe:      false,
	}

	user := suite.createTestUser()
	user.LockedUntil = sql.NullTime{
		Time:  time.Now().Add(30 * time.Minute),
		Valid: true,
	}

	// Mock expectations
	suite.userService.On("GetUserByEmailOrUsername", mock.Anything, req.EmailOrUsername).
		Return(user, nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/login", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusForbidden, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Account is locked due to too many failed login attempts", resp["error"])
	assert.NotEmpty(suite.T(), resp["locked_until"])
}

func (suite *AuthHandlerTestSuite) TestLogin_InactiveAccount() {
	suite.router.POST("/auth/login", suite.handler.Login)

	req := models.UserLoginRequest{
		EmailOrUsername: "test@example.com",
		Password:        "password123",
		RememberMe:      false,
	}

	user := suite.createTestUser()
	user.IsActive = false

	// Mock expectations
	suite.userService.On("GetUserByEmailOrUsername", mock.Anything, req.EmailOrUsername).
		Return(user, nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/login", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusForbidden, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Account is not active", resp["error"])
}

func (suite *AuthHandlerTestSuite) TestLogin_RememberMe() {
	suite.router.POST("/auth/login", suite.handler.Login)

	req := models.UserLoginRequest{
		EmailOrUsername: "test@example.com",
		Password:        "password123",
		RememberMe:      true,
	}

	user := suite.createTestUser()
	// Set password hash for valid password
	user.PasswordHash = "$2a$10$9Y0cXMdgpPMj2YqQdNIoFuEJfBVP.60g9V7HvJogFKnKMKdIKtHXq"

	// Mock expectations
	suite.userService.On("GetUserByEmailOrUsername", mock.Anything, req.EmailOrUsername).
		Return(user, nil)
	suite.userService.On("UpdateLastLoginAt", mock.Anything, user.ID).Return(nil)
	
	// Mock JWT manager calls
	config := auth.JWTConfig{AccessExpiry: 30 * 24 * time.Hour} // 30 days for remember me
	suite.jwtManager.On("GetConfig").Return(config)
	
	// Create a custom JWT manager mock for remember me
	customJWT := new(MockJWTManager)
	customJWT.On("GenerateTokenPair", user.ID, user.Email, user.Roles).
		Return("long-access-token", "long-refresh-token", nil)
	
	// Note: In the actual implementation, we'd need to mock the auth.NewJWTManager call
	// For this test, we'll simulate the behavior
	suite.jwtManager.On("GenerateTokenPair", user.ID, user.Email, user.Roles).
		Return("long-access-token", "long-refresh-token", nil)
	
	suite.cacheService.On("Key", []string{"refresh_token", user.ID, "long-refresh-token"[:16]}).
		Return("cache-key")
	suite.cacheService.On("StoreSession", mock.Anything, "cache-key", mock.Anything, 7*24*time.Hour).
		Return(nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/login", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp models.UserLoginResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), user.ID, resp.User.ID)
	assert.Equal(suite.T(), "long-access-token", resp.AccessToken)
	assert.Equal(suite.T(), "long-refresh-token", resp.RefreshToken)
	
	// Check for cookie
	cookies := rec.Result().Cookies()
	assert.NotEmpty(suite.T(), cookies)
	
	var accessTokenCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "access_token" {
			accessTokenCookie = cookie
			break
		}
	}
	assert.NotNil(suite.T(), accessTokenCookie)
	assert.Equal(suite.T(), "long-access-token", accessTokenCookie.Value)
	assert.True(suite.T(), accessTokenCookie.HttpOnly)
}

// Test Cases - Token Refresh

func (suite *AuthHandlerTestSuite) TestRefreshToken_Success() {
	suite.router.POST("/auth/refresh", suite.handler.RefreshToken)

	req := models.RefreshTokenRequest{
		RefreshToken: "valid-refresh-token",
	}

	user := suite.createTestUser()
	claims := &auth.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Roles:  user.Roles,
	}

	// Mock expectations
	suite.jwtManager.On("ValidateRefreshToken", req.RefreshToken).Return(claims, nil)
	suite.cacheService.On("Key", []string{"refresh_token", user.ID, req.RefreshToken[:16]}).
		Return("cache-key")
	suite.cacheService.On("GetSession", mock.Anything, "cache-key", mock.Anything).Return(nil)
	suite.userService.On("GetUserByID", mock.Anything, user.ID).Return(user, nil)
	suite.jwtManager.On("RefreshAccessToken", req.RefreshToken, user.Email, user.Roles).
		Return("new-access-token", nil)
	suite.jwtManager.On("GetConfig").Return(auth.JWTConfig{AccessExpiry: 15 * time.Minute})

	// Make request
	rec := suite.makeRequest("POST", "/auth/refresh", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp models.RefreshTokenResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "new-access-token", resp.AccessToken)
	assert.Equal(suite.T(), int64(900), resp.ExpiresIn) // 15 minutes
}

func (suite *AuthHandlerTestSuite) TestRefreshToken_InvalidToken() {
	suite.router.POST("/auth/refresh", suite.handler.RefreshToken)

	req := models.RefreshTokenRequest{
		RefreshToken: "invalid-refresh-token",
	}

	// Mock expectations
	suite.jwtManager.On("ValidateRefreshToken", req.RefreshToken).
		Return(nil, errors.New("invalid token"))

	// Make request
	rec := suite.makeRequest("POST", "/auth/refresh", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid refresh token", resp["error"])
}

func (suite *AuthHandlerTestSuite) TestRefreshToken_TokenNotInCache() {
	suite.router.POST("/auth/refresh", suite.handler.RefreshToken)

	req := models.RefreshTokenRequest{
		RefreshToken: "valid-refresh-token",
	}

	claims := &auth.Claims{
		UserID: "user-id",
		Email:  "test@example.com",
		Roles:  []string{"user"},
	}

	// Mock expectations
	suite.jwtManager.On("ValidateRefreshToken", req.RefreshToken).Return(claims, nil)
	suite.cacheService.On("Key", []string{"refresh_token", claims.UserID, req.RefreshToken[:16]}).
		Return("cache-key")
	suite.cacheService.On("GetSession", mock.Anything, "cache-key", mock.Anything).
		Return(errors.New("key not found"))

	// Make request
	rec := suite.makeRequest("POST", "/auth/refresh", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid refresh token", resp["error"])
}

// Test Cases - Logout

func (suite *AuthHandlerTestSuite) TestLogout_Success() {
	// Setup router with middleware that sets user context
	suite.router.POST("/auth/logout", func(c *gin.Context) {
		// Simulate authenticated user context
		c.Set("user_id", "test-user-id")
		suite.handler.Logout(c)
	})

	req := struct {
		RefreshToken string `json:"refresh_token"`
	}{
		RefreshToken: "refresh-token-to-invalidate",
	}

	// Mock expectations
	suite.cacheService.On("Key", []string{"refresh_token", "test-user-id", req.RefreshToken[:16]}).
		Return("cache-key")
	suite.cacheService.On("DeleteSession", mock.Anything, "cache-key").Return(nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/logout", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Logged out successfully", resp["message"])
	
	// Check cookie is cleared
	cookies := rec.Result().Cookies()
	var accessTokenCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "access_token" {
			accessTokenCookie = cookie
			break
		}
	}
	if accessTokenCookie != nil {
		assert.Equal(suite.T(), "", accessTokenCookie.Value)
		assert.Less(suite.T(), accessTokenCookie.MaxAge, 0)
	}
}

// Test Cases - Profile Operations

func (suite *AuthHandlerTestSuite) TestGetProfile_Success() {
	// Setup router with middleware that sets user context
	suite.router.GET("/auth/profile", func(c *gin.Context) {
		// Simulate authenticated user context
		c.Set("user_id", "test-user-id")
		suite.handler.GetProfile(c)
	})

	user := suite.createTestUser()

	// Mock expectations
	suite.userService.On("GetUserByID", mock.Anything, "test-user-id").Return(user, nil)

	// Make request
	rec := suite.makeRequest("GET", "/auth/profile", nil)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp models.User
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), user.ID, resp.ID)
	assert.Equal(suite.T(), user.Email, resp.Email)
}

func (suite *AuthHandlerTestSuite) TestGetProfile_Unauthorized() {
	// Setup router without user context
	suite.router.GET("/auth/profile", suite.handler.GetProfile)

	// Make request
	rec := suite.makeRequest("GET", "/auth/profile", nil)

	// Assertions
	assert.Equal(suite.T(), http.StatusUnauthorized, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Authentication required", resp["error"])
}

func (suite *AuthHandlerTestSuite) TestUpdateProfile_Success() {
	// Setup router with middleware that sets user context
	suite.router.PUT("/auth/profile", func(c *gin.Context) {
		// Simulate authenticated user context
		c.Set("user_id", "test-user-id")
		suite.handler.UpdateProfile(c)
	})

	req := models.UserUpdateRequest{
		FirstName: strPtr("Updated"),
		LastName:  strPtr("Name"),
	}

	updatedUser := suite.createTestUser()
	updatedUser.FirstName = sql.NullString{String: "Updated", Valid: true}
	updatedUser.LastName = sql.NullString{String: "Name", Valid: true}

	// Mock expectations
	suite.userService.On("UpdateUser", mock.Anything, "test-user-id", req).
		Return(updatedUser, nil)

	// Make request
	rec := suite.makeRequest("PUT", "/auth/profile", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp models.User
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Updated", resp.FirstName.String)
	assert.Equal(suite.T(), "Name", resp.LastName.String)
}

func (suite *AuthHandlerTestSuite) TestChangePassword_Success() {
	// Setup router with middleware that sets user context
	suite.router.POST("/auth/change-password", func(c *gin.Context) {
		// Simulate authenticated user context
		c.Set("user_id", "test-user-id")
		suite.handler.ChangePassword(c)
	})

	req := models.PasswordChangeRequest{
		CurrentPassword: "oldpassword123",
		NewPassword:     "newpassword123",
		ConfirmPassword: "newpassword123",
	}

	// Mock expectations
	suite.userService.On("ChangePassword", mock.Anything, "test-user-id", 
		req.CurrentPassword, req.NewPassword).Return(nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/change-password", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Password changed successfully", resp["message"])
}

func (suite *AuthHandlerTestSuite) TestChangePassword_Mismatch() {
	// Setup router with middleware that sets user context
	suite.router.POST("/auth/change-password", func(c *gin.Context) {
		// Simulate authenticated user context
		c.Set("user_id", "test-user-id")
		suite.handler.ChangePassword(c)
	})

	req := models.PasswordChangeRequest{
		CurrentPassword: "oldpassword123",
		NewPassword:     "newpassword123",
		ConfirmPassword: "differentpassword123",
	}

	// Make request
	rec := suite.makeRequest("POST", "/auth/change-password", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Passwords do not match", resp["error"])
}

func (suite *AuthHandlerTestSuite) TestChangePassword_IncorrectCurrent() {
	// Setup router with middleware that sets user context
	suite.router.POST("/auth/change-password", func(c *gin.Context) {
		// Simulate authenticated user context
		c.Set("user_id", "test-user-id")
		suite.handler.ChangePassword(c)
	})

	req := models.PasswordChangeRequest{
		CurrentPassword: "wrongpassword",
		NewPassword:     "newpassword123",
		ConfirmPassword: "newpassword123",
	}

	// Mock expectations
	suite.userService.On("ChangePassword", mock.Anything, "test-user-id", 
		req.CurrentPassword, req.NewPassword).
		Return(errors.New("current password is incorrect"))

	// Make request
	rec := suite.makeRequest("POST", "/auth/change-password", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "current password is incorrect", resp["error"])
}

// Test Cases - Email Verification

func (suite *AuthHandlerTestSuite) TestVerifyEmail_Success() {
	suite.router.POST("/auth/verify-email", suite.handler.VerifyEmail)

	req := models.EmailVerificationRequest{
		Token: "valid-verification-token",
	}

	// Mock expectations
	suite.userService.On("VerifyEmail", mock.Anything, req.Token).Return(nil)

	// Make request
	rec := suite.makeRequest("POST", "/auth/verify-email", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Email verified successfully", resp["message"])
}

func (suite *AuthHandlerTestSuite) TestVerifyEmail_InvalidToken() {
	suite.router.POST("/auth/verify-email", suite.handler.VerifyEmail)

	req := models.EmailVerificationRequest{
		Token: "invalid-token",
	}

	// Mock expectations
	suite.userService.On("VerifyEmail", mock.Anything, req.Token).
		Return(errors.New("invalid or expired verification token"))

	// Make request
	rec := suite.makeRequest("POST", "/auth/verify-email", req)

	// Assertions
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "invalid or expired verification token", resp["error"])
}

// Test Runner

func TestAuthHandlerTestSuite(t *testing.T) {
	suite.Run(t, new(AuthHandlerTestSuite))
}

// Helper function
func strPtr(s string) *string {
	return &s
}