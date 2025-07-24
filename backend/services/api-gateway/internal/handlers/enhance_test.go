package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/handlers"
	"github.com/betterprompts/api-gateway/internal/models"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// Mock Services for Enhance Handler

type MockIntentClassifierClient struct {
	mock.Mock
}

func (m *MockIntentClassifierClient) ClassifyIntent(ctx context.Context, text string) (*services.IntentClassificationResult, error) {
	args := m.Called(ctx, text)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*services.IntentClassificationResult), args.Error(1)
}

type MockTechniqueSelectorClient struct {
	mock.Mock
}

func (m *MockTechniqueSelectorClient) SelectTechniques(ctx context.Context, req models.TechniqueSelectionRequest) ([]string, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

type MockPromptGeneratorClient struct {
	mock.Mock
}

func (m *MockPromptGeneratorClient) GeneratePrompt(ctx context.Context, req models.PromptGenerationRequest) (*models.PromptGenerationResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PromptGenerationResponse), args.Error(1)
}

type MockDatabaseService struct {
	mock.Mock
}

func (m *MockDatabaseService) SavePromptHistory(ctx context.Context, entry models.PromptHistory) (string, error) {
	args := m.Called(ctx, entry)
	return args.String(0), args.Error(1)
}

func (m *MockDatabaseService) GetPromptHistory(ctx context.Context, historyID string) (*models.PromptHistory, error) {
	args := m.Called(ctx, historyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.PromptHistory), args.Error(1)
}

func (m *MockDatabaseService) ListUserPromptHistory(ctx context.Context, userID string, limit, offset int) ([]models.PromptHistory, error) {
	args := m.Called(ctx, userID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.PromptHistory), args.Error(1)
}

type MockCacheServiceForEnhance struct {
	mock.Mock
}

func (m *MockCacheServiceForEnhance) CacheEnhancedPrompt(ctx context.Context, hash string, techniques []string, response *handlers.EnhanceResponse, ttl time.Duration) error {
	args := m.Called(ctx, hash, techniques, response, ttl)
	return args.Error(0)
}

func (m *MockCacheServiceForEnhance) GetCachedEnhancedPrompt(ctx context.Context, hash string, techniques []string) (*handlers.EnhanceResponse, error) {
	args := m.Called(ctx, hash, techniques)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*handlers.EnhanceResponse), args.Error(1)
}

func (m *MockCacheServiceForEnhance) CacheIntentClassification(ctx context.Context, hash string, result *services.IntentClassificationResult, ttl time.Duration) error {
	args := m.Called(ctx, hash, result, ttl)
	return args.Error(0)
}

func (m *MockCacheServiceForEnhance) GetCachedIntentClassification(ctx context.Context, hash string) (*services.IntentClassificationResult, error) {
	args := m.Called(ctx, hash)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*services.IntentClassificationResult), args.Error(1)
}

func (m *MockCacheServiceForEnhance) RateLimitCheck(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	args := m.Called(ctx, key, limit, window)
	return args.Bool(0), args.Int(1), args.Error(2)
}

// Test Suite
type EnhanceHandlerTestSuite struct {
	suite.Suite
	router              *gin.Engine
	intentClassifier    *MockIntentClassifierClient
	techniqueSelector   *MockTechniqueSelectorClient
	promptGenerator     *MockPromptGeneratorClient
	database            *MockDatabaseService
	cache               *MockCacheServiceForEnhance
	logger              *logrus.Logger
	serviceClients      *services.ServiceClients
	enhanceHandler      gin.HandlerFunc
}

