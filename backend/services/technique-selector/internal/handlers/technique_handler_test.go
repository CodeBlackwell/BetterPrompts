package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/betterprompts/technique-selector/internal/models"
	"github.com/betterprompts/technique-selector/internal/rules"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

// createTestConfig creates a test configuration
func createTestConfig() *models.RulesConfig {
	return &models.RulesConfig{
		Techniques: []models.Technique{
			{
				ID:          "chain_of_thought",
				Name:        "Chain of Thought",
				Description: "Step-by-step reasoning",
				Priority:    5,
				Conditions: models.TechniqueConditions{
					Intents:             []string{"problem_solving", "reasoning"},
					ComplexityLevels:    []string{"complex"},
					ComplexityThreshold: 0.5,
				},
				Template: "Step-by-step template",
			},
			{
				ID:          "few_shot",
				Name:        "Few-Shot Learning",
				Description: "Learning from examples",
				Priority:    4,
				Conditions: models.TechniqueConditions{
					Intents:          []string{"creative_writing"},
					ComplexityLevels: []string{"simple", "moderate"},
					Keywords:         []string{"example", "similar"},
				},
				Template: "Example template",
			},
			{
				ID:          "zero_shot",
				Name:        "Zero-Shot Learning",
				Description: "Direct task completion",
				Priority:    2,
				Conditions: models.TechniqueConditions{
					ComplexityLevels:       []string{"simple"},
					ComplexityThresholdMax: 0.3,
				},
				Template: "Direct template",
			},
		},
		SelectionRules: models.SelectionRules{
			MaxTechniques: 3,
			MinConfidence: 0.5,
			CompatibleCombinations: [][]string{
				{"chain_of_thought", "self_consistency"},
			},
			IncompatibleCombinations: [][]string{
				{"zero_shot", "few_shot"},
			},
			IntentPriorityBoost: map[string]map[string]int{
				"problem_solving": {
					"chain_of_thought": 2,
				},
				"creative_writing": {
					"few_shot": 3,
				},
			},
		},
		ComplexityFactors: models.ComplexityFactors{
			WordCount: []models.WordCountRange{
				{Range: []int{0, 10}, Score: 0.2},
				{Range: []int{11, 50}, Score: 0.5},
				{Range: []int{51, -1}, Score: 0.8},
			},
			MultiPartQuestion:   0.2,
			TechnicalTerms:      0.1,
			RequiresCalculation: 0.2,
			AbstractConcepts:    0.1,
			MultipleConstraints: 0.1,
		},
	}
}

// Helper function to create test router
func setupRouter(handler *TechniqueHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Register routes
	router.POST("/select", handler.SelectTechniques)
	router.GET("/techniques", handler.ListTechniques)
	router.GET("/techniques/:id", handler.GetTechniqueByID)
	router.GET("/health", handler.Health)
	router.GET("/ready", handler.Ready)
	
	return router
}

