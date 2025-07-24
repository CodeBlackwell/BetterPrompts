package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/betterprompts/technique-selector/internal/models"
	"gopkg.in/yaml.v3"
)

// TestYAMLParsing tests YAML configuration parsing
func TestYAMLParsing(t *testing.T) {
	yamlContent := `
techniques:
  - id: "chain_of_thought"
    name: "Chain of Thought"
    description: "Step-by-step reasoning"
    priority: 5
    conditions:
      intents:
        - "reasoning"
        - "problem_solving"
      complexity_levels:
        - "moderate"
        - "complex"
      complexity_threshold: 0.5
      keywords:
        - "explain"
        - "why"
      multi_step_indicators:
        - "step by step"
      requires_exploration: false
      requires_pattern: false
      requires_accuracy: false
    template: "Let me break this down step by step."
    parameters:
      max_steps: 10
      detail_level: "high"

selection_rules:
  max_techniques: 3
  min_confidence: 0.6
  compatible_combinations:
    - ["chain_of_thought", "self_consistency"]
    - ["tree_of_thoughts", "structured_output"]
  incompatible_combinations:
    - ["zero_shot", "few_shot"]
  intent_priority_boost:
    problem_solving:
      chain_of_thought: 2
      tree_of_thoughts: 1

complexity_factors:
  word_count:
    - range: [0, 10]
      score: 0.2
    - range: [11, 50]
      score: 0.5
    - range: [51, -1]
      score: 0.8
  multi_part_question: 0.2
  technical_terms: 0.3
  requires_calculation: 0.4
  abstract_concepts: 0.3
  multiple_constraints: 0.3
`

	var config models.RulesConfig
	err := yaml.Unmarshal([]byte(yamlContent), &config)
	if err != nil {
		t.Fatalf("Failed to parse YAML: %v", err)
	}

	// Test techniques parsing
	if len(config.Techniques) != 1 {
		t.Errorf("Expected 1 technique, got %d", len(config.Techniques))
	}

	tech := config.Techniques[0]
	if tech.ID != "chain_of_thought" {
		t.Errorf("Expected technique ID 'chain_of_thought', got '%s'", tech.ID)
	}
	if tech.Priority != 5 {
		t.Errorf("Expected priority 5, got %d", tech.Priority)
	}
	if len(tech.Conditions.Intents) != 2 {
		t.Errorf("Expected 2 intents, got %d", len(tech.Conditions.Intents))
	}
	if tech.Conditions.ComplexityThreshold != 0.5 {
		t.Errorf("Expected complexity threshold 0.5, got %f", tech.Conditions.ComplexityThreshold)
	}
	if tech.Template != "Let me break this down step by step." {
		t.Errorf("Unexpected template: %s", tech.Template)
	}

	// Test parameters parsing
	if tech.Parameters == nil {
		t.Error("Expected parameters to be parsed")
	} else {
		if maxSteps, ok := tech.Parameters["max_steps"].(int); !ok || maxSteps != 10 {
			t.Error("Expected max_steps parameter to be 10")
		}
		if detailLevel, ok := tech.Parameters["detail_level"].(string); !ok || detailLevel != "high" {
			t.Error("Expected detail_level parameter to be 'high'")
		}
	}

	// Test selection rules parsing
	if config.SelectionRules.MaxTechniques != 3 {
		t.Errorf("Expected max techniques 3, got %d", config.SelectionRules.MaxTechniques)
	}
	if config.SelectionRules.MinConfidence != 0.6 {
		t.Errorf("Expected min confidence 0.6, got %f", config.SelectionRules.MinConfidence)
	}
	if len(config.SelectionRules.CompatibleCombinations) != 2 {
		t.Errorf("Expected 2 compatible combinations, got %d", len(config.SelectionRules.CompatibleCombinations))
	}
	if len(config.SelectionRules.IncompatibleCombinations) != 1 {
		t.Errorf("Expected 1 incompatible combination, got %d", len(config.SelectionRules.IncompatibleCombinations))
	}

	// Test intent priority boost parsing
	if boost, exists := config.SelectionRules.IntentPriorityBoost["problem_solving"]["chain_of_thought"]; !exists || boost != 2 {
		t.Error("Expected chain_of_thought boost of 2 for problem_solving")
	}

	// Test complexity factors parsing
	if len(config.ComplexityFactors.WordCount) != 3 {
		t.Errorf("Expected 3 word count ranges, got %d", len(config.ComplexityFactors.WordCount))
	}
	if config.ComplexityFactors.TechnicalTerms != 0.3 {
		t.Errorf("Expected technical terms factor 0.3, got %f", config.ComplexityFactors.TechnicalTerms)
	}
}