func (suite *EnhanceHandlerTestSuite) SetupTest() {
	gin.SetMode(gin.TestMode)
	
	// Create mocks
	suite.intentClassifier = new(MockIntentClassifierClient)
	suite.techniqueSelector = new(MockTechniqueSelectorClient)
	suite.promptGenerator = new(MockPromptGeneratorClient)
	suite.database = new(MockDatabaseService)
	suite.cache = new(MockCacheServiceForEnhance)
	suite.logger = logrus.New()
	suite.logger.Out = nil // Disable logging during tests
	
	// Create service clients
	suite.serviceClients = &services.ServiceClients{
		IntentClassifier:  suite.intentClassifier,
		TechniqueSelector: suite.techniqueSelector,
		PromptGenerator:   suite.promptGenerator,
		Database:          suite.database,
		Cache:             suite.cache,
	}
	
	// Create handler
	suite.enhanceHandler = handlers.EnhancePrompt(suite.serviceClients)
	
	// Setup router
	suite.router = gin.New()
	suite.router.Use(func(c *gin.Context) {
		// Add required middleware context
		entry := suite.logger.WithField("request_id", "test-request-id")
		c.Set("logger", entry)
		c.Set("request_id", "test-request-id")
		c.Next()
	})
}

func (suite *EnhanceHandlerTestSuite) TearDownTest() {
	suite.intentClassifier.AssertExpectations(suite.T())
	suite.techniqueSelector.AssertExpectations(suite.T())
	suite.promptGenerator.AssertExpectations(suite.T())
	suite.database.AssertExpectations(suite.T())
	suite.cache.AssertExpectations(suite.T())
}

