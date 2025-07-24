package auth_test

import (
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/auth"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type JWTTestSuite struct {
	suite.Suite
	jwtManager *auth.JWTManager
	config     auth.JWTConfig
}

func (suite *JWTTestSuite) SetupTest() {
	suite.config = auth.JWTConfig{
		SecretKey:        "test-secret-key-12345678901234567890",
		RefreshSecretKey: "test-refresh-secret-key-12345678901234567890",
		AccessExpiry:     15 * time.Minute,
		RefreshExpiry:    7 * 24 * time.Hour,
		Issuer:           "test-issuer",
	}
	suite.jwtManager = auth.NewJWTManager(suite.config)
}

// Test Cases - JWT Manager Creation

func (suite *JWTTestSuite) TestNewJWTManager_WithConfig() {
	manager := auth.NewJWTManager(suite.config)
	assert.NotNil(suite.T(), manager)
	
	// Check that config is stored properly
	storedConfig := manager.GetConfig()
	assert.Equal(suite.T(), suite.config.SecretKey, storedConfig.SecretKey)
	assert.Equal(suite.T(), suite.config.RefreshSecretKey, storedConfig.RefreshSecretKey)
	assert.Equal(suite.T(), suite.config.AccessExpiry, storedConfig.AccessExpiry)
	assert.Equal(suite.T(), suite.config.RefreshExpiry, storedConfig.RefreshExpiry)
	assert.Equal(suite.T(), suite.config.Issuer, storedConfig.Issuer)
}

func (suite *JWTTestSuite) TestNewJWTManager_WithEmptyKeys() {
	// Create manager with empty keys
	emptyConfig := auth.JWTConfig{
		SecretKey:        "",
		RefreshSecretKey: "",
		Issuer:           "test-issuer",
	}
	
	manager := auth.NewJWTManager(emptyConfig)
	assert.NotNil(suite.T(), manager)
	
	// Should generate random keys
	storedConfig := manager.GetConfig()
	assert.NotEmpty(suite.T(), storedConfig.SecretKey)
	assert.NotEmpty(suite.T(), storedConfig.RefreshSecretKey)
	assert.NotEqual(suite.T(), storedConfig.SecretKey, storedConfig.RefreshSecretKey)
}

func (suite *JWTTestSuite) TestNewJWTManager_WithDefaultExpiry() {
	// Create manager with zero expiry times
	config := auth.JWTConfig{
		SecretKey:        "test-key",
		RefreshSecretKey: "test-refresh-key",
		AccessExpiry:     0,
		RefreshExpiry:    0,
		Issuer:           "test-issuer",
	}
	
	manager := auth.NewJWTManager(config)
	assert.NotNil(suite.T(), manager)
	
	// Should set default expiry times
	storedConfig := manager.GetConfig()
	assert.Equal(suite.T(), 15*time.Minute, storedConfig.AccessExpiry)
	assert.Equal(suite.T(), 7*24*time.Hour, storedConfig.RefreshExpiry)
}

// Test Cases - Token Generation

func (suite *JWTTestSuite) TestGenerateTokenPair_Success() {
	userID := "user-123"
	email := "test@example.com"
	roles := []string{"user", "admin"}
	
	accessToken, refreshToken, err := suite.jwtManager.GenerateTokenPair(userID, email, roles)
	
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), accessToken)
	assert.NotEmpty(suite.T(), refreshToken)
	assert.NotEqual(suite.T(), accessToken, refreshToken)
}

func (suite *JWTTestSuite) TestGenerateAccessToken_Success() {
	userID := "user-456"
	email := "user@example.com"
	roles := []string{"user"}
	
	token, err := suite.jwtManager.GenerateAccessToken(userID, email, roles)
	
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), token)
	
	// Parse and verify token structure
	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		return []byte(suite.config.SecretKey), nil
	})
	
	require.NoError(suite.T(), err)
	assert.True(suite.T(), parsedToken.Valid)
}

func (suite *JWTTestSuite) TestGenerateRefreshToken_Success() {
	userID := "user-789"
	
	token, err := suite.jwtManager.GenerateRefreshToken(userID)
	
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), token)
	
	// Parse and verify token structure
	parsedToken, err := jwt.Parse(token, func(token *jwt.Token) (interface{}, error) {
		return []byte(suite.config.RefreshSecretKey), nil
	})
	
	require.NoError(suite.T(), err)
	assert.True(suite.T(), parsedToken.Valid)
}

