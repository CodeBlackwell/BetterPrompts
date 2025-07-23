package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/betterprompts/api-gateway/internal/middleware"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// FeedbackHandler handles feedback-related requests
type FeedbackHandler struct {
	clients *services.ServiceClients
	logger  *logrus.Entry
}

// NewFeedbackHandler creates a new feedback handler
func NewFeedbackHandler(clients *services.ServiceClients, logger *logrus.Entry) *FeedbackHandler {
	return &FeedbackHandler{
		clients: clients,
		logger:  logger.WithField("handler", "feedback"),
	}
}

// FeedbackRequest represents a feedback submission request
type FeedbackRequest struct {
	PromptHistoryID      string            `json:"prompt_history_id" binding:"required"`
	Rating               *int              `json:"rating,omitempty" binding:"omitempty,min=1,max=5"`
	FeedbackType         string            `json:"feedback_type,omitempty"`
	FeedbackText         string            `json:"feedback_text,omitempty" binding:"omitempty,max=1000"`
	TechniqueRatings     map[string]int    `json:"technique_ratings,omitempty"`
	MostHelpfulTechnique string            `json:"most_helpful_technique,omitempty"`
	LeastHelpfulTechnique string           `json:"least_helpful_technique,omitempty"`
	Metadata             map[string]interface{} `json:"metadata,omitempty"`
}

// FeedbackResponse represents a feedback submission response
type FeedbackResponse struct {
	ID              string    `json:"id"`
	PromptHistoryID string    `json:"prompt_history_id"`
	Rating          *int      `json:"rating,omitempty"`
	FeedbackType    string    `json:"feedback_type"`
	CreatedAt       time.Time `json:"created_at"`
	Message         string    `json:"message"`
}

// TechniqueEffectivenessRequest represents a request for technique effectiveness
type TechniqueEffectivenessRequest struct {
	Technique   string `json:"technique" binding:"required"`
	Intent      string `json:"intent,omitempty"`
	Complexity  string `json:"complexity,omitempty"`
	PeriodDays  int    `json:"period_days,omitempty"`
}

// TechniqueEffectivenessResponse represents technique effectiveness metrics
type TechniqueEffectivenessResponse struct {
	Technique          string     `json:"technique"`
	Intent             *string    `json:"intent,omitempty"`
	Complexity         *string    `json:"complexity,omitempty"`
	EffectivenessScore *float64   `json:"effectiveness_score,omitempty"`
	AverageRating      *float64   `json:"average_rating,omitempty"`
	PositiveRatio      *float64   `json:"positive_ratio,omitempty"`
	NegativeRatio      *float64   `json:"negative_ratio,omitempty"`
	Confidence         string     `json:"confidence"`
	SampleSize         int        `json:"sample_size"`
	PeriodDays         int        `json:"period_days"`
	LastUpdated        time.Time  `json:"last_updated"`
}