// Helper functions
func (suite *EnhanceHandlerTestSuite) makeRequest(method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	var req *http.Request
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		req = httptest.NewRequest(method, path, bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	
	rec := httptest.NewRecorder()
	suite.router.ServeHTTP(rec, req)
	return rec
}

// Test Cases - Success Flow

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_Success() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request
	req := handlers.EnhanceRequest{
		Text: "How do I implement a binary search algorithm?",
	}
	
	// Expected hash for caching
	expectedHash := "5e2bf6e31aad643f" // First 16 chars of SHA256 hash
	
	// Mock expectations
	// 1. Cache miss for intent classification
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, nil)
	
	// 2. Intent classification
	intentResult := &services.IntentClassificationResult{
		Intent:              "coding_implementation",
		Complexity:          "medium",
		Confidence:          0.95,
		SuggestedTechniques: []string{"chain_of_thought", "step_by_step"},
	}
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(intentResult, nil)
	
	// 3. Cache intent result
	suite.cache.On("CacheIntentClassification", mock.Anything, expectedHash, intentResult, 1*time.Hour).
		Return(nil)
	
	// 4. Technique selection
	techniqueReq := models.TechniqueSelectionRequest{
		Text:              req.Text,
		Intent:            "coding_implementation",
		Complexity:        "medium",
		PreferTechniques:  []string{},
		ExcludeTechniques: []string{},
		UserID:            nil,
	}
	selectedTechniques := []string{"chain_of_thought", "step_by_step", "examples"}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, techniqueReq).
		Return(selectedTechniques, nil)
	
	// 5. Prompt generation
	genReq := models.PromptGenerationRequest{
		Text:       req.Text,
		Intent:     "coding_implementation",
		Complexity: "medium",
		Techniques: selectedTechniques,
		Context:    nil,
	}
	genResp := &models.PromptGenerationResponse{
		Text:         "Let me help you implement a binary search algorithm step by step...",
		TokensUsed:   150,
		ModelVersion: "v1.0.0",
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, genReq).
		Return(genResp, nil)
	
	// 6. Save to database
	suite.database.On("SavePromptHistory", mock.Anything, mock.MatchedBy(func(entry models.PromptHistory) bool {
		return entry.OriginalInput == req.Text &&
			entry.EnhancedOutput == genResp.Text &&
			entry.Intent.String == "coding_implementation" &&
			len(entry.TechniquesUsed) == 3
	})).Return("history-123", nil)
	
	// 7. Cache enhanced result
	suite.cache.On("CacheEnhancedPrompt", mock.Anything, expectedHash, selectedTechniques, mock.AnythingOfType("*handlers.EnhanceResponse"), 1*time.Hour).
		Return(nil)
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{
		"X-Session-ID": "session-123",
	})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "history-123", resp.ID)
	assert.Equal(suite.T(), req.Text, resp.OriginalText)
	assert.Equal(suite.T(), genResp.Text, resp.EnhancedText)
	assert.Equal(suite.T(), "coding_implementation", resp.Intent)
	assert.Equal(suite.T(), "medium", resp.Complexity)
	assert.Equal(suite.T(), selectedTechniques, resp.TechniquesUsed)
	assert.Equal(suite.T(), 0.95, resp.Confidence)
	assert.Greater(suite.T(), resp.ProcessingTime, float64(0))
	assert.Equal(suite.T(), float64(150), resp.Metadata["tokens_used"])
	assert.Equal(suite.T(), "v1.0.0", resp.Metadata["model_version"])
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_WithUserAuthentication() {
	// Setup route with user context
	suite.router.POST("/enhance", func(c *gin.Context) {
		// Simulate authenticated user
		c.Set("user_id", "user-456")
		suite.enhanceHandler(c)
	})
	
	// Request
	req := handlers.EnhanceRequest{
		Text:             "Explain machine learning",
		PreferTechniques: []string{"eli5"},
	}
	
	expectedHash := "f3e4d9c70b1a2f89"
	
	// Mock expectations
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, nil)
	
	intentResult := &services.IntentClassificationResult{
		Intent:              "explanation",
		Complexity:          "simple",
		Confidence:          0.88,
		SuggestedTechniques: []string{"eli5", "analogies"},
	}
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(intentResult, nil)
	
	suite.cache.On("CacheIntentClassification", mock.Anything, expectedHash, intentResult, 1*time.Hour).
		Return(nil)
	
	// Technique selection should include user ID
	techniqueReq := models.TechniqueSelectionRequest{
		Text:              req.Text,
		Intent:            "explanation",
		Complexity:        "simple",
		PreferTechniques:  []string{"eli5"},
		ExcludeTechniques: []string{},
		UserID:            "user-456",
	}
	selectedTechniques := []string{"eli5", "analogies"}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, techniqueReq).
		Return(selectedTechniques, nil)
	
	genReq := models.PromptGenerationRequest{
		Text:       req.Text,
		Intent:     "explanation",
		Complexity: "simple",
		Techniques: selectedTechniques,
		Context:    nil,
	}
	genResp := &models.PromptGenerationResponse{
		Text:         "Machine learning is like teaching a computer to learn from examples...",
		TokensUsed:   100,
		ModelVersion: "v1.0.0",
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, genReq).
		Return(genResp, nil)
	
	// Database save should include user ID
	suite.database.On("SavePromptHistory", mock.Anything, mock.MatchedBy(func(entry models.PromptHistory) bool {
		return entry.UserID.Valid && entry.UserID.String == "user-456"
	})).Return("history-456", nil)
	
	suite.cache.On("CacheEnhancedPrompt", mock.Anything, expectedHash, selectedTechniques, mock.AnythingOfType("*handlers.EnhanceResponse"), 1*time.Hour).
		Return(nil)
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "history-456", resp.ID)
	assert.Equal(suite.T(), selectedTechniques, resp.TechniquesUsed)
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_CachedIntentClassification() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request
	req := handlers.EnhanceRequest{
		Text: "What is the meaning of life?",
	}
	
	expectedHash := "3b5d3c4a9e8f7a6b"
	
	// Mock expectations
	// 1. Cache hit for intent classification
	cachedIntent := &services.IntentClassificationResult{
		Intent:              "philosophical",
		Complexity:          "complex",
		Confidence:          0.75,
		SuggestedTechniques: []string{"socratic_method", "multi_perspective"},
	}
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(cachedIntent, nil)
	
	// 2. No intent classification call needed
	
	// 3. Technique selection
	techniqueReq := models.TechniqueSelectionRequest{
		Text:              req.Text,
		Intent:            "philosophical",
		Complexity:        "complex",
		PreferTechniques:  []string{},
		ExcludeTechniques: []string{},
		UserID:            nil,
	}
	selectedTechniques := []string{"socratic_method", "multi_perspective", "thought_experiment"}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, techniqueReq).
		Return(selectedTechniques, nil)
	
	// 4. Prompt generation
	genReq := models.PromptGenerationRequest{
		Text:       req.Text,
		Intent:     "philosophical",
		Complexity: "complex",
		Techniques: selectedTechniques,
		Context:    nil,
	}
	genResp := &models.PromptGenerationResponse{
		Text:         "Let's explore this profound question from multiple perspectives...",
		TokensUsed:   200,
		ModelVersion: "v1.0.0",
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, genReq).
		Return(genResp, nil)
	
	// 5. Save to database
	suite.database.On("SavePromptHistory", mock.Anything, mock.AnythingOfType("models.PromptHistory")).
		Return("history-789", nil)
	
	// 6. Cache enhanced result
	suite.cache.On("CacheEnhancedPrompt", mock.Anything, expectedHash, selectedTechniques, mock.AnythingOfType("*handlers.EnhanceResponse"), 1*time.Hour).
		Return(nil)
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "philosophical", resp.Intent)
	assert.Equal(suite.T(), "complex", resp.Complexity)
	assert.Equal(suite.T(), 0.75, resp.Confidence)
}

