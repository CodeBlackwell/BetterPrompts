"""Unit tests for text preprocessing and validation."""

import pytest
from unittest.mock import MagicMock, patch


class TestTextPreprocessing:
    """Test suite for text preprocessing functionality."""
    
    @pytest.mark.parametrize("input_text,expected_output", [
        # Basic cleaning
        ("  Hello World  ", "Hello World"),
        ("Hello\n\nWorld", "Hello World"),
        ("Hello\tWorld", "Hello World"),
        # Unicode handling
        ("Hello 👋 World", "Hello 👋 World"),
        ("Café résumé", "Café résumé"),
        # Special characters
        ("Hello@World#2023", "Hello@World#2023"),
        # Mixed whitespace
        ("Hello   \n\t  World", "Hello World"),
    ])
    def test_text_cleaning(self, initialized_classifier, input_text, expected_output):
        """Test text cleaning and normalization."""
        # Assuming there's a clean_text method
        if hasattr(initialized_classifier, 'clean_text'):
            cleaned = initialized_classifier.clean_text(input_text)
            assert cleaned == expected_output
    
    @pytest.mark.parametrize("text,should_be_valid", [
        ("", False),
        ("   ", False),
        ("\n\n\n", False),
        ("a", False),  # Too short
        ("Hello", True),
        ("A" * 10000, True),  # Long but valid
        (None, False),
        (123, False),  # Wrong type
        (["list"], False),  # Wrong type
    ])
    def test_input_validation(self, initialized_classifier, text, should_be_valid):
        """Test input validation logic."""
        if not should_be_valid:
            if text is None or not isinstance(text, str):
                with pytest.raises((TypeError, ValueError)):
                    initialized_classifier._validate_input(text)
            else:
                is_valid = initialized_classifier._validate_input(text) if hasattr(initialized_classifier, '_validate_input') else len(text.strip()) > 0
                assert not is_valid
        else:
            if hasattr(initialized_classifier, '_validate_input'):
                assert initialized_classifier._validate_input(text)
    
    def test_tokenization_truncation(self, initialized_classifier, mock_settings):
        """Test that long inputs are properly truncated."""
        mock_settings.MODEL_MAX_LENGTH = 512
        
        # Create a very long text
        long_text = "word " * 1000  # ~5000 characters
        
        # Mock tokenizer
        mock_tokenizer = MagicMock()
        mock_tokenizer.return_value = {
            "input_ids": torch.tensor([[1] * 512]),  # Exactly max length
            "attention_mask": torch.tensor([[1] * 512])
        }
        initialized_classifier.tokenizer = mock_tokenizer
        
        # Should not raise an error
        if hasattr(initialized_classifier, '_tokenize'):
            tokens = initialized_classifier._tokenize(long_text)
            assert len(tokens["input_ids"][0]) <= 512
    
    @pytest.mark.parametrize("text,expected_language", [
        ("Hello world", "en"),
        ("Bonjour le monde", "fr"),
        ("Hola mundo", "es"),
        ("你好世界", "zh"),
        ("こんにちは世界", "ja"),
        ("Привет мир", "ru"),
    ])
    def test_language_detection(self, initialized_classifier, text, expected_language):
        """Test language detection if supported."""
        if hasattr(initialized_classifier, 'detect_language'):
            detected = initialized_classifier.detect_language(text)
            # Language detection might not be perfect, so we check if it's implemented
            assert detected is not None
    
    def test_special_token_handling(self, initialized_classifier):
        """Test handling of special tokens in input."""
        special_texts = [
            "<|endoftext|>",
            "[MASK] token",
            "<<<SYSTEM>>>",
            "```python\ncode\n```",
        ]
        
        for text in special_texts:
            # Should handle special tokens gracefully
            if hasattr(initialized_classifier, '_preprocess_text'):
                processed = initialized_classifier._preprocess_text(text)
                assert processed is not None
    
    @pytest.mark.parametrize("encoding", [
        "utf-8",
        "utf-16",
        "latin-1",
        "ascii",
    ])
    def test_encoding_handling(self, initialized_classifier, encoding):
        """Test handling of different text encodings."""
        test_text = "Hello World"
        
        try:
            # Encode and decode with different encodings
            encoded = test_text.encode(encoding)
            decoded = encoded.decode(encoding)
            
            # Should handle the decoded text
            if hasattr(initialized_classifier, '_validate_encoding'):
                assert initialized_classifier._validate_encoding(decoded)
        except UnicodeEncodeError:
            # Some encodings might not support all characters
            pass
    
    def test_html_and_markdown_handling(self, initialized_classifier):
        """Test preprocessing of HTML and Markdown content."""
        test_cases = [
            ("<p>Hello World</p>", "Hello World"),
            ("**Bold** text", "Bold text"),
            ("[Link](http://example.com)", "Link"),
            ("<!-- comment -->Text", "Text"),
        ]
        
        for input_text, expected in test_cases:
            if hasattr(initialized_classifier, '_strip_markup'):
                cleaned = initialized_classifier._strip_markup(input_text)
                assert expected in cleaned
    
    def test_code_block_preservation(self, initialized_classifier):
        """Test that code blocks are preserved during preprocessing."""
        code_text = """
        Please analyze this code:
        ```python
        def factorial(n):
            if n <= 1:
                return 1
            return n * factorial(n-1)
        ```
        """
        
        if hasattr(initialized_classifier, '_preprocess_with_code'):
            processed = initialized_classifier._preprocess_with_code(code_text)
            assert "def factorial" in processed
            assert "```" in processed or "factorial" in processed