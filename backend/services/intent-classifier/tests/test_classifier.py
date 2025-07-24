"""Unit tests for the IntentClassifier class."""

import pytest
import torch
from unittest.mock import patch, MagicMock, AsyncMock
import time
from app.models.torchserve_client import (
    TorchServeError,
    TorchServeConnectionError,
    TorchServeInferenceError
)


class TestIntentClassifier:
    """Test suite for IntentClassifier."""
    
    @pytest.mark.asyncio
    async def test_initialization(self, classifier):
        """Test classifier initialization."""
        assert classifier.model is None
        assert classifier.tokenizer is None
        assert classifier.device == torch.device("cpu")
        assert not classifier._initialized
        assert len(classifier.intent_labels) == 10
        assert "chain_of_thought" in classifier.technique_mapping["question_answering"]
    
    @pytest.mark.asyncio
    async def test_initialize_model_local(self, classifier):
        """Test local model initialization."""
        with patch.object(classifier, '_load_model') as mock_load:
            await classifier.initialize_model()
            
            mock_load.assert_called_once()
            assert classifier._initialized
    
    @pytest.mark.asyncio
    async def test_initialize_model_torchserve(self, mock_settings, mock_torchserve_client, monkeypatch):
        """Test TorchServe model initialization."""
        mock_settings.USE_TORCHSERVE = True
        monkeypatch.setattr("app.core.config.settings", mock_settings)
        
        from app.models.classifier import IntentClassifier
        classifier = IntentClassifier()
        
        with patch('app.models.classifier.TorchServeClient', return_value=mock_torchserve_client):
            await classifier.initialize_model()
            
            mock_torchserve_client.connect.assert_called_once()
            mock_torchserve_client.health_check.assert_called_once()
            assert classifier._initialized
    
    @pytest.mark.asyncio
    async def test_initialize_model_torchserve_unhealthy(self, mock_settings, mock_torchserve_client, monkeypatch):
        """Test initialization failure when TorchServe is unhealthy."""
        mock_settings.USE_TORCHSERVE = True
        monkeypatch.setattr("app.core.config.settings", mock_settings)
        mock_torchserve_client.health_check.return_value = False
        
        from app.models.classifier import IntentClassifier
        classifier = IntentClassifier()
        
        with patch('app.models.classifier.TorchServeClient', return_value=mock_torchserve_client):
            with pytest.raises(TorchServeConnectionError):
                await classifier.initialize_model()
    
    def test_is_initialized(self, classifier):
        """Test is_initialized method."""
        assert not classifier.is_initialized()
        classifier._initialized = True
        assert classifier.is_initialized()
    
    @pytest.mark.asyncio
    async def test_classify_not_initialized(self, classifier):
        """Test classification fails when model not initialized."""
        with pytest.raises(RuntimeError, match="Model not initialized"):
            await classifier.classify("Test text")
    
    @pytest.mark.asyncio
    async def test_classify_local_model(self, initialized_classifier, mock_model_output, sample_texts):
        """Test classification with local model."""
        classifier = initialized_classifier
        
        # Mock the model and tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[1, 2, 3, 4, 5]]),
            "attention_mask": torch.tensor([[1, 1, 1, 1, 1]])
        }
        mock_model = MagicMock()
        mock_model.return_value = mock_model_output
        
        classifier.tokenizer = mock_tokenizer
        classifier.model = mock_model
        
        # Test classification
        result = await classifier.classify(sample_texts["code_generation"])
        
        assert result["intent"] == "code_generation"
        assert 0 <= result["confidence"] <= 1
        assert result["complexity"] in ["simple", "moderate", "complex"]
        assert isinstance(result["suggested_techniques"], list)
        assert result["tokens_used"] == 5
        assert len(result["all_probabilities"]) == 10
    
    @pytest.mark.asyncio
    async def test_classify_torchserve(self, torchserve_classifier, mock_torchserve_response, sample_texts):
        """Test classification with TorchServe."""
        torchserve_classifier.torchserve_client.classify.return_value = mock_torchserve_response
        
        result = await torchserve_classifier.classify(sample_texts["code_generation"])
        
        assert result["intent"] == "code_generation"
        assert result["confidence"] == 0.92
        assert result["complexity"] == "moderate"
        assert "chain_of_thought" in result["suggested_techniques"]
        assert result["tokens_used"] == 125
        assert "torchserve_metadata" in result
    
    @pytest.mark.asyncio
    async def test_classify_torchserve_error(self, torchserve_classifier, sample_texts):
        """Test error handling when TorchServe fails."""
        torchserve_classifier.torchserve_client.classify.side_effect = TorchServeInferenceError("Inference failed")
        
        with pytest.raises(TorchServeError):
            await torchserve_classifier.classify(sample_texts["simple"])
    
    @pytest.mark.parametrize("text,expected_complexity", [
        ("What is 2+2?", "simple"),
        ("Write a function to calculate factorial", "moderate"),
        ("Design a distributed system with fault tolerance", "complex")
    ])
    def test_determine_complexity(self, initialized_classifier, text, expected_complexity):
        """Test complexity determination."""
        # Test with different confidence levels
        complexities = []
        for confidence in [0.9, 0.7, 0.5]:
            complexity = initialized_classifier._determine_complexity(text, confidence)
            complexities.append(complexity)
        
        # At least one should match expected complexity
        assert expected_complexity in complexities
    
    def test_determine_complexity_factors(self, initialized_classifier):
        """Test various complexity factors."""
        # Long text
        long_text = "word " * 150
        complexity = initialized_classifier._determine_complexity(long_text, 0.8)
        assert complexity in ["moderate", "complex"]
        
        # Multiple conditions
        conditional_text = "If A then B. When C, do D. Unless E, perform F."
        complexity = initialized_classifier._determine_complexity(conditional_text, 0.8)
        assert complexity in ["moderate", "complex"]
        
        # Comparisons
        comparison_text = "Compare X versus Y. What's the difference between A and B?"
        complexity = initialized_classifier._determine_complexity(comparison_text, 0.8)
        assert complexity in ["moderate", "complex"]
    
    @pytest.mark.asyncio
    async def test_cleanup_local_model(self, initialized_classifier):
        """Test cleanup for local model."""
        classifier = initialized_classifier
        classifier.model = MagicMock()
        classifier.tokenizer = MagicMock()
        
        await classifier.cleanup()
        
        assert classifier.model is None
        assert classifier.tokenizer is None
        assert not classifier._initialized
    
    @pytest.mark.asyncio
    async def test_cleanup_torchserve(self, torchserve_classifier):
        """Test cleanup for TorchServe."""
        await torchserve_classifier.cleanup()
        
        torchserve_classifier.torchserve_client.close.assert_called_once()
        assert torchserve_classifier.torchserve_client is None
        assert not torchserve_classifier._initialized
    
    @pytest.mark.asyncio
    async def test_performance_classification(self, initialized_classifier, mock_model_output, performance_metrics):
        """Test classification performance."""
        classifier = initialized_classifier
        
        # Mock the model and tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[1, 2, 3, 4, 5]]),
            "attention_mask": torch.tensor([[1, 1, 1, 1, 1]])
        }
        mock_model = MagicMock()
        mock_model.return_value = mock_model_output
        
        classifier.tokenizer = mock_tokenizer
        classifier.model = mock_model
        
        # Measure classification time
        start_time = time.time()
        result = await classifier.classify("Test text for performance")
        classification_time_ms = (time.time() - start_time) * 1000
        
        assert classification_time_ms < performance_metrics["max_classification_time_ms"]
    
    @pytest.mark.parametrize("intent,expected_techniques", [
        ("question_answering", ["chain_of_thought", "few_shot"]),
        ("creative_writing", ["few_shot", "iterative_refinement"]),
        ("code_generation", ["chain_of_thought", "few_shot", "self_consistency"]),
        ("data_analysis", ["chain_of_thought", "tree_of_thoughts"]),
        ("reasoning", ["chain_of_thought", "tree_of_thoughts", "self_consistency"])
    ])
    def test_technique_mapping(self, classifier, intent, expected_techniques):
        """Test technique mapping for different intents."""
        techniques = classifier.technique_mapping.get(intent, [])
        for expected in expected_techniques:
            assert expected in techniques
    
    @pytest.mark.asyncio
    async def test_concurrent_classifications(self, initialized_classifier, mock_model_output):
        """Test concurrent classification requests."""
        classifier = initialized_classifier
        
        # Mock the model and tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[1, 2, 3, 4, 5]]),
            "attention_mask": torch.tensor([[1, 1, 1, 1, 1]])
        }
        mock_model = MagicMock()
        mock_model.return_value = mock_model_output
        
        classifier.tokenizer = mock_tokenizer
        classifier.model = mock_model
        
        # Run multiple classifications concurrently
        import asyncio
        texts = ["Test 1", "Test 2", "Test 3", "Test 4", "Test 5"]
        tasks = [classifier.classify(text) for text in texts]
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 5
        for result in results:
            assert "intent" in result
            assert "confidence" in result