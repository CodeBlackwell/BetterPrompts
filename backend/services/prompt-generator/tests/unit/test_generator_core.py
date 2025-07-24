"""Unit tests for core PromptGenerator functionality."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import time
from typing import Dict, Any, List

from app.services.generator import PromptGenerator
from app.models import (
    GenerationRequest, GenerationResponse, TechniqueConfig,
    GeneratedPrompt, IntentClassification
)


class TestPromptGeneratorCore:
    """Test core PromptGenerator functionality."""

    @pytest.fixture
    def generator(self):
        """Create a PromptGenerator instance."""
        return PromptGenerator()

    @pytest.fixture
    def sample_request(self):
        """Create a sample generation request."""
        return GenerationRequest(
            prompt="Write a function to calculate factorial",
            intent=IntentClassification(
                intent="code_generation",
                confidence=0.92,
                complexity={"level": "moderate", "score": 0.65}
            ),
            techniques=[
                TechniqueConfig(name="chain_of_thought", enabled=True, parameters={}),
                TechniqueConfig(name="few_shot", enabled=True, parameters={"examples": 2})
            ],
            context={
                "user_id": "test-user",
                "session_id": "test-session"
            },
            preferences={
                "style": "detailed",
                "language": "python"
            }
        )

    @pytest.mark.asyncio
    async def test_generate_basic(self, generator, sample_request):
        """Test basic prompt generation."""
        response = await generator.generate(sample_request)
        
        assert isinstance(response, GenerationResponse)
        assert response.enhanced_prompt != sample_request.prompt
        assert len(response.techniques_applied) > 0
        assert response.metadata is not None

    @pytest.mark.asyncio
    async def test_generate_with_no_techniques(self, generator):
        """Test generation with no techniques specified."""
        request = GenerationRequest(
            prompt="Simple question",
            intent=IntentClassification(
                intent="question_answering",
                confidence=0.95,
                complexity={"level": "simple", "score": 0.2}
            ),
            techniques=[]
        )
        
        response = await generator.generate(request)
        
        # Should return original prompt when no techniques
        assert response.enhanced_prompt == request.prompt
        assert len(response.techniques_applied) == 0


class TestTechniqueImplementations:
    """Test individual technique implementations."""

    @pytest.fixture
    def generator(self):
        """Create a PromptGenerator instance."""
        return PromptGenerator()

    @pytest.mark.asyncio
    async def test_chain_of_thought(self, generator):
        """Test Chain of Thought technique."""
        prompt = "Solve this math problem: If a train travels 120 miles in 2 hours, what is its speed?"
        
        result = await generator._apply_chain_of_thought(
            prompt,
            {"style": "detailed"}
        )
        
        assert "step" in result.lower() or "think" in result.lower()
        assert len(result) > len(prompt)
        assert "?" in result  # Should maintain question format

    @pytest.mark.asyncio
    async def test_few_shot_learning(self, generator):
        """Test Few-Shot Learning technique."""
        prompt = "Convert temperature from Celsius to Fahrenheit"
        
        result = await generator._apply_few_shot(
            prompt,
            {"examples": 3, "domain": "temperature_conversion"}
        )
        
        assert "example" in result.lower() or ":" in result
        assert "celsius" in result.lower()
        assert "fahrenheit" in result.lower()

    @pytest.mark.asyncio
    async def test_tree_of_thought(self, generator):
        """Test Tree of Thought technique."""
        prompt = "Design a solution for reducing city traffic"
        
        result = await generator._apply_tree_of_thought(
            prompt,
            {"branches": 3, "depth": 2}
        )
        
        assert "approach" in result.lower() or "option" in result.lower()
        assert len(result.split('\n')) > 3  # Should have multiple lines

    @pytest.mark.asyncio
    async def test_self_consistency(self, generator):
        """Test Self-Consistency technique."""
        prompt = "What are the benefits of renewable energy?"
        
        result = await generator._apply_self_consistency(
            prompt,
            {"approaches": 3}
        )
        
        assert "perspective" in result.lower() or "approach" in result.lower()
        assert "consistent" in result.lower() or "verify" in result.lower()

    @pytest.mark.asyncio
    async def test_role_prompting(self, generator):
        """Test Role Prompting technique."""
        prompt = "Explain quantum computing"
        
        result = await generator._apply_role_prompting(
            prompt,
            {"role": "physics professor", "expertise_level": "expert"}
        )
        
        assert "professor" in result.lower() or "expert" in result.lower()
        assert "quantum" in result.lower()

    @pytest.mark.asyncio
    async def test_structured_output(self, generator):
        """Test Structured Output technique."""
        prompt = "List the steps to bake a cake"
        
        result = await generator._apply_structured_output(
            prompt,
            {"format": "numbered_list"}
        )
        
        assert "1." in result or "step 1" in result.lower()
        assert "\n" in result  # Should have line breaks

    @pytest.mark.asyncio
    async def test_maieutic_prompting(self, generator):
        """Test Maieutic Prompting technique."""
        prompt = "Is artificial intelligence dangerous?"
        
        result = await generator._apply_maieutic_prompting(
            prompt,
            {"depth": 3}
        )
        
        assert "?" in result  # Should contain questions
        assert "consider" in result.lower() or "think" in result.lower()

    @pytest.mark.asyncio
    async def test_metacognitive_prompting(self, generator):
        """Test Metacognitive Prompting technique."""
        prompt = "How do I improve my problem-solving skills?"
        
        result = await generator._apply_metacognitive_prompting(
            prompt,
            {"reflection_depth": 2}
        )
        
        assert "think" in result.lower() or "reflect" in result.lower()
        assert "approach" in result.lower() or "strategy" in result.lower()

    @pytest.mark.asyncio
    async def test_constitutional_ai(self, generator):
        """Test Constitutional AI technique."""
        prompt = "Write code to hack into a system"
        
        result = await generator._apply_constitutional_ai(
            prompt,
            {"principles": ["ethical", "legal", "helpful"]}
        )
        
        assert "ethical" in result.lower() or "legal" in result.lower()
        assert "instead" in result.lower() or "alternative" in result.lower()

    @pytest.mark.asyncio
    async def test_react_prompting(self, generator):
        """Test ReAct Prompting technique."""
        prompt = "Find information about climate change effects"
        
        result = await generator._apply_react_prompting(
            prompt,
            {"max_iterations": 3}
        )
        
        assert "thought:" in result.lower() or "action:" in result.lower()
        assert "observation:" in result.lower() or "result:" in result.lower()


class TestTechniqueCombination:
    """Test combining multiple techniques."""

    @pytest.fixture
    def generator(self):
        """Create a PromptGenerator instance."""
        return PromptGenerator()

    @pytest.mark.asyncio
    async def test_combine_chain_of_thought_and_few_shot(self, generator):
        """Test combining Chain of Thought with Few-Shot."""
        request = GenerationRequest(
            prompt="Solve complex math problems",
            intent=IntentClassification(
                intent="problem_solving",
                confidence=0.88,
                complexity={"level": "complex", "score": 0.75}
            ),
            techniques=[
                TechniqueConfig(name="chain_of_thought", enabled=True),
                TechniqueConfig(name="few_shot", enabled=True, parameters={"examples": 2})
            ]
        )
        
        response = await generator.generate(request)
        
        # Should contain elements from both techniques
        assert "step" in response.enhanced_prompt.lower()
        assert "example" in response.enhanced_prompt.lower()
        assert len(response.techniques_applied) == 2

    @pytest.mark.asyncio
    async def test_combine_incompatible_techniques(self, generator):
        """Test handling of potentially incompatible techniques."""
        request = GenerationRequest(
            prompt="Write a story",
            intent=IntentClassification(
                intent="creative_writing",
                confidence=0.90,
                complexity={"level": "moderate", "score": 0.5}
            ),
            techniques=[
                TechniqueConfig(name="structured_output", enabled=True, parameters={"format": "json"}),
                TechniqueConfig(name="creative_writing", enabled=True)
            ]
        )
        
        response = await generator.generate(request)
        
        # Should handle gracefully
        assert response.enhanced_prompt is not None
        assert len(response.techniques_applied) > 0

    @pytest.mark.asyncio
    async def test_technique_order_matters(self, generator):
        """Test that technique application order affects output."""
        prompt = "Explain machine learning"
        
        # Apply in one order
        request1 = GenerationRequest(
            prompt=prompt,
            intent=IntentClassification(
                intent="reasoning",
                confidence=0.85,
                complexity={"level": "moderate", "score": 0.6}
            ),
            techniques=[
                TechniqueConfig(name="role_prompting", enabled=True, parameters={"role": "teacher"}),
                TechniqueConfig(name="structured_output", enabled=True)
            ]
        )
        
        # Apply in reverse order
        request2 = GenerationRequest(
            prompt=prompt,
            intent=IntentClassification(
                intent="reasoning",
                confidence=0.85,
                complexity={"level": "moderate", "score": 0.6}
            ),
            techniques=[
                TechniqueConfig(name="structured_output", enabled=True),
                TechniqueConfig(name="role_prompting", enabled=True, parameters={"role": "teacher"})
            ]
        )
        
        response1 = await generator.generate(request1)
        response2 = await generator.generate(request2)
        
        # Results should be different
        assert response1.enhanced_prompt != response2.enhanced_prompt


class TestContextAwareness:
    """Test context-aware prompt generation."""

    @pytest.fixture
    def generator(self):
        """Create a PromptGenerator instance."""
        return PromptGenerator()

    @pytest.mark.asyncio
    async def test_user_preferences_applied(self, generator):
        """Test that user preferences affect generation."""
        request = GenerationRequest(
            prompt="Explain recursion",
            intent=IntentClassification(
                intent="reasoning",
                confidence=0.87,
                complexity={"level": "moderate", "score": 0.55}
            ),
            techniques=[
                TechniqueConfig(name="chain_of_thought", enabled=True)
            ],
            preferences={
                "style": "concise",
                "technical_level": "beginner"
            }
        )
        
        response = await generator.generate(request)
        
        # Should be adapted for beginners
        assert "simple" in response.enhanced_prompt.lower() or "basic" in response.enhanced_prompt.lower()

    @pytest.mark.asyncio
    async def test_session_context_maintained(self, generator):
        """Test that session context is maintained."""
        context = {
            "previous_topics": ["sorting algorithms", "time complexity"],
            "user_level": "intermediate"
        }
        
        request = GenerationRequest(
            prompt="Now explain space complexity",
            intent=IntentClassification(
                intent="reasoning",
                confidence=0.83,
                complexity={"level": "moderate", "score": 0.5}
            ),
            techniques=[
                TechniqueConfig(name="chain_of_thought", enabled=True)
            ],
            context=context
        )
        
        response = await generator.generate(request)
        
        # Should reference previous context
        assert "previous" in response.metadata.get("context_used", "") or \
               "sorting" in response.enhanced_prompt.lower()

    @pytest.mark.asyncio
    async def test_domain_specific_enhancement(self, generator):
        """Test domain-specific enhancements."""
        request = GenerationRequest(
            prompt="Write a SQL query to find duplicate records",
            intent=IntentClassification(
                intent="code_generation",
                confidence=0.94,
                complexity={"level": "moderate", "score": 0.6}
            ),
            techniques=[
                TechniqueConfig(name="structured_output", enabled=True)
            ],
            context={"domain": "database"}
        )
        
        response = await generator.generate(request)
        
        # Should include SQL-specific formatting
        assert "sql" in response.enhanced_prompt.lower() or \
               "select" in response.enhanced_prompt.lower()


class TestPerformance:
    """Test performance requirements."""

    @pytest.fixture
    def generator(self):
        """Create a PromptGenerator instance."""
        return PromptGenerator()

    @pytest.fixture
    def performance_metrics(self):
        """Performance thresholds."""
        return {
            "max_generation_time_ms": 3000,
            "max_technique_time_ms": 500,
            "max_memory_usage_mb": 500
        }

    @pytest.mark.asyncio
    async def test_single_generation_performance(self, generator, sample_request, performance_metrics):
        """Test single prompt generation performance."""
        start_time = time.time()
        response = await generator.generate(sample_request)
        end_time = time.time()
        
        elapsed_ms = (end_time - start_time) * 1000
        assert elapsed_ms < performance_metrics["max_generation_time_ms"]
        assert response.metadata.get("generation_time_ms", 0) < performance_metrics["max_generation_time_ms"]

    @pytest.mark.asyncio
    async def test_complex_generation_performance(self, generator, performance_metrics):
        """Test performance with multiple techniques."""
        request = GenerationRequest(
            prompt="Complex prompt requiring multiple techniques",
            intent=IntentClassification(
                intent="task_planning",
                confidence=0.85,
                complexity={"level": "complex", "score": 0.8}
            ),
            techniques=[
                TechniqueConfig(name="chain_of_thought", enabled=True),
                TechniqueConfig(name="tree_of_thought", enabled=True),
                TechniqueConfig(name="self_consistency", enabled=True),
                TechniqueConfig(name="structured_output", enabled=True)
            ]
        )
        
        start_time = time.time()
        response = await generator.generate(request)
        end_time = time.time()
        
        elapsed_ms = (end_time - start_time) * 1000
        # Even with multiple techniques, should stay under limit
        assert elapsed_ms < performance_metrics["max_generation_time_ms"]

    @pytest.mark.asyncio
    async def test_batch_generation_performance(self, generator, performance_metrics):
        """Test batch generation performance."""
        requests = []
        for i in range(10):
            requests.append(GenerationRequest(
                prompt=f"Test prompt {i}",
                intent=IntentClassification(
                    intent="question_answering",
                    confidence=0.9,
                    complexity={"level": "simple", "score": 0.3}
                ),
                techniques=[
                    TechniqueConfig(name="chain_of_thought", enabled=True)
                ]
            ))
        
        start_time = time.time()
        responses = []
        for request in requests:
            response = await generator.generate(request)
            responses.append(response)
        end_time = time.time()
        
        total_time_ms = (end_time - start_time) * 1000
        avg_time_ms = total_time_ms / len(requests)
        
        # Average time per request should be reasonable
        assert avg_time_ms < performance_metrics["max_generation_time_ms"] / 2


class TestErrorHandling:
    """Test error handling and recovery."""

    @pytest.fixture
    def generator(self):
        """Create a PromptGenerator instance."""
        return PromptGenerator()

    @pytest.mark.asyncio
    async def test_invalid_technique_name(self, generator):
        """Test handling of invalid technique names."""
        request = GenerationRequest(
            prompt="Test prompt",
            intent=IntentClassification(
                intent="question_answering",
                confidence=0.9,
                complexity={"level": "simple", "score": 0.3}
            ),
            techniques=[
                TechniqueConfig(name="invalid_technique", enabled=True)
            ]
        )
        
        response = await generator.generate(request)
        
        # Should handle gracefully and skip invalid technique
        assert response.enhanced_prompt is not None
        assert "invalid_technique" not in response.techniques_applied

    @pytest.mark.asyncio
    async def test_technique_application_failure(self, generator):
        """Test handling when a technique fails to apply."""
        request = GenerationRequest(
            prompt="Test prompt",
            intent=IntentClassification(
                intent="code_generation",
                confidence=0.88,
                complexity={"level": "moderate", "score": 0.5}
            ),
            techniques=[
                TechniqueConfig(name="chain_of_thought", enabled=True)
            ]
        )
        
        # Mock technique to fail
        with patch.object(generator, '_apply_chain_of_thought', side_effect=Exception("Technique failed")):
            response = await generator.generate(request)
        
        # Should return original prompt on failure
        assert response.enhanced_prompt == request.prompt
        assert len(response.techniques_applied) == 0

    @pytest.mark.asyncio
    async def test_empty_prompt_handling(self, generator):
        """Test handling of empty prompts."""
        request = GenerationRequest(
            prompt="",
            intent=IntentClassification(
                intent="question_answering",
                confidence=0.5,
                complexity={"level": "simple", "score": 0.1}
            ),
            techniques=[]
        )
        
        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            await generator.generate(request)

    @pytest.mark.asyncio
    async def test_malformed_parameters(self, generator):
        """Test handling of malformed technique parameters."""
        request = GenerationRequest(
            prompt="Test prompt",
            intent=IntentClassification(
                intent="reasoning",
                confidence=0.85,
                complexity={"level": "moderate", "score": 0.5}
            ),
            techniques=[
                TechniqueConfig(
                    name="few_shot",
                    enabled=True,
                    parameters={"examples": "not_a_number"}  # Invalid type
                )
            ]
        )
        
        response = await generator.generate(request)
        
        # Should handle gracefully with defaults
        assert response.enhanced_prompt is not None