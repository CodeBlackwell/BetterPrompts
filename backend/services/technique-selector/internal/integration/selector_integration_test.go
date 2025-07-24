// +build integration

package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/betterprompts/technique-selector/internal/config"
	"github.com/betterprompts/technique-selector/internal/handlers"
	"github.com/betterprompts/technique-selector/internal/models"
	"github.com/betterprompts/technique-selector/internal/rules"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createTestConfig creates a comprehensive test configuration
func createTestConfig() *models.RulesConfig {
	return &models.RulesConfig{
		Techniques: []models.Technique{
			{
				ID:          "chain_of_thought",
				Name:        "Chain of Thought",
				Description: "Step-by-step reasoning that breaks down complex problems",
				Priority:    5,
				Conditions: models.TechniqueConditions{
					Intents:             []string{"reasoning", "problem_solving", "data_analysis"},
					ComplexityLevels:    []string{"moderate", "complex"},
					ComplexityThreshold: 0.5,
					Keywords:            []string{"explain", "why", "how", "analyze", "solve", "calculate"},
					MultiStepIndicators: []string{"step by step", "first", "then", "finally"},
				},
				Template: "I'll work through this step-by-step.",
			},
			{
				ID:          "tree_of_thoughts",
				Name:        "Tree of Thoughts",
				Description: "Explores multiple reasoning paths",
				Priority:    4,
				Conditions: models.TechniqueConditions{
					Intents:             []string{"problem_solving", "task_planning"},
					ComplexityLevels:    []string{"complex"},
					ComplexityThreshold: 0.7,
					Keywords:            []string{"alternatives", "options", "approaches", "explore"},
					RequiresExploration: true,
				},
				Template: "Let me explore different approaches.",
			},
			{
				ID:          "few_shot",
				Name:        "Few-Shot Learning",
				Description: "Provides examples to guide the response",
				Priority:    3,
				Conditions: models.TechniqueConditions{
					Intents:          []string{"creative_writing", "code_generation", "translation"},
					ComplexityLevels: []string{"simple", "moderate"},
					Keywords:         []string{"example", "like", "similar", "pattern"},
					RequiresPattern:  true,
				},
				Template: "Here are some examples:",
			},
			{
				ID:          "zero_shot",
				Name:        "Zero-Shot Learning",
				Description: "Direct task completion without examples",
				Priority:    2,
				Conditions: models.TechniqueConditions{
					ComplexityLevels:       []string{"simple"},
					ComplexityThresholdMax: 0.3,
					SimpleRequest:          true,
				},
				Template: "I'll directly answer your question.",
			},
			{
				ID:          "self_consistency",
				Name:        "Self-Consistency",
				Description: "Multiple attempts with consistency verification",
				Priority:    3,
				Conditions: models.TechniqueConditions{
					Intents:             []string{"data_analysis", "reasoning", "fact_checking"},
					ComplexityThreshold: 0.6,
					RequiresAccuracy:    true,
					Keywords:            []string{"verify", "accurate", "check", "confirm"},
				},
				Template: "Let me verify this through multiple approaches.",
			},
			{
				ID:          "structured_output",
				Name:        "Structured Output",
				Description: "Provides response in a specific format",
				Priority:    2,
				Conditions: models.TechniqueConditions{
					Intents:            []string{"data_extraction", "summarization", "documentation"},
					Keywords:           []string{"format", "structure", "organize", "list"},
					RequiresStructure:  true,
				},
				Template: "I'll organize this in a structured format.",
			},
		},
		SelectionRules: models.SelectionRules{
			MaxTechniques: 3,
			MinConfidence: 0.5,
			CompatibleCombinations: [][]string{
				{"chain_of_thought", "self_consistency"},
				{"chain_of_thought", "structured_output"},
				{"tree_of_thoughts", "self_consistency"},
			},
			IncompatibleCombinations: [][]string{
				{"zero_shot", "few_shot"},
				{"chain_of_thought", "tree_of_thoughts"},
			},
			IntentPriorityBoost: map[string]map[string]int{
				"problem_solving": {
					"chain_of_thought": 2,
					"tree_of_thoughts": 1,
				},
				"creative_writing": {
					"few_shot": 3,
				},
				"data_analysis": {
					"self_consistency": 2,
					"structured_output": 1,
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

// setupTestServer creates a test server with the full stack
func setupTestServer(t *testing.T, config *models.RulesConfig) *gin.Engine {
	logger := logrus.New()
	logger.SetLevel(logrus.DebugLevel)

	engine := rules.NewEngine(config, logger)
	handler := handlers.NewTechniqueHandler(engine, logger)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Register routes
	api := router.Group("/api/v1")
	{
		api.POST("/select", handler.SelectTechniques)
		api.GET("/techniques", handler.ListTechniques)
		api.GET("/techniques/:id", handler.GetTechniqueByID)
		api.GET("/health", handler.Health)
		api.GET("/ready", handler.Ready)
	}

	return router
}

// TestCompleteSelectionFlow tests the complete technique selection flow
func TestCompleteSelectionFlow(t *testing.T) {
	config := createTestConfig()
	router := setupTestServer(t, config)

	testCases := []struct {
		name                 string
		request              models.SelectionRequest
		expectedTechniques   []string
		expectedPrimary      string
		minConfidence        float64
		validateCombinations bool
	}{
		{
			name: "Complex problem solving",
			request: models.SelectionRequest{
				Text:       "How do I solve this complex algorithmic problem? I need to analyze the time complexity and optimize the solution step by step.",
				Intent:     "problem_solving",
				Complexity: "complex",
			},
			expectedTechniques:   []string{"chain_of_thought"},
			expectedPrimary:      "chain_of_thought",
			minConfidence:        0.7,
			validateCombinations: true,
		},
		{
			name: "Creative writing with examples",
			request: models.SelectionRequest{
				Text:       "Can you write a haiku similar to this example pattern?",
				Intent:     "creative_writing",
				Complexity: "simple",
			},
			expectedTechniques:   []string{"few_shot"},
			expectedPrimary:      "few_shot",
			minConfidence:        0.6,
			validateCombinations: true,
		},
		{
			name: "Data analysis with verification",
			request: models.SelectionRequest{
				Text:       "Analyze this dataset and verify the accuracy of the statistical results. Check if the conclusions are correct.",
				Intent:     "data_analysis",
				Complexity: "complex",
			},
			expectedTechniques:   []string{"self_consistency", "structured_output"},
			expectedPrimary:      "self_consistency",
			minConfidence:        0.7,
			validateCombinations: true,
		},
		{
			name: "Simple direct question",
			request: models.SelectionRequest{
				Text:       "What is the capital of France?",
				Intent:     "question_answering",
				Complexity: "simple",
			},
			expectedTechniques:   []string{"zero_shot"},
			expectedPrimary:      "zero_shot",
			minConfidence:        0.5,
			validateCombinations: false,
		},
		{
			name: "Complex exploration task",
			request: models.SelectionRequest{
				Text:       "Explore different approaches and alternatives to implement this feature. What are the various options we should consider?",
				Intent:     "task_planning",
				Complexity: "complex",
			},
			expectedTechniques:   []string{"tree_of_thoughts"},
			expectedPrimary:      "tree_of_thoughts",
			minConfidence:        0.6,
			validateCombinations: true,
		},
		{
			name: "Automatic complexity detection",
			request: models.SelectionRequest{
				Text:   "Explain the concept",
				Intent: "reasoning",
				// Complexity will be calculated automatically
			},
			expectedTechniques:   []string{"chain_of_thought"},
			minConfidence:        0.5,
			validateCombinations: false,
		},
		{
			name: "Multiple compatible techniques",
			request: models.SelectionRequest{
				Text:          "Analyze this complex data step by step and verify the accuracy of each calculation.",
				Intent:        "data_analysis",
				Complexity:    "complex",
				MaxTechniques: 2,
			},
			expectedTechniques:   []string{"chain_of_thought", "self_consistency"},
			minConfidence:        0.6,
			validateCombinations: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Prepare request
			body, err := json.Marshal(tc.request)
			require.NoError(t, err)

			req := httptest.NewRequest("POST", "/api/v1/select", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			// Execute request
			router.ServeHTTP(w, req)

			// Check response status
			assert.Equal(t, http.StatusOK, w.Code, "Response body: %s", w.Body.String())

			// Parse response
			var response models.SelectionResponse
			err = json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)

			// Validate techniques
			techniqueIDs := make([]string, len(response.Techniques))
			for i, tech := range response.Techniques {
				techniqueIDs[i] = tech.ID
			}

			// Check expected techniques are present
			for _, expectedID := range tc.expectedTechniques {
				assert.Contains(t, techniqueIDs, expectedID, 
					"Expected technique %s not found. Got: %v", expectedID, techniqueIDs)
			}

			// Check primary technique
			if tc.expectedPrimary != "" {
				assert.Equal(t, tc.expectedPrimary, response.PrimaryTechnique)
			}

			// Check confidence
			assert.GreaterOrEqual(t, response.Confidence, tc.minConfidence)

			// Validate each technique
			for _, tech := range response.Techniques {
				assert.NotEmpty(t, tech.ID)
				assert.NotEmpty(t, tech.Name)
				assert.NotEmpty(t, tech.Description)
				assert.Greater(t, tech.Score, 0.0)
				assert.GreaterOrEqual(t, tech.Confidence, 0.5)
				assert.NotEmpty(t, tech.Reasoning)
			}

			// Validate combinations if required
			if tc.validateCombinations && len(response.Techniques) > 1 {
				validateTechniqueCombinations(t, response.Techniques, config.SelectionRules)
			}

			// Check metadata
			assert.NotNil(t, response.Metadata)
			assert.Contains(t, response.Metadata, "complexity")
			assert.Contains(t, response.Metadata, "intent")
			assert.Contains(t, response.Metadata, "word_count")
			assert.Contains(t, response.Metadata, "techniques_evaluated")

			// Check reasoning
			assert.NotEmpty(t, response.Reasoning)
		})
	}
}

// validateTechniqueCombinations checks that selected techniques are compatible
func validateTechniqueCombinations(t *testing.T, techniques []models.SelectedTechnique, rules models.SelectionRules) {
	// Check for incompatible combinations
	for i := 0; i < len(techniques); i++ {
		for j := i + 1; j < len(techniques); j++ {
			tech1 := techniques[i].ID
			tech2 := techniques[j].ID
			
			for _, incompatible := range rules.IncompatibleCombinations {
				if (incompatible[0] == tech1 && incompatible[1] == tech2) ||
				   (incompatible[0] == tech2 && incompatible[1] == tech1) {
					t.Errorf("Found incompatible combination: %s and %s", tech1, tech2)
				}
			}
		}
	}
}

// TestEdgeCases tests edge cases and error scenarios
func TestEdgeCases(t *testing.T) {
	config := createTestConfig()
	router := setupTestServer(t, config)

	testCases := []struct {
		name           string
		request        models.SelectionRequest
		expectedStatus int
	}{
		{
			name: "Very long text",
			request: models.SelectionRequest{
				Text:       string(make([]byte, 10000)), // 10KB of text
				Intent:     "reasoning",
				Complexity: "complex",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Empty text",
			request: models.SelectionRequest{
				Text:       "",
				Intent:     "reasoning",
				Complexity: "simple",
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Unknown intent",
			request: models.SelectionRequest{
				Text:       "Test text",
				Intent:     "unknown_intent",
				Complexity: "moderate",
			},
			expectedStatus: http.StatusOK, // Should still work, just might not match techniques
		},
		{
			name: "Special characters in text",
			request: models.SelectionRequest{
				Text:       "Test with special chars: @#$%^&*()_+{}[]|\\:\";<>?,./",
				Intent:     "question_answering",
				Complexity: "simple",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Unicode text",
			request: models.SelectionRequest{
				Text:       "测试中文 テスト 🎯 émojis",
				Intent:     "translation",
				Complexity: "moderate",
			},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(tc.request)
			require.NoError(t, err)

			req := httptest.NewRequest("POST", "/api/v1/select", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code, "Response body: %s", w.Body.String())
		})
	}
}

// TestHealthAndReadiness tests the health and readiness endpoints
func TestHealthAndReadiness(t *testing.T) {
	config := createTestConfig()
	router := setupTestServer(t, config)

	// Test health endpoint
	t.Run("Health check", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/health", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "healthy", response["status"])
		assert.Equal(t, "technique-selector", response["service"])
	})

	// Test readiness endpoint
	t.Run("Readiness check", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/ready", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]string
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "ready", response["status"])
		assert.Equal(t, "technique-selector", response["service"])
	})
}

// TestConfigurationLoading tests loading configuration from YAML file
func TestConfigurationLoading(t *testing.T) {
	// Create temporary config file
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "test_rules.yaml")

	configContent := `
techniques:
  - id: "test_technique"
    name: "Test Technique"
    description: "Integration test technique"
    priority: 5
    conditions:
      intents: ["test_intent"]
      complexity_levels: ["moderate"]
      keywords: ["test", "integration"]
    template: "Test template"

selection_rules:
  max_techniques: 2
  min_confidence: 0.5

complexity_factors:
  word_count:
    - range: [0, 50]
      score: 0.5
  multi_part_question: 0.1
  technical_terms: 0.1
  requires_calculation: 0.1
  abstract_concepts: 0.1
  multiple_constraints: 0.1
`

	err := os.WriteFile(configPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Load config
	loadedConfig, err := config.LoadConfig(configPath)
	require.NoError(t, err)
	require.NotNil(t, loadedConfig)

	// Set up server with loaded config
	router := setupTestServer(t, loadedConfig)

	// Test selection with loaded config
	request := models.SelectionRequest{
		Text:       "This is a test integration scenario",
		Intent:     "test_intent",
		Complexity: "moderate",
	}

	body, err := json.Marshal(request)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/api/v1/select", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response models.SelectionResponse
	err = json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	// Should select our test technique
	assert.Len(t, response.Techniques, 1)
	assert.Equal(t, "test_technique", response.Techniques[0].ID)
}