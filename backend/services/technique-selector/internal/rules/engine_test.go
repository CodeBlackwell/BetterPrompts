package rules

import (
	"strings"
	"testing"

	"github.com/betterprompts/technique-selector/internal/models"
	"github.com/sirupsen/logrus"
)

// Helper function to create test logger
func createTestLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetLevel(logrus.DebugLevel)
	return logger
}

// Helper function to create test config
func createTestConfig() *models.RulesConfig {
	return &models.RulesConfig{
		Techniques: []models.Technique{
			{
				ID:          "chain_of_thought",
				Name:        "Chain of Thought",
				Description: "Step-by-step reasoning",
				Priority:    5,
				Conditions: models.TechniqueConditions{
					Intents:             []string{"reasoning", "problem_solving"},
					ComplexityLevels:    []string{"moderate", "complex"},
					ComplexityThreshold: 0.5,
					Keywords:            []string{"explain", "why", "how"},
					MultiStepIndicators: []string{"step by step", "first", "then"},
				},
				Template: "Let me break this down step by step.",
			},
			{
				ID:          "tree_of_thoughts",
				Name:        "Tree of Thoughts",
				Description: "Multiple reasoning paths",
				Priority:    3,
				Conditions: models.TechniqueConditions{
					Intents:             []string{"problem_solving", "task_planning"},
					ComplexityLevels:    []string{"complex"},
					ComplexityThreshold: 0.7,
					Keywords:            []string{"alternatives", "options", "approaches"},
					RequiresExploration: true,
				},
				Template: "Let me explore different approaches.",
			},
			{
				ID:          "few_shot",
				Name:        "Few-Shot Learning",
				Description: "Learning from examples",
				Priority:    4,
				Conditions: models.TechniqueConditions{
					Intents:          []string{"creative_writing", "code_generation"},
					ComplexityLevels: []string{"simple", "moderate"},
					Keywords:         []string{"example", "like", "similar"},
					RequiresPattern:  true,
				},
				Template: "Here are some examples:",
			},
			{
				ID:          "zero_shot",
				Name:        "Zero-Shot Learning",
				Description: "Direct task completion",
				Priority:    2,
				Conditions: models.TechniqueConditions{
					ComplexityLevels:      []string{"simple"},
					ComplexityThresholdMax: 0.3,
					SimpleRequest:         true,
				},
				Template: "I'll directly answer your question.",
			},
			{
				ID:          "self_consistency",
				Name:        "Self-Consistency",
				Description: "Multiple attempts with verification",
				Priority:    3,
				Conditions: models.TechniqueConditions{
					Intents:             []string{"data_analysis", "reasoning"},
					ComplexityThreshold: 0.6,
					RequiresAccuracy:    true,
					Keywords:            []string{"verify", "accurate", "check"},
				},
				Template: "Let me verify this through multiple approaches.",
			},
		},
		SelectionRules: models.SelectionRules{
			MaxTechniques: 3,
			MinConfidence: 0.5,
			CompatibleCombinations: [][]string{
				{"chain_of_thought", "self_consistency"},
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

// TestNewEngine tests engine creation
func TestNewEngine(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	
	engine := NewEngine(config, logger)
	
	if engine == nil {
		t.Fatal("Expected engine to be created, got nil")
	}
	if engine.config != config {
		t.Error("Expected engine config to match provided config")
	}
	if engine.logger != logger {
		t.Error("Expected engine logger to match provided logger")
	}
}

// TestComplexityConversion tests complexity string/float conversion
func TestComplexityConversion(t *testing.T) {
	testCases := []struct {
		name     string
		strValue string
		expected float64
	}{
		{"Simple", "simple", 0.2},
		{"Moderate", "moderate", 0.5},
		{"Complex", "complex", 0.8},
		{"Unknown", "unknown", 0.5}, // defaults to moderate
		{"Empty", "", 0.5},          // defaults to moderate
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := complexityStringToFloat(tc.strValue)
			if result != tc.expected {
				t.Errorf("Expected %f for '%s', got %f", tc.expected, tc.strValue, result)
			}
		})
	}
}

func TestComplexityFloatToString(t *testing.T) {
	testCases := []struct {
		name     string
		value    float64
		expected string
	}{
		{"Low complexity", 0.2, "simple"},
		{"Simple boundary", 0.33, "simple"},
		{"Moderate low", 0.34, "moderate"},
		{"Moderate high", 0.66, "moderate"},
		{"Complex boundary", 0.67, "complex"},
		{"High complexity", 0.9, "complex"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := complexityFloatToString(tc.value)
			if result != tc.expected {
				t.Errorf("Expected '%s' for %f, got '%s'", tc.expected, tc.value, result)
			}
		})
	}
}

// TestSelectTechniques tests the main selection flow
func TestSelectTechniques(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	engine := NewEngine(config, logger)

	testCases := []struct {
		name                  string
		request               *models.SelectionRequest
		expectedPrimary       string
		expectedTechniqueIDs  []string
		minTechniques         int
		maxTechniques         int
	}{
		{
			name: "Simple problem solving",
			request: &models.SelectionRequest{
				Text:       "How do I solve this step by step?",
				Intent:     "problem_solving",
				Complexity: "moderate",
			},
			expectedPrimary:      "chain_of_thought",
			expectedTechniqueIDs: []string{"chain_of_thought"},
			minTechniques:        1,
			maxTechniques:        1,
		},
		{
			name: "Complex problem with exploration",
			request: &models.SelectionRequest{
				Text:       "What are the different approaches and alternatives to solve this complex problem? Let me explore the options.",
				Intent:     "problem_solving",
				Complexity: "complex",
			},
			expectedPrimary:      "tree_of_thoughts",
			expectedTechniqueIDs: []string{"tree_of_thoughts"},
			minTechniques:        1,
			maxTechniques:        2,
		},
		{
			name: "Creative writing with examples",
			request: &models.SelectionRequest{
				Text:       "Can you write something similar to this example?",
				Intent:     "creative_writing",
				Complexity: "moderate",
			},
			expectedPrimary:      "few_shot",
			expectedTechniqueIDs: []string{"few_shot"},
			minTechniques:        1,
			maxTechniques:        1,
		},
		{
			name: "Simple direct question",
			request: &models.SelectionRequest{
				Text:       "What is 2+2?",
				Intent:     "question_answering",
				Complexity: "simple",
			},
			expectedPrimary:      "zero_shot",
			expectedTechniqueIDs: []string{"zero_shot"},
			minTechniques:        1,
			maxTechniques:        1,
		},
		{
			name: "Data analysis requiring accuracy",
			request: &models.SelectionRequest{
				Text:       "Analyze this data and verify the accuracy of the results.",
				Intent:     "data_analysis",
				Complexity: "complex",
			},
			expectedTechniqueIDs: []string{"self_consistency"},
			minTechniques:        1,
			maxTechniques:        2,
		},
		{
			name: "Max techniques limit",
			request: &models.SelectionRequest{
				Text:          "Complex problem needing multiple techniques",
				Intent:        "problem_solving",
				Complexity:    "complex",
				MaxTechniques: 1,
			},
			minTechniques: 1,
			maxTechniques: 1,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			response, err := engine.SelectTechniques(tc.request)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			// Check response structure
			if response == nil {
				t.Fatal("Expected response, got nil")
			}

			// Check number of techniques
			if len(response.Techniques) < tc.minTechniques {
				t.Errorf("Expected at least %d techniques, got %d", tc.minTechniques, len(response.Techniques))
			}
			if len(response.Techniques) > tc.maxTechniques {
				t.Errorf("Expected at most %d techniques, got %d", tc.maxTechniques, len(response.Techniques))
			}

			// Check primary technique
			if tc.expectedPrimary != "" && response.PrimaryTechnique != tc.expectedPrimary {
				t.Errorf("Expected primary technique '%s', got '%s'", tc.expectedPrimary, response.PrimaryTechnique)
			}

			// Check expected techniques are included
			if len(tc.expectedTechniqueIDs) > 0 {
				techniqueIDs := make(map[string]bool)
				for _, tech := range response.Techniques {
					techniqueIDs[tech.ID] = true
				}
				for _, expectedID := range tc.expectedTechniqueIDs {
					if !techniqueIDs[expectedID] {
						t.Errorf("Expected technique '%s' not found in response", expectedID)
					}
				}
			}

			// Check confidence
			if response.Confidence < 0 || response.Confidence > 1 {
				t.Errorf("Confidence should be between 0 and 1, got %f", response.Confidence)
			}

			// Check reasoning
			if response.Reasoning == "" {
				t.Error("Expected reasoning to be provided")
			}

			// Check metadata
			if response.Metadata == nil {
				t.Error("Expected metadata to be provided")
			} else {
				if _, ok := response.Metadata["complexity"]; !ok {
					t.Error("Expected complexity in metadata")
				}
				if _, ok := response.Metadata["intent"]; !ok {
					t.Error("Expected intent in metadata")
				}
				if _, ok := response.Metadata["word_count"]; !ok {
					t.Error("Expected word_count in metadata")
				}
			}
		})
	}
}

