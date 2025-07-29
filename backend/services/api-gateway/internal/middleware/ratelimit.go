package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// RateLimitConfig defines rate limiting configuration
type RateLimitConfig struct {
	Limit      int           // Maximum number of requests
	Window     time.Duration // Time window for the limit
	KeyFunc    func(*gin.Context) string // Function to extract rate limit key
	SkipFunc   func(*gin.Context) bool   // Function to determine if rate limiting should be skipped
	OnLimitHit func(*gin.Context, int)   // Callback when rate limit is hit
}

// DefaultRateLimitConfig returns a default rate limit configuration
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		Limit:  100,
		Window: 1 * time.Minute,
		KeyFunc: func(c *gin.Context) string {
			// Use user ID if authenticated, otherwise use IP
			if userID, exists := c.Get("user_id"); exists {
				return fmt.Sprintf("user:%v", userID)
			}
			return fmt.Sprintf("ip:%s", c.ClientIP())
		},
		SkipFunc: func(c *gin.Context) bool {
			// Skip rate limiting for health checks
			return c.Request.URL.Path == "/health" || c.Request.URL.Path == "/ready"
		},
		OnLimitHit: func(c *gin.Context, remaining int) {
			c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
			c.Header("Retry-After", "60")
		},
	}
}

// TestRateLimitConfig returns a rate limit configuration optimized for testing
func TestRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		Limit:  1000, // Match E2E test expectations  
		Window: 1 * time.Minute,
		KeyFunc: func(c *gin.Context) string {
			// Use user ID if authenticated, otherwise use IP
			if userID, exists := c.Get("user_id"); exists {
				return fmt.Sprintf("test_user:%v", userID)
			}
			return fmt.Sprintf("test_ip:%s", c.ClientIP())
		},
		SkipFunc: func(c *gin.Context) bool {
			// Skip rate limiting for health checks and test endpoints
			path := c.Request.URL.Path
			return path == "/health" || path == "/ready" || 
				   path == "/api/v1/health" || path == "/api/v1/auth/login"
		},
		OnLimitHit: func(c *gin.Context, remaining int) {
			c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
			c.Header("Retry-After", "60")
		},
	}
}

// GetRateLimitConfigForEnvironment returns appropriate rate limit config based on environment
func GetRateLimitConfigForEnvironment(env string) RateLimitConfig {
	switch env {
	case "test", "testing", "e2e":
		return TestRateLimitConfig()
	default:
		return DefaultRateLimitConfig()
	}
}

// RateLimitMiddleware creates a rate limiting middleware
func RateLimitMiddleware(cache *services.CacheService, config RateLimitConfig, logger *logrus.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip if configured
		if config.SkipFunc != nil && config.SkipFunc(c) {
			c.Next()
			return
		}

		// Skip if cache is not available
		if cache == nil {
			logger.Warn("Rate limiting disabled: cache not available")
			c.Next()
			return
		}

		// Get rate limit key
		key := config.KeyFunc(c)
		if key == "" {
			logger.Warn("Rate limiting skipped: empty key")
			c.Next()
			return
		}

		// Check rate limit
		allowed, remaining, err := cache.RateLimitCheck(c.Request.Context(), key, config.Limit, config.Window)
		if err != nil {
			logger.WithError(err).Error("Rate limit check failed")
			// Allow request on error
			c.Next()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", config.Limit))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(config.Window).Unix()))

		// Check if limit exceeded
		if !allowed {
			if config.OnLimitHit != nil {
				config.OnLimitHit(c, remaining)
			}

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
				"message": fmt.Sprintf("Too many requests. Please retry after %d seconds", int(config.Window.Seconds())),
				"retry_after": int(config.Window.Seconds()),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// UserRateLimitMiddleware creates a user-specific rate limiter
func UserRateLimitMiddleware(cache *services.CacheService, limit int, window time.Duration, logger *logrus.Logger) gin.HandlerFunc {
	config := RateLimitConfig{
		Limit:  limit,
		Window: window,
		KeyFunc: func(c *gin.Context) string {
			if userID, exists := c.Get("user_id"); exists {
				return fmt.Sprintf("user_rate:%v", userID)
			}
			return ""
		},
		SkipFunc: func(c *gin.Context) bool {
			// Only apply to authenticated users
			_, exists := c.Get("user_id")
			return !exists
		},
	}
	return RateLimitMiddleware(cache, config, logger)
}

// IPRateLimitMiddleware creates an IP-based rate limiter
func IPRateLimitMiddleware(cache *services.CacheService, limit int, window time.Duration, logger *logrus.Logger) gin.HandlerFunc {
	config := RateLimitConfig{
		Limit:  limit,
		Window: window,
		KeyFunc: func(c *gin.Context) string {
			return fmt.Sprintf("ip_rate:%s", c.ClientIP())
		},
	}
	return RateLimitMiddleware(cache, config, logger)
}

// EndpointRateLimitMiddleware creates an endpoint-specific rate limiter
func EndpointRateLimitMiddleware(cache *services.CacheService, endpoint string, limit int, window time.Duration, logger *logrus.Logger) gin.HandlerFunc {
	config := RateLimitConfig{
		Limit:  limit,
		Window: window,
		KeyFunc: func(c *gin.Context) string {
			key := fmt.Sprintf("endpoint:%s", endpoint)
			if userID, exists := c.Get("user_id"); exists {
				key = fmt.Sprintf("%s:user:%v", key, userID)
			} else {
				key = fmt.Sprintf("%s:ip:%s", key, c.ClientIP())
			}
			return key
		},
	}
	return RateLimitMiddleware(cache, config, logger)
}