package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/betterprompts/api-gateway/internal/models"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/sirupsen/logrus"
)

// TechniquePreferences represents user preferences for techniques
type TechniquePreferences struct {
	PreferredTechniques []string
	ExcludedTechniques  []string
}

// SelectedTechnique represents a selected technique with metadata
type SelectedTechnique struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description,omitempty"`
	Score       float64                `json:"score,omitempty"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

// EnhancedPrompt represents the enhanced prompt details
type EnhancedPrompt struct {
	Prompt       string                 `json:"prompt"`
	TokensUsed   int                    `json:"tokens_used"`
	ModelVersion string                 `json:"model_version"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// EnhancePromptOptimized creates an optimized version of the enhance endpoint
func EnhancePromptOptimized(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		userID, _ := c.Get("user_id")
		logger := c.MustGet("logger").(*logrus.Entry)

		// Parse request
		var req models.EnhanceRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			logger.WithError(err).Error("Failed to parse request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}

		// Validate request
		if err := validateEnhanceRequest(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Check cache with optimized key
		cacheKey := generateOptimizedCacheKey(req)
		if clients.Cache != nil {
			if cachedResult, err := clients.Cache.GetCachedEnhancement(ctx, cacheKey); err == nil && cachedResult != nil {
				logger.Info("Cache hit for enhancement request")
				c.JSON(http.StatusOK, cachedResult)
				
				// Record cache hit asynchronously
				go recordCacheHit(context.Background(), clients, userID, req.Text)
				return
			}
		}

		// Start timing
		startTime := time.Now()

		// Initialize response channels
		type intentResult struct {
			intent *services.IntentClassificationResult
			err    error
		}
		intentChan := make(chan intentResult, 1)

		// Start intent classification in parallel
		go func() {
			intent, err := clients.IntentClassifier.ClassifyIntent(ctx, req.Text)
			intentChan <- intentResult{intent: intent, err: err}
		}()

		// While intent classification runs, prepare other data
		sessionID := c.GetHeader("X-Session-ID")
		if sessionID == "" {
			sessionID = c.MustGet("request_id").(string)
		}
		
		// Prepare technique preferences
		techniquePrefs := TechniquePreferences{
			PreferredTechniques: req.PreferTechniques,
			ExcludedTechniques:  req.ExcludeTechniques,
		}

		// Wait for intent classification result
		intentRes := <-intentChan
		if intentRes.err != nil {
			logger.WithError(intentRes.err).Error("Intent classification failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze prompt"})
			return
		}

		// Parallel execution of technique selection and preparation
		var wg sync.WaitGroup
		var techniqueErr, generationErr error
		var techniques []SelectedTechnique
		var enhancedPrompt *EnhancedPrompt

		wg.Add(2)

		// Technique selection
		go func() {
			defer wg.Done()
			techniques, techniqueErr = selectTechniquesOptimized(ctx, clients, intentRes.intent, req.Text, techniquePrefs)
		}()

		// Start warming up prompt generator connection while technique selection runs
		go func() {
			defer wg.Done()
			// Pre-connect to prompt generator to reduce latency
			clients.PromptGenerator.WarmConnection(ctx)
		}()

		wg.Wait()

		if techniqueErr != nil {
			logger.WithError(techniqueErr).Error("Technique selection failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to select enhancement techniques"})
			return
		}

		// Generate enhanced prompt
		enhancedPrompt, generationErr = generateEnhancedPromptOptimized(ctx, clients, req, intentRes.intent, techniques)
		if generationErr != nil {
			logger.WithError(generationErr).Error("Prompt generation failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate enhanced prompt"})
			return
		}

		// Build response
		response := buildEnhanceResponse(req, intentRes.intent, techniques, enhancedPrompt, sessionID)
		response.Metadata["response_time"] = time.Since(startTime).Milliseconds()

		// Cache result asynchronously
		if clients.Cache != nil {
			go func() {
				if err := clients.Cache.CacheEnhancement(context.Background(), cacheKey, response); err != nil {
					logger.WithError(err).Warn("Failed to cache result")
				}
			}()
		}

		// Save history asynchronously to avoid blocking response
		go func() {
			historyEntry := &models.PromptHistory{
				UserID:             userID,
				SessionID:          sessionID,
				OriginalPrompt:     req.Text,
				EnhancedPrompt:     enhancedPrompt.Prompt,
				Intent:             intentRes.intent.Intent,
				Complexity:         intentRes.intent.Complexity,
				Techniques:         techniques,
				EnhancementDetails: enhancedPrompt,
				CreatedAt:          time.Now(),
			}

			if err := clients.Database.SavePromptHistory(context.Background(), historyEntry); err != nil {
				logger.WithError(err).Error("Failed to save prompt history")
			}
		}()

		// Record metrics asynchronously
		go recordMetrics(context.Background(), clients, userID, req, response, time.Since(startTime))

		// Return response immediately
		c.JSON(http.StatusOK, response)
	}
}

