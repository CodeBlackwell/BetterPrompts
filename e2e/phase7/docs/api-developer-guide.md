# BetterPrompts API Developer Guide

Welcome to the BetterPrompts API! This guide will help you integrate our AI-powered prompt enhancement capabilities into your applications.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Core Endpoints](#core-endpoints)
4. [Rate Limiting](#rate-limiting)
5. [Webhooks](#webhooks)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [SDKs and Examples](#sdks-and-examples)

## Getting Started

### Base URL

All API requests should be made to:

```
https://api.betterprompts.io/v1
```

For local development:
```
http://localhost/api/v1
```

### Request Format

- All requests must include `Content-Type: application/json`
- Request bodies should be valid JSON
- Responses are returned in JSON format

### Quick Example

```bash
curl -X POST https://api.betterprompts.io/v1/enhance \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "text": "Write a function to sort an array",
    "target_complexity": "moderate"
  }'
```

## Authentication

BetterPrompts API supports two authentication methods:

### 1. API Key Authentication (Recommended)

Include your API key in the request header:

```http
X-API-Key: your-api-key-here
```

**Example:**
```javascript
const response = await fetch('https://api.betterprompts.io/v1/enhance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key-here'
  },
  body: JSON.stringify({
    text: 'Your prompt here'
  })
});
```

### 2. Bearer Token Authentication

For user-specific operations, use JWT bearer tokens:

```http
Authorization: Bearer your-jwt-token
```

**Obtaining a Bearer Token:**

```javascript
// Login
const authResponse = await fetch('https://api.betterprompts.io/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your-password'
  })
});

const { access_token } = await authResponse.json();

// Use token in subsequent requests
const response = await fetch('https://api.betterprompts.io/v1/history', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});
```

## Core Endpoints

### 1. Enhance Prompt

**Endpoint:** `POST /enhance`

Analyze and enhance a single prompt using AI-powered techniques.

**Request Body:**
```json
{
  "text": "Write a function to sort an array",
  "context": {
    "language": "python",
    "level": "beginner"
  },
  "prefer_techniques": ["step_by_step", "examples"],
  "exclude_techniques": ["analogies"],
  "target_complexity": "simple"
}
```

**Parameters:**
- `text` (required): The prompt to enhance (1-5000 characters)
- `context` (optional): Additional context for better enhancement
- `prefer_techniques` (optional): Array of preferred technique IDs
- `exclude_techniques` (optional): Array of techniques to avoid
- `target_complexity` (optional): "simple", "moderate", or "complex"

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "original_text": "Write a function to sort an array",
  "enhanced_text": "Write a Python function that takes an array of numbers as input and returns a new array with the elements sorted in ascending order. Include:\n1. Function definition with clear parameter names\n2. Step-by-step implementation\n3. Example usage with sample input/output\n4. Time complexity analysis",
  "intent": "code_generation",
  "complexity": "simple",
  "techniques_used": ["step_by_step", "examples"],
  "confidence": 0.92,
  "processing_time_ms": 127.5,
  "enhanced": true
}
```

### 2. Batch Enhancement

**Endpoint:** `POST /batch` *(Requires Authentication)*

Process multiple prompts asynchronously.

**Request Body:**
```json
{
  "requests": [
    {
      "text": "Explain TCP vs UDP",
      "target_complexity": "simple"
    },
    {
      "text": "Design a caching system",
      "prefer_techniques": ["system_design"]
    }
  ]
}
```

**Response:**
```json
{
  "job_id": "batch-550e8400-e29b-41d4-a716-446655440000"
}
```

**Limitations:**
- Maximum 100 requests per batch
- Requires authentication
- Results available via webhook or polling

### 3. List Techniques

**Endpoint:** `GET /techniques`

Get available prompt enhancement techniques.

**Query Parameters:**
- `category`: Filter by category (reasoning, creative, analytical, instructional)
- `complexity`: Filter by complexity level (1-5)

**Example:**
```
GET /techniques?category=reasoning&complexity=2
```

**Response:**
```json
[
  {
    "id": "chain_of_thought",
    "name": "Chain of Thought",
    "category": "reasoning",
    "description": "Step-by-step reasoning that breaks down complex problems",
    "complexity": 2,
    "examples": [
      "Let me work through this step-by-step...",
      "First, I'll identify the key components..."
    ],
    "effectiveness": {
      "overall": 0.85,
      "byIntent": {
        "problem_solving": 0.9,
        "analysis": 0.85
      }
    }
  }
]
```

### 4. Prompt History

**Endpoint:** `GET /history` *(Requires Authentication)*

Retrieve your prompt enhancement history.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort_by`: Sort field (default: created_at)
- `sort_order`: "asc" or "desc" (default: desc)
- `start_date`: Filter by start date (ISO 8601)
- `end_date`: Filter by end date (ISO 8601)
- `intent`: Filter by intent type
- `technique`: Filter by technique used

**Example:**
```
GET /history?page=1&limit=10&intent=code_generation
```

**Response:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user-123",
      "original_text": "Write a sorting function",
      "enhanced_text": "...",
      "intent": "code_generation",
      "complexity": "simple",
      "techniques_used": ["step_by_step"],
      "confidence": 0.92,
      "processing_time_ms": 127.5,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 10,
  "total_pages": 5,
  "has_next": true,
  "has_prev": false
}
```

### 5. Usage Statistics

**Endpoint:** `GET /stats` *(Requires Authentication)*

Get your usage statistics and metrics.

**Response:**
```json
{
  "total_enhancements": 1523,
  "techniques_usage": {
    "chain_of_thought": 342,
    "step_by_step": 287,
    "examples": 198
  },
  "average_confidence": 0.87,
  "average_processing_time": 145.3
}
```

## Rate Limiting

API rate limits help ensure fair usage and system stability.

### Rate Limit Tiers

| Tier | Requests/Minute | Burst Capacity |
|------|----------------|----------------|
| Default | 1,000 | 100 |
| Enterprise | 10,000 | 1,000 |

### Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1705321860
```

### Handling Rate Limits

When rate limited, you'll receive a 429 response:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Please retry after 45 seconds.",
  "request_id": "req-550e8400"
}
```

**Headers:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705321860
```