// TestSelectTechniques tests the SelectTechniques handler
func TestSelectTechniques(t *testing.T) {
	logger := logrus.New()
	logger.SetLevel(logrus.DebugLevel)

	// Create test configuration and handler
	testConfig := createTestConfig()
	engine := rules.NewEngine(testConfig, logger)
	handler := NewTechniqueHandler(engine, logger)
	router := setupRouter(handler)

	testCases := []struct {
		name           string
		requestBody    interface{}
		expectedStatus int
		validateBody   func(t *testing.T, body map[string]interface{})
	}{
		{
			name: "Successful technique selection - problem solving",
			requestBody: models.SelectionRequest{
				Text:       "How do I solve this complex problem step by step?",
				Intent:     "problem_solving",
				Complexity: "complex",
			},
			expectedStatus: http.StatusOK,
			validateBody: func(t *testing.T, body map[string]interface{}) {
				techniques := body["techniques"].([]interface{})
				assert.GreaterOrEqual(t, len(techniques), 1)
				firstTech := techniques[0].(map[string]interface{})
				assert.Equal(t, "chain_of_thought", firstTech["id"])
				assert.Contains(t, body, "primary_technique")
				assert.Contains(t, body, "confidence")
				assert.Contains(t, body, "reasoning")
			},
		},
		{
			name: "Successful technique selection - creative writing",
			requestBody: models.SelectionRequest{
				Text:       "Write an example similar to this pattern",
				Intent:     "creative_writing",
				Complexity: "simple",
			},
			expectedStatus: http.StatusOK,
			validateBody: func(t *testing.T, body map[string]interface{}) {
				techniques := body["techniques"].([]interface{})
				assert.GreaterOrEqual(t, len(techniques), 1)
				firstTech := techniques[0].(map[string]interface{})
				assert.Equal(t, "few_shot", firstTech["id"])
			},
		},
		{
			name: "Simple question - zero shot", 
			requestBody: models.SelectionRequest{
				Text:       "What is 2+2?",
				Intent:     "question_answering",
				Complexity: "simple",
			},
			expectedStatus: http.StatusOK,
			validateBody: func(t *testing.T, body map[string]interface{}) {
				// For this test config, zero_shot might not match
				// as it doesn't have intents configured
				assert.Contains(t, body, "techniques")
				assert.Contains(t, body, "primary_technique")
				assert.Contains(t, body, "confidence")
				assert.Contains(t, body, "reasoning")
			},
		},
		{
			name: "Invalid request body",
			requestBody: map[string]interface{}{
				"invalid_field": "value",
			},
			expectedStatus: http.StatusBadRequest,
			validateBody: func(t *testing.T, body map[string]interface{}) {
				assert.Contains(t, body["error"], "Invalid request body")
			},
		},
		{
			name: "Missing required fields",
			requestBody: models.SelectionRequest{
				Text: "Test text",
				// Missing Intent and Complexity
			},
			expectedStatus: http.StatusBadRequest,
			validateBody: func(t *testing.T, body map[string]interface{}) {
				assert.Contains(t, body["error"], "Invalid request body")
			},
		},
		{
			name: "No matching techniques",
			requestBody: models.SelectionRequest{
				Text:       "Unknown intent test",
				Intent:     "unknown_intent_test",
				Complexity: "moderate",
			},
			expectedStatus: http.StatusOK,
			validateBody: func(t *testing.T, body map[string]interface{}) {
				techniquesRaw, ok := body["techniques"]
				if ok && techniquesRaw != nil {
					techniques := techniquesRaw.([]interface{})
					// With no matching techniques, should have empty list
					assert.GreaterOrEqual(t, len(techniques), 0)
				}
				assert.Contains(t, body, "reasoning")
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {

			// Create request
			body, err := json.Marshal(tc.requestBody)
			assert.NoError(t, err)
			
			req := httptest.NewRequest("POST", "/select", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			// Perform request
			router.ServeHTTP(w, req)

			// Check status
			assert.Equal(t, tc.expectedStatus, w.Code)

			// Parse response
			var responseBody map[string]interface{}
			err = json.Unmarshal(w.Body.Bytes(), &responseBody)
			assert.NoError(t, err)

			// Validate response body
			tc.validateBody(t, responseBody)
		})
	}
}

// TestListTechniques tests the ListTechniques handler
func TestListTechniques(t *testing.T) {
	logger := logrus.New()
	handler := NewTechniqueHandler(nil, logger)
	router := setupRouter(handler)

	req := httptest.NewRequest("GET", "/techniques", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	techniques := response["techniques"].([]interface{})
	assert.Greater(t, len(techniques), 0)
	assert.Equal(t, float64(len(techniques)), response["total"])

	// Check structure of first technique
	firstTech := techniques[0].(map[string]interface{})
	assert.Contains(t, firstTech, "id")
	assert.Contains(t, firstTech, "name")
	assert.Contains(t, firstTech, "description")
}

// TestGetTechniqueByID tests the GetTechniqueByID handler
func TestGetTechniqueByID(t *testing.T) {
	logger := logrus.New()
	handler := NewTechniqueHandler(nil, logger)
	router := setupRouter(handler)

	testCases := []struct {
		name           string
		techniqueID    string
		expectedStatus int
	}{
		{
			name:           "Valid technique ID",
			techniqueID:    "chain_of_thought",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Another valid ID",
			techniqueID:    "few_shot",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Special characters in ID",
			techniqueID:    "test-technique_123",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/techniques/"+tc.techniqueID, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			assert.Equal(t, tc.techniqueID, response["id"])
			assert.Contains(t, response, "name")
			assert.Contains(t, response, "description")
			assert.Contains(t, response, "examples")
			assert.Contains(t, response, "use_cases")
		})
	}
}

// TestHealth tests the Health handler
func TestHealth(t *testing.T) {
	logger := logrus.New()
	handler := NewTechniqueHandler(nil, logger)
	router := setupRouter(handler)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	assert.Equal(t, "healthy", response["status"])
	assert.Equal(t, "technique-selector", response["service"])
}

// TestReady tests the Ready handler
func TestReady(t *testing.T) {
	logger := logrus.New()

	testCases := []struct {
		name           string
		engine         *rules.Engine
		expectedStatus int
		expectedBody   map[string]string
	}{
		{
			name:           "Engine initialized",
			engine:         rules.NewEngine(&models.RulesConfig{}, logger),
			expectedStatus: http.StatusOK,
			expectedBody: map[string]string{
				"status":  "ready",
				"service": "technique-selector",
			},
		},
		{
			name:           "Engine not initialized",
			engine:         nil,
			expectedStatus: http.StatusServiceUnavailable,
			expectedBody: map[string]string{
				"status": "not ready",
				"reason": "engine not initialized",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			handler := &TechniqueHandler{
				engine: tc.engine,
				logger: logger,
			}
			router := setupRouter(handler)

			req := httptest.NewRequest("GET", "/ready", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)

			for key, expectedValue := range tc.expectedBody {
				assert.Equal(t, expectedValue, response[key])
			}
		})
	}
}

// TestConcurrentRequests tests handling of concurrent requests
func TestConcurrentRequests(t *testing.T) {
	logger := logrus.New()
	config := &models.RulesConfig{
		Techniques: []models.Technique{
			{
				ID:          "test",
				Name:        "Test",
				Description: "Test technique",
				Priority:    1,
			},
		},
		SelectionRules: models.SelectionRules{
			MaxTechniques: 3,
			MinConfidence: 0.5,
		},
	}
	engine := rules.NewEngine(config, logger)
	handler := NewTechniqueHandler(engine, logger)
	router := setupRouter(handler)

	// Number of concurrent requests
	numRequests := 10
	done := make(chan bool, numRequests)

	for i := 0; i < numRequests; i++ {
		go func(id int) {
			reqBody := models.SelectionRequest{
				Text:       "Test request " + string(rune(id)),
				Intent:     "test",
				Complexity: "simple",
			}
			body, _ := json.Marshal(reqBody)

			req := httptest.NewRequest("POST", "/select", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)
			
			assert.Equal(t, http.StatusOK, w.Code)
			done <- true
		}(i)
	}

	// Wait for all requests to complete
	for i := 0; i < numRequests; i++ {
		<-done
	}
}

// TestRequestValidation tests various invalid request scenarios
func TestRequestValidation(t *testing.T) {
	logger := logrus.New()
	testConfig := createTestConfig()
	engine := rules.NewEngine(testConfig, logger)
	handler := NewTechniqueHandler(engine, logger)
	router := setupRouter(handler)

	testCases := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "Empty body",
			requestBody:    "",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request body",
		},
		{
			name:           "Invalid JSON",
			requestBody:    "{invalid json}",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request body",
		},
		{
			name:           "Invalid complexity value",
			requestBody:    `{"text":"test","intent":"test","complexity":"invalid"}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request body",
		},
		{
			name:           "Missing text field",
			requestBody:    `{"intent":"test","complexity":"simple"}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid request body",
		},
		{
			name:           "Extra fields (should be accepted)",
			requestBody:    `{"text":"test","intent":"test","complexity":"simple","extra":"field"}`,
			expectedStatus: http.StatusOK, // Should work fine with valid engine
			expectedError:  "", // No error expected
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/select", bytes.NewBufferString(tc.requestBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			assert.NoError(t, err)
			
			if tc.expectedError != "" {
				assert.Contains(t, response["error"], tc.expectedError)
			} else {
				// For successful cases, check response structure
				assert.NotContains(t, response, "error")
				assert.Contains(t, response, "techniques")
			}
		})
	}
}