// generateOptimizedCacheKey includes user preferences in the cache key
func generateOptimizedCacheKey(req models.EnhanceRequest) string {
	data := fmt.Sprintf("%s:%v:%v:%v", 
		req.Text, 
		req.PreferTechniques,
		req.ExcludeTechniques,
		req.Options,
	)
	hash := sha256.Sum256([]byte(data))
	return "enhance:v2:" + hex.EncodeToString(hash[:])
}

// validateEnhanceRequest validates the enhance request
func validateEnhanceRequest(req *models.EnhanceRequest) error {
	if len(req.Text) == 0 {
		return fmt.Errorf("text cannot be empty")
	}
	if len(req.Text) > 5000 {
		return fmt.Errorf("text exceeds maximum length of 5000 characters")
	}
	return nil
}

// selectTechniquesOptimized selects techniques with optimization
func selectTechniquesOptimized(ctx context.Context, clients *services.ServiceClients, intent *services.IntentClassificationResult, text string, prefs TechniquePreferences) ([]SelectedTechnique, error) {
	// Select techniques based on intent
	techniqueRequest := models.TechniqueSelectionRequest{
		Text:              text,
		Intent:            intent.Intent,
		Complexity:        intent.Complexity,
		PreferTechniques:  prefs.PreferredTechniques,
		ExcludeTechniques: prefs.ExcludedTechniques,
	}

	techniques, err := clients.TechniqueSelector.SelectTechniques(ctx, techniqueRequest)
	if err != nil {
		// Fall back to suggested techniques from intent classifier
		return convertToSelectedTechniques(intent.SuggestedTechniques), nil
	}

	return convertStringToSelectedTechniques(techniques), nil
}

// generateEnhancedPromptOptimized generates enhanced prompt with optimization
func generateEnhancedPromptOptimized(ctx context.Context, clients *services.ServiceClients, req models.EnhanceRequest, intent *services.IntentClassificationResult, techniques []SelectedTechnique) (*EnhancedPrompt, error) {
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
		Intent:     intent.Intent,
		Complexity: intent.Complexity,
		Techniques: extractTechniqueIDs(techniques),
		Context:    generationContext,
	}

	response, err := clients.PromptGenerator.GeneratePrompt(ctx, generationRequest)
	if err != nil {
		return nil, err
	}

	return &EnhancedPrompt{
		Prompt:       response.Text,
		TokensUsed:   response.TokensUsed,
		ModelVersion: response.ModelVersion,
		Metadata:     response.Metadata,
	}, nil
}

// buildEnhanceResponse builds the enhance response
func buildEnhanceResponse(req models.EnhanceRequest, intent *services.IntentClassificationResult, techniques []SelectedTechnique, enhancedPrompt *EnhancedPrompt, sessionID string) *models.EnhanceResponse {
	return &models.EnhanceResponse{
		EnhancedText:       enhancedPrompt.Prompt,
		TechniquesUsed:     extractTechniqueIDs(techniques),
		Intent:             intent.Intent,
		IntentConfidence:   intent.Confidence,
		Complexity:         intent.Complexity,
		ProcessingTime:     0, // Will be set by caller
		RequestID:          sessionID,
		Metadata: map[string]interface{}{
			"tokens_used":     enhancedPrompt.TokensUsed,
			"model_version":   enhancedPrompt.ModelVersion,
			"original_text":   req.Text,
		},
	}
}

// Helper functions

// recordCacheHit records cache hit metrics asynchronously
func recordCacheHit(ctx context.Context, clients *services.ServiceClients, userID interface{}, text string) {
	// Record cache hit metrics without blocking
	// Implementation would record to metrics service
}

