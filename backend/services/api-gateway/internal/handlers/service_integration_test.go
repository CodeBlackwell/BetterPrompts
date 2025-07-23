package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/betterprompts/api-gateway/internal/handlers"
	"github.com/betterprompts/api-gateway/internal/models"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// ServiceIntegrationTestSuite tests the integration between API Gateway and all backend services
type ServiceIntegrationTestSuite struct {
	suite.Suite
	router               *gin.Engine
	logger               *logrus.Logger
	mockIntentServer     *httptest.Server
	mockTechniqueServer  *httptest.Server
	mockPromptServer     *httptest.Server
	serviceClients       *services.ServiceClients
	testDB               *sql.DB
	testRedis            *redis.Client
}

func (suite *ServiceIntegrationTestSuite) SetupSuite() {
	// Set gin to test mode
	gin.SetMode(gin.TestMode)
	
	// Create logger
	suite.logger = logrus.New()
	suite.logger.SetLevel(logrus.DebugLevel)
	
	// Setup mock servers
	suite.setupMockServers()
	
	// Initialize service clients pointing to mock servers
	suite.setupServiceClients()
	
	// Setup router
	suite.setupRouter()
}

func (suite *ServiceIntegrationTestSuite) TearDownSuite() {
	// Close mock servers
	if suite.mockIntentServer != nil {
		suite.mockIntentServer.Close()
	}
	if suite.mockTechniqueServer != nil {
		suite.mockTechniqueServer.Close()
	}
	if suite.mockPromptServer != nil {
		suite.mockPromptServer.Close()
	}
	
	// Close service clients
	if suite.serviceClients != nil {
		suite.serviceClients.Close()
	}
}

