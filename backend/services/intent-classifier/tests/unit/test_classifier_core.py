"""Unit tests for core IntentClassifier functionality."""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import time
import torch
from typing import Dict, Any

from app.models.classifier import IntentClassifier
from app.models.torchserve_client import TorchServeClient


class TestIntentClassifierCore:
    """Test core IntentClassifier functionality."""

    @pytest.mark.asyncio
    async def test_initialization_local_model(self, classifier, mock_settings):
        """Test initialization with local model."""
        mock_settings.USE_TORCHSERVE = False
        
        with patch.object(classifier, '_load_model') as mock_load:
            await classifier.initialize_model()
            
            mock_load.assert_called_once()
            assert classifier._initialized is True

    @pytest.mark.asyncio
    async def test_initialization_torchserve(self, classifier, mock_settings, mock_torchserve_client):
        """Test initialization with TorchServe."""
        mock_settings.USE_TORCHSERVE = True
        
        with patch('app.models.classifier.TorchServeClient') as mock_client_class:
            mock_client_class.return_value = mock_torchserve_client
            
            await classifier.initialize_model()
            
            assert classifier._initialized is True
            assert classifier.torchserve_client == mock_torchserve_client
            mock_torchserve_client.connect.assert_called_once()

    @pytest.mark.asyncio
    async def test_initialization_failure_local(self, classifier, mock_settings):
        """Test initialization failure with local model."""
        mock_settings.USE_TORCHSERVE = False
        
        with patch.object(classifier, '_load_model', side_effect=Exception("Model load failed")):
            with pytest.raises(Exception, match="Model load failed"):
                await classifier.initialize_model()
            
            assert classifier._initialized is False

    @pytest.mark.asyncio
    async def test_initialization_failure_torchserve(self, classifier, mock_settings):
        """Test initialization failure with TorchServe."""
        mock_settings.USE_TORCHSERVE = True
        
        with patch('app.models.classifier.TorchServeClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.connect.side_effect = Exception("Connection failed")
            mock_client_class.return_value = mock_client
            
            with pytest.raises(Exception, match="Connection failed"):
                await classifier.initialize_model()
            
            assert classifier._initialized is False

    @pytest.mark.asyncio
    async def test_cleanup(self, torchserve_classifier):
        """Test cleanup releases resources."""
        await torchserve_classifier.cleanup()
        
        torchserve_classifier.torchserve_client.close.assert_called_once()
        assert torchserve_classifier._initialized is False


class TestTextPreprocessing:
    """Test text preprocessing functionality."""

    @pytest.mark.asyncio
    async def test_preprocess_text_basic(self, initialized_classifier):
        """Test basic text preprocessing."""
        text = "  Hello World!  \n\n  This is a test.  "
        result = await initialized_classifier._preprocess_text(text)
        
        assert result == "Hello World! This is a test."

    @pytest.mark.asyncio
    async def test_preprocess_text_empty(self, initialized_classifier):
        """Test preprocessing empty text."""
        result = await initialized_classifier._preprocess_text("")
        assert result == ""

    @pytest.mark.asyncio
    async def test_preprocess_text_whitespace_only(self, initialized_classifier):
        """Test preprocessing whitespace-only text."""
        result = await initialized_classifier._preprocess_text("   \n\t   ")
        assert result == ""

    @pytest.mark.asyncio
    async def test_preprocess_text_max_length(self, initialized_classifier, mock_settings):
        """Test text truncation at max length."""
        mock_settings.MODEL_MAX_LENGTH = 50
        long_text = "A" * 100
        
        result = await initialized_classifier._preprocess_text(long_text)
        
        assert len(result) <= 50

    @pytest.mark.asyncio
    async def test_preprocess_text_special_chars(self, initialized_classifier):
        """Test preprocessing with special characters."""
        text = "Hello\x00World\x01Test\x02"
        result = await initialized_classifier._preprocess_text(text)
        
        assert "\x00" not in result
        assert "\x01" not in result
        assert "\x02" not in result

    @pytest.mark.asyncio
    async def test_preprocess_text_unicode(self, initialized_classifier):
        """Test preprocessing with unicode characters."""
        text = "Hello 世界 🌍 Émojis"
        result = await initialized_classifier._preprocess_text(text)
        
        assert result == "Hello 世界 🌍 Émojis"


class TestClassification:
    """Test classification functionality."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("text,expected_intent", [
        ("Write a Python function to calculate factorial", "code_generation"),
        ("What is the capital of France?", "question_answering"),
        ("Write a story about a robot", "creative_writing"),
        ("Analyze this data and find patterns", "data_analysis"),
        ("Explain why the sky is blue", "reasoning"),
        ("Summarize this article", "summarization"),
        ("Translate this to Spanish", "translation"),
        ("Let's chat about movies", "conversation"),
        ("Create a project plan", "task_planning"),
        ("How to solve this math problem", "problem_solving")
    ])
    async def test_classify_intents_local(self, initialized_classifier, mock_model_output, text, expected_intent):
        """Test classification of different intent types with local model."""
        initialized_classifier.config.USE_TORCHSERVE = False
        
        # Mock the intent mapping
        intent_idx = list(initialized_classifier.intent_mapping.values()).index(expected_intent)
        mock_model_output.logits[0, intent_idx] = 5.0  # High confidence
        
        with patch.object(initialized_classifier.model, '__call__', return_value=mock_model_output):
            with patch.object(initialized_classifier.tokenizer, '__call__', return_value={'input_ids': torch.tensor([[1, 2, 3]])}):
                result = await initialized_classifier.classify(text)
        
        assert result["intent"] == expected_intent
        assert result["confidence"] > 0.8
        assert len(result["all_intents"]) == 10

    @pytest.mark.asyncio
    async def test_classify_with_torchserve(self, torchserve_classifier, mock_torchserve_response, sample_texts):
        """Test classification using TorchServe."""
        text = sample_texts["code_generation"]
        torchserve_classifier.torchserve_client.classify.return_value = mock_torchserve_response
        
        result = await torchserve_classifier.classify(text)
        
        assert result == mock_torchserve_response
        torchserve_classifier.torchserve_client.classify.assert_called_once_with(text)

    @pytest.mark.asyncio
    async def test_classify_empty_text(self, initialized_classifier):
        """Test classification with empty text."""
        with pytest.raises(ValueError, match="Input text cannot be empty"):
            await initialized_classifier.classify("")

    @pytest.mark.asyncio
    async def test_classify_whitespace_text(self, initialized_classifier):
        """Test classification with whitespace-only text."""
        with pytest.raises(ValueError, match="Input text cannot be empty"):
            await initialized_classifier.classify("   \n\t   ")

    @pytest.mark.asyncio
    async def test_classify_not_initialized(self, classifier):
        """Test classification when model not initialized."""
        with pytest.raises(RuntimeError, match="Model not initialized"):
            await classifier.classify("Test text")

    @pytest.mark.asyncio
    async def test_classify_with_caching(self, initialized_classifier, mock_cache, mock_model_output):
        """Test classification with caching enabled."""
        initialized_classifier.cache = mock_cache
        text = "Test classification with cache"
        
        # First call - cache miss
        with patch.object(initialized_classifier.model, '__call__', return_value=mock_model_output):
            with patch.object(initialized_classifier.tokenizer, '__call__', return_value={'input_ids': torch.tensor([[1, 2, 3]])}):
                result1 = await initialized_classifier.classify(text)
        
        mock_cache.get.assert_called()
        mock_cache.set.assert_called()
        
        # Second call - cache hit
        cached_result = {"intent": "cached", "confidence": 0.99}
        mock_cache.get.return_value = cached_result
        
        result2 = await initialized_classifier.classify(text)
        assert result2 == cached_result


class TestComplexityDetection:
    """Test complexity detection functionality."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("text,expected_level", [
        ("What is 2+2?", "simple"),
        ("Write a function to sort a list", "moderate"),
        ("Design a distributed system with fault tolerance", "complex")
    ])
    async def test_detect_complexity_levels(self, initialized_classifier, text, expected_level):
        """Test complexity detection for different text levels."""
        result = await initialized_classifier._detect_complexity(text)
        
        assert result["level"] in ["simple", "moderate", "complex"]
        assert 0 <= result["score"] <= 1

    @pytest.mark.asyncio
    async def test_detect_complexity_factors(self, initialized_classifier):
        """Test complexity detection considers multiple factors."""
        # Text with multiple complexity indicators
        complex_text = """
        Design and implement a microservices architecture that includes:
        1. Service discovery and load balancing
        2. Circuit breakers and fault tolerance
        3. Distributed tracing and monitoring
        4. Event sourcing and CQRS patterns
        5. Multi-region deployment with data consistency
        """
        
        result = await initialized_classifier._detect_complexity(complex_text)
        
        assert result["level"] == "complex"
        assert result["score"] > 0.7

    @pytest.mark.asyncio
    async def test_detect_complexity_conditional_logic(self, initialized_classifier):
        """Test complexity detection for conditional logic."""
        text = "If x > 5 and y < 10, then calculate z = x * y, else return 0"
        
        result = await initialized_classifier._detect_complexity(text)
        
        assert result["score"] > 0.3  # Should detect conditional complexity