// Test Cases - Error Handling

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_InvalidRequest() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Test empty text
	req := handlers.EnhanceRequest{
		Text: "",
	}
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid request body", resp["error"])
	assert.Contains(suite.T(), resp["details"], "Text")
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_TextTooLong() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Create text longer than 5000 chars
	longText := make([]byte, 5001)
	for i := range longText {
		longText[i] = 'a'
	}
	
	req := handlers.EnhanceRequest{
		Text: string(longText),
	}
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusBadRequest, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Invalid request body", resp["error"])
	assert.Contains(suite.T(), resp["details"], "max")
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_IntentClassificationError() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request
	req := handlers.EnhanceRequest{
		Text: "Test prompt",
	}
	
	expectedHash := "b5bb9d8014a0f9b1"
	
	// Mock expectations
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, nil)
	
	// Intent classification fails
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(nil, errors.New("classification service unavailable"))
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusInternalServerError, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Failed to analyze intent", resp["error"])
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_TechniqueSelectionError() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request
	req := handlers.EnhanceRequest{
		Text: "Test prompt",
	}
	
	expectedHash := "b5bb9d8014a0f9b1"
	
	// Mock expectations
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, nil)
	
	intentResult := &services.IntentClassificationResult{
		Intent:              "general",
		Complexity:          "simple",
		Confidence:          0.8,
		SuggestedTechniques: []string{"basic"},
	}
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(intentResult, nil)
	
	suite.cache.On("CacheIntentClassification", mock.Anything, expectedHash, intentResult, 1*time.Hour).
		Return(nil)
	
	// Technique selection fails
	techniqueReq := models.TechniqueSelectionRequest{
		Text:              req.Text,
		Intent:            "general",
		Complexity:        "simple",
		PreferTechniques:  []string{},
		ExcludeTechniques: []string{},
		UserID:            nil,
	}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, techniqueReq).
		Return(nil, errors.New("technique service error"))
	
	// Should fall back to suggested techniques
	genReq := models.PromptGenerationRequest{
		Text:       req.Text,
		Intent:     "general",
		Complexity: "simple",
		Techniques: []string{"basic"}, // Falls back to suggested
		Context:    nil,
	}
	genResp := &models.PromptGenerationResponse{
		Text:         "Enhanced prompt with basic technique",
		TokensUsed:   50,
		ModelVersion: "v1.0.0",
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, genReq).
		Return(genResp, nil)
	
	suite.database.On("SavePromptHistory", mock.Anything, mock.AnythingOfType("models.PromptHistory")).
		Return("history-fallback", nil)
	
	suite.cache.On("CacheEnhancedPrompt", mock.Anything, expectedHash, []string{"basic"}, mock.AnythingOfType("*handlers.EnhanceResponse"), 1*time.Hour).
		Return(nil)
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), []string{"basic"}, resp.TechniquesUsed)
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_PromptGenerationError() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request
	req := handlers.EnhanceRequest{
		Text: "Test prompt",
	}
	
	expectedHash := "b5bb9d8014a0f9b1"
	
	// Mock expectations
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, nil)
	
	intentResult := &services.IntentClassificationResult{
		Intent:              "general",
		Complexity:          "simple",
		Confidence:          0.8,
		SuggestedTechniques: []string{"basic"},
	}
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(intentResult, nil)
	
	suite.cache.On("CacheIntentClassification", mock.Anything, expectedHash, intentResult, 1*time.Hour).
		Return(nil)
	
	selectedTechniques := []string{"basic", "structured"}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, mock.AnythingOfType("models.TechniqueSelectionRequest")).
		Return(selectedTechniques, nil)
	
	// Prompt generation fails
	genReq := models.PromptGenerationRequest{
		Text:       req.Text,
		Intent:     "general",
		Complexity: "simple",
		Techniques: selectedTechniques,
		Context:    nil,
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, genReq).
		Return(nil, errors.New("generation service unavailable"))
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusInternalServerError, rec.Code)
	
	var resp map[string]interface{}
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "Failed to generate enhanced prompt", resp["error"])
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_DatabaseSaveError() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request
	req := handlers.EnhanceRequest{
		Text: "Test prompt",
	}
	
	expectedHash := "b5bb9d8014a0f9b1"
	
	// Mock all successful operations until database save
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, nil)
	
	intentResult := &services.IntentClassificationResult{
		Intent:              "general",
		Complexity:          "simple",
		Confidence:          0.8,
		SuggestedTechniques: []string{"basic"},
	}
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(intentResult, nil)
	
	suite.cache.On("CacheIntentClassification", mock.Anything, expectedHash, intentResult, 1*time.Hour).
		Return(nil)
	
	selectedTechniques := []string{"basic"}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, mock.AnythingOfType("models.TechniqueSelectionRequest")).
		Return(selectedTechniques, nil)
	
	genResp := &models.PromptGenerationResponse{
		Text:         "Enhanced prompt",
		TokensUsed:   50,
		ModelVersion: "v1.0.0",
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, mock.AnythingOfType("models.PromptGenerationRequest")).
		Return(genResp, nil)
	
	// Database save fails
	suite.database.On("SavePromptHistory", mock.Anything, mock.AnythingOfType("models.PromptHistory")).
		Return("", errors.New("database connection failed"))
	
	suite.cache.On("CacheEnhancedPrompt", mock.Anything, expectedHash, selectedTechniques, mock.AnythingOfType("*handlers.EnhanceResponse"), 1*time.Hour).
		Return(nil)
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions - request should still succeed
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Empty(suite.T(), resp.ID) // No history ID since save failed
	assert.Equal(suite.T(), genResp.Text, resp.EnhancedText)
}

