package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"database/sql"
	"github.com/betterprompts/api-gateway/internal/models"
	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
)

// ServiceClients holds all service clients
type ServiceClients struct {
	IntentClassifier     *IntentClassifierClient
	TechniqueSelector    *TechniqueSelectorClient
	PromptGenerator      *PromptGeneratorClient
	Database             *DatabaseService
	Cache                *CacheService
	HTTPClient           *http.Client
	IntentClassifierURL  string
	TechniqueSelectorURL string
	PromptGeneratorURL   string
}

// InitializeClients initializes all service clients
func InitializeClients(logger *logrus.Logger) (*ServiceClients, error) {
	clients := &ServiceClients{}

	// Initialize shared HTTP client with sensible defaults
	clients.HTTPClient = &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	// Initialize database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://betterprompts:betterprompts@postgres:5432/betterprompts?sslmode=disable"
	}
	
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	
	// Test database connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	
	clients.Database = NewDatabaseService(db)

	// Initialize Redis cache
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis:6379"
	}
	
	redisClient := redis.NewClient(&redis.Options{
		Addr:     redisURL,
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})

	// Test Redis connection
	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := redisClient.Ping(ctx).Err(); err != nil {
		logger.WithError(err).Warn("Failed to connect to Redis, caching disabled")
		// Don't fail if Redis is not available
		clients.Cache = nil
	} else {
		clients.Cache = NewCacheService(redisClient, logger)
	}

	// Initialize intent classifier client
	intentClassifierURL := os.Getenv("INTENT_CLASSIFIER_URL")
	if intentClassifierURL == "" {
		intentClassifierURL = "http://intent-classifier:8001"
	}
	clients.IntentClassifierURL = intentClassifierURL
	clients.IntentClassifier = &IntentClassifierClient{
		baseURL: intentClassifierURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}

	// Initialize technique selector client
	techniqueSelectorURL := os.Getenv("TECHNIQUE_SELECTOR_URL")
	if techniqueSelectorURL == "" {
		techniqueSelectorURL = "http://technique-selector:8002"
	}
	clients.TechniqueSelectorURL = techniqueSelectorURL
	clients.TechniqueSelector = &TechniqueSelectorClient{
		baseURL: techniqueSelectorURL,
		client:  &http.Client{Timeout: 10 * time.Second},
		logger:  logger,
	}

	// Initialize prompt generator client (placeholder)
	promptGeneratorURL := os.Getenv("PROMPT_GENERATOR_URL")
	if promptGeneratorURL == "" {
		promptGeneratorURL = "http://prompt-generator:8003"
	}
	clients.PromptGeneratorURL = promptGeneratorURL
	clients.PromptGenerator = &PromptGeneratorClient{
		baseURL: promptGeneratorURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}

	return clients, nil
}

// IntentClassifierClient handles communication with intent classifier service
type IntentClassifierClient struct {
	baseURL string
	client  *http.Client
}

// IntentClassificationResult represents the classification result
type IntentClassificationResult struct {
	Intent              string                 `json:"intent"`
	Confidence          float64                `json:"confidence"`
	Complexity          string                 `json:"complexity"`  // Changed from float64 to string
	IntentScores        map[string]float64     `json:"intent_scores,omitempty"`
	SuggestedTechniques []string               `json:"suggested_techniques"`
	Metadata            map[string]interface{} `json:"metadata,omitempty"`
}

func (c *IntentClassifierClient) ClassifyIntent(ctx context.Context, text string) (*IntentClassificationResult, error) {
	req := map[string]string{"text": text}
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/intents/classify", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request to %s: %w", c.baseURL+"/api/v1/intents/classify", err)
	}
	defer resp.Body.Close()

	// Read the entire response body for debugging
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("intent classifier returned status %d: %s", resp.StatusCode, responseBody)
	}

	var result IntentClassificationResult
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w, body: %s", err, responseBody)
	}

	// Add default suggested techniques if none provided
	if len(result.SuggestedTechniques) == 0 {
		result.SuggestedTechniques = []string{"chain_of_thought"}
	}

	// Ensure complexity is one of the valid values
	validComplexities := map[string]bool{
		"simple":   true,
		"moderate": true,
		"complex":  true,
	}
	if !validComplexities[result.Complexity] {
		// Default to moderate if invalid
		result.Complexity = "moderate"
	}

	return &result, nil
}

