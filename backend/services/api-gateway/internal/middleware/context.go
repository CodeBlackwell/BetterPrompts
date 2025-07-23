package middleware

import (
	"github.com/betterprompts/api-gateway/internal/auth"
	"github.com/gin-gonic/gin"
)

// UserContext represents the user information extracted from the request
type UserContext struct {
	UserID   string
	Email    string
	Roles    []string
	Claims   *auth.Claims
}

// GetUserContext extracts user context from the Gin context
// Returns nil if no user context is found
func GetUserContext(c *gin.Context) (*UserContext, bool) {
	// Check if auth claims exist
	claims, exists := c.Get("auth_claims")
	if !exists {
		return nil, false
	}

	// Type assert to auth.Claims
	authClaims, ok := claims.(*auth.Claims)
	if !ok {
		return nil, false
	}

	// Build user context from claims
	userCtx := &UserContext{
		UserID: authClaims.UserID,
		Email:  authClaims.Email,
		Roles:  authClaims.Roles,
		Claims: authClaims,
	}

	// Also check for individual values set in context (for compatibility)
	if userID, exists := c.Get("user_id"); exists {
		if uid, ok := userID.(string); ok && uid != "" {
			userCtx.UserID = uid
		}
	}

	if email, exists := c.Get("user_email"); exists {
		if e, ok := email.(string); ok && e != "" {
			userCtx.Email = e
		}
	}

	if roles, exists := c.Get("user_roles"); exists {
		if r, ok := roles.([]string); ok {
			userCtx.Roles = r
		}
	}

	return userCtx, true
}

// SetUserContext sets user context in the Gin context
func SetUserContext(c *gin.Context, userCtx *UserContext) {
	if userCtx == nil {
		return
	}

	// Set individual values for backward compatibility
	c.Set("user_id", userCtx.UserID)
	c.Set("user_email", userCtx.Email)
	c.Set("user_roles", userCtx.Roles)
	
	// Set claims if available
	if userCtx.Claims != nil {
		c.Set("auth_claims", userCtx.Claims)
	}
}