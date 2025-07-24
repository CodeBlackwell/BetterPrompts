"""Pytest configuration and fixtures for Intent Classification Service tests."""

import os
import sys
from pathlib import Path
from typing import AsyncGenerator, Dict, Any
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.classifier import IntentClassifier
from app.models.torchserve_client import TorchServeClient
from app.core.config import Settings


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    settings = MagicMock(spec=Settings)
    settings.MODEL_NAME = "microsoft/deberta-v3-base"
    settings.MODEL_DEVICE = "cpu"
    settings.MODEL_MAX_LENGTH = 512
    settings.USE_TORCHSERVE = False
    settings.TORCHSERVE_URL = "http://localhost:8080"
    settings.TORCHSERVE_MODEL_NAME = "intent_classifier"
    settings.TORCHSERVE_TIMEOUT = 30
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]
    return settings


@pytest.fixture
def mock_torchserve_response():
    """Mock response from TorchServe."""
    return {
        "intent": "code_generation",
        "confidence": 0.92,
        "complexity": {
            "level": "moderate",
            "score": 0.65
        },
        "techniques": [
            {"name": "chain_of_thought", "score": 0.85},
            {"name": "few_shot", "score": 0.72},
            {"name": "self_consistency", "score": 0.68}
        ],
        "all_intents": {
            "question_answering": 0.05,
            "creative_writing": 0.02,
            "code_generation": 0.92,
            "data_analysis": 0.01,
            "reasoning": 0.00,
            "summarization": 0.00,
            "translation": 0.00,
            "conversation": 0.00,
            "task_planning": 0.00,
            "problem_solving": 0.00
        },
        "metadata": {
            "model_version": "1.0.0",
            "tokens_used": 125,
            "inference_time_ms": 234.5
        }
    }


@pytest.fixture
def sample_texts():
    """Sample texts for testing."""
    return {
        "simple": "What is the capital of France?",
        "moderate": "Write a Python function that calculates the factorial of a number using recursion.",
        "complex": "Design and implement a distributed caching system that handles cache invalidation across multiple nodes, supports TTL-based expiration, and provides consistency guarantees. Include error handling, monitoring, and performance optimization strategies.",
        "code_generation": "Create a REST API endpoint for user authentication",
        "reasoning": "If all roses are flowers and some flowers fade quickly, can we conclude that some roses fade quickly?",
        "creative": "Write a short story about a robot learning to paint",
        "analysis": "Analyze the time complexity of merge sort algorithm",
        "empty": "",
        "short": "Hi",
        "with_conditions": "If the user is authenticated and has admin privileges, then allow access to the dashboard",
        "with_multiple_parts": "First, explain the concept of recursion. Then provide an example in Python. Finally, discuss its advantages and disadvantages.",
        "with_comparisons": "Compare the performance difference between quicksort and mergesort algorithms"
    }


@pytest_asyncio.fixture
async def mock_torchserve_client():
    """Mock TorchServe client."""
    client = AsyncMock(spec=TorchServeClient)
    client.connect = AsyncMock()
    client.health_check = AsyncMock(return_value=True)
    client.classify = AsyncMock()
    client.close = AsyncMock()
    return client


@pytest_asyncio.fixture
async def classifier(mock_settings, monkeypatch):
    """Create an IntentClassifier instance with mocked settings."""
    monkeypatch.setattr("app.core.config.settings", mock_settings)
    classifier = IntentClassifier()
    yield classifier
    # Cleanup
    await classifier.cleanup()


@pytest_asyncio.fixture
async def initialized_classifier(classifier):
    """Create an initialized IntentClassifier instance."""
    with patch.object(classifier, '_load_model'):
        await classifier.initialize_model()
    return classifier


@pytest_asyncio.fixture
async def torchserve_classifier(mock_settings, mock_torchserve_client, monkeypatch):
    """Create an IntentClassifier instance configured for TorchServe."""
    mock_settings.USE_TORCHSERVE = True
    monkeypatch.setattr("app.core.config.settings", mock_settings)
    
    classifier = IntentClassifier()
    classifier.torchserve_client = mock_torchserve_client
    classifier._initialized = True
    
    yield classifier
    # Cleanup
    await classifier.cleanup()


@pytest.fixture
def mock_model_output():
    """Mock output from the local model."""
    import torch
    
    # Create mock logits for 10 classes
    logits = torch.randn(1, 10)
    # Set high value for code_generation (index 2)
    logits[0, 2] = 5.0
    
    mock_output = MagicMock()
    mock_output.logits = logits
    return mock_output


@pytest.fixture
def performance_metrics():
    """Performance assertion thresholds."""
    return {
        "max_classification_time_ms": 500,
        "max_initialization_time_s": 10,
        "max_memory_usage_mb": 1000,
        "min_throughput_rps": 10
    }


@pytest.fixture
def mock_cache():
    """Mock Redis cache."""
    cache = MagicMock()
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock()
    cache.delete = AsyncMock()
    cache.exists = AsyncMock(return_value=False)
    return cache


@pytest.fixture
def api_client():
    """Create a test client for the FastAPI app."""
    from fastapi.testclient import TestClient
    from app.main import app
    
    return TestClient(app)