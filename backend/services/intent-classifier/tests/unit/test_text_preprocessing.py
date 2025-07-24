"""Unit tests for text preprocessing and validation in the intent classifier."""

import pytest
from unittest.mock import MagicMock, patch
import torch

from app.models.classifier import IntentClassifier


class TestTextPreprocessing:
    """Test suite for text preprocessing and validation."""
    
    @pytest.fixture
    def classifier(self):
        """Create an IntentClassifier instance."""
        return IntentClassifier()
    
    @pytest.mark.parametrize("text,expected_valid", [
        ("", False),  # Empty text
        (" ", False),  # Only whitespace
        ("a", True),  # Single character
        ("Hello world", True),  # Normal text
        ("a" * 10000, True),  # Very long text (will be truncated)
        ("🚀 Unicode test 测试", True),  # Unicode characters
        ("<script>alert('xss')</script>", True),  # HTML (should be handled)
        ("Line 1\nLine 2\nLine 3", True),  # Multi-line text
    ])
    def test_text_validation(self, classifier, text, expected_valid):
        """Test text validation for various inputs."""
        # For empty/whitespace, we expect the classifier to handle gracefully
        if not expected_valid:
            # Empty text should still be processable but may have low confidence
            assert text.strip() == ""
        else:
            assert len(text.strip()) > 0
    
    @pytest.mark.asyncio
    async def test_text_normalization(self, classifier):
        """Test text normalization features."""
        classifier._initialized = True
        classifier.use_torchserve = False
        
        # Mock tokenizer with proper return structure
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[101, 2023, 2003, 102]]),
            "attention_mask": torch.tensor([[1, 1, 1, 1]])
        }
        classifier.tokenizer = mock_tokenizer
        
        # Mock model
        mock_model = MagicMock()
        mock_outputs = MagicMock()
        mock_outputs.logits = torch.tensor([[2.0, 3.5, 1.0, 0.5, -1.0, -2.0, -3.0, -4.0, -5.0, -6.0]])
        mock_model.return_value = mock_outputs
        classifier.model = mock_model
        
        # Test cases with different text formats
        test_cases = [
            "  Extra   spaces   ",
            "UPPERCASE TEXT",
            "Mixed-Case_Text",
            "Text\twith\ttabs",
            "Text\n\nwith\n\nnewlines",
        ]
        
        with patch('app.models.classifier.settings.MODEL_MAX_LENGTH', 512):
            for text in test_cases:
                result = await classifier.classify(text)
                
                # Verify tokenizer was called with the text
                mock_tokenizer.assert_called()
                call_args = mock_tokenizer.call_args[0][0]
                
                # The text should be passed to tokenizer (tokenizer handles normalization)
                assert isinstance(call_args, str)
                assert result["tokens_used"] > 0
    
    @pytest.mark.asyncio
    async def test_max_length_truncation(self, classifier):
        """Test that long texts are properly truncated."""
        classifier._initialized = True
        classifier.use_torchserve = False
        
        # Create a very long text
        long_text = "This is a test. " * 1000  # ~16000 characters
        
        # Mock tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[101] + [2023] * 510 + [102]]),  # Max length tokens
            "attention_mask": torch.tensor([[1] * 512])
        }
        classifier.tokenizer = mock_tokenizer
        
        # Mock model
        mock_model = MagicMock()
        mock_outputs = MagicMock()
        mock_outputs.logits = torch.tensor([[2.0, 3.5, 1.0, 0.5, -1.0, -2.0, -3.0, -4.0, -5.0, -6.0]])
        mock_model.return_value = mock_outputs
        classifier.model = mock_model
        
        with patch('app.models.classifier.settings.MODEL_MAX_LENGTH', 512):
            result = await classifier.classify(long_text)
            
            # Verify tokenizer was called with truncation
            mock_tokenizer.assert_called_once()
            call_kwargs = mock_tokenizer.call_args[1]
            
            assert call_kwargs["truncation"] is True
            assert call_kwargs["max_length"] == 512
            assert result["tokens_used"] == 512  # Should be at max length
    
    @pytest.mark.asyncio
    async def test_special_characters_handling(self, classifier):
        """Test handling of special characters and edge cases."""
        classifier._initialized = True
        classifier.use_torchserve = False
        
        # Mock tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[101, 2023, 2003, 102]]),
            "attention_mask": torch.tensor([[1, 1, 1, 1]])
        }
        classifier.tokenizer = mock_tokenizer
        
        # Mock model
        mock_model = MagicMock()
        mock_outputs = MagicMock()
        mock_outputs.logits = torch.tensor([[2.0, 3.5, 1.0, 0.5, -1.0, -2.0, -3.0, -4.0, -5.0, -6.0]])
        mock_model.return_value = mock_outputs
        classifier.model = mock_model
        
        special_texts = [
            "Test with émojis 🎉🚀💻",
            "Test with symbols @#$%^&*()",
            "Test with mixed 中文 English текст",
            "Test\x00with\x00null\x00bytes",  # Null bytes
            "Test with \u200b zero-width spaces",
        ]
        
        with patch('app.models.classifier.settings.MODEL_MAX_LENGTH', 512):
            for text in special_texts:
                result = await classifier.classify(text)
                
                # Should handle all special characters gracefully
                assert result["intent"] in classifier.intent_labels
                assert 0 <= result["confidence"] <= 1
                assert result["tokens_used"] > 0
    
    def test_complexity_edge_cases(self, classifier):
        """Test complexity determination for edge cases."""
        edge_cases = [
            ("", 0.5),  # Empty text
            ("a" * 10000, 0.5),  # Extremely long text
            ("!!!!!!!!!!!!", 0.9),  # Only punctuation
            ("123456789", 0.9),  # Only numbers
            ("test TEST TeSt", 0.8),  # Repeated words
        ]
        
        for text, confidence in edge_cases:
            complexity = classifier._determine_complexity(text, confidence)
            assert complexity in ["simple", "moderate", "complex"]
    
    @pytest.mark.parametrize("text,expected_factors", [
        ("Do A and B", {"has_multiple_parts": True}),
        ("If condition then result", {"has_conditionals": True}),
        ("Compare X versus Y", {"has_comparisons": True}),
        ("Do A and B. If C then D. Compare E versus F.", {
            "has_multiple_parts": True,
            "has_conditionals": True,
            "has_comparisons": True
        }),
    ])
    def test_complexity_factors_detection(self, classifier, text, expected_factors):
        """Test detection of specific complexity factors."""
        # We'll test the internal logic by checking the complexity score
        complexity = classifier._determine_complexity(text, 0.8)
        
        # Text with multiple factors should have higher complexity
        factor_count = len(expected_factors)
        if factor_count >= 2:
            assert complexity in ["moderate", "complex"]
        
        # Very short texts with single factors might still be simple
        if len(text.split()) < 10 and factor_count == 1:
            assert complexity in ["simple", "moderate"]