// recordMetrics records enhancement metrics asynchronously
func recordMetrics(ctx context.Context, clients *services.ServiceClients, userID interface{}, req models.EnhanceRequest, response *models.EnhanceResponse, duration time.Duration) {
	// Record various metrics without blocking
	// Implementation would record to metrics service
}

// extractTechniqueIDs extracts technique IDs from selected techniques
func extractTechniqueIDs(techniques []SelectedTechnique) []string {
	ids := make([]string, len(techniques))
	for i, tech := range techniques {
		ids[i] = tech.ID
	}
	return ids
}

// convertToSelectedTechniques converts string technique IDs to SelectedTechnique objects
func convertToSelectedTechniques(techniqueIDs []string) []SelectedTechnique {
	techniques := make([]SelectedTechnique, len(techniqueIDs))
	for i, id := range techniqueIDs {
		techniques[i] = SelectedTechnique{
			ID:   id,
			Name: id, // Simple conversion, real implementation would look up details
		}
	}
	return techniques
}

// convertStringToSelectedTechniques converts string slice to SelectedTechnique slice
func convertStringToSelectedTechniques(techniqueIDs []string) []SelectedTechnique {
	return convertToSelectedTechniques(techniqueIDs)
}

// Batch processing endpoint for multiple enhancements
func HandleBatchEnhance(clients *services.ServiceClients) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		userID, _ := c.Get("user_id")
		logger := c.MustGet("logger").(*logrus.Entry)

		var req struct {
			Prompts []models.EnhanceRequest `json:"prompts" binding:"required,min=1,max=10"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			logger.WithError(err).Error("Failed to parse batch request")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}

		// Process prompts in parallel with controlled concurrency
		const maxConcurrency = 5
		sem := make(chan struct{}, maxConcurrency)
		
		results := make([]models.EnhanceResponse, len(req.Prompts))
		errors := make([]error, len(req.Prompts))
		
		var wg sync.WaitGroup
		wg.Add(len(req.Prompts))

		for i, prompt := range req.Prompts {
			go func(idx int, p models.EnhanceRequest) {
				defer wg.Done()
				
				// Acquire semaphore
				sem <- struct{}{}
				defer func() { <-sem }()

				// Process individual prompt
				result, err := processSinglePromptBatch(ctx, clients, userID, p)
				if err != nil {
					errors[idx] = err
				} else {
					results[idx] = *result
				}
			}(i, prompt)
		}

		wg.Wait()

		// Build batch response
		batchResponse := struct {
			Results []models.EnhanceResponse `json:"results"`
			Errors  []string                 `json:"errors,omitempty"`
		}{
			Results: results,
		}

		// Add errors if any
		for i, err := range errors {
			if err != nil {
				batchResponse.Errors = append(batchResponse.Errors, fmt.Sprintf("Prompt %d: %v", i+1, err))
			}
		}

		c.JSON(http.StatusOK, batchResponse)
	}
}

// processSinglePromptBatch processes a single prompt for batch operations
func processSinglePromptBatch(ctx context.Context, clients *services.ServiceClients, userID interface{}, req models.EnhanceRequest) (*models.EnhanceResponse, error) {
	// Validate request
	if err := validateEnhanceRequest(&req); err != nil {
		return nil, err
	}

	// Process similar to EnhancePromptOptimized but return result instead of writing to response
	intent, err := clients.IntentClassifier.ClassifyIntent(ctx, req.Text)
	if err != nil {
		return nil, fmt.Errorf("intent classification failed: %w", err)
	}

	techniquePrefs := TechniquePreferences{
		PreferredTechniques: req.PreferTechniques,
		ExcludedTechniques:  req.ExcludeTechniques,
	}

	techniques, err := selectTechniquesOptimized(ctx, clients, intent, req.Text, techniquePrefs)
	if err != nil {
		return nil, fmt.Errorf("technique selection failed: %w", err)
	}

	enhancedPrompt, err := generateEnhancedPromptOptimized(ctx, clients, req, intent, techniques)
	if err != nil {
		return nil, fmt.Errorf("prompt generation failed: %w", err)
	}

	response := buildEnhanceResponse(req, intent, techniques, enhancedPrompt, "batch")
	return response, nil
}