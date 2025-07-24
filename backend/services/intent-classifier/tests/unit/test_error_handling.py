"""Unit tests for error handling in the intent classifier."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import torch
import numpy as np
from typing import Dict, Any

from app.models.classifier import IntentClassifier
from app.models.torchserve_client import (
    TorchServeError,
    TorchServeConnectionError,
    TorchServeInferenceError,
    TorchServeTimeoutError
)


class TestErrorHandling:
    """Test suite for error handling and edge cases."""
    
    @pytest.fixture
    def classifier(self):
        """Create an IntentClassifier instance."""
        return IntentClassifier()
    
    @pytest.mark.asyncio
    async def test_model_initialization_failure(self, classifier):
        """Test handling of model initialization failures."""
        # Test local model loading failure
        with patch('app.models.classifier.settings.USE_TORCHSERVE', False), \
             patch('app.models.classifier.AutoTokenizer.from_pretrained', 
                   side_effect=Exception("Model not found")):
            
            with pytest.raises(Exception) as exc_info:
                await classifier.initialize_model()
            
            assert "Model not found" in str(exc_info.value)
            assert classifier._initialized is False
    
    @pytest.mark.asyncio
    async def test_torchserve_connection_failure(self, classifier):
        """Test handling of TorchServe connection failures."""
        mock_client = AsyncMock()
        mock_client.connect = AsyncMock(side_effect=TorchServeConnectionError("Connection refused"))
        
        with patch('app.models.classifier.settings.USE_TORCHSERVE', True), \
             patch('app.models.classifier.TorchServeClient', return_value=mock_client):
            
            with pytest.raises(TorchServeConnectionError) as exc_info:
                await classifier.initialize_model()
            
            assert "Connection refused" in str(exc_info.value)
            assert classifier._initialized is False
    
    @pytest.mark.asyncio
    async def test_inference_timeout(self, classifier):
        """Test handling of inference timeouts."""
        classifier._initialized = True
        classifier.use_torchserve = True
        
        mock_client = AsyncMock()
        mock_client.classify = AsyncMock(
            side_effect=TorchServeTimeoutError("Inference timeout after 30s")
        )
        classifier.torchserve_client = mock_client
        
        with pytest.raises(TorchServeTimeoutError) as exc_info:
            await classifier.classify("Test prompt that causes timeout")
        
        assert "timeout" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_malformed_torchserve_response(self, classifier):
        """Test handling of malformed TorchServe responses."""
        classifier._initialized = True
        classifier.use_torchserve = True
        
        # Test various malformed responses
        malformed_responses = [
            {},  # Empty response
            {"intent": "test"},  # Missing confidence
            {"confidence": 0.9},  # Missing intent
            {"intent": "test", "confidence": "not_a_number"},  # Invalid type
            None,  # Null response
        ]
        
        for bad_response in malformed_responses:
            mock_client = AsyncMock()
            mock_client.classify = AsyncMock(return_value=bad_response)
            classifier.torchserve_client = mock_client
            
            try:
                result = await classifier.classify("Test prompt")
                # Should handle gracefully and provide defaults
                assert "intent" in result
                assert "confidence" in result
                assert "complexity" in result
            except Exception as e:
                # Or raise a specific error
                assert isinstance(e, (KeyError, TypeError, AttributeError))
    
    @pytest.mark.asyncio
    async def test_gpu_out_of_memory(self, classifier):
        """Test handling of GPU out of memory errors."""
        classifier._initialized = True
        classifier.use_torchserve = False
        
        # Mock tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[101, 2023, 2003, 102]]),
            "attention_mask": torch.tensor([[1, 1, 1, 1]])
        }
        classifier.tokenizer = mock_tokenizer
        
        # Mock model that raises CUDA OOM error
        mock_model = MagicMock()
        mock_model.side_effect = RuntimeError("CUDA out of memory")
        classifier.model = mock_model
        
        with pytest.raises(RuntimeError) as exc_info:
            await classifier.classify("Test prompt")
        
        assert "CUDA out of memory" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_invalid_input_types(self, classifier):
        """Test handling of invalid input types."""
        classifier._initialized = True
        
        invalid_inputs = [
            None,
            123,  # Integer
            [],   # List
            {},   # Dict
            True, # Boolean
        ]
        
        for invalid_input in invalid_inputs:
            with pytest.raises((TypeError, AttributeError)):
                await classifier.classify(invalid_input)
    
    @pytest.mark.asyncio
    async def test_tokenizer_errors(self, classifier):
        """Test handling of tokenizer errors."""
        classifier._initialized = True
        classifier.use_torchserve = False
        
        # Mock tokenizer that raises error
        mock_tokenizer = MagicMock()
        mock_tokenizer.side_effect = Exception("Tokenizer error: Invalid input")
        classifier.tokenizer = mock_tokenizer
        
        # Mock model (won't be reached)
        classifier.model = MagicMock()
        
        with pytest.raises(Exception) as exc_info:
            await classifier.classify("Test prompt")
        
        assert "Tokenizer error" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_model_inference_errors(self, classifier):
        """Test handling of model inference errors."""
        classifier._initialized = True
        classifier.use_torchserve = False
        
        # Mock tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[101, 2023, 2003, 102]]),
            "attention_mask": torch.tensor([[1, 1, 1, 1]])
        }
        classifier.tokenizer = mock_tokenizer
        
        # Mock model that raises various errors
        error_cases = [
            RuntimeError("Model forward pass failed"),
            ValueError("Invalid tensor dimensions"),
            torch.cuda.CudaError("CUDA error"),
        ]
        
        for error in error_cases:
            mock_model = MagicMock()
            mock_model.side_effect = error
            classifier.model = mock_model
            
            with pytest.raises(type(error)):
                await classifier.classify("Test prompt")
    
    @pytest.mark.asyncio
    async def test_cleanup_errors(self, classifier):
        """Test error handling during cleanup."""
        classifier._initialized = True
        classifier.use_torchserve = True
        
        # Mock client that raises error during close
        mock_client = AsyncMock()
        mock_client.close = AsyncMock(side_effect=Exception("Connection already closed"))
        classifier.torchserve_client = mock_client
        
        # Cleanup should handle errors gracefully
        await classifier.cleanup()
        
        # Should still mark as not initialized
        assert classifier._initialized is False
        assert classifier.torchserve_client is None
    
    @pytest.mark.asyncio
    async def test_concurrent_classification_errors(self, classifier):
        """Test handling of concurrent classification requests."""
        classifier._initialized = True
        classifier.use_torchserve = True
        
        # Mock client that fails on concurrent requests
        call_count = 0
        
        async def mock_classify(text):
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise TorchServeError("Server overloaded")
            return {
                "intent": "test",
                "confidence": 0.9,
                "complexity": {"level": "simple"},
                "techniques": []
            }
        
        mock_client = AsyncMock()
        mock_client.classify = mock_classify
        classifier.torchserve_client = mock_client
        
        # First call should succeed
        result1 = await classifier.classify("Test 1")
        assert result1["intent"] == "test"
        
        # Second call should fail
        with pytest.raises(TorchServeError) as exc_info:
            await classifier.classify("Test 2")
        assert "overloaded" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_edge_case_confidence_values(self, classifier):
        """Test handling of edge case confidence values."""
        classifier._initialized = True
        classifier.use_torchserve = True
        
        edge_cases = [
            {"intent": "test", "confidence": -0.1},  # Negative
            {"intent": "test", "confidence": 1.5},   # Greater than 1
            {"intent": "test", "confidence": float('inf')},  # Infinity
            {"intent": "test", "confidence": float('nan')},  # NaN
        ]
        
        for response in edge_cases:
            mock_client = AsyncMock()
            mock_client.classify = AsyncMock(return_value=response)
            classifier.torchserve_client = mock_client
            
            try:
                result = await classifier.classify("Test")
                # Should either clamp values or raise error
                if "confidence" in result:
                    assert 0 <= result["confidence"] <= 1 or np.isnan(result["confidence"])
            except (ValueError, TypeError):
                # Acceptable to raise error for invalid values
                pass
    
    @pytest.mark.asyncio
    async def test_network_errors(self, classifier):
        """Test handling of network-related errors."""
        classifier._initialized = True
        classifier.use_torchserve = True
        
        network_errors = [
            ConnectionError("Connection reset by peer"),
            TimeoutError("Request timeout"),
            OSError("Network is unreachable"),
        ]
        
        for error in network_errors:
            mock_client = AsyncMock()
            mock_client.classify = AsyncMock(side_effect=error)
            classifier.torchserve_client = mock_client
            
            with pytest.raises(type(error)):
                await classifier.classify("Test prompt")
    
    def test_complexity_determination_edge_cases(self, classifier):
        """Test complexity determination with edge case inputs."""
        edge_cases = [
            ("", 0.5),  # Empty string
            ("a" * 10000, 0.5),  # Very long string
            ("\n\n\n", 0.5),  # Only newlines
            ("..." * 100, 0.5),  # Repeated punctuation
        ]
        
        for text, confidence in edge_cases:
            # Should not raise error
            complexity = classifier._determine_complexity(text, confidence)
            assert complexity in ["simple", "moderate", "complex"]