package middleware

import (
	"html"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// SecurityHeaders adds security headers to responses
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")
		
		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")
		
		// Enable XSS protection
		c.Header("X-XSS-Protection", "1; mode=block")
		
		// HSTS - Force HTTPS
		if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}
		
		// Content Security Policy
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
			"font-src 'self' https://fonts.gstatic.com; " +
			"img-src 'self' data: https:; " +
			"connect-src 'self' https://api.betterprompts.ai; " +
			"frame-ancestors 'none'; " +
			"base-uri 'self'; " +
			"form-action 'self'"
		c.Header("Content-Security-Policy", csp)
		
		// Referrer Policy
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		
		// Permissions Policy (formerly Feature Policy)
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()")
		
		// Additional security headers
		c.Header("X-Permitted-Cross-Domain-Policies", "none")
		c.Header("X-Download-Options", "noopen")
		c.Header("X-DNS-Prefetch-Control", "off")
		
		c.Next()
	}
}

// InputSanitization sanitizes user input to prevent XSS
func InputSanitization() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only process JSON requests
		if c.ContentType() == "application/json" {
			// Hook into JSON binding to sanitize input
			c.Set("sanitize_input", true)
		}
		
		// For query parameters
		sanitizeQueryParams(c)
		
		// For headers
		sanitizeHeaders(c)
		
		c.Next()
	}
}

// sanitizeQueryParams sanitizes query parameters
func sanitizeQueryParams(c *gin.Context) {
	query := c.Request.URL.Query()
	for key, values := range query {
		for i, value := range values {
			query[key][i] = html.EscapeString(value)
		}
	}
	c.Request.URL.RawQuery = query.Encode()
}

// sanitizeHeaders sanitizes potentially dangerous headers
func sanitizeHeaders(c *gin.Context) {
	dangerousHeaders := []string{"User-Agent", "Referer", "X-Forwarded-For"}
	
	for _, header := range dangerousHeaders {
		value := c.GetHeader(header)
		if value != "" {
			c.Request.Header.Set(header, html.EscapeString(value))
		}
	}
}

// CSRF generates and validates CSRF tokens
func CSRF() gin.HandlerFunc {
	tokenStore := &sync.Map{}
	
	return func(c *gin.Context) {
		// Skip CSRF for safe methods
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}
		
		// Get session ID
		sessionID, err := c.Cookie("session_id")
		if err != nil || sessionID == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Session required for CSRF protection"})
			c.Abort()
			return
		}
		
		// For token generation endpoint
		if c.Request.URL.Path == "/api/v1/csrf-token" {
			token := generateCSRFToken()
			tokenStore.Store(sessionID, token)
			
			c.SetCookie("csrf_token", token, 3600, "/", "", true, true)
			c.JSON(http.StatusOK, gin.H{"csrf_token": token})
			return
		}
		
		// Validate CSRF token
		csrfToken := c.GetHeader("X-CSRF-Token")
		if csrfToken == "" {
			csrfToken = c.PostForm("csrf_token")
		}
		
		if csrfToken == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "CSRF token required"})
			c.Abort()
			return
		}
		
		// Verify token
		storedToken, exists := tokenStore.Load(sessionID)
		if !exists || storedToken.(string) != csrfToken {
			c.JSON(http.StatusForbidden, gin.H{"error": "Invalid CSRF token"})
			c.Abort()
			return
		}
		
		c.Next()
	}
}

// StrictRateLimit implements strict rate limiting for sensitive endpoints
func StrictRateLimit(requests int, duration time.Duration) gin.HandlerFunc {
	limiters := &sync.Map{}
	
	return func(c *gin.Context) {
		// Get client identifier
		clientIP := c.ClientIP()
		
		// Get or create limiter
		limiterInterface, _ := limiters.LoadOrStore(clientIP, rate.NewLimiter(rate.Every(duration/time.Duration(requests)), requests))
		limiter := limiterInterface.(*rate.Limiter)
		
		if !limiter.Allow() {
			c.Header("Retry-After", "60")
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Too many requests",
				"retry_after": 60,
			})
			c.Abort()
			return
		}
		
		c.Next()
	}
}

// RateLimit implements general rate limiting
func RateLimit(requests int, duration time.Duration) gin.HandlerFunc {
	return StrictRateLimit(requests, duration)
}

// InputValidation provides input validation middleware
func InputValidation() gin.HandlerFunc {
	return func(c *gin.Context) {
		// This is handled by gin binding tags
		// Additional validation can be added here
		c.Next()
	}
}

// SessionManager handles session management
func SessionManager() gin.HandlerFunc {
	sessions := &sync.Map{}
	
	return func(c *gin.Context) {
		sessionID, err := c.Cookie("session_id")
		
		// Create new session if needed
		if err != nil || sessionID == "" {
			sessionID = generateSessionID()
			c.SetCookie("session_id", sessionID, 3600, "/", "", true, true)
		}
		
		// Store session data
		sessions.Store(sessionID, time.Now())
		
		// Make session ID available to handlers
		c.Set("session_id", sessionID)
		
		c.Next()
	}
}

// SQLInjectionProtection validates queries for SQL injection attempts
func SQLInjectionProtection() gin.HandlerFunc {
	// Common SQL injection patterns
	sqlPatterns := []string{
		`(?i)(union.*select)`,
		`(?i)(delete.*from)`,
		`(?i)(drop.*table)`,
		`(?i)(insert.*into)`,
		`(?i)(update.*set)`,
		`(?i)(script)`,
		`(/\*|\*/|;|'|"|--)`,
	}
	
	compiledPatterns := make([]*regexp.Regexp, len(sqlPatterns))
	for i, pattern := range sqlPatterns {
		compiledPatterns[i] = regexp.MustCompile(pattern)
	}
	
	return func(c *gin.Context) {
		// Check query parameters
		for _, values := range c.Request.URL.Query() {
			for _, value := range values {
				for _, pattern := range compiledPatterns {
					if pattern.MatchString(value) {
						c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid characters in query"})
						c.Abort()
						return
					}
				}
			}
		}
		
		c.Next()
	}
}

// Helper functions

func generateCSRFToken() string {
	// In production, use crypto/rand
	return "csrf_" + generateRandomString(32)
}


func generateRandomString(length int) string {
	// Simplified for example - use crypto/rand in production
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(result)
}

// RateLimiter returns a configurable rate limiter
func RateLimiter() gin.HandlerFunc {
	// Default rate limit: 1000 requests per minute per IP
	return RateLimit(1000, time.Minute)
}