// Test Cases - Token Validation

func (suite *JWTTestSuite) TestValidateAccessToken_ValidToken() {
	// Generate a valid token
	userID := "user-123"
	email := "test@example.com"
	roles := []string{"user", "admin"}
	
	token, err := suite.jwtManager.GenerateAccessToken(userID, email, roles)
	require.NoError(suite.T(), err)
	
	// Validate the token
	claims, err := suite.jwtManager.ValidateAccessToken(token)
	
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), claims)
	assert.Equal(suite.T(), userID, claims.UserID)
	assert.Equal(suite.T(), email, claims.Email)
	assert.Equal(suite.T(), roles, claims.Roles)
	assert.Equal(suite.T(), suite.config.Issuer, claims.Issuer)
}

func (suite *JWTTestSuite) TestValidateAccessToken_ExpiredToken() {
	// Create manager with very short expiry
	shortConfig := auth.JWTConfig{
		SecretKey:        "test-key",
		RefreshSecretKey: "test-refresh-key",
		AccessExpiry:     1 * time.Nanosecond,
		RefreshExpiry:    7 * 24 * time.Hour,
		Issuer:           "test-issuer",
	}
	shortManager := auth.NewJWTManager(shortConfig)
	
	// Generate token
	token, err := shortManager.GenerateAccessToken("user-123", "test@example.com", []string{"user"})
	require.NoError(suite.T(), err)
	
	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)
	
	// Validate should fail
	claims, err := shortManager.ValidateAccessToken(token)
	
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), claims)
	assert.Contains(suite.T(), err.Error(), "token is expired")
}

func (suite *JWTTestSuite) TestValidateAccessToken_InvalidToken() {
	// Try to validate an invalid token
	invalidToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"
	
	claims, err := suite.jwtManager.ValidateAccessToken(invalidToken)
	
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), claims)
}

func (suite *JWTTestSuite) TestValidateAccessToken_WrongSecret() {
	// Generate token with one manager
	token, err := suite.jwtManager.GenerateAccessToken("user-123", "test@example.com", []string{"user"})
	require.NoError(suite.T(), err)
	
	// Try to validate with different secret
	differentConfig := auth.JWTConfig{
		SecretKey:        "different-secret-key",
		RefreshSecretKey: "different-refresh-key",
		AccessExpiry:     15 * time.Minute,
		RefreshExpiry:    7 * 24 * time.Hour,
		Issuer:           "test-issuer",
	}
	differentManager := auth.NewJWTManager(differentConfig)
	
	claims, err := differentManager.ValidateAccessToken(token)
	
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), claims)
}

func (suite *JWTTestSuite) TestValidateAccessToken_WrongAlgorithm() {
	// Create a token with a different algorithm (simulated)
	token := jwt.NewWithClaims(jwt.SigningMethodNone, &auth.Claims{
		UserID: "user-123",
		Email:  "test@example.com",
		Roles:  []string{"user"},
	})
	tokenString, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(suite.T(), err)
	
	// Validation should fail due to unexpected signing method
	claims, err := suite.jwtManager.ValidateAccessToken(tokenString)
	
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), claims)
	assert.Contains(suite.T(), err.Error(), "unexpected signing method")
}

// Test Cases - Refresh Token Validation

func (suite *JWTTestSuite) TestValidateRefreshToken_ValidToken() {
	// Generate a valid refresh token
	userID := "user-123"
	
	token, err := suite.jwtManager.GenerateRefreshToken(userID)
	require.NoError(suite.T(), err)
	
	// Validate the token
	claims, err := suite.jwtManager.ValidateRefreshToken(token)
	
	require.NoError(suite.T(), err)
	assert.NotNil(suite.T(), claims)
	assert.Equal(suite.T(), userID, claims.UserID)
	assert.Equal(suite.T(), suite.config.Issuer, claims.Issuer)
}

func (suite *JWTTestSuite) TestValidateRefreshToken_InvalidToken() {
	// Try to validate an invalid token
	invalidToken := "invalid.refresh.token"
	
	claims, err := suite.jwtManager.ValidateRefreshToken(invalidToken)
	
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), claims)
}