// TestScoreTechnique tests individual technique scoring
func TestScoreTechnique(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	engine := NewEngine(config, logger)

	testCases := []struct {
		name           string
		technique      models.Technique
		request        *models.SelectionRequest
		complexityFloat float64
		expectScore    bool
		minScore       float64
	}{
		{
			name:      "Matching intent and complexity",
			technique: config.Techniques[0], // chain_of_thought
			request: &models.SelectionRequest{
				Text:       "Explain how this works step by step",
				Intent:     "reasoning",
				Complexity: "moderate",
			},
			complexityFloat: 0.5,
			expectScore:     true,
			minScore:        50.0, // intent match (30) + complexity match (20) + keywords + priority
		},
		{
			name:      "Non-matching intent",
			technique: config.Techniques[0], // chain_of_thought
			request: &models.SelectionRequest{
				Text:       "Write a poem",
				Intent:     "creative_writing",
				Complexity: "moderate",
			},
			complexityFloat: 0.5,
			expectScore:     false,
			minScore:        0,
		},
		{
			name:      "Complexity too low",
			technique: config.Techniques[1], // tree_of_thoughts (requires 0.7)
			request: &models.SelectionRequest{
				Text:       "Simple question",
				Intent:     "problem_solving",
				Complexity: "simple",
			},
			complexityFloat: 0.2,
			expectScore:     false,
			minScore:        0,
		},
		{
			name:      "Keyword matching",
			technique: config.Techniques[2], // few_shot
			request: &models.SelectionRequest{
				Text:       "Can you give me an example similar to this pattern?",
				Intent:     "creative_writing",
				Complexity: "moderate",
			},
			complexityFloat: 0.5,
			expectScore:     true,
			minScore:        40.0, // intent match + keywords + priority
		},
		{
			name:      "Multi-step indicators",
			technique: config.Techniques[0], // chain_of_thought
			request: &models.SelectionRequest{
				Text:       "First do this, then that, step by step",
				Intent:     "problem_solving",
				Complexity: "moderate",
			},
			complexityFloat: 0.5,
			expectScore:     true,
			minScore:        60.0, // higher score due to multi-step indicators
		},
		{
			name:      "Simple request matching",
			technique: config.Techniques[3], // zero_shot
			request: &models.SelectionRequest{
				Text:       "What is the capital of France?",
				Intent:     "question_answering",
				Complexity: "simple",
			},
			complexityFloat: 0.2,
			expectScore:     true,
			minScore:        20.0, // simple request match + priority
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			score, confidence, reasoning := engine.scoreTechnique(tc.technique, tc.request, tc.complexityFloat)

			if tc.expectScore && score == 0 {
				t.Errorf("Expected score > 0, got %f. Reasoning: %s", score, reasoning)
			}
			if !tc.expectScore && score > 0 {
				t.Errorf("Expected score = 0, got %f. Reasoning: %s", score, reasoning)
			}
			if tc.expectScore && score < tc.minScore {
				t.Errorf("Expected score >= %f, got %f. Reasoning: %s", tc.minScore, score, reasoning)
			}

			// Check confidence is valid
			if score > 0 && (confidence < 0 || confidence > 1) {
				t.Errorf("Confidence should be between 0 and 1, got %f", confidence)
			}

			// Check reasoning is provided when score > 0
			if score > 0 && reasoning == "" {
				t.Error("Expected reasoning when score > 0")
			}
		})
	}
}