// Test Cases - Caching

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_CachingErrors() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request
	req := handlers.EnhanceRequest{
		Text: "Test prompt",
	}
	
	expectedHash := "b5bb9d8014a0f9b1"
	
	// Mock expectations - cache errors shouldn't break the flow
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, errors.New("cache read error"))
	
	intentResult := &services.IntentClassificationResult{
		Intent:              "general",
		Complexity:          "simple",
		Confidence:          0.8,
		SuggestedTechniques: []string{"basic"},
	}
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(intentResult, nil)
	
	// Cache write error
	suite.cache.On("CacheIntentClassification", mock.Anything, expectedHash, intentResult, 1*time.Hour).
		Return(errors.New("cache write error"))
	
	selectedTechniques := []string{"basic"}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, mock.AnythingOfType("models.TechniqueSelectionRequest")).
		Return(selectedTechniques, nil)
	
	genResp := &models.PromptGenerationResponse{
		Text:         "Enhanced prompt",
		TokensUsed:   50,
		ModelVersion: "v1.0.0",
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, mock.AnythingOfType("models.PromptGenerationRequest")).
		Return(genResp, nil)
	
	suite.database.On("SavePromptHistory", mock.Anything, mock.AnythingOfType("models.PromptHistory")).
		Return("history-123", nil)
	
	// Cache enhanced result error
	suite.cache.On("CacheEnhancedPrompt", mock.Anything, expectedHash, selectedTechniques, mock.AnythingOfType("*handlers.EnhanceResponse"), 1*time.Hour).
		Return(errors.New("cache write error"))
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions - should still succeed despite cache errors
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "history-123", resp.ID)
	assert.Equal(suite.T(), genResp.Text, resp.EnhancedText)
}

