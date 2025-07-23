package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/betterprompts/api-gateway/internal/models"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"database/sql"
)

// EnhanceRequest represents the request body for prompt enhancement
type EnhanceRequest struct {
	Text              string                 `json:"text" binding:"required,min=1,max=5000"`
	Context           map[string]interface{} `json:"context,omitempty"`
	PreferTechniques  []string               `json:"prefer_techniques,omitempty"`
	ExcludeTechniques []string               `json:"exclude_techniques,omitempty"`
	TargetComplexity  string                 `json:"target_complexity,omitempty"`
}

// EnhanceResponse represents the response for prompt enhancement
type EnhanceResponse struct {
	ID               string                 `json:"id"`
	OriginalText     string                 `json:"original_text"`
	EnhancedText     string                 `json:"enhanced_text"`
	Intent           string                 `json:"intent"`
	Complexity       string                 `json:"complexity"`
	TechniquesUsed   []string               `json:"techniques_used"`
	Confidence       float64                `json:"confidence"`
	ProcessingTime   float64                `json:"processing_time_ms"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// EnhancePrompt handles the main prompt enhancement endpoint
func EnhancePrompt(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()
		logger := c.MustGet("logger").(*logrus.Entry)

		var req EnhanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			logger.WithError(err).Error("Invalid request body")
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid request body",
				"details": err.Error(),
			})
			return
		}

		// Get user ID if authenticated
		userID, _ := c.Get("user_id")

		// Generate text hash for caching
		textHash := generateTextHash(req.Text)

		// Check cache for intent classification
		var intentResult *services.IntentClassificationResult
		if clients.Cache != nil {
			intentResult, _ = clients.Cache.GetCachedIntentClassification(c.Request.Context(), textHash)
		}

		// Step 1: Analyze intent if not cached
		if intentResult == nil {
			var err error
			intentResult, err = clients.IntentClassifier.ClassifyIntent(c.Request.Context(), req.Text)
			if err != nil {
				logger.WithError(err).Error("Intent classification failed")
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Failed to analyze intent",
				})
				return
			}

			// Cache the result
			if clients.Cache != nil {
				clients.Cache.CacheIntentClassification(c.Request.Context(), textHash, intentResult, 1*time.Hour)
			}
		}

		// Step 2: Select techniques
		techniqueRequest := models.TechniqueSelectionRequest{
			Text:              req.Text,
			Intent:            intentResult.Intent,
			Complexity:        intentResult.Complexity,
			PreferTechniques:  req.PreferTechniques,
			ExcludeTechniques: req.ExcludeTechniques,
			UserID:            userID,
		}
		
		// Debug log what we're sending
		logger.WithFields(logrus.Fields{
			"text_len":   len(req.Text),
			"text":       req.Text,
			"intent":     techniqueRequest.Intent,
			"complexity": techniqueRequest.Complexity,
		}).Debug("Sending technique selection request")

		techniques, err := clients.TechniqueSelector.SelectTechniques(c.Request.Context(), techniqueRequest)
		if err != nil {
			logger.WithError(err).Error("Technique selection failed")
			// Fall back to suggested techniques from intent classifier
			techniques = intentResult.SuggestedTechniques
		}

		// Step 3: Generate enhanced prompt
		// Ensure context includes enhanced flag
		generationContext := make(map[string]interface{})
		if req.Context != nil {
			for k, v := range req.Context {
				generationContext[k] = v
			}
		}
		generationContext["enhanced"] = true // Critical: This flag enables enhancement
		
		generationRequest := models.PromptGenerationRequest{
			Text:       req.Text,
			Intent:     intentResult.Intent,
			Complexity: intentResult.Complexity,
			Techniques: techniques,
			Context:    generationContext,
		}

		enhancedPrompt, err := clients.PromptGenerator.GeneratePrompt(c.Request.Context(), generationRequest)
		if err != nil {
			logger.WithError(err).Error("Prompt generation failed")
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate enhanced prompt",
			})
			return
		}
		
		// Debug log the response
		logger.WithFields(logrus.Fields{
			"enhanced_text": enhancedPrompt.Text,
			"tokens_used":   enhancedPrompt.TokensUsed,
			"model_version": enhancedPrompt.ModelVersion,
		}).Debug("Prompt generation response")

		// Step 4: Save to history if user is authenticated
		sessionID := c.GetHeader("X-Session-ID")
		if sessionID == "" {
			sessionID = c.MustGet("request_id").(string)
		}

		historyEntry := models.PromptHistory{
			UserID:         sql.NullString{String: func() string { if uid, ok := userID.(string); ok { return uid } else { return "" } }(), Valid: userID != nil},
			SessionID:      sql.NullString{String: sessionID, Valid: sessionID != ""},
			OriginalInput:  req.Text,
			EnhancedOutput: enhancedPrompt.Text,
			Intent:         sql.NullString{String: intentResult.Intent, Valid: true},
			Complexity:     sql.NullString{String: intentResult.Complexity, Valid: true},
			TechniquesUsed: techniques,
			IntentConfidence: sql.NullFloat64{Float64: intentResult.Confidence, Valid: true},
			Metadata: map[string]interface{}{
				"processing_time_ms": time.Since(startTime).Milliseconds(),
				"model_version":      enhancedPrompt.ModelVersion,
			},
		}

		historyID, err := clients.Database.SavePromptHistory(c.Request.Context(), historyEntry)
		if err != nil {
			logger.WithError(err).Warn("Failed to save prompt history")
			// Don't fail the request if history save fails
		}

		// Prepare response
		response := EnhanceResponse{
			ID:             historyID,
			OriginalText:   req.Text,
			EnhancedText:   enhancedPrompt.Text,
			Intent:         intentResult.Intent,
			Complexity:     intentResult.Complexity,
			TechniquesUsed: techniques,
			Confidence:     intentResult.Confidence,
			ProcessingTime: float64(time.Since(startTime).Milliseconds()),
			Metadata: map[string]interface{}{
				"tokens_used":   enhancedPrompt.TokensUsed,
				"model_version": enhancedPrompt.ModelVersion,
			},
		}

		// Cache the enhanced result
		if clients.Cache != nil {
			err = clients.Cache.CacheEnhancedPrompt(c.Request.Context(), textHash, techniques, &response, 1*time.Hour)
			if err != nil {
				logger.WithError(err).Debug("Failed to cache enhanced prompt")
			}
		}

		logger.WithFields(logrus.Fields{
			"intent":          response.Intent,
			"complexity":      response.Complexity,
			"techniques_used": response.TechniquesUsed,
			"processing_time": response.ProcessingTime,
		}).Info("Prompt enhanced successfully")

		c.JSON(http.StatusOK, response)
	}
}

// generateTextHash creates a hash of the input text for caching
func generateTextHash(text string) string {
	// Create SHA256 hash of the text
	h := sha256.New()
	h.Write([]byte(text))
	return hex.EncodeToString(h.Sum(nil))[:16] // Use first 16 chars of hash
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}