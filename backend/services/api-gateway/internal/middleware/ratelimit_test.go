package middleware_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/middleware"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// Mock CacheService
type MockCacheService struct {
	mock.Mock
}

func (m *MockCacheService) RateLimitCheck(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	args := m.Called(ctx, key, limit, window)
	return args.Bool(0), args.Int(1), args.Error(2)
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

func (m *MockCacheService) CacheEnhancedPrompt(ctx context.Context, hash string, techniques []string, response *handlers.EnhanceResponse, ttl time.Duration) error {
	args := m.Called(ctx, hash, techniques, response, ttl)
	return args.Error(0)
}

func (m *MockCacheService) GetCachedEnhancedPrompt(ctx context.Context, hash string, techniques []string) (*handlers.EnhanceResponse, error) {
	args := m.Called(ctx, hash, techniques)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*handlers.EnhanceResponse), args.Error(1)
}

func (m *MockCacheService) CacheIntentClassification(ctx context.Context, hash string, result *services.IntentClassificationResult, ttl time.Duration) error {
	args := m.Called(ctx, hash, result, ttl)
	return args.Error(0)
}

func (m *MockCacheService) GetCachedIntentClassification(ctx context.Context, hash string) (*services.IntentClassificationResult, error) {
	args := m.Called(ctx, hash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*services.IntentClassificationResult), args.Error(1)
}

// Test Suite
type RateLimitMiddlewareTestSuite struct {
	suite.Suite
	router       *gin.Engine
	cacheService *MockCacheService
	logger       *logrus.Logger
}

func (suite *RateLimitMiddlewareTestSuite) SetupTest() {
	gin.SetMode(gin.TestMode)
	
	// Create mocks
	suite.cacheService = new(MockCacheService)
	suite.logger = logrus.New()
	suite.logger.Out = nil // Disable logging during tests
	
	// Setup router
	suite.router = gin.New()
}

func (suite *RateLimitMiddlewareTestSuite) TearDownTest() {
	suite.cacheService.AssertExpectations(suite.T())
}

// Helper functions
func (suite *RateLimitMiddlewareTestSuite) makeRequest(method, path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	return rec
}