// TestLoadConfigFromFile tests loading configuration from a file
func TestLoadConfigFromFile(t *testing.T) {
	// Create a temporary YAML file
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "test_rules.yaml")

	yamlContent := `
techniques:
  - id: "test_technique"
    name: "Test Technique"
    description: "Test description"
    priority: 1
    conditions:
      intents: ["test"]
      complexity_levels: ["simple"]
    template: "Test template"

selection_rules:
  max_techniques: 5
  min_confidence: 0.5

complexity_factors:
  word_count:
    - range: [0, 100]
      score: 0.5
  multi_part_question: 0.1
  technical_terms: 0.1
  requires_calculation: 0.1
  abstract_concepts: 0.1
  multiple_constraints: 0.1
`

	err := os.WriteFile(configPath, []byte(yamlContent), 0644)
	if err != nil {
		t.Fatalf("Failed to write test config file: %v", err)
	}

	// Test loading the config
	config, err := LoadConfig(configPath)
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if config == nil {
		t.Fatal("Expected config to be loaded, got nil")
	}

	if len(config.Techniques) != 1 {
		t.Errorf("Expected 1 technique, got %d", len(config.Techniques))
	}

	if config.Techniques[0].ID != "test_technique" {
		t.Errorf("Expected technique ID 'test_technique', got '%s'", config.Techniques[0].ID)
	}
}

// TestComplexTechniqueConditions tests parsing of complex technique conditions
func TestComplexTechniqueConditions(t *testing.T) {
	yamlContent := `
techniques:
  - id: "complex_technique"
    name: "Complex Technique"
    description: "Technique with all condition types"
    priority: 10
    conditions:
      intents:
        - "reasoning"
        - "analysis"
        - "problem_solving"
      complexity_levels:
        - "moderate"
        - "complex"
      complexity_threshold: 0.6
      complexity_threshold_max: 0.9
      keywords:
        - "analyze"
        - "explain"
        - "evaluate"
        - "compare"
      multi_step_indicators:
        - "step by step"
        - "first"
        - "then"
        - "finally"
      requires_exploration: true
      requires_pattern: true
      requires_accuracy: true
      requires_expertise: true
      requires_structure: true
      simple_request: false
      sensitive_content: true
`

	var config models.RulesConfig
	err := yaml.Unmarshal([]byte(yamlContent), &config)
	if err != nil {
		t.Fatalf("Failed to parse YAML: %v", err)
	}

	if len(config.Techniques) != 1 {
		t.Fatalf("Expected 1 technique, got %d", len(config.Techniques))
	}

	conditions := config.Techniques[0].Conditions

	// Test all fields
	if len(conditions.Intents) != 3 {
		t.Errorf("Expected 3 intents, got %d", len(conditions.Intents))
	}
	if len(conditions.ComplexityLevels) != 2 {
		t.Errorf("Expected 2 complexity levels, got %d", len(conditions.ComplexityLevels))
	}
	if conditions.ComplexityThreshold != 0.6 {
		t.Errorf("Expected complexity threshold 0.6, got %f", conditions.ComplexityThreshold)
	}
	if conditions.ComplexityThresholdMax != 0.9 {
		t.Errorf("Expected complexity threshold max 0.9, got %f", conditions.ComplexityThresholdMax)
	}
	if len(conditions.Keywords) != 4 {
		t.Errorf("Expected 4 keywords, got %d", len(conditions.Keywords))
	}
	if len(conditions.MultiStepIndicators) != 4 {
		t.Errorf("Expected 4 multi-step indicators, got %d", len(conditions.MultiStepIndicators))
	}
	if !conditions.RequiresExploration {
		t.Error("Expected requires_exploration to be true")
	}
	if !conditions.RequiresPattern {
		t.Error("Expected requires_pattern to be true")
	}
	if !conditions.RequiresAccuracy {
		t.Error("Expected requires_accuracy to be true")
	}
	if !conditions.RequiresExpertise {
		t.Error("Expected requires_expertise to be true")
	}
	if !conditions.RequiresStructure {
		t.Error("Expected requires_structure to be true")
	}
	if conditions.SimpleRequest {
		t.Error("Expected simple_request to be false")
	}
	if !conditions.SensitiveContent {
		t.Error("Expected sensitive_content to be true")
	}
}