// TechniqueSelectorClient handles communication with technique selector service
type TechniqueSelectorClient struct {
	baseURL string
	client  *http.Client
	logger  *logrus.Logger
}

// TechniqueSelectionRequest represents the internal request format
type TechniqueSelectionRequest struct {
	Text          string                 `json:"text"`
	Intent        string                 `json:"intent"`
	Complexity    string                 `json:"complexity"`
	Context       map[string]interface{} `json:"context,omitempty"`
	MaxTechniques int                    `json:"max_techniques,omitempty"`
}

// TechniqueSelectionResponse represents the technique selection response
type TechniqueSelectionResponse struct {
	Techniques       []SelectedTechnique    `json:"techniques"`
	PrimaryTechnique string                 `json:"primary_technique"`
	Confidence       float64                `json:"confidence"`
	Reasoning        string                 `json:"reasoning"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// SelectedTechnique represents a selected technique
type SelectedTechnique struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Template    string                 `json:"template,omitempty"`
	Priority    int                    `json:"priority"`
	Score       float64                `json:"score"`
	Confidence  float64                `json:"confidence"`
	Reasoning   string                 `json:"reasoning"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

// normalizeComplexity ensures the complexity value is valid for the technique selector
func normalizeComplexity(complexity string) string {
	// Map various complexity values to the expected ones
	switch strings.ToLower(complexity) {
	case "simple", "low", "easy", "basic":
		return "simple"
	case "moderate", "medium", "intermediate":
		return "moderate"
	case "complex", "high", "hard", "difficult", "advanced":
		return "complex"
	default:
		// Default to moderate for unknown values
		return "moderate"
	}
}

// SelectTechniques selects appropriate techniques based on intent and complexity
func (c *TechniqueSelectorClient) SelectTechniques(ctx context.Context, req models.TechniqueSelectionRequest) ([]string, error) {
	// Convert to internal request format
	intReq := TechniqueSelectionRequest{
		Text:       req.Text, // Pass the actual text for better technique selection
		Intent:     req.Intent,
		Complexity: normalizeComplexity(req.Complexity),
	}

	body, err := json.Marshal(intReq)
	if err != nil {
		return nil, err
	}
	
	// Debug log the request
	c.logger.WithFields(map[string]interface{}{
		"text_len":   len(req.Text),
		"intent":     req.Intent,
		"complexity": req.Complexity,
		"request":    string(body),
		"url":        c.baseURL + "/api/v1/select",
	}).Info("Sending technique selection request") // Changed to Info to ensure it logs

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/select", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		responseBody, _ := io.ReadAll(resp.Body)
		c.logger.WithFields(map[string]interface{}{
			"status_code": resp.StatusCode,
			"response":    string(responseBody),
			"request":     string(body),
		}).Error("Technique selector returned error")
		return nil, fmt.Errorf("technique selector returned status %d: %s", resp.StatusCode, responseBody)
	}

	var result TechniqueSelectionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	// Extract technique IDs
	techniqueIDs := make([]string, len(result.Techniques))
	for i, tech := range result.Techniques {
		techniqueIDs[i] = tech.ID
	}

	return techniqueIDs, nil
}

// PromptGeneratorClient handles communication with prompt generator service
type PromptGeneratorClient struct {
	baseURL string
	client  *http.Client
}

// GeneratePrompt generates an enhanced prompt using selected techniques
func (c *PromptGeneratorClient) GeneratePrompt(ctx context.Context, req models.PromptGenerationRequest) (*models.PromptGenerationResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/api/v1/generate", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("prompt generator returned status %d: %s", resp.StatusCode, body)
	}

	var result models.PromptGenerationResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

// Close closes all clients
func (c *ServiceClients) Close() error {
	if c.Database != nil {
		c.Database.Close()
	}
	if c.Cache != nil {
		c.Cache.client.Close()
	}
	return nil
}