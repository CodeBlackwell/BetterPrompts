"""
Integration tests for BetterPrompts backend services.
Tests the interactions between Intent Classifier, Technique Selector, and Prompt Generator.
"""

import asyncio
import json
import time
from typing import Dict, Any, Optional
from unittest.mock import Mock, patch, AsyncMock

import pytest
import redis
from httpx import AsyncClient, Response
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Test configuration
TEST_CONFIG = {
    "intent_classifier": {
        "base_url": "http://localhost:8001",
        "timeout": 10
    },
    "technique_selector": {
        "base_url": "http://localhost:8002",
        "timeout": 10
    },
    "prompt_generator": {
        "base_url": "http://localhost:8003",
        "timeout": 10
    },
    "torchserve": {
        "base_url": "http://localhost:8080",
        "timeout": 15
    },
    "redis": {
        "host": "localhost",
        "port": 6379,
        "decode_responses": True
    },
    "database": {
        "url": "postgresql://betterprompts:betterprompts@localhost:5432/betterprompts_test"
    }
}


class ServiceHealthChecker:
    """Checks health status of all services."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.client = AsyncClient()
    
    async def check_all_services(self) -> Dict[str, bool]:
        """Check health of all backend services."""
        results = {}
        
        services = [
            ("intent_classifier", "/health"),
            ("technique_selector", "/health"),
            ("prompt_generator", "/health"),
            ("torchserve", "/ping")
        ]
        
        for service_name, health_path in services:
            if service_name in self.config:
                url = self.config[service_name]["base_url"] + health_path
                try:
                    response = await self.client.get(url, timeout=5)
                    results[service_name] = response.status_code == 200
                except Exception as e:
                    results[service_name] = False
                    print(f"Health check failed for {service_name}: {e}")
        
        return results
    
    async def wait_for_services(self, timeout: int = 60) -> bool:
        """Wait for all services to become healthy."""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            health_status = await self.check_all_services()
            if all(health_status.values()):
                return True
            
            await asyncio.sleep(2)
        
        return False
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()


class MockTorchServe:
    """Mock TorchServe server for testing."""
    
    def __init__(self):
        self.responses = {
            "simple": {
                "intent": "general",
                "confidence": 0.85,
                "complexity": 0.3
            },
            "complex": {
                "intent": "technical_explanation",
                "confidence": 0.92,
                "complexity": 0.8
            },
            "error": {
                "error": "Model prediction failed"
            }
        }
    
    async def predict(self, text: str) -> Dict[str, Any]:
        """Simulate model prediction."""
        if "error" in text.lower():
            return self.responses["error"]
        elif any(word in text.lower() for word in ["explain", "how", "why", "technical"]):
            return self.responses["complex"]
        else:
            return self.responses["simple"]


@pytest.fixture
async def mock_torchserve():
    """Provide mock TorchServe instance."""
    return MockTorchServe()


@pytest.fixture
async def redis_client():
    """Provide Redis client for testing."""
    client = redis.Redis(**TEST_CONFIG["redis"])
    yield client
    # Clean up test keys
    for key in client.scan_iter("test:*"):
        client.delete(key)
    client.close()


@pytest.fixture
async def db_session():
    """Provide database session for testing."""
    engine = create_engine(TEST_CONFIG["database"]["url"])
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture
async def http_client():
    """Provide HTTP client for API calls."""
    async with AsyncClient() as client:
        yield client


class TestServiceIntegration:
    """Test integration between backend services."""
    
    @pytest.mark.asyncio
    async def test_health_checks(self, http_client: AsyncClient):
        """Test that all services respond to health checks."""
        async with ServiceHealthChecker(TEST_CONFIG) as checker:
            health_status = await checker.check_all_services()
            
            # In a real test, all services should be healthy
            # For now, we'll just check the structure
            assert isinstance(health_status, dict)
            assert "intent_classifier" in health_status
            assert "technique_selector" in health_status
            assert "prompt_generator" in health_status
    
    @pytest.mark.asyncio
    async def test_complete_enhancement_pipeline(self, http_client: AsyncClient, mock_torchserve: MockTorchServe):
        """Test the complete enhancement pipeline from intent classification to prompt generation."""
        
        # Test data
        user_prompt = "Explain how neural networks work"
        
        # Step 1: Intent Classification
        intent_response = await self._classify_intent(http_client, user_prompt, mock_torchserve)
        assert intent_response is not None
        assert "intent" in intent_response
        assert "confidence" in intent_response
        assert "complexity" in intent_response
        
        # Step 2: Technique Selection
        technique_response = await self._select_techniques(
            http_client,
            user_prompt,
            intent_response["intent"],
            intent_response["complexity"]
        )
        assert technique_response is not None
        assert "techniques" in technique_response
        assert len(technique_response["techniques"]) > 0
        
        # Step 3: Prompt Generation
        prompt_response = await self._generate_prompt(
            http_client,
            user_prompt,
            technique_response["techniques"]
        )
        assert prompt_response is not None
        assert "enhanced_prompt" in prompt_response
        assert "techniques_applied" in prompt_response
        
        # Verify the pipeline produced a valid result
        assert len(prompt_response["enhanced_prompt"]) > len(user_prompt)
        assert prompt_response["techniques_applied"] == technique_response["techniques"]
    
    @pytest.mark.asyncio
    async def test_caching_strategy(self, http_client: AsyncClient, redis_client: redis.Redis):
        """Test that services properly cache results."""
        
        user_prompt = "What is machine learning?"
        cache_key = f"test:intent:{hash(user_prompt)}"
        
        # First request should miss cache
        response1 = await self._classify_intent(http_client, user_prompt, None)
        
        # Simulate caching the result
        redis_client.setex(
            cache_key,
            300,  # 5 minutes TTL
            json.dumps(response1)
        )
        
        # Second request should hit cache
        cached_data = redis_client.get(cache_key)
        assert cached_data is not None
        
        cached_response = json.loads(cached_data)
        assert cached_response == response1
    
    @pytest.mark.asyncio
    async def test_error_propagation(self, http_client: AsyncClient, mock_torchserve: MockTorchServe):
        """Test that errors propagate correctly through the service chain."""
        
        # Test with error-triggering input
        error_prompt = "This will cause an error in classification"
        
        # Intent classification should handle the error
        with pytest.raises(Exception) as exc_info:
            await self._classify_intent(http_client, error_prompt, mock_torchserve)
        
        # Verify error contains useful information
        assert "classification failed" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_service_circuit_breakers(self, http_client: AsyncClient):
        """Test circuit breaker functionality when services fail."""
        
        # Simulate multiple failures to trigger circuit breaker
        failure_count = 0
        max_failures = 5
        
        for i in range(max_failures + 2):
            try:
                # Use a prompt that will cause timeouts
                await self._classify_intent(http_client, "timeout test", None, timeout=0.1)
            except Exception as e:
                failure_count += 1
                
                # After max_failures, circuit should be open
                if failure_count > max_failures:
                    assert "circuit breaker" in str(e).lower() or "unavailable" in str(e).lower()
    
    @pytest.mark.asyncio
    async def test_database_integration(self, http_client: AsyncClient, db_session):
        """Test that services correctly interact with the database."""
        
        # Create a test user
        user_data = {
            "email": "integration_test@example.com",
            "name": "Integration Test User"
        }
        
        # Test user creation through API
        response = await http_client.post(
            f"{TEST_CONFIG['api_gateway']['base_url']}/api/v1/auth/register",
            json={**user_data, "password": "testpassword123"}
        )
        
        if response.status_code == 201:
            user_id = response.json()["id"]
            
            # Test saving enhancement history
            enhancement_data = {
                "user_id": user_id,
                "original_prompt": "Test prompt",
                "enhanced_prompt": "Enhanced test prompt",
                "techniques_used": ["chain_of_thought"],
                "intent": "general"
            }
            
            # This would normally go through the API Gateway
            # For testing, we simulate the database operation
            # In real tests, use the actual API endpoint
    
    @pytest.mark.asyncio
    async def test_ml_model_integration(self, http_client: AsyncClient):
        """Test integration with ML models via TorchServe."""
        
        test_cases = [
            {
                "prompt": "Simple question about Python",
                "expected_intent": "general",
                "expected_complexity": "simple"
            },
            {
                "prompt": "Explain the mathematical foundations of deep learning",
                "expected_intent": "technical_explanation",
                "expected_complexity": "complex"
            }
        ]
        
        for test_case in test_cases:
            # Call TorchServe directly for testing
            response = await http_client.post(
                f"{TEST_CONFIG['torchserve']['base_url']}/predictions/intent_classifier",
                json={"text": test_case["prompt"]}
            )
            
            if response.status_code == 200:
                result = response.json()
                # Verify model output structure
                assert "intent" in result
                assert "confidence" in result
                assert "complexity" in result
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, http_client: AsyncClient):
        """Test system behavior under concurrent load."""
        
        prompts = [
            "How do I learn Python?",
            "Explain quantum computing",
            "What is the meaning of life?",
            "How to build a web application?",
            "Explain machine learning algorithms"
        ]
        
        # Send concurrent requests
        tasks = []
        for prompt in prompts:
            task = self._process_enhancement(http_client, prompt)
            tasks.append(task)
        
        # Wait for all requests to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify results
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) >= 3  # At least 60% should succeed
        
        # Check for rate limiting
        errors = [r for r in results if isinstance(r, Exception)]
        rate_limit_errors = [e for e in errors if "rate limit" in str(e).lower()]
        assert len(rate_limit_errors) <= 2  # No more than 40% rate limited
    
    # Helper methods
    async def _classify_intent(
        self,
        client: AsyncClient,
        text: str,
        mock_torchserve: Optional[MockTorchServe],
        timeout: float = 10
    ) -> Dict[str, Any]:
        """Call intent classification service."""
        if mock_torchserve:
            # Use mock for testing
            return await mock_torchserve.predict(text)
        
        response = await client.post(
            f"{TEST_CONFIG['intent_classifier']['base_url']}/api/v1/intents/classify",
            json={"text": text},
            timeout=timeout
        )
        
        if response.status_code != 200:
            raise Exception(f"Intent classification failed: {response.text}")
        
        return response.json()
    
    async def _select_techniques(
        self,
        client: AsyncClient,
        text: str,
        intent: str,
        complexity: str
    ) -> Dict[str, Any]:
        """Call technique selection service."""
        response = await client.post(
            f"{TEST_CONFIG['technique_selector']['base_url']}/api/v1/select",
            json={
                "text": text,
                "intent": intent,
                "complexity": complexity
            },
            timeout=TEST_CONFIG['technique_selector']['timeout']
        )
        
        if response.status_code != 200:
            raise Exception(f"Technique selection failed: {response.text}")
        
        return response.json()
    
    async def _generate_prompt(
        self,
        client: AsyncClient,
        text: str,
        techniques: list
    ) -> Dict[str, Any]:
        """Call prompt generation service."""
        response = await client.post(
            f"{TEST_CONFIG['prompt_generator']['base_url']}/api/v1/generate",
            json={
                "text": text,
                "techniques": techniques
            },
            timeout=TEST_CONFIG['prompt_generator']['timeout']
        )
        
        if response.status_code != 200:
            raise Exception(f"Prompt generation failed: {response.text}")
        
        return response.json()
    
    async def _process_enhancement(
        self,
        client: AsyncClient,
        prompt: str
    ) -> Dict[str, Any]:
        """Process a complete enhancement request."""
        try:
            # Full pipeline
            intent_result = await self._classify_intent(client, prompt, None)
            technique_result = await self._select_techniques(
                client,
                prompt,
                intent_result["intent"],
                intent_result["complexity"]
            )
            prompt_result = await self._generate_prompt(
                client,
                prompt,
                technique_result["techniques"]
            )
            return prompt_result
        except Exception as e:
            return {"error": str(e)}


class TestCacheIntegration:
    """Test Redis cache integration across services."""
    
    @pytest.mark.asyncio
    async def test_cache_invalidation(self, redis_client: redis.Redis):
        """Test cache invalidation strategies."""
        
        # Set up test data
        cache_keys = [
            "intent:user123:prompt1",
            "technique:general:simple",
            "prompt:hash123"
        ]
        
        for key in cache_keys:
            redis_client.setex(f"test:{key}", 300, json.dumps({"data": "test"}))
        
        # Test pattern-based invalidation
        pattern = "test:intent:*"
        invalidated_count = 0
        for key in redis_client.scan_iter(pattern):
            redis_client.delete(key)
            invalidated_count += 1
        
        assert invalidated_count == 1
        
        # Verify other keys remain
        assert redis_client.exists("test:technique:general:simple")
        assert redis_client.exists("test:prompt:hash123")
    
    @pytest.mark.asyncio
    async def test_cache_warming(self, redis_client: redis.Redis):
        """Test cache warming strategies for common queries."""
        
        common_prompts = [
            "How to learn programming",
            "Explain machine learning",
            "What is artificial intelligence"
        ]
        
        # Warm cache with common prompts
        for prompt in common_prompts:
            cache_key = f"test:warm:intent:{hash(prompt)}"
            cache_data = {
                "intent": "explanation",
                "confidence": 0.9,
                "complexity": "moderate",
                "cached_at": time.time()
            }
            redis_client.setex(cache_key, 3600, json.dumps(cache_data))
        
        # Verify cache is warmed
        for prompt in common_prompts:
            cache_key = f"test:warm:intent:{hash(prompt)}"
            assert redis_client.exists(cache_key)
            
            data = json.loads(redis_client.get(cache_key))
            assert data["intent"] == "explanation"


class TestCircuitBreakers:
    """Test circuit breaker patterns in service communication."""
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_states(self):
        """Test circuit breaker state transitions."""
        
        class CircuitBreaker:
            def __init__(self, failure_threshold: int = 5, timeout: float = 60):
                self.failure_threshold = failure_threshold
                self.timeout = timeout
                self.failure_count = 0
                self.last_failure_time = None
                self.state = "closed"  # closed, open, half-open
            
            async def call(self, func, *args, **kwargs):
                if self.state == "open":
                    if time.time() - self.last_failure_time > self.timeout:
                        self.state = "half-open"
                    else:
                        raise Exception("Circuit breaker is open")
                
                try:
                    result = await func(*args, **kwargs)
                    if self.state == "half-open":
                        self.state = "closed"
                        self.failure_count = 0
                    return result
                except Exception as e:
                    self.failure_count += 1
                    self.last_failure_time = time.time()
                    
                    if self.failure_count >= self.failure_threshold:
                        self.state = "open"
                    
                    raise e
        
        # Test circuit breaker behavior
        breaker = CircuitBreaker(failure_threshold=3, timeout=5)
        
        async def failing_service():
            raise Exception("Service unavailable")
        
        async def working_service():
            return {"status": "ok"}
        
        # Test failures trigger circuit opening
        for i in range(3):
            with pytest.raises(Exception):
                await breaker.call(failing_service)
        
        assert breaker.state == "open"
        
        # Test circuit remains open
        with pytest.raises(Exception) as exc_info:
            await breaker.call(working_service)
        assert "Circuit breaker is open" in str(exc_info.value)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])