// TestFilterAndSort tests filtering and sorting of techniques
func TestFilterAndSort(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	engine := NewEngine(config, logger)

	techniques := []models.SelectedTechnique{
		{ID: "tech1", Score: 80, Confidence: 0.8},
		{ID: "tech2", Score: 60, Confidence: 0.6},
		{ID: "tech3", Score: 40, Confidence: 0.4}, // Below min confidence
		{ID: "tech4", Score: 90, Confidence: 0.9},
		{ID: "tech5", Score: 70, Confidence: 0.7},
	}

	req := &models.SelectionRequest{}
	filtered := engine.filterAndSort(techniques, req)

	// Check filtering (min confidence is 0.5)
	if len(filtered) != 4 {
		t.Errorf("Expected 4 techniques after filtering, got %d", len(filtered))
	}

	// Check sorting (descending by score)
	expectedOrder := []string{"tech4", "tech1", "tech5", "tech2"}
	for i, tech := range filtered {
		if tech.ID != expectedOrder[i] {
			t.Errorf("Expected technique %s at position %d, got %s", expectedOrder[i], i, tech.ID)
		}
	}
}

// TestApplyCombinationRules tests compatibility rules
func TestApplyCombinationRules(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	engine := NewEngine(config, logger)

	testCases := []struct {
		name               string
		techniques         []models.SelectedTechnique
		expectedTechIDs    []string
		expectedRemoved    []string
	}{
		{
			name: "Compatible techniques",
			techniques: []models.SelectedTechnique{
				{ID: "chain_of_thought", Score: 90},
				{ID: "self_consistency", Score: 80},
			},
			expectedTechIDs: []string{"chain_of_thought", "self_consistency"},
			expectedRemoved: []string{},
		},
		{
			name: "Incompatible techniques",
			techniques: []models.SelectedTechnique{
				{ID: "chain_of_thought", Score: 90},
				{ID: "tree_of_thoughts", Score: 85}, // Incompatible with chain_of_thought
				{ID: "self_consistency", Score: 80},
			},
			expectedTechIDs: []string{"chain_of_thought", "self_consistency"},
			expectedRemoved: []string{"tree_of_thoughts"},
		},
		{
			name: "Multiple incompatibilities",
			techniques: []models.SelectedTechnique{
				{ID: "zero_shot", Score: 90},
				{ID: "few_shot", Score: 85},     // Incompatible with zero_shot
				{ID: "chain_of_thought", Score: 80},
			},
			expectedTechIDs: []string{"zero_shot", "chain_of_thought"},
			expectedRemoved: []string{"few_shot"},
		},
		{
			name: "Single technique",
			techniques: []models.SelectedTechnique{
				{ID: "chain_of_thought", Score: 90},
			},
			expectedTechIDs: []string{"chain_of_thought"},
			expectedRemoved: []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := engine.applyCombinationRules(tc.techniques)

			// Check expected techniques are present
			if len(result) != len(tc.expectedTechIDs) {
				t.Errorf("Expected %d techniques, got %d", len(tc.expectedTechIDs), len(result))
			}

			resultIDs := make(map[string]bool)
			for _, tech := range result {
				resultIDs[tech.ID] = true
			}

			for _, expectedID := range tc.expectedTechIDs {
				if !resultIDs[expectedID] {
					t.Errorf("Expected technique '%s' not found in result", expectedID)
				}
			}

			// Check removed techniques are not present
			for _, removedID := range tc.expectedRemoved {
				if resultIDs[removedID] {
					t.Errorf("Technique '%s' should have been removed due to incompatibility", removedID)
				}
			}
		})
	}
}