func (suite *EnhanceHandlerTestSuite) TestEnhancePrompt_WithContext() {
	// Setup route
	suite.router.POST("/enhance", suite.enhanceHandler)
	
	// Request with context
	req := handlers.EnhanceRequest{
		Text: "Optimize this query",
		Context: map[string]interface{}{
			"database": "PostgreSQL",
			"table":    "users",
			"size":     1000000,
		},
	}
	
	expectedHash := "2c3d4e5f6a7b8c9d"
	
	// Mock expectations
	suite.cache.On("GetCachedIntentClassification", mock.Anything, expectedHash).
		Return(nil, nil)
	
	intentResult := &services.IntentClassificationResult{
		Intent:              "optimization",
		Complexity:          "medium",
		Confidence:          0.9,
		SuggestedTechniques: []string{"performance_analysis", "benchmarking"},
	}
	suite.intentClassifier.On("ClassifyIntent", mock.Anything, req.Text).
		Return(intentResult, nil)
	
	suite.cache.On("CacheIntentClassification", mock.Anything, expectedHash, intentResult, 1*time.Hour).
		Return(nil)
	
	selectedTechniques := []string{"performance_analysis", "benchmarking", "sql_optimization"}
	suite.techniqueSelector.On("SelectTechniques", mock.Anything, mock.AnythingOfType("models.TechniqueSelectionRequest")).
		Return(selectedTechniques, nil)
	
	// Prompt generation should receive context
	genReq := models.PromptGenerationRequest{
		Text:       req.Text,
		Intent:     "optimization",
		Complexity: "medium",
		Techniques: selectedTechniques,
		Context:    req.Context,
	}
	genResp := &models.PromptGenerationResponse{
		Text:         "For optimizing PostgreSQL queries on a large users table...",
		TokensUsed:   200,
		ModelVersion: "v1.0.0",
	}
	suite.promptGenerator.On("GeneratePrompt", mock.Anything, genReq).
		Return(genResp, nil)
	
	suite.database.On("SavePromptHistory", mock.Anything, mock.AnythingOfType("models.PromptHistory")).
		Return("history-context", nil)
	
	suite.cache.On("CacheEnhancedPrompt", mock.Anything, expectedHash, selectedTechniques, mock.AnythingOfType("*handlers.EnhanceResponse"), 1*time.Hour).
		Return(nil)
	
	// Make request
	rec := suite.makeRequest("POST", "/enhance", req, map[string]string{})
	
	// Assertions
	assert.Equal(suite.T(), http.StatusOK, rec.Code)
	
	var resp handlers.EnhanceResponse
	err := json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), resp.EnhancedText, "PostgreSQL")
}

// Test Runner
func TestEnhanceHandlerTestSuite(t *testing.T) {
	suite.Run(t, new(EnhanceHandlerTestSuite))
}