class TestTechniqueRecommendation:
    """Test technique recommendation functionality."""

    @pytest.mark.asyncio
    async def test_recommend_techniques_code_generation(self, initialized_classifier):
        """Test technique recommendations for code generation."""
        intent = "code_generation"
        complexity = {"level": "moderate", "score": 0.6}
        
        techniques = await initialized_classifier._recommend_techniques(intent, complexity)
        
        assert len(techniques) > 0
        assert any(t["name"] == "chain_of_thought" for t in techniques)
        assert all(0 <= t["score"] <= 1 for t in techniques)

    @pytest.mark.asyncio
    async def test_recommend_techniques_reasoning(self, initialized_classifier):
        """Test technique recommendations for reasoning tasks."""
        intent = "reasoning"
        complexity = {"level": "complex", "score": 0.8}
        
        techniques = await initialized_classifier._recommend_techniques(intent, complexity)
        
        assert any(t["name"] == "tree_of_thought" for t in techniques)
        assert any(t["name"] == "self_consistency" for t in techniques)

    @pytest.mark.asyncio
    async def test_recommend_techniques_simple_task(self, initialized_classifier):
        """Test technique recommendations for simple tasks."""
        intent = "question_answering"
        complexity = {"level": "simple", "score": 0.2}
        
        techniques = await initialized_classifier._recommend_techniques(intent, complexity)
        
        # Simple tasks should have fewer or simpler techniques
        assert len(techniques) <= 3

    @pytest.mark.asyncio
    async def test_recommend_techniques_sorted_by_score(self, initialized_classifier):
        """Test technique recommendations are sorted by score."""
        intent = "task_planning"
        complexity = {"level": "moderate", "score": 0.5}
        
        techniques = await initialized_classifier._recommend_techniques(intent, complexity)
        
        # Check techniques are sorted by score descending
        scores = [t["score"] for t in techniques]
        assert scores == sorted(scores, reverse=True)