// Test Cases - Basic Rate Limiting

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_AllowRequest() {
	config := middleware.DefaultRateLimitConfig()
	
	// Setup route
	suite.router.GET("/api/test", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - request should be allowed
	suite.cacheService.On("RateLimitCheck", mock.Anything, "ip:127.0.0.1", 100, 1*time.Minute).
		Return(true, 99, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	// Check rate limit headers
	assert.Equal(suite.T(), "100", rec.Header().Get("X-RateLimit-Limit"))
	assert.Equal(suite.T(), "99", rec.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(suite.T(), rec.Header().Get("X-RateLimit-Reset"))
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_BlockRequest() {
	config := middleware.DefaultRateLimitConfig()
	
	// Setup route
	suite.router.GET("/api/test", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - request should be blocked
	suite.cacheService.On("RateLimitCheck", mock.Anything, "ip:127.0.0.1", 100, 1*time.Minute).
		Return(false, 0, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusTooManyRequests, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Rate limit exceeded", resp["error"])
	assert.Contains(suite.T(), resp["message"], "Too many requests")
	assert.Equal(suite.T(), float64(60), resp["retry_after"])
	
	// Check headers
	assert.Equal(suite.T(), "0", rec.Header().Get("X-RateLimit-Remaining"))
	assert.Equal(suite.T(), "60", rec.Header().Get("Retry-After"))
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_AuthenticatedUser() {
	config := middleware.DefaultRateLimitConfig()
	
	// Setup route with user context
	suite.router.GET("/api/test", 
		func(c *gin.Context) {
			// Simulate authenticated user
			c.Set("user_id", "user-123")
			c.Next()
		},
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - should use user ID for rate limiting
	suite.cacheService.On("RateLimitCheck", mock.Anything, "user:user-123", 100, 1*time.Minute).
		Return(true, 50, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	assert.Equal(suite.T(), "50", rec.Header().Get("X-RateLimit-Remaining"))
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_SkipHealthCheck() {
	config := middleware.DefaultRateLimitConfig()
	
	// Setup routes
	suite.router.GET("/health", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "healthy"})
		})
	
	suite.router.GET("/ready", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ready"})
		})
	
	// No cache service calls expected for health checks
	
	// Make requests
	rec1 := suite.makeRequest("GET", "/health", map[string]string{})
	rec2 := suite.makeRequest("GET", "/ready", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec1.Code)
	assert.Equal(suite.T(), http.StatusOK, rec2.Code)
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_CustomKeyFunc() {
	config := middleware.RateLimitConfig{
		Limit:  50,
		Window: 1 * time.Minute,
		KeyFunc: func(c *gin.Context) string {
			// Custom key based on API key header
			apiKey := c.GetHeader("X-API-Key")
			if apiKey != "" {
				return fmt.Sprintf("api:%s", apiKey)
			}
			return ""
		},
	}
	
	// Setup route
	suite.router.GET("/api/test", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations
	suite.cacheService.On("RateLimitCheck", mock.Anything, "api:test-key-123", 50, 1*time.Minute).
		Return(true, 25, nil)
	
	// Make request with API key
	rec := suite.makeRequest("GET", "/api/test", map[string]string{
		"X-API-Key": "test-key-123",
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	assert.Equal(suite.T(), "50", rec.Header().Get("X-RateLimit-Limit"))
	assert.Equal(suite.T(), "25", rec.Header().Get("X-RateLimit-Remaining"))
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_EmptyKey() {
	config := middleware.RateLimitConfig{
		Limit:  50,
		Window: 1 * time.Minute,
		KeyFunc: func(c *gin.Context) string {
			// Return empty key
			return ""
		},
	}
	
	// Setup route
	suite.router.GET("/api/test", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// No cache service calls expected when key is empty
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions - request should be allowed when key is empty
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_CacheError() {
	config := middleware.DefaultRateLimitConfig()
	
	// Setup route
	suite.router.GET("/api/test", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - cache service returns error
	suite.cacheService.On("RateLimitCheck", mock.Anything, "ip:127.0.0.1", 100, 1*time.Minute).
		Return(false, 0, fmt.Errorf("cache connection failed"))
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions - request should be allowed on error
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_NilCache() {
	config := middleware.DefaultRateLimitConfig()
	
	// Setup route with nil cache
	suite.router.GET("/api/test", 
		middleware.RateLimitMiddleware(nil, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions - request should be allowed when cache is nil
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_CustomOnLimitHit() {
	hitCallbackCalled := false
	config := middleware.RateLimitConfig{
		Limit:  10,
		Window: 1 * time.Minute,
		KeyFunc: func(c *gin.Context) string {
			return fmt.Sprintf("ip:%s", c.ClientIP())
		},
		OnLimitHit: func(c *gin.Context, remaining int) {
			hitCallbackCalled = true
			c.Header("X-Custom-Header", "rate-limit-hit")
		},
	}
	
	// Setup route
	suite.router.GET("/api/test", 
		middleware.RateLimitMiddleware(suite.cacheService, config, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - request should be blocked
	suite.cacheService.On("RateLimitCheck", mock.Anything, "ip:127.0.0.1", 10, 1*time.Minute).
		Return(false, 0, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusTooManyRequests, rec.Code)
	assert.True(suite.T(), hitCallbackCalled)
	assert.Equal(suite.T(), "rate-limit-hit", rec.Header().Get("X-Custom-Header"))
}

// Test Cases - Specialized Rate Limiters

func (suite *RateLimitMiddlewareTestSuite) TestUserRateLimitMiddleware() {
	// Setup route
	suite.router.GET("/api/test", 
		func(c *gin.Context) {
			// Simulate authenticated user
			c.Set("user_id", "user-456")
			c.Next()
		},
		middleware.UserRateLimitMiddleware(suite.cacheService, 50, 1*time.Minute, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations
	suite.cacheService.On("RateLimitCheck", mock.Anything, "user_rate:user-456", 50, 1*time.Minute).
		Return(true, 45, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	assert.Equal(suite.T(), "50", rec.Header().Get("X-RateLimit-Limit"))
	assert.Equal(suite.T(), "45", rec.Header().Get("X-RateLimit-Remaining"))
}

func (suite *RateLimitMiddlewareTestSuite) TestUserRateLimitMiddleware_UnauthenticatedSkipped() {
	// Setup route without authentication
	suite.router.GET("/api/test", 
		middleware.UserRateLimitMiddleware(suite.cacheService, 50, 1*time.Minute, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// No cache service calls expected for unauthenticated users
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions - request should be allowed
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
}

func (suite *RateLimitMiddlewareTestSuite) TestIPRateLimitMiddleware() {
	// Setup route
	suite.router.GET("/api/test", 
		middleware.IPRateLimitMiddleware(suite.cacheService, 100, 1*time.Minute, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations
	suite.cacheService.On("RateLimitCheck", mock.Anything, "ip_rate:127.0.0.1", 100, 1*time.Minute).
		Return(true, 80, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	assert.Equal(suite.T(), "100", rec.Header().Get("X-RateLimit-Limit"))
	assert.Equal(suite.T(), "80", rec.Header().Get("X-RateLimit-Remaining"))
}

func (suite *RateLimitMiddlewareTestSuite) TestEndpointRateLimitMiddleware_Authenticated() {
	// Setup route
	suite.router.GET("/api/enhance", 
		func(c *gin.Context) {
			// Simulate authenticated user
			c.Set("user_id", "user-789")
			c.Next()
		},
		middleware.EndpointRateLimitMiddleware(suite.cacheService, "enhance", 20, 1*time.Minute, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - should use user ID
	suite.cacheService.On("RateLimitCheck", mock.Anything, "endpoint:enhance:user:user-789", 20, 1*time.Minute).
		Return(true, 15, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/enhance", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	assert.Equal(suite.T(), "20", rec.Header().Get("X-RateLimit-Limit"))
	assert.Equal(suite.T(), "15", rec.Header().Get("X-RateLimit-Remaining"))
}

func (suite *RateLimitMiddlewareTestSuite) TestEndpointRateLimitMiddleware_Unauthenticated() {
	// Setup route
	suite.router.GET("/api/enhance", 
		middleware.EndpointRateLimitMiddleware(suite.cacheService, "enhance", 20, 1*time.Minute, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - should use IP
	suite.cacheService.On("RateLimitCheck", mock.Anything, "endpoint:enhance:ip:127.0.0.1", 20, 1*time.Minute).
		Return(true, 10, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/enhance", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	assert.Equal(suite.T(), "20", rec.Header().Get("X-RateLimit-Limit"))
	assert.Equal(suite.T(), "10", rec.Header().Get("X-RateLimit-Remaining"))
}

// Test Cases - Edge Cases

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_MultipleMiddlewares() {
	// Setup route with multiple rate limiters
	suite.router.GET("/api/test", 
		middleware.IPRateLimitMiddleware(suite.cacheService, 1000, 1*time.Hour, suite.logger),
		middleware.EndpointRateLimitMiddleware(suite.cacheService, "test", 100, 1*time.Minute, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - both should be checked
	suite.cacheService.On("RateLimitCheck", mock.Anything, "ip_rate:127.0.0.1", 1000, 1*time.Hour).
		Return(true, 500, nil)
	suite.cacheService.On("RateLimitCheck", mock.Anything, "endpoint:test:ip:127.0.0.1", 100, 1*time.Minute).
		Return(true, 50, nil)
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	// The last middleware's headers will be set
	assert.Equal(suite.T(), "100", rec.Header().Get("X-RateLimit-Limit"))
	assert.Equal(suite.T(), "50", rec.Header().Get("X-RateLimit-Remaining"))
}

func (suite *RateLimitMiddlewareTestSuite) TestRateLimitMiddleware_FirstBlocksSecond() {
	// Setup route with multiple rate limiters
	suite.router.GET("/api/test", 
		middleware.IPRateLimitMiddleware(suite.cacheService, 10, 1*time.Minute, suite.logger),
		middleware.EndpointRateLimitMiddleware(suite.cacheService, "test", 100, 1*time.Minute, suite.logger),
		func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "success"})
		})
	
	// Mock expectations - first one blocks
	suite.cacheService.On("RateLimitCheck", mock.Anything, "ip_rate:127.0.0.1", 10, 1*time.Minute).
		Return(false, 0, nil)
	// Second middleware should not be called
	
	// Make request
	rec := suite.makeRequest("GET", "/api/test", map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusTooManyRequests, rec.Code)
}

// Test Runner
func TestRateLimitMiddlewareTestSuite(t *testing.T) {
	suite.Run(t, new(RateLimitMiddlewareTestSuite))
}