// TestEmptyConfiguration tests handling of empty or minimal configurations
func TestEmptyConfiguration(t *testing.T) {
	testCases := []struct {
		name        string
		yamlContent string
		expectError bool
	}{
		{
			name:        "Empty YAML",
			yamlContent: "",
			expectError: false, // Should parse but with empty values
		},
		{
			name: "Only techniques",
			yamlContent: `
techniques:
  - id: "test"
    name: "Test"
    description: "Test"
    priority: 1
`,
			expectError: false,
		},
		{
			name: "Missing required fields",
			yamlContent: `
techniques:
  - name: "Missing ID"
    description: "This technique has no ID"
`,
			expectError: false, // YAML will parse, validation happens elsewhere
		},
		{
			name: "Invalid YAML syntax",
			yamlContent: `
techniques:
  - id: "test"
    name: [invalid syntax here
`,
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var config models.RulesConfig
			err := yaml.Unmarshal([]byte(tc.yamlContent), &config)

			if tc.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

// TestComplexSelectionRules tests parsing of complex selection rules
func TestComplexSelectionRules(t *testing.T) {
	yamlContent := `
selection_rules:
  max_techniques: 5
  min_confidence: 0.7
  compatible_combinations:
    - ["chain_of_thought", "self_consistency", "structured_output"]
    - ["tree_of_thoughts", "metacognitive"]
    - ["few_shot", "role_based"]
  incompatible_combinations:
    - ["zero_shot", "few_shot"]
    - ["chain_of_thought", "tree_of_thoughts"]
    - ["simple_direct", "complex_reasoning"]
  intent_priority_boost:
    problem_solving:
      chain_of_thought: 3
      tree_of_thoughts: 2
      structured_output: 1
    creative_writing:
      few_shot: 3
      role_based: 2
    data_analysis:
      self_consistency: 3
      structured_output: 2
      chain_of_thought: 1
`

	var config models.RulesConfig
	err := yaml.Unmarshal([]byte(yamlContent), &config)
	if err != nil {
		t.Fatalf("Failed to parse YAML: %v", err)
	}

	rules := config.SelectionRules

	// Test basic fields
	if rules.MaxTechniques != 5 {
		t.Errorf("Expected max techniques 5, got %d", rules.MaxTechniques)
	}
	if rules.MinConfidence != 0.7 {
		t.Errorf("Expected min confidence 0.7, got %f", rules.MinConfidence)
	}

	// Test compatible combinations
	if len(rules.CompatibleCombinations) != 3 {
		t.Errorf("Expected 3 compatible combinations, got %d", len(rules.CompatibleCombinations))
	}
	if len(rules.CompatibleCombinations[0]) != 3 {
		t.Errorf("Expected first compatible combination to have 3 techniques, got %d", len(rules.CompatibleCombinations[0]))
	}

	// Test incompatible combinations
	if len(rules.IncompatibleCombinations) != 3 {
		t.Errorf("Expected 3 incompatible combinations, got %d", len(rules.IncompatibleCombinations))
	}

	// Test intent priority boosts
	if len(rules.IntentPriorityBoost) != 3 {
		t.Errorf("Expected 3 intents with priority boosts, got %d", len(rules.IntentPriorityBoost))
	}
	if boost := rules.IntentPriorityBoost["problem_solving"]["chain_of_thought"]; boost != 3 {
		t.Errorf("Expected chain_of_thought boost of 3 for problem_solving, got %d", boost)
	}
	if boost := rules.IntentPriorityBoost["creative_writing"]["few_shot"]; boost != 3 {
		t.Errorf("Expected few_shot boost of 3 for creative_writing, got %d", boost)
	}
	if boost := rules.IntentPriorityBoost["data_analysis"]["self_consistency"]; boost != 3 {
		t.Errorf("Expected self_consistency boost of 3 for data_analysis, got %d", boost)
	}
}

