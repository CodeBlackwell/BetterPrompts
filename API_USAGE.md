# BetterPrompts API Usage Guide

## Overview

BetterPrompts API provides intelligent prompt enhancement capabilities through a simple REST API. This guide covers authentication, endpoints, and usage examples.

## Base URL

```
http://localhost:8080/api/v1  # Local development
https://api.betterprompts.ai/api/v1  # Production
```

## Authentication

The API supports two authentication methods:

### 1. JWT Token (Default)

```bash
# Register
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'

# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}

# Use token in requests
curl http://localhost:8080/api/v1/history \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 2. API Key (Optional - enable in config)

```bash
curl http://localhost:8080/api/v1/enhance \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your prompt here"}'
```

## Core Endpoints

### 1. Enhance Prompt - `POST /enhance`

Transform any prompt into an optimized version using AI-powered techniques.

**Request:**
```json
{
  "text": "Explain quantum computing",
  "context": {
    "domain": "education",
    "audience": "beginners"
  },
  "prefer_techniques": ["step_by_step", "analogical"],
  "exclude_techniques": ["tree_of_thoughts"],
  "target_complexity": "intermediate"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "original_text": "Explain quantum computing",
  "enhanced_text": "Let me explain quantum computing step by step, using familiar analogies...",
  "intent": "explanation",
  "complexity": "intermediate",
  "techniques_used": ["step_by_step", "analogical"],
  "confidence": 0.95,
  "processing_time_ms": 245,
  "enhanced": true,
  "metadata": {
    "tokens_used": 150,
    "model_version": "1.0.0"
  }
}
```

### 2. Analyze Intent - `POST /analyze`

Analyze a prompt without enhancement to understand its intent and complexity.

**Request:**
```json
{
  "text": "Write a story about a robot learning to paint",
  "context": {}
}
```

**Response:**
```json
{
  "intent": "creative_writing",
  "complexity": "intermediate",
  "confidence": 0.92,
  "suggested_techniques": ["role_play", "creative_constraints", "emotional_appeal"],
  "topics": ["storytelling", "artificial_intelligence", "creativity"],
  "metadata": {
    "model_version": "1.0.0",
    "processing_time_ms": 89
  }
}
```

### 3. Get Available Techniques - `GET /techniques`

List all available prompt engineering techniques.

**Response:**
```json
{
  "techniques": [
    {
      "id": "chain_of_thought",
      "name": "Chain of Thought",
      "description": "Break down complex reasoning into step-by-step logic",
      "best_for": ["problem_solving", "analysis", "math"],
      "effectiveness_score": 0.89
    },
    {
      "id": "few_shot",
      "name": "Few-Shot Learning",
      "description": "Provide examples to guide the response format",
      "best_for": ["formatting", "consistency", "pattern_following"],
      "effectiveness_score": 0.85
    }
    // ... more techniques
  ]
}
```

### 4. Get Enhancement History - `GET /history` (Authenticated)

Retrieve your prompt enhancement history.

**Response:**
```json
{
  "history": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2024-01-20T10:30:00Z",
      "original_input": "Explain machine learning",
      "enhanced_output": "Let's explore machine learning step by step...",
      "intent": "explanation",
      "techniques_used": ["step_by_step", "analogical"],
      "feedback_score": 5
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45
  }
}
```

### 5. Submit Feedback - `POST /feedback` (Authenticated)

Provide feedback on enhancement quality.

**Request:**
```json
{
  "enhancement_id": "550e8400-e29b-41d4-a716-446655440000",
  "score": 5,
  "comment": "Much clearer than my original prompt!"
}
```

## Error Handling

The API uses standard HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid authentication
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "error": "Invalid request body",
  "details": "Field 'text' is required",
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Rate Limiting

- Default: 60 requests per minute per IP
- Authenticated users: 200 requests per minute
- Response headers include rate limit info:
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp for reset

## Code Examples

### Python

```python
import requests
import json

class BetterPromptsAPI:
    def __init__(self, base_url="http://localhost:8080/api/v1", api_key=None):
        self.base_url = base_url
        self.headers = {"Content-Type": "application/json"}
        if api_key:
            self.headers["X-API-Key"] = api_key
    
    def enhance(self, text, **kwargs):
        data = {"text": text, **kwargs}
        response = requests.post(
            f"{self.base_url}/enhance",
            json=data,
            headers=self.headers
        )
        return response.json()

# Usage
api = BetterPromptsAPI()
result = api.enhance(
    "Explain neural networks",
    prefer_techniques=["step_by_step", "visual_thinking"],
    context={"audience": "beginners"}
)
print(f"Enhanced: {result['enhanced_text']}")
```

### JavaScript/Node.js

```javascript
class BetterPromptsAPI {
  constructor(baseUrl = 'http://localhost:8080/api/v1', apiKey = null) {
    this.baseUrl = baseUrl;
    this.headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      this.headers['X-API-Key'] = apiKey;
    }
  }

  async enhance(text, options = {}) {
    const response = await fetch(`${this.baseUrl}/enhance`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ text, ...options })
    });
    return response.json();
  }
}

// Usage
const api = new BetterPromptsAPI();
const result = await api.enhance('Explain quantum computing', {
  preferTechniques: ['step_by_step', 'analogical'],
  context: { audience: 'high_school' }
});
console.log(`Enhanced: ${result.enhanced_text}`);
```

### cURL

```bash
# Basic enhancement
curl -X POST http://localhost:8080/api/v1/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Help me write a business plan"
  }'

# With preferences
curl -X POST http://localhost:8080/api/v1/enhance \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Explain climate change",
    "prefer_techniques": ["step_by_step", "visual_thinking"],
    "context": {
      "audience": "children",
      "purpose": "education"
    }
  }'

# With authentication
curl -X POST http://localhost:8080/api/v1/enhance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Analyze this data trend"
  }'
```

## Best Practices

1. **Cache Responses**: Enhancement results are deterministic for the same input - cache them client-side
2. **Batch Requests**: For multiple prompts, consider implementing a queue to respect rate limits
3. **Error Handling**: Implement exponential backoff for rate limit errors
4. **Context Matters**: Always provide context for better enhancement results
5. **Technique Selection**: Let the API choose techniques unless you have specific requirements

## OpenAPI/Swagger Documentation

Interactive API documentation is available at:
- Local: http://localhost:8080/docs
- Production: https://api.betterprompts.ai/docs

OpenAPI specification:
- Local: http://localhost:8080/openapi.json
- Production: https://api.betterprompts.ai/openapi.json

## Support

- GitHub Issues: https://github.com/your-org/betterprompts/issues
- Email: api-support@betterprompts.ai
- Documentation: https://docs.betterprompts.ai