"""Unit tests for caching mechanisms in the intent classifier."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json
import hashlib
from datetime import datetime, timedelta

from app.services.cache import CacheService
from app.models.classifier import IntentClassifier


class TestCachingMechanisms:
    """Test suite for caching functionality."""
    
    @pytest.fixture
    def cache_service(self, test_redis_client):
        """Create a cache service instance."""
        return CacheService(test_redis_client)
    
    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client."""
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=None)
        redis.set = AsyncMock(return_value=True)
        redis.delete = AsyncMock(return_value=1)
        redis.exists = AsyncMock(return_value=0)
        redis.expire = AsyncMock(return_value=True)
        redis.ttl = AsyncMock(return_value=3600)
        return redis
    
    def test_cache_key_generation(self, cache_service):
        """Test cache key generation for different inputs."""
        # Test basic key generation
        text1 = "What is machine learning?"
        key1 = cache_service._generate_cache_key(text1)
        
        # Same text should generate same key
        key2 = cache_service._generate_cache_key(text1)
        assert key1 == key2
        
        # Different text should generate different key
        text2 = "What is deep learning?"
        key3 = cache_service._generate_cache_key(text2)
        assert key1 != key3
        
        # Key should have expected format
        assert key1.startswith("intent:")
        assert len(key1) > 10  # Should include hash
    
    def test_cache_key_normalization(self, cache_service):
        """Test that cache keys are normalized for similar inputs."""
        # These should generate the same cache key due to normalization
        variations = [
            "What is machine learning?",
            "  What is machine learning?  ",  # Extra spaces
            "What is machine learning?\n",     # Trailing newline
            "What is machine\tlearning?",      # Tab character
        ]
        
        keys = [cache_service._generate_cache_key(text) for text in variations]
        
        # All normalized versions should have the same key
        assert len(set(keys)) == 1
    
    @pytest.mark.asyncio
    async def test_cache_hit(self, cache_service, mock_redis):
        """Test cache hit scenario."""
        # Setup cache hit
        cached_data = {
            "intent": "question_answering",
            "confidence": 0.95,
            "complexity": "simple",
            "suggested_techniques": ["chain_of_thought"],
            "cached_at": datetime.utcnow().isoformat()
        }
        mock_redis.get = AsyncMock(return_value=json.dumps(cached_data))
        cache_service.redis_client = mock_redis
        
        # Get from cache
        result = await cache_service.get_classification("What is ML?")
        
        # Verify result
        assert result is not None
        assert result["intent"] == "question_answering"
        assert result["confidence"] == 0.95
        assert "cached_at" in result
        
        # Verify Redis was called correctly
        mock_redis.get.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cache_miss(self, cache_service, mock_redis):
        """Test cache miss scenario."""
        # Setup cache miss
        mock_redis.get = AsyncMock(return_value=None)
        cache_service.redis_client = mock_redis
        
        # Get from cache
        result = await cache_service.get_classification("What is ML?")
        
        # Verify result
        assert result is None
        
        # Verify Redis was called
        mock_redis.get.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cache_set(self, cache_service, mock_redis):
        """Test setting cache values."""
        cache_service.redis_client = mock_redis
        
        # Classification result to cache
        classification_result = {
            "intent": "code_generation",
            "confidence": 0.87,
            "complexity": "moderate",
            "suggested_techniques": ["few_shot", "chain_of_thought"],
            "tokens_used": 45
        }
        
        # Set cache
        await cache_service.set_classification(
            "Write a Python function",
            classification_result,
            ttl=3600
        )
        
        # Verify Redis set was called with correct arguments
        mock_redis.set.assert_called_once()
        call_args = mock_redis.set.call_args
        
        # Check key format
        assert call_args[0][0].startswith("intent:")
        
        # Check value is JSON
        cached_value = json.loads(call_args[0][1])
        assert cached_value["intent"] == "code_generation"
        assert cached_value["confidence"] == 0.87
        
        # Check TTL
        assert call_args[1]["ex"] == 3600
    
    @pytest.mark.asyncio
    async def test_cache_ttl_handling(self, cache_service, mock_redis):
        """Test TTL (Time To Live) handling."""
        cache_service.redis_client = mock_redis
        
        # Test with different TTL values
        ttl_cases = [
            (60, "short-lived cache"),      # 1 minute
            (3600, "standard cache"),       # 1 hour
            (86400, "long-lived cache"),    # 1 day
            (None, "default TTL"),          # Should use default
        ]
        
        for ttl, description in ttl_cases:
            mock_redis.set.reset_mock()
            
            await cache_service.set_classification(
                f"Test prompt for {description}",
                {"intent": "test", "confidence": 0.9},
                ttl=ttl
            )
            
            # Verify TTL was set correctly
            if ttl is not None:
                assert mock_redis.set.call_args[1]["ex"] == ttl
            else:
                # Should use default TTL from settings
                assert "ex" in mock_redis.set.call_args[1]
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, cache_service, mock_redis):
        """Test cache invalidation."""
        cache_service.redis_client = mock_redis
        
        # Invalidate specific key
        text = "Test prompt"
        await cache_service.invalidate_classification(text)
        
        # Verify delete was called with correct key
        mock_redis.delete.assert_called_once()
        call_args = mock_redis.delete.call_args[0]
        assert call_args[0].startswith("intent:")
    
    @pytest.mark.asyncio
    async def test_cache_error_handling(self, cache_service, mock_redis):
        """Test error handling in cache operations."""
        # Simulate Redis connection error
        mock_redis.get = AsyncMock(side_effect=Exception("Redis connection error"))
        cache_service.redis_client = mock_redis
        
        # Should handle error gracefully and return None
        result = await cache_service.get_classification("Test prompt")
        assert result is None
        
        # Test set operation error handling
        mock_redis.set = AsyncMock(side_effect=Exception("Redis write error"))
        
        # Should handle error gracefully (not raise)
        try:
            await cache_service.set_classification(
                "Test prompt",
                {"intent": "test", "confidence": 0.9}
            )
            # Should not raise exception
            assert True
        except Exception:
            pytest.fail("Cache set should handle errors gracefully")
    
    @pytest.mark.asyncio
    async def test_cache_with_metadata(self, cache_service, mock_redis):
        """Test caching with additional metadata."""
        cache_service.redis_client = mock_redis
        
        # Classification with metadata
        classification_result = {
            "intent": "data_analysis",
            "confidence": 0.92,
            "complexity": "complex",
            "suggested_techniques": ["tree_of_thoughts", "chain_of_thought"],
            "tokens_used": 120,
            "metadata": {
                "processing_time_ms": 250,
                "model_version": "1.0.0",
                "torchserve_node": "node1"
            }
        }
        
        # Cache the result
        await cache_service.set_classification(
            "Analyze this dataset and create visualizations",
            classification_result
        )
        
        # Verify metadata is included in cached value
        call_args = mock_redis.set.call_args[0]
        cached_value = json.loads(call_args[1])
        
        assert "metadata" in cached_value
        assert cached_value["metadata"]["processing_time_ms"] == 250
        assert cached_value["metadata"]["model_version"] == "1.0.0"
    
    @pytest.mark.asyncio
    async def test_cache_statistics(self, cache_service, mock_redis):
        """Test cache hit/miss statistics tracking."""
        cache_service.redis_client = mock_redis
        
        # Initialize statistics
        cache_service._stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0
        }
        
        # Simulate cache hit
        mock_redis.get = AsyncMock(return_value=json.dumps({
            "intent": "test",
            "confidence": 0.9
        }))
        await cache_service.get_classification("Test 1")
        assert cache_service._stats["hits"] == 1
        assert cache_service._stats["misses"] == 0
        
        # Simulate cache miss
        mock_redis.get = AsyncMock(return_value=None)
        await cache_service.get_classification("Test 2")
        assert cache_service._stats["hits"] == 1
        assert cache_service._stats["misses"] == 1
        
        # Simulate error
        mock_redis.get = AsyncMock(side_effect=Exception("Error"))
        await cache_service.get_classification("Test 3")
        assert cache_service._stats["errors"] == 1
    
    @pytest.mark.parametrize("text,expected_key_parts", [
        ("Simple query", ["intent:", "simple", "query"]),
        ("Query with numbers 123", ["intent:", "query", "numbers", "123"]),
        ("Special chars !@#", ["intent:", "special", "chars"]),
        ("", ["intent:"]),  # Empty string
    ])
    def test_cache_key_format(self, cache_service, text, expected_key_parts):
        """Test cache key format for various inputs."""
        key = cache_service._generate_cache_key(text)
        
        # Key should start with prefix
        assert key.startswith(expected_key_parts[0])
        
        # Key should be deterministic
        key2 = cache_service._generate_cache_key(text)
        assert key == key2
        
        # Key length should be reasonable
        assert 10 < len(key) < 100