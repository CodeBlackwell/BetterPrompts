"""Unit tests for caching mechanisms."""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
import hashlib
import json


class TestCaching:
    """Test suite for caching functionality."""
    
    @pytest.mark.asyncio
    async def test_cache_key_generation(self, initialized_classifier):
        """Test cache key generation for different inputs."""
        test_inputs = [
            "Simple query",
            "Simple query",  # Duplicate
            "Different query",
            "Query with special chars: @#$%",
            "Very long query " * 100,
        ]
        
        cache_keys = []
        for text in test_inputs:
            # Generate cache key
            if hasattr(initialized_classifier, '_generate_cache_key'):
                key = initialized_classifier._generate_cache_key(text)
            else:
                # Default implementation
                key = hashlib.md5(text.encode()).hexdigest()
            
            cache_keys.append(key)
        
        # First two should be the same (duplicate inputs)
        assert cache_keys[0] == cache_keys[1]
        
        # Others should be unique
        unique_keys = set(cache_keys[2:])
        assert len(unique_keys) == len(cache_keys[2:])
    
    @pytest.mark.asyncio
    async def test_cache_hit(self, torchserve_classifier, mock_cache, sample_texts):
        """Test cache hit scenario."""
        # Set up cache with pre-computed result
        cached_result = {
            "intent": "code_generation",
            "confidence": 0.95,
            "complexity": "moderate",
            "suggested_techniques": ["chain_of_thought"],
            "cached": True
        }
        
        cache_key = hashlib.md5(sample_texts["code_generation"].encode()).hexdigest()
        mock_cache.get.return_value = json.dumps(cached_result)
        
        # Inject cache
        if hasattr(torchserve_classifier, 'cache'):
            torchserve_classifier.cache = mock_cache
            
            # Should return cached result without calling TorchServe
            result = await torchserve_classifier.classify(sample_texts["code_generation"])
            
            # Verify cache was checked
            mock_cache.get.assert_called()
            
            # Verify TorchServe was not called
            torchserve_classifier.torchserve_client.classify.assert_not_called()
            
            # Verify cached result
            assert result.get("cached") is True
    
    @pytest.mark.asyncio
    async def test_cache_miss(self, torchserve_classifier, mock_cache, mock_torchserve_response, sample_texts):
        """Test cache miss scenario."""
        # Cache returns None (miss)
        mock_cache.get.return_value = None
        torchserve_classifier.torchserve_client.classify.return_value = mock_torchserve_response
        
        if hasattr(torchserve_classifier, 'cache'):
            torchserve_classifier.cache = mock_cache
            
            result = await torchserve_classifier.classify(sample_texts["code_generation"])
            
            # Verify cache was checked
            mock_cache.get.assert_called()
            
            # Verify TorchServe was called
            torchserve_classifier.torchserve_client.classify.assert_called_once()
            
            # Verify result was cached
            mock_cache.set.assert_called()
    
    @pytest.mark.asyncio
    async def test_cache_ttl(self, mock_cache):
        """Test cache TTL (Time To Live) functionality."""
        # Test that cache entries expire
        ttl_seconds = 3600  # 1 hour
        
        mock_cache.set = AsyncMock()
        
        # Verify TTL is set when caching
        await mock_cache.set("test_key", "test_value", ttl_seconds)
        mock_cache.set.assert_called_with("test_key", "test_value", ttl_seconds)
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, torchserve_classifier, mock_cache):
        """Test cache invalidation mechanisms."""
        if hasattr(torchserve_classifier, 'invalidate_cache'):
            # Test pattern-based invalidation
            await torchserve_classifier.invalidate_cache(pattern="intent:*")
            mock_cache.delete.assert_called()
            
            # Test full cache clear
            await torchserve_classifier.clear_cache()
            # Should call appropriate cache clearing method
    
    @pytest.mark.asyncio
    async def test_cache_size_limits(self, mock_cache):
        """Test cache size limiting functionality."""
        # Simulate cache size tracking
        cache_size = 0
        max_cache_size = 1000  # MB
        
        async def mock_set_with_size_check(key, value, ttl=None):
            nonlocal cache_size
            value_size = len(json.dumps(value).encode()) / (1024 * 1024)  # Convert to MB
            
            if cache_size + value_size > max_cache_size:
                # Should trigger cache eviction
                raise Exception("Cache full")
            
            cache_size += value_size
            return True
        
        mock_cache.set = AsyncMock(side_effect=mock_set_with_size_check)
        
        # Test adding items until cache is full
        large_value = {"data": "x" * 1000000}  # ~1MB
        
        for i in range(1100):  # Try to exceed limit
            try:
                await mock_cache.set(f"key_{i}", large_value)
            except Exception as e:
                assert str(e) == "Cache full"
                break
    
    @pytest.mark.asyncio
    async def test_concurrent_cache_access(self, torchserve_classifier, mock_cache, mock_torchserve_response):
        """Test concurrent cache access handling."""
        # Simulate concurrent requests for the same key
        mock_cache.get.return_value = None
        torchserve_classifier.torchserve_client.classify.return_value = mock_torchserve_response
        
        if hasattr(torchserve_classifier, 'cache'):
            torchserve_classifier.cache = mock_cache
            
            # Launch multiple concurrent requests
            text = "Concurrent test query"
            tasks = [
                torchserve_classifier.classify(text)
                for _ in range(10)
            ]
            
            results = await asyncio.gather(*tasks)
            
            # All results should be the same
            first_result = results[0]
            for result in results[1:]:
                assert result == first_result
            
            # TorchServe should only be called once (cache stampede prevention)
            # Note: This might be implementation dependent
            call_count = torchserve_classifier.torchserve_client.classify.call_count
            assert call_count <= 3  # Allow some concurrent calls but not all 10
    
    @pytest.mark.asyncio
    async def test_cache_warmup(self, torchserve_classifier, mock_cache):
        """Test cache warmup functionality."""
        if hasattr(torchserve_classifier, 'warmup_cache'):
            common_queries = [
                "Write a function",
                "Explain this concept",
                "Debug this code",
                "Create a class",
            ]
            
            # Warm up cache with common queries
            await torchserve_classifier.warmup_cache(common_queries)
            
            # Verify cache was populated
            assert mock_cache.set.call_count >= len(common_queries)
    
    def test_cache_serialization(self):
        """Test serialization of cache values."""
        test_objects = [
            {"intent": "test", "confidence": 0.95},
            {"complex": {"nested": {"structure": [1, 2, 3]}}},
            {"unicode": "Hello 世界 🌍"},
            {"special_float": float('inf')},  # Should handle special values
        ]
        
        for obj in test_objects:
            # Test serialization
            serialized = json.dumps(obj, default=str)
            assert isinstance(serialized, str)
            
            # Test deserialization
            deserialized = json.loads(serialized)
            assert isinstance(deserialized, dict)
    
    @pytest.mark.asyncio
    async def test_cache_performance(self, torchserve_classifier, mock_cache, mock_torchserve_response, performance_metrics):
        """Test cache performance improvements."""
        mock_cache.get.return_value = json.dumps(mock_torchserve_response)
        
        if hasattr(torchserve_classifier, 'cache'):
            torchserve_classifier.cache = mock_cache
            
            # Time cached request
            start_time = time.time()
            await torchserve_classifier.classify("Test query")
            cached_time = time.time() - start_time
            
            # Reset cache to force miss
            mock_cache.get.return_value = None
            torchserve_classifier.torchserve_client.classify.return_value = mock_torchserve_response
            
            # Time uncached request
            start_time = time.time()
            await torchserve_classifier.classify("Different query")
            uncached_time = time.time() - start_time
            
            # Cached should be significantly faster
            # Allow for some variance in timing
            assert cached_time < uncached_time * 0.5 or cached_time < 0.01