func (suite *ServiceIntegrationTestSuite) setupMockServers() {
	// Mock Intent Classifier Server
	suite.mockIntentServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		suite.logger.Info("Intent classifier received request")
		
		// Verify request method and path
		assert.Equal(suite.T(), "POST", r.Method)
		assert.Equal(suite.T(), "/api/v1/intents/classify", r.URL.Path)
		
		// Parse request body
		var req map[string]string
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(suite.T(), err)
		
		// Simulate different responses based on input
		response := services.IntentClassificationResult{
			Intent:     "code_generation",
			Confidence: 0.95,
			Complexity: "moderate",
			IntentScores: map[string]float64{
				"code_generation":     0.95,
				"question_answering":  0.03,
				"text_summarization": 0.02,
			},
			SuggestedTechniques: []string{"chain_of_thought", "few_shot"},
			Metadata: map[string]interface{}{
				"language_detected": "english",
				"domain":           "programming",
			},
		}
		
		// Customize response based on input text
		if text, ok := req["text"]; ok {
			switch text {
			case "simple question":
				response.Intent = "question_answering"
				response.Complexity = "simple"
				response.SuggestedTechniques = []string{"zero_shot"}
			case "complex analysis":
				response.Intent = "data_analysis"
				response.Complexity = "complex"
				response.SuggestedTechniques = []string{"chain_of_thought", "structured_output", "tree_of_thoughts"}
			case "error trigger":
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": "classification failed"})
				return
			}
		}
		
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))
	
	// Mock Technique Selector Server
	suite.mockTechniqueServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		suite.logger.Info("Technique selector received request")
		
		// Verify request method and path
		assert.Equal(suite.T(), "POST", r.Method)
		assert.Equal(suite.T(), "/api/v1/select", r.URL.Path)
		
		// Parse request body
		var req services.TechniqueSelectionRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(suite.T(), err)
		
		// Verify request contains expected fields
		assert.NotEmpty(suite.T(), req.Text)
		assert.NotEmpty(suite.T(), req.Intent)
		assert.NotEmpty(suite.T(), req.Complexity)
		
		// Simulate response
		response := services.TechniqueSelectionResponse{
			Techniques: []services.SelectedTechnique{
				{
					ID:          "chain_of_thought",
					Name:        "Chain of Thought",
					Description: "Break down complex problems into steps",
					Priority:    1,
					Score:       0.95,
					Confidence:  0.9,
					Reasoning:   "Suitable for code generation tasks",
				},
				{
					ID:          "few_shot",
					Name:        "Few-Shot Learning",
					Description: "Provide examples to guide the response",
					Priority:    2,
					Score:       0.85,
					Confidence:  0.8,
					Reasoning:   "Examples help clarify the expected output",
				},
			},
			PrimaryTechnique: "chain_of_thought",
			Confidence:       0.9,
			Reasoning:        "Chain of thought is ideal for step-by-step code generation",
		}
		
		// Customize response based on intent
		switch req.Intent {
		case "question_answering":
			response.Techniques = []services.SelectedTechnique{
				{
					ID:          "zero_shot",
					Name:        "Zero Shot",
					Description: "Direct answer without examples",
					Priority:    1,
					Score:       0.9,
					Confidence:  0.85,
				},
			}
			response.PrimaryTechnique = "zero_shot"
		case "error_intent":
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid intent"})
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))
	
	// Mock Prompt Generator Server
	suite.mockPromptServer = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		suite.logger.Info("Prompt generator received request")
		
		// Verify request method and path
		assert.Equal(suite.T(), "POST", r.Method)
		assert.Equal(suite.T(), "/api/v1/generate", r.URL.Path)
		
		// Parse request body
		var req models.PromptGenerationRequest
		err := json.NewDecoder(r.Body).Decode(&req)
		require.NoError(suite.T(), err)
		
		// Verify request contains expected fields
		assert.NotEmpty(suite.T(), req.Text)
		assert.NotEmpty(suite.T(), req.Intent)
		assert.NotEmpty(suite.T(), req.Techniques)
		
		// Simulate enhanced prompt generation
		enhancedText := fmt.Sprintf("Let me help you with that step by step.\n\n%s\n\nHere's how to approach this:", req.Text)
		
		// Customize based on techniques
		for _, technique := range req.Techniques {
			switch technique {
			case "chain_of_thought":
				enhancedText += "\n\nStep 1: Understand the requirements\nStep 2: Plan the implementation\nStep 3: Write the code\nStep 4: Test and refine"
			case "few_shot":
				enhancedText += "\n\nExample:\n```python\ndef example_function():\n    return 'This is an example'\n```"
			case "zero_shot":
				enhancedText = fmt.Sprintf("To answer your question: %s", req.Text)
			}
		}
		
		// Handle error case
		if req.Text == "generation error" {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "generation failed"})
			return
		}
		
		response := models.PromptGenerationResponse{
			Text:         enhancedText,
			ModelVersion: "gpt-4-turbo",
			TokensUsed:   len(enhancedText) / 4, // Rough approximation
		}
		
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))
}

func (suite *ServiceIntegrationTestSuite) setupServiceClients() {
	// Create service clients with mock server URLs
	suite.serviceClients = &services.ServiceClients{
		IntentClassifier: &services.IntentClassifierClient{
			BaseURL: suite.mockIntentServer.URL,
			Client:  &http.Client{Timeout: 5 * time.Second},
		},
		TechniqueSelector: &services.TechniqueSelectorClient{
			BaseURL: suite.mockTechniqueServer.URL,
			Client:  &http.Client{Timeout: 5 * time.Second},
			Logger:  suite.logger,
		},
		PromptGenerator: &services.PromptGeneratorClient{
			BaseURL: suite.mockPromptServer.URL,
			Client:  &http.Client{Timeout: 5 * time.Second},
		},
		// For these tests, we'll use nil for DB and Cache
		// In real integration tests, you'd set up test instances
		Database: nil,
		Cache:    nil,
	}
}

func (suite *ServiceIntegrationTestSuite) setupRouter() {
	suite.router = gin.New()
	
	// Add middleware
	suite.router.Use(func(c *gin.Context) {
		c.Set("logger", logrus.NewEntry(suite.logger))
		c.Set("request_id", "test-request-"+time.Now().Format("20060102150405"))
		c.Next()
	})
	
	// Register routes
	suite.router.POST("/api/v1/enhance", handlers.EnhancePrompt(suite.serviceClients))
}

// Test Cases

