package handlers

import (
	"net/http"
	"github.com/gin-gonic/gin"
	"github.com/betterprompts/api-gateway/internal/services"
)

// Stub handlers to make the build work

func GetAvailableTechniques(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"techniques": []string{"cot", "few_shot"}})
	}
}

func SelectTechniques(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"selected": []string{"cot"}})
	}
}

// SubmitFeedback is now implemented in feedback.go
// Use NewFeedbackHandler(clients, logger).SubmitFeedback instead

func GetUsers(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"users": []interface{}{}})
	}
}

func GetUser(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"user": nil})
	}
}

func UpdateUser(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "updated"})
	}
}

func DeleteUser(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	}
}

func GetSystemMetrics(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"metrics": map[string]interface{}{}})
	}
}

func GetUsageMetrics(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"usage": map[string]interface{}{}})
	}
}

func ClearCache(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "cache cleared"})
	}
}

func InvalidateUserCache(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "user cache invalidated"})
	}
}

func CreateAPIKey(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"api_key": "stub-key"})
	}
}

func GetAPIKeys(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"api_keys": []interface{}{}})
	}
}

func DeleteAPIKey(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	}
}

func GetDeveloperUsage(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"usage": map[string]interface{}{}})
	}
}

func GetPerformanceMetrics(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"performance": map[string]interface{}{}})
	}
}