**Best Practices:**
- Implement exponential backoff
- Respect the `Retry-After` header
- Use batch endpoints for bulk operations
- Cache responses when appropriate

## Webhooks

Webhooks allow you to receive real-time notifications for asynchronous events.

### Setting Up Webhooks

**Create a Webhook:**
```bash
POST /webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["enhancement.completed", "batch.finished"],
  "active": true
}
```

**Response:**
```json
{
  "id": "webhook-123",
  "secret": "whsec_aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW"
}
```

### Webhook Events

| Event | Description | Payload |
|-------|-------------|---------|
| `enhancement.completed` | Single enhancement finished | Enhancement result |
| `batch.finished` | Batch job completed | Job summary |
| `error.occurred` | Processing error | Error details |

### Webhook Security

All webhook requests include an HMAC signature:

```http
X-Webhook-Signature: sha256=7d38cdd689735b008b3c7ada8d3f8e9e4f6ec4cf96de8c7f0e2736ca7a301c85
```

**Verify Signature (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Webhook Delivery

- Webhooks are delivered with `POST` requests
- Timeout: 30 seconds
- Retries: Up to 3 attempts with exponential backoff
- Success: Any 2xx status code

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "validation_error",
  "message": "The 'text' field is required and cannot be empty",
  "details": {
    "field": "text",
    "constraint": "required"
  },
  "request_id": "req-550e8400-e29b-41d4-a716-446655440000"
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `validation_error` | Invalid request parameters |
| 401 | `unauthorized` | Missing or invalid authentication |
| 403 | `forbidden` | Insufficient permissions |
| 404 | `not_found` | Resource not found |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `internal_error` | Server error |
| 503 | `service_unavailable` | Temporary unavailability |

### Error Handling Example

```javascript
try {
  const response = await fetch('https://api.betterprompts.io/v1/enhance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({ text: prompt })
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (response.status) {
      case 429:
        // Handle rate limiting
        const retryAfter = response.headers.get('Retry-After');
        await sleep(retryAfter * 1000);
        // Retry request
        break;
      
      case 401:
        // Handle authentication error
        // Refresh token or prompt for new API key
        break;
      
      default:
        console.error(`API Error: ${error.message}`);
    }
  }
  
  const data = await response.json();
  // Process successful response
} catch (networkError) {
  // Handle network errors
  console.error('Network error:', networkError);
}
```

## Best Practices

### 1. Efficient API Usage

- **Batch Operations**: Use `/batch` endpoint for multiple prompts
- **Caching**: Cache technique lists and unchanged responses
- **Compression**: Enable gzip compression for large payloads

### 2. Error Recovery

```javascript
async function enhanceWithRetry(text, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await enhancePrompt(text);
      return response;
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        // Rate limited - wait and retry
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Request Optimization

- **Provide Context**: Include relevant context for better results
- **Specify Preferences**: Use `prefer_techniques` for consistent output
- **Target Complexity**: Guide the enhancement with `target_complexity`

### 4. Security

- **Secure Storage**: Never expose API keys in client-side code
- **HTTPS Only**: Always use HTTPS in production
- **Validate Webhooks**: Always verify webhook signatures
- **Sanitize Input**: Clean user input before sending to API

## SDKs and Examples

### Official SDKs

- **JavaScript/TypeScript**: `npm install @betterprompts/sdk`
- **Python**: `pip install betterprompts`
- **Go**: `go get github.com/betterprompts/go-sdk`
- **Java**: Coming soon

### Quick Start Examples

**JavaScript:**
```javascript
import { BetterPromptsClient } from '@betterprompts/sdk';

const client = new BetterPromptsClient({
  apiKey: process.env.BETTERPROMPTS_API_KEY
});

// Enhance a prompt
const result = await client.enhance({
  text: 'Explain recursion',
  targetComplexity: 'simple'
});

console.log(result.enhancedText);
```

**Python:**
```python
from betterprompts import Client

client = Client(api_key=os.environ['BETTERPROMPTS_API_KEY'])

# Enhance a prompt
result = client.enhance(
    text="Explain recursion",
    target_complexity="simple"
)

print(result.enhanced_text)
```

**cURL:**
```bash
curl -X POST https://api.betterprompts.io/v1/enhance \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BETTERPROMPTS_API_KEY" \
  -d '{
    "text": "Explain recursion",
    "target_complexity": "simple"
  }'
```

### Advanced Examples

See our [GitHub repository](https://github.com/betterprompts/examples) for more examples:

- Webhook integration
- Batch processing
- Rate limit handling
- Custom technique selection
- React/Vue/Angular components
- CLI tools

## Support

- **Documentation**: https://docs.betterprompts.io
- **API Status**: https://status.betterprompts.io
- **Support**: support@betterprompts.io
- **Discord**: https://discord.gg/betterprompts

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- Core enhancement endpoints
- Webhook support
- Rate limiting
- Authentication via API keys and JWT

### Upcoming Features
- GraphQL API
- WebSocket support for real-time enhancements
- Custom technique training
- Team collaboration features