// SubmitFeedback handles POST /api/v1/feedback
func (h *FeedbackHandler) SubmitFeedback(c *gin.Context) {
	var req FeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Invalid feedback request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Get user context
	userCtx, _ := middleware.GetUserContext(c)
	
	// Add user information to the request headers for the prompt-generator service
	headers := map[string]string{
		"Content-Type": "application/json",
		"User-Agent":   c.GetHeader("User-Agent"),
	}
	
	if userCtx != nil {
		headers["X-User-ID"] = userCtx.UserID
	}
	
	// Add session ID if available
	sessionID := c.GetHeader("X-Session-ID")
	if sessionID != "" {
		headers["X-Session-ID"] = sessionID
	}

	// Forward to prompt-generator service
	feedbackURL := fmt.Sprintf("%s/api/v1/feedback/", h.clients.PromptGeneratorURL)
	
	reqBody, err := json.Marshal(req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal feedback request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	httpReq, err := http.NewRequest("POST", feedbackURL, bytes.NewReader(reqBody))
	if err != nil {
		h.logger.WithError(err).Error("Failed to create feedback request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Set headers
	for key, value := range headers {
		httpReq.Header.Set(key, value)
	}

	// Make request
	resp, err := h.clients.HTTPClient.Do(httpReq)
	if err != nil {
		h.logger.WithError(err).Error("Failed to submit feedback")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Feedback service unavailable"})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.logger.WithError(err).Error("Failed to read feedback response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Forward the response
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		var feedbackResp FeedbackResponse
		if err := json.Unmarshal(body, &feedbackResp); err != nil {
			h.logger.WithError(err).Error("Failed to parse feedback response")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
			return
		}
		
		h.logger.WithFields(logrus.Fields{
			"feedback_id":       feedbackResp.ID,
			"prompt_history_id": feedbackResp.PromptHistoryID,
			"rating":           feedbackResp.Rating,
		}).Info("Feedback submitted successfully")
		
		c.JSON(resp.StatusCode, feedbackResp)
	} else {
		var errorResp map[string]interface{}
		json.Unmarshal(body, &errorResp)
		c.JSON(resp.StatusCode, errorResp)
	}
}

// GetFeedback handles GET /api/v1/feedback/:prompt_history_id
func (h *FeedbackHandler) GetFeedback(c *gin.Context) {
	promptHistoryID := c.Param("prompt_history_id")
	if promptHistoryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Prompt history ID required"})
		return
	}

	// Get user context
	userCtx, _ := middleware.GetUserContext(c)
	
	// Build request headers
	headers := map[string]string{
		"Content-Type": "application/json",
	}
	
	if userCtx != nil {
		headers["X-User-ID"] = userCtx.UserID
	}

	// Forward to prompt-generator service
	feedbackURL := fmt.Sprintf("%s/api/v1/feedback/prompt/%s", h.clients.PromptGeneratorURL, promptHistoryID)
	
	httpReq, err := http.NewRequest("GET", feedbackURL, nil)
	if err != nil {
		h.logger.WithError(err).Error("Failed to create feedback request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Set headers
	for key, value := range headers {
		httpReq.Header.Set(key, value)
	}

	// Make request
	resp, err := h.clients.HTTPClient.Do(httpReq)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get feedback")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Feedback service unavailable"})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.logger.WithError(err).Error("Failed to read feedback response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Forward the response
	if resp.StatusCode == http.StatusOK {
		var feedbackResp FeedbackResponse
		if err := json.Unmarshal(body, &feedbackResp); err != nil {
			h.logger.WithError(err).Error("Failed to parse feedback response")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
			return
		}
		c.JSON(resp.StatusCode, feedbackResp)
	} else {
		var errorResp map[string]interface{}
		json.Unmarshal(body, &errorResp)
		c.JSON(resp.StatusCode, errorResp)
	}
}

// GetTechniqueEffectiveness handles POST /api/v1/feedback/effectiveness
func (h *FeedbackHandler) GetTechniqueEffectiveness(c *gin.Context) {
	var req TechniqueEffectivenessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.WithError(err).Error("Invalid effectiveness request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}

	// Set default period if not specified
	if req.PeriodDays == 0 {
		req.PeriodDays = 30
	}

	// Forward to prompt-generator service
	effectivenessURL := fmt.Sprintf("%s/api/v1/feedback/effectiveness", h.clients.PromptGeneratorURL)
	
	reqBody, err := json.Marshal(req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to marshal effectiveness request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	httpReq, err := http.NewRequest("POST", effectivenessURL, bytes.NewReader(reqBody))
	if err != nil {
		h.logger.WithError(err).Error("Failed to create effectiveness request")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	httpReq.Header.Set("Content-Type", "application/json")

	// Make request
	resp, err := h.clients.HTTPClient.Do(httpReq)
	if err != nil {
		h.logger.WithError(err).Error("Failed to get technique effectiveness")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Feedback service unavailable"})
		return
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.logger.WithError(err).Error("Failed to read effectiveness response")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Forward the response
	if resp.StatusCode == http.StatusOK {
		var effectivenessResp TechniqueEffectivenessResponse
		if err := json.Unmarshal(body, &effectivenessResp); err != nil {
			h.logger.WithError(err).Error("Failed to parse effectiveness response")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
			return
		}
		
		h.logger.WithFields(logrus.Fields{
			"technique":           effectivenessResp.Technique,
			"effectiveness_score": effectivenessResp.EffectivenessScore,
			"sample_size":        effectivenessResp.SampleSize,
		}).Info("Technique effectiveness retrieved")
		
		c.JSON(resp.StatusCode, effectivenessResp)
	} else {
		var errorResp map[string]interface{}
		json.Unmarshal(body, &errorResp)
		c.JSON(resp.StatusCode, errorResp)
	}
}