// TestCalculateComplexity tests complexity calculation
func TestCalculateComplexity(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	engine := NewEngine(config, logger)

	testCases := []struct {
		name        string
		text        string
		minExpected float64
		maxExpected float64
	}{
		{
			name:        "Short simple text",
			text:        "Hello world",
			minExpected: 0.1,
			maxExpected: 0.3,
		},
		{
			name:        "Medium text with question",
			text:        "How does the algorithm work? Can you explain the steps involved in the process?",
			minExpected: 0.5,
			maxExpected: 0.8,
		},
		{
			name:        "Long technical text",
			text:        strings.Repeat("Implement an optimized algorithm to analyze the database ", 10),
			minExpected: 0.7,
			maxExpected: 1.0,
		},
		{
			name:        "Text with abstract concepts",
			text:        "Explain the philosophical concept and theoretical principles behind this abstract theory",
			minExpected: 0.5,
			maxExpected: 0.9,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			complexity := engine.calculateComplexity(tc.text)

			if complexity < 0 || complexity > 1 {
				t.Errorf("Complexity should be between 0 and 1, got %f", complexity)
			}
			if complexity < tc.minExpected || complexity > tc.maxExpected {
				t.Errorf("Expected complexity between %f and %f, got %f", tc.minExpected, tc.maxExpected, complexity)
			}
		})
	}
}