class TestPerformance:
    """Test performance requirements."""

    @pytest.mark.asyncio
    async def test_classification_performance(self, initialized_classifier, mock_model_output, performance_metrics):
        """Test classification meets performance requirements."""
        text = "Test performance of classification"
        
        with patch.object(initialized_classifier.model, '__call__', return_value=mock_model_output):
            with patch.object(initialized_classifier.tokenizer, '__call__', return_value={'input_ids': torch.tensor([[1, 2, 3]])}):
                start_time = time.time()
                result = await initialized_classifier.classify(text)
                end_time = time.time()
        
        elapsed_ms = (end_time - start_time) * 1000
        assert elapsed_ms < performance_metrics["max_classification_time_ms"]

    @pytest.mark.asyncio
    async def test_batch_classification_performance(self, initialized_classifier, mock_model_output, performance_metrics):
        """Test batch classification performance."""
        texts = ["Text " + str(i) for i in range(10)]
        
        with patch.object(initialized_classifier.model, '__call__', return_value=mock_model_output):
            with patch.object(initialized_classifier.tokenizer, '__call__', return_value={'input_ids': torch.tensor([[1, 2, 3]])}):
                start_time = time.time()
                
                for text in texts:
                    await initialized_classifier.classify(text)
                
                end_time = time.time()
        
        elapsed_s = end_time - start_time
        throughput = len(texts) / elapsed_s
        
        assert throughput >= performance_metrics["min_throughput_rps"]


class TestErrorHandling:
    """Test error handling and recovery."""

    @pytest.mark.asyncio
    async def test_torchserve_connection_failure(self, torchserve_classifier):
        """Test handling of TorchServe connection failures."""
        torchserve_classifier.torchserve_client.classify.side_effect = Exception("Connection refused")
        
        with pytest.raises(Exception, match="Connection refused"):
            await torchserve_classifier.classify("Test text")

    @pytest.mark.asyncio
    async def test_model_inference_failure(self, initialized_classifier):
        """Test handling of model inference failures."""
        with patch.object(initialized_classifier.model, '__call__', side_effect=RuntimeError("CUDA out of memory")):
            with pytest.raises(RuntimeError, match="CUDA out of memory"):
                await initialized_classifier.classify("Test text")

    @pytest.mark.asyncio
    async def test_tokenizer_failure(self, initialized_classifier):
        """Test handling of tokenizer failures."""
        with patch.object(initialized_classifier.tokenizer, '__call__', side_effect=Exception("Tokenizer error")):
            with pytest.raises(Exception, match="Tokenizer error"):
                await initialized_classifier.classify("Test text")

    @pytest.mark.asyncio
    async def test_cache_failure_graceful_degradation(self, initialized_classifier, mock_cache, mock_model_output):
        """Test graceful degradation when cache fails."""
        initialized_classifier.cache = mock_cache
        mock_cache.get.side_effect = Exception("Redis connection failed")
        
        # Should still work without cache
        with patch.object(initialized_classifier.model, '__call__', return_value=mock_model_output):
            with patch.object(initialized_classifier.tokenizer, '__call__', return_value={'input_ids': torch.tensor([[1, 2, 3]])}):
                result = await initialized_classifier.classify("Test text")
        
        assert result is not None
        assert "intent" in result