func (suite *JWTTestSuite) TestValidateRefreshToken_AccessTokenUsedAsRefresh() {
	// Generate an access token
	accessToken, err := suite.jwtManager.GenerateAccessToken("user-123", "test@example.com", []string{"user"})
	require.NoError(suite.T(), err)
	
	// Try to validate it as a refresh token (should fail due to different secret)
	claims, err := suite.jwtManager.ValidateRefreshToken(accessToken)
	
	assert.Error(suite.T(), err)
	assert.Nil(suite.T(), claims)
}

// Test Cases - Refresh Access Token

func (suite *JWTTestSuite) TestRefreshAccessToken_Success() {
	userID := "user-123"
	email := "test@example.com"
	roles := []string{"user", "admin"}
	
	// Generate initial tokens
	_, refreshToken, err := suite.jwtManager.GenerateTokenPair(userID, email, roles)
	require.NoError(suite.T(), err)
	
	// Refresh the access token
	newAccessToken, err := suite.jwtManager.RefreshAccessToken(refreshToken, email, roles)
	
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), newAccessToken)
	
	// Validate the new access token
	claims, err := suite.jwtManager.ValidateAccessToken(newAccessToken)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), userID, claims.UserID)
	assert.Equal(suite.T(), email, claims.Email)
	assert.Equal(suite.T(), roles, claims.Roles)
}

func (suite *JWTTestSuite) TestRefreshAccessToken_InvalidRefreshToken() {
	// Try to refresh with invalid token
	newAccessToken, err := suite.jwtManager.RefreshAccessToken("invalid.refresh.token", "test@example.com", []string{"user"})
	
	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), newAccessToken)
	assert.Contains(suite.T(), err.Error(), "invalid refresh token")
}

func (suite *JWTTestSuite) TestRefreshAccessToken_ExpiredRefreshToken() {
	// Create manager with very short refresh expiry
	shortConfig := auth.JWTConfig{
		SecretKey:        "test-key",
		RefreshSecretKey: "test-refresh-key",
		AccessExpiry:     15 * time.Minute,
		RefreshExpiry:    1 * time.Nanosecond,
		Issuer:           "test-issuer",
	}
	shortManager := auth.NewJWTManager(shortConfig)
	
	// Generate refresh token
	refreshToken, err := shortManager.GenerateRefreshToken("user-123")
	require.NoError(suite.T(), err)
	
	// Wait for token to expire
	time.Sleep(10 * time.Millisecond)
	
	// Try to refresh
	newAccessToken, err := shortManager.RefreshAccessToken(refreshToken, "test@example.com", []string{"user"})
	
	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), newAccessToken)
	assert.Contains(suite.T(), err.Error(), "invalid refresh token")
}

// Test Cases - Extract Token From Header

func (suite *JWTTestSuite) TestExtractTokenFromHeader_ValidBearer() {
	header := "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token"
	
	token, err := auth.ExtractTokenFromHeader(header)
	
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token", token)
}

func (suite *JWTTestSuite) TestExtractTokenFromHeader_EmptyHeader() {
	header := ""
	
	token, err := auth.ExtractTokenFromHeader(header)
	
	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), token)
	assert.Equal(suite.T(), "authorization header missing", err.Error())
}

func (suite *JWTTestSuite) TestExtractTokenFromHeader_InvalidFormat() {
	// Missing "Bearer " prefix
	header := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token"
	
	token, err := auth.ExtractTokenFromHeader(header)
	
	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), token)
	assert.Equal(suite.T(), "invalid authorization header format", err.Error())
}

func (suite *JWTTestSuite) TestExtractTokenFromHeader_WrongScheme() {
	// Using "Basic" instead of "Bearer"
	header := "Basic eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token"
	
	token, err := auth.ExtractTokenFromHeader(header)
	
	assert.Error(suite.T(), err)
	assert.Empty(suite.T(), token)
	assert.Equal(suite.T(), "invalid authorization header format", err.Error())
}

func (suite *JWTTestSuite) TestExtractTokenFromHeader_OnlyBearer() {
	// Only "Bearer" without token
	header := "Bearer "
	
	token, err := auth.ExtractTokenFromHeader(header)
	
	require.NoError(suite.T(), err)
	assert.Empty(suite.T(), token)
}

// Test Cases - Claims Structure