func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_Success() {
	// Test the complete enhancement flow with all services
	req := handlers.EnhanceRequest{
		Text: "Write a Python function to implement binary search",
		Context: map[string]interface{}{
			"language": "python",
			"level":    "intermediate",
		},
	}
	
	body, err := json.Marshal(req)
	require.NoError(suite.T(), err)
	
	// Make request
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Session-ID", "test-session-123")
	
	suite.router.ServeHTTP(w, httpReq)
	
	// Verify response
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var resp handlers.EnhanceResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	// Verify response fields
	assert.Equal(suite.T(), req.Text, resp.OriginalText)
	assert.NotEmpty(suite.T(), resp.EnhancedText)
	assert.Contains(suite.T(), resp.EnhancedText, "step by step")
	assert.Equal(suite.T(), "code_generation", resp.Intent)
	assert.Equal(suite.T(), "moderate", resp.Complexity)
	assert.Contains(suite.T(), resp.TechniquesUsed, "chain_of_thought")
	assert.Contains(suite.T(), resp.TechniquesUsed, "few_shot")
	assert.Greater(suite.T(), resp.Confidence, 0.0)
	assert.Greater(suite.T(), resp.ProcessingTime, 0.0)
	
	// Verify metadata
	assert.NotNil(suite.T(), resp.Metadata)
	assert.Contains(suite.T(), resp.Metadata, "tokens_used")
	assert.Contains(suite.T(), resp.Metadata, "model_version")
}

func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_SimpleQuestion() {
	// Test with a simple question that should use different techniques
	req := handlers.EnhanceRequest{
		Text: "simple question",
	}
	
	body, err := json.Marshal(req)
	require.NoError(suite.T(), err)
	
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	
	suite.router.ServeHTTP(w, httpReq)
	
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var resp handlers.EnhanceResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "question_answering", resp.Intent)
	assert.Equal(suite.T(), "simple", resp.Complexity)
	assert.Contains(suite.T(), resp.TechniquesUsed, "zero_shot")
	assert.Contains(suite.T(), resp.EnhancedText, "To answer your question")
}

func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_ComplexAnalysis() {
	// Test with complex analysis requiring multiple techniques
	req := handlers.EnhanceRequest{
		Text: "complex analysis",
		PreferTechniques: []string{"structured_output"},
	}
	
	body, err := json.Marshal(req)
	require.NoError(suite.T(), err)
	
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	
	suite.router.ServeHTTP(w, httpReq)
	
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var resp handlers.EnhanceResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.Equal(suite.T(), "data_analysis", resp.Intent)
	assert.Equal(suite.T(), "complex", resp.Complexity)
	assert.Len(suite.T(), resp.TechniquesUsed, 2) // Should have multiple techniques
}

func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_IntentClassifierError() {
	// Test error handling when intent classifier fails
	req := handlers.EnhanceRequest{
		Text: "error trigger",
	}
	
	body, err := json.Marshal(req)
	require.NoError(suite.T(), err)
	
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	
	suite.router.ServeHTTP(w, httpReq)
	
	assert.Equal(suite.T(), http.StatusInternalServerError, w.Code)
	
	var errResp map[string]string
	err = json.Unmarshal(w.Body.Bytes(), &errResp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), errResp["error"], "Failed to analyze intent")
}

func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_PromptGeneratorError() {
	// Test error handling when prompt generator fails
	req := handlers.EnhanceRequest{
		Text: "generation error",
	}
	
	body, err := json.Marshal(req)
	require.NoError(suite.T(), err)
	
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	
	suite.router.ServeHTTP(w, httpReq)
	
	assert.Equal(suite.T(), http.StatusInternalServerError, w.Code)
	
	var errResp map[string]string
	err = json.Unmarshal(w.Body.Bytes(), &errResp)
	require.NoError(suite.T(), err)
	
	assert.Contains(suite.T(), errResp["error"], "Failed to generate enhanced prompt")
}

