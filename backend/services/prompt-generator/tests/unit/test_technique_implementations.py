"""Unit tests for individual technique implementations."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from typing import Dict, Any

from app.techniques import (
    ChainOfThoughtTechnique,
    FewShotTechnique,
    TreeOfThoughtsTechnique,
    ZeroShotTechnique,
    RolePlayTechnique,
    StepByStepTechnique,
    StructuredOutputTechnique,
    EmotionalAppealTechnique,
    ConstraintsTechnique,
    AnalogicalTechnique,
    SelfConsistencyTechnique,
    ReactTechnique
)


class TestChainOfThoughtTechnique:
    """Test suite for Chain of Thought technique."""
    
    @pytest.fixture
    def technique(self):
        """Create a ChainOfThoughtTechnique instance."""
        return ChainOfThoughtTechnique()
    
    def test_basic_application(self, technique):
        """Test basic chain of thought application."""
        prompt = "Calculate 25 * 17"
        context = {"intent": "calculation"}
        
        result = technique.apply(prompt, context)
        
        assert "step by step" in result.lower() or "think through" in result.lower()
        assert prompt in result
        assert len(result) > len(prompt)
    
    def test_complex_reasoning_enhancement(self, technique):
        """Test enhancement for complex reasoning tasks."""
        prompt = "Analyze the economic impact of renewable energy adoption"
        context = {
            "intent": "analysis",
            "complexity": "complex"
        }
        
        result = technique.apply(prompt, context)
        
        # Should include reasoning structure
        assert any(keyword in result.lower() for keyword in [
            "first", "then", "finally", "consider", "analyze"
        ])
        assert len(result) > len(prompt) * 1.5
    
    def test_with_existing_structure(self, technique):
        """Test handling of prompts that already have structure."""
        prompt = "Step 1: Do this\nStep 2: Do that\nStep 3: Finish"
        context = {}
        
        result = technique.apply(prompt, context)
        
        # Should enhance without duplicating structure
        assert "Step 1:" in result
        assert result.count("Step") >= 3
    
    def test_context_awareness(self, technique):
        """Test context-aware application."""
        prompt = "Solve this problem"
        contexts = [
            {"intent": "math", "expected_keywords": ["calculate", "compute"]},
            {"intent": "coding", "expected_keywords": ["implement", "code"]},
            {"intent": "analysis", "expected_keywords": ["examine", "evaluate"]},
        ]
        
        for context_data in contexts:
            context = {"intent": context_data["intent"]}
            result = technique.apply(prompt, context)
            
            # Should adapt based on intent
            assert any(keyword in result.lower() 
                      for keyword in context_data["expected_keywords"])


class TestFewShotTechnique:
    """Test suite for Few-Shot technique."""
    
    @pytest.fixture
    def technique(self):
        """Create a FewShotTechnique instance."""
        return FewShotTechnique()
    
    def test_example_generation(self, technique):
        """Test generation of examples."""
        prompt = "Convert temperature from Celsius to Fahrenheit"
        context = {"intent": "conversion"}
        
        result = technique.apply(prompt, context)
        
        assert "example" in result.lower()
        assert "°C" in result or "celsius" in result.lower()
        assert "°F" in result or "fahrenheit" in result.lower()
        assert result.count("Example") >= 2
    
    def test_pattern_matching_examples(self, technique):
        """Test examples for pattern matching tasks."""
        prompt = "Extract email addresses from text"
        context = {"intent": "pattern_matching"}
        
        result = technique.apply(prompt, context)
        
        # Should include example patterns
        assert "@" in result
        assert "example.com" in result or "email.com" in result
        assert "Input:" in result and "Output:" in result
    
    def test_code_generation_examples(self, technique):
        """Test examples for code generation."""
        prompt = "Write a function to reverse a string"
        context = {
            "intent": "code_generation",
            "language": "python"
        }
        
        result = technique.apply(prompt, context)
        
        # Should include code examples
        assert "def" in result or "function" in result
        assert "return" in result
        assert "Example" in result
    
    def test_adaptive_example_count(self, technique):
        """Test adaptive number of examples based on complexity."""
        simple_prompt = "Add two numbers"
        complex_prompt = "Implement a neural network from scratch"
        
        simple_result = technique.apply(simple_prompt, {"complexity": "simple"})
        complex_result = technique.apply(complex_prompt, {"complexity": "complex"})
        
        # Complex tasks should have more examples
        simple_examples = simple_result.count("Example")
        complex_examples = complex_result.count("Example")
        
        assert complex_examples >= simple_examples
        assert simple_examples >= 2
        assert complex_examples >= 3


class TestTreeOfThoughtsTechnique:
    """Test suite for Tree of Thoughts technique."""
    
    @pytest.fixture
    def technique(self):
        """Create a TreeOfThoughtsTechnique instance."""
        return TreeOfThoughtsTechnique()
    
    def test_multiple_approaches(self, technique):
        """Test generation of multiple solution approaches."""
        prompt = "Design a recommendation system"
        context = {"intent": "design"}
        
        result = technique.apply(prompt, context)
        
        # Should present multiple approaches
        assert "Approach" in result or "Option" in result or "Method" in result
        assert result.count("Approach") >= 2 or result.count("Option") >= 2
        assert "evaluate" in result.lower() or "consider" in result.lower()
    
    def test_decision_tree_structure(self, technique):
        """Test decision tree structure generation."""
        prompt = "Choose the best database for a social media app"
        context = {"intent": "decision_making"}
        
        result = technique.apply(prompt, context)
        
        # Should include evaluation criteria
        assert any(term in result.lower() for term in [
            "pros", "cons", "advantages", "disadvantages", "consider"
        ])
        assert len(result.split('\n')) > 5  # Multi-line structure
    
    def test_complexity_handling(self, technique):
        """Test handling of different complexity levels."""
        prompts = [
            ("Simple choice between A and B", "simple"),
            ("Complex architectural decision with multiple constraints", "complex")
        ]
        
        for prompt, complexity in prompts:
            result = technique.apply(prompt, {"complexity": complexity})
            
            if complexity == "complex":
                # More detailed exploration for complex problems
                assert len(result) > 500
                assert result.count("Approach") >= 3 or result.count("Option") >= 3
            else:
                # Simpler structure for simple problems
                assert len(result) < 500


class TestStructuredOutputTechnique:
    """Test suite for Structured Output technique."""
    
    @pytest.fixture
    def technique(self):
        """Create a StructuredOutputTechnique instance."""
        return StructuredOutputTechnique()
    
    def test_json_format_request(self, technique):
        """Test JSON format structuring."""
        prompt = "Get user information"
        context = {"output_format": "json"}
        
        result = technique.apply(prompt, context)
        
        assert "JSON" in result or "json" in result
        assert "{" in result
        assert "}" in result
        assert any(term in result for term in ["format", "structure", "schema"])
    
    def test_table_format_request(self, technique):
        """Test table format structuring."""
        prompt = "Compare different programming languages"
        context = {"output_format": "table"}
        
        result = technique.apply(prompt, context)
        
        assert "table" in result.lower() or "|" in result
        assert any(term in result.lower() for term in ["column", "row", "header"])
    
    def test_list_format_request(self, technique):
        """Test list format structuring."""
        prompt = "List the steps to deploy a web application"
        context = {"output_format": "list"}
        
        result = technique.apply(prompt, context)
        
        assert any(marker in result for marker in ["1.", "-", "•", "*"])
        assert "list" in result.lower() or "steps" in result.lower()
    
    def test_custom_format(self, technique):
        """Test custom format specification."""
        prompt = "Analyze data"
        context = {
            "output_format": "custom",
            "format_spec": "Title: []\nSummary: []\nDetails: []"
        }
        
        result = technique.apply(prompt, context)
        
        assert "Title:" in result or "Summary:" in result
        assert "format" in result.lower()


class TestRolePlayTechnique:
    """Test suite for Role Play technique."""
    
    @pytest.fixture
    def technique(self):
        """Create a RolePlayTechnique instance."""
        return RolePlayTechnique()
    
    def test_expert_role_assignment(self, technique):
        """Test expert role assignment."""
        prompts = [
            ("Explain quantum computing", "physicist"),
            ("Debug this code", "software engineer"),
            ("Analyze financial data", "financial analyst"),
        ]
        
        for prompt, expected_role in prompts:
            result = technique.apply(prompt, {"domain": expected_role})
            
            assert "expert" in result.lower() or expected_role in result.lower()
            assert "you are" in result.lower() or "acting as" in result.lower()
    
    def test_role_based_on_intent(self, technique):
        """Test role selection based on intent."""
        intents = [
            ("code_generation", ["developer", "programmer", "engineer"]),
            ("creative_writing", ["writer", "author", "creative"]),
            ("data_analysis", ["analyst", "scientist", "researcher"]),
        ]
        
        for intent, expected_roles in intents:
            result = technique.apply("Do something", {"intent": intent})
            
            assert any(role in result.lower() for role in expected_roles)
    
    def test_detailed_role_description(self, technique):
        """Test detailed role descriptions."""
        prompt = "Design a scalable microservices architecture"
        context = {
            "intent": "design",
            "complexity": "complex"
        }
        
        result = technique.apply(prompt, context)
        
        # Should include detailed expertise description
        assert len(result) > len(prompt) * 2
        assert any(term in result.lower() for term in [
            "experience", "expertise", "knowledge", "skilled"
        ])


class TestConstraintsTechnique:
    """Test suite for Constraints technique."""
    
    @pytest.fixture
    def technique(self):
        """Create a ConstraintsTechnique instance."""
        return ConstraintsTechnique()
    
    def test_basic_constraints(self, technique):
        """Test basic constraint application."""
        prompt = "Write a story"
        context = {
            "constraints": {
                "length": "100 words",
                "style": "formal",
                "audience": "children"
            }
        }
        
        result = technique.apply(prompt, context)
        
        assert "100 words" in result
        assert "formal" in result
        assert "children" in result
        assert "constraint" in result.lower() or "requirement" in result.lower()
    
    def test_technical_constraints(self, technique):
        """Test technical constraints."""
        prompt = "Implement a sorting algorithm"
        context = {
            "constraints": {
                "time_complexity": "O(n log n)",
                "space_complexity": "O(1)",
                "language": "Python"
            }
        }
        
        result = technique.apply(prompt, context)
        
        assert "O(n log n)" in result
        assert "O(1)" in result
        assert "Python" in result
    
    def test_multiple_constraint_types(self, technique):
        """Test multiple types of constraints."""
        prompt = "Create a web application"
        context = {
            "constraints": {
                "performance": "< 100ms response time",
                "security": "OWASP compliant",
                "accessibility": "WCAG 2.1 AA",
                "budget": "$10,000"
            }
        }
        
        result = technique.apply(prompt, context)
        
        # All constraints should be mentioned
        assert "100ms" in result
        assert "OWASP" in result
        assert "WCAG" in result
        assert "$10,000" in result
    
    def test_constraint_prioritization(self, technique):
        """Test constraint prioritization."""
        prompt = "Solve this problem"
        context = {
            "constraints": {
                "primary": "accuracy > 95%",
                "secondary": "processing time < 1s",
                "optional": "memory usage < 1GB"
            },
            "priority_indicators": True
        }
        
        result = technique.apply(prompt, context)
        
        # Should indicate priority levels
        assert any(term in result.lower() for term in [
            "must", "should", "priority", "important"
        ])