func (suite *JWTTestSuite) TestClaims_Structure() {
	userID := "user-123"
	email := "test@example.com"
	roles := []string{"user", "admin", "developer"}
	
	token, err := suite.jwtManager.GenerateAccessToken(userID, email, roles)
	require.NoError(suite.T(), err)
	
	claims, err := suite.jwtManager.ValidateAccessToken(token)
	require.NoError(suite.T(), err)
	
	// Check all claim fields
	assert.Equal(suite.T(), userID, claims.UserID)
	assert.Equal(suite.T(), email, claims.Email)
	assert.Equal(suite.T(), roles, claims.Roles)
	assert.Equal(suite.T(), suite.config.Issuer, claims.Issuer)
	assert.Equal(suite.T(), userID, claims.Subject)
	
	// Check time claims
	assert.WithinDuration(suite.T(), time.Now(), claims.IssuedAt.Time, 5*time.Second)
	assert.WithinDuration(suite.T(), time.Now(), claims.NotBefore.Time, 5*time.Second)
	assert.WithinDuration(suite.T(), time.Now().Add(suite.config.AccessExpiry), claims.ExpiresAt.Time, 5*time.Second)
}

func (suite *JWTTestSuite) TestRefreshClaims_Structure() {
	userID := "user-456"
	
	token, err := suite.jwtManager.GenerateRefreshToken(userID)
	require.NoError(suite.T(), err)
	
	claims, err := suite.jwtManager.ValidateRefreshToken(token)
	require.NoError(suite.T(), err)
	
	// Check all claim fields
	assert.Equal(suite.T(), userID, claims.UserID)
	assert.Equal(suite.T(), suite.config.Issuer, claims.Issuer)
	assert.Equal(suite.T(), userID, claims.Subject)
	
	// Check time claims
	assert.WithinDuration(suite.T(), time.Now(), claims.IssuedAt.Time, 5*time.Second)
	assert.WithinDuration(suite.T(), time.Now(), claims.NotBefore.Time, 5*time.Second)
	assert.WithinDuration(suite.T(), time.Now().Add(suite.config.RefreshExpiry), claims.ExpiresAt.Time, 5*time.Second)
}

// Test Cases - Edge Cases

func (suite *JWTTestSuite) TestGenerateTokens_EmptyRoles() {
	userID := "user-123"
	email := "test@example.com"
	var emptyRoles []string
	
	accessToken, refreshToken, err := suite.jwtManager.GenerateTokenPair(userID, email, emptyRoles)
	
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), accessToken)
	assert.NotEmpty(suite.T(), refreshToken)
	
	// Validate and check empty roles
	claims, err := suite.jwtManager.ValidateAccessToken(accessToken)
	require.NoError(suite.T(), err)
	assert.Empty(suite.T(), claims.Roles)
}

func (suite *JWTTestSuite) TestGenerateTokens_SpecialCharacters() {
	userID := "user-123!@#$%^&*()"
	email := "test+special@example.com"
	roles := []string{"user/admin", "test:role"}
	
	accessToken, refreshToken, err := suite.jwtManager.GenerateTokenPair(userID, email, roles)
	
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), accessToken)
	assert.NotEmpty(suite.T(), refreshToken)
	
	// Validate and check special characters are preserved
	claims, err := suite.jwtManager.ValidateAccessToken(accessToken)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), userID, claims.UserID)
	assert.Equal(suite.T(), email, claims.Email)
	assert.Equal(suite.T(), roles, claims.Roles)
}

func (suite *JWTTestSuite) TestGenerateTokens_LongData() {
	// Test with very long user ID and many roles
	userID := "user-" + string(make([]byte, 1000))
	email := "verylongemailaddress@verylongdomainname.com"
	roles := make([]string, 100)
	for i := range roles {
		roles[i] = "role" + string(rune(i))
	}
	
	accessToken, refreshToken, err := suite.jwtManager.GenerateTokenPair(userID, email, roles)
	
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), accessToken)
	assert.NotEmpty(suite.T(), refreshToken)
	
	// Tokens will be long but should still be valid
	claims, err := suite.jwtManager.ValidateAccessToken(accessToken)
	require.NoError(suite.T(), err)
	assert.Equal(suite.T(), userID, claims.UserID)
	assert.Len(suite.T(), claims.Roles, 100)
}

// Test Runner
func TestJWTTestSuite(t *testing.T) {
	suite.Run(t, new(JWTTestSuite))
}