// TestCalculateOverallConfidence tests overall confidence calculation
func TestCalculateOverallConfidence(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	engine := NewEngine(config, logger)

	testCases := []struct {
		name       string
		techniques []models.SelectedTechnique
		expected   float64
		tolerance  float64
	}{
		{
			name:       "Empty techniques",
			techniques: []models.SelectedTechnique{},
			expected:   0,
			tolerance:  0,
		},
		{
			name: "Single technique",
			techniques: []models.SelectedTechnique{
				{Score: 80, Confidence: 0.8},
			},
			expected:  0.8,
			tolerance: 0.01,
		},
		{
			name: "Multiple techniques weighted",
			techniques: []models.SelectedTechnique{
				{Score: 90, Confidence: 0.9},
				{Score: 60, Confidence: 0.6},
				{Score: 30, Confidence: 0.3},
			},
			expected:  0.7, // (0.9*90 + 0.6*60 + 0.3*30) / (90+60+30) = 0.7
			tolerance: 0.01,
		},
		{
			name: "Equal scores",
			techniques: []models.SelectedTechnique{
				{Score: 50, Confidence: 0.8},
				{Score: 50, Confidence: 0.6},
			},
			expected:  0.7, // (0.8*50 + 0.6*50) / 100 = 0.7
			tolerance: 0.01,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			confidence := engine.calculateOverallConfidence(tc.techniques)

			if confidence < 0 || confidence > 1 {
				t.Errorf("Confidence should be between 0 and 1, got %f", confidence)
			}

			diff := confidence - tc.expected
			if diff < 0 {
				diff = -diff
			}
			if diff > tc.tolerance {
				t.Errorf("Expected confidence %f (±%f), got %f", tc.expected, tc.tolerance, confidence)
			}
		})
	}
}

// TestGenerateReasoning tests reasoning generation
func TestGenerateReasoning(t *testing.T) {
	config := createTestConfig()
	logger := createTestLogger()
	engine := NewEngine(config, logger)

	testCases := []struct {
		name               string
		techniques         []models.SelectedTechnique
		request            *models.SelectionRequest
		expectedFragments  []string
	}{
		{
			name:       "No techniques",
			techniques: []models.SelectedTechnique{},
			request: &models.SelectionRequest{
				Intent:     "problem_solving",
				Complexity: "complex",
			},
			expectedFragments: []string{
				"Based on intent 'problem_solving' and complexity 'complex'",
				"no techniques were selected",
			},
		},
		{
			name: "Single technique",
			techniques: []models.SelectedTechnique{
				{
					Name:      "Chain of Thought",
					Reasoning: "matches intent and complexity",
				},
			},
			request: &models.SelectionRequest{
				Intent:     "reasoning",
				Complexity: "moderate",
			},
			expectedFragments: []string{
				"Based on intent 'reasoning' and complexity 'moderate'",
				"selected 'Chain of Thought' technique",
				"matches intent and complexity",
			},
		},
		{
			name: "Multiple techniques",
			techniques: []models.SelectedTechnique{
				{
					Name:      "Chain of Thought",
					Reasoning: "high score match",
				},
				{
					Name:      "Self-Consistency",
					Reasoning: "accuracy required",
				},
			},
			request: &models.SelectionRequest{
				Intent:     "data_analysis",
				Complexity: "complex",
			},
			expectedFragments: []string{
				"selected 2 techniques",
				"Chain of Thought, Self-Consistency",
				"Primary technique 'Chain of Thought'",
				"high score match",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			reasoning := engine.generateReasoning(tc.techniques, tc.request)

			if reasoning == "" {
				t.Error("Expected reasoning to be generated")
			}

			for _, fragment := range tc.expectedFragments {
				if !strings.Contains(reasoning, fragment) {
					t.Errorf("Expected reasoning to contain '%s', got: %s", fragment, reasoning)
				}
			}
		})
	}
}