func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_WithAuthentication() {
	// Test enhancement with authenticated user context
	req := handlers.EnhanceRequest{
		Text: "Create a REST API endpoint",
	}
	
	body, err := json.Marshal(req)
	require.NoError(suite.T(), err)
	
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	
	// Add authentication context
	suite.router.POST("/api/v1/enhance/auth", func(c *gin.Context) {
		c.Set("user_id", "user-123")
		handlers.EnhancePrompt(suite.serviceClients)(c)
	})
	
	suite.router.ServeHTTP(w, httpReq)
	
	assert.Equal(suite.T(), http.StatusOK, w.Code)
	
	var resp handlers.EnhanceResponse
	err = json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(suite.T(), err)
	
	assert.NotEmpty(suite.T(), resp.EnhancedText)
}

func (suite *ServiceIntegrationTestSuite) TestServiceCommunication_RequestHeaders() {
	// Test that proper headers are passed between services
	// This test verifies the mock servers receive correct headers
	
	// Create a custom mock to check headers
	headerCheckServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify headers
		assert.Equal(suite.T(), "application/json", r.Header.Get("Content-Type"))
		assert.NotEmpty(suite.T(), r.Header.Get("User-Agent"))
		
		// Return minimal valid response
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(services.IntentClassificationResult{
			Intent:              "test",
			Complexity:          "simple",
			Confidence:          0.9,
			SuggestedTechniques: []string{"test"},
		})
	}))
	defer headerCheckServer.Close()
	
	// Temporarily replace intent classifier
	originalURL := suite.serviceClients.IntentClassifier.BaseURL
	suite.serviceClients.IntentClassifier.BaseURL = headerCheckServer.URL
	defer func() {
		suite.serviceClients.IntentClassifier.BaseURL = originalURL
	}()
	
	req := handlers.EnhanceRequest{
		Text: "Test headers",
	}
	
	body, _ := json.Marshal(req)
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	
	suite.router.ServeHTTP(w, httpReq)
}

func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_Timeouts() {
	// Test timeout handling
	slowServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate slow response
		time.Sleep(15 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer slowServer.Close()
	
	// Create client with short timeout
	suite.serviceClients.IntentClassifier = &services.IntentClassifierClient{
		BaseURL: slowServer.URL,
		Client:  &http.Client{Timeout: 100 * time.Millisecond},
	}
	
	req := handlers.EnhanceRequest{
		Text: "Test timeout",
	}
	
	body, _ := json.Marshal(req)
	w := httptest.NewRecorder()
	httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	
	suite.router.ServeHTTP(w, httpReq)
	
	assert.Equal(suite.T(), http.StatusInternalServerError, w.Code)
}

// Benchmark test
func (suite *ServiceIntegrationTestSuite) TestEnhanceFlow_Performance() {
	// Measure end-to-end latency
	req := handlers.EnhanceRequest{
		Text: "Optimize this database query",
	}
	
	body, _ := json.Marshal(req)
	
	// Run multiple requests and measure time
	var totalTime time.Duration
	iterations := 10
	
	for i := 0; i < iterations; i++ {
		start := time.Now()
		
		w := httptest.NewRecorder()
		httpReq := httptest.NewRequest("POST", "/api/v1/enhance", bytes.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")
		
		suite.router.ServeHTTP(w, httpReq)
		
		elapsed := time.Since(start)
		totalTime += elapsed
		
		assert.Equal(suite.T(), http.StatusOK, w.Code)
	}
	
	avgTime := totalTime / time.Duration(iterations)
	suite.logger.Infof("Average enhancement time: %v", avgTime)
	
	// Assert performance SLA (should be under 2 seconds)
	assert.Less(suite.T(), avgTime, 2*time.Second)
}

// Run the test suite
func TestServiceIntegrationTestSuite(t *testing.T) {
	suite.Run(t, new(ServiceIntegrationTestSuite))
}

// Additional helper functions for service client mocking
type IntentClassifierInterface interface {
	ClassifyIntent(ctx context.Context, text string) (*services.IntentClassificationResult, error)
}

type TechniqueSelectorInterface interface {
	SelectTechniques(ctx context.Context, req models.TechniqueSelectionRequest) ([]string, error)
}

type PromptGeneratorInterface interface {
	GeneratePrompt(ctx context.Context, req models.PromptGenerationRequest) (*models.PromptGenerationResponse, error)
}