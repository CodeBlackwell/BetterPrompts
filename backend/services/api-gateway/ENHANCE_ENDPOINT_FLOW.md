# Enhance Endpoint Service Orchestration

## Overview

The `/api/v1/enhance` endpoint in the API Gateway orchestrates calls to three backend services to provide intelligent prompt enhancement. This document describes the complete flow and integration points.

## Service Flow Diagram

```
┌─────────────┐
│   Frontend  │
│  (React UI) │
└──────┬──────┘
       │ POST /api/v1/enhance
       │ {text, context, preferences}
       │
┌──────▼──────────────────────────────────────────────────┐
│                    API Gateway (8090)                    │
│                                                          │
│  1. Validate request & authenticate user                 │
│  2. Generate text hash for caching                       │
│  3. Check cache for existing results                     │
│  4. Orchestrate service calls                            │
│                                                          │
└──────┬───────────────┬────────────────┬─────────────────┘
       │               │                │
       │ Step 1        │ Step 2         │ Step 3
       │               │                │
┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│   Intent    │ │  Technique   │ │   Prompt    │
│ Classifier  │ │  Selector    │ │  Generator  │
│   (8001)    │ │   (8002)     │ │   (8003)    │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │                │
       │               │                │
┌──────▼──────┐        │                │
│ TorchServe  │        │                │
│   (8080)    │        │                │
│  ML Model   │        │                │
└─────────────┘        │                │
                       │                │
                       └────────┬───────┘
                                │
                        ┌───────▼────────┐
                        │   PostgreSQL   │
                        │  (Save History) │
                        └────────────────┘
```

## Detailed Request Flow

### 1. Frontend Request
```typescript
// Frontend sends enhancement request
const response = await apiClient.post('/api/v1/enhance', {
  text: "Write a function to calculate fibonacci numbers",
  context: { domain: "programming" },
  prefer_techniques: ["chain_of_thought", "step_by_step"]
});
```

### 2. API Gateway Processing

#### Step 1: Intent Classification
```go
// Call Intent Classifier Service
intentResult, err := clients.IntentClassifier.ClassifyIntent(ctx, req.Text)
// Returns: {
//   intent: "code_generation",
//   complexity: "moderate",
//   confidence: 0.92,
//   suggested_techniques: ["chain_of_thought", "step_by_step"]
// }
```

#### Step 2: Technique Selection
```go
// Call Technique Selector with intent and complexity
techniqueRequest := models.TechniqueSelectionRequest{
    Text:       req.Text,
    Intent:     intentResult.Intent,
    Complexity: intentResult.Complexity,
    PreferTechniques: req.PreferTechniques,
}
techniques, err := clients.TechniqueSelector.SelectTechniques(ctx, techniqueRequest)
// Returns: ["chain_of_thought", "step_by_step", "few_shot"]
```

#### Step 3: Prompt Generation
```go
// Call Prompt Generator with selected techniques
generationRequest := models.PromptGenerationRequest{
    Text:       req.Text,
    Intent:     intentResult.Intent,
    Complexity: intentResult.Complexity,
    Techniques: techniques,
    Context:    req.Context,
}
enhancedPrompt, err := clients.PromptGenerator.GeneratePrompt(ctx, generationRequest)
// Returns enhanced prompt with applied techniques
```

### 3. Response Format
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "original_text": "Write a function to calculate fibonacci numbers",
  "enhanced_text": "Let's approach this step-by-step:\n\n1. First, I'll analyze what fibonacci numbers are...\n2. Design the function signature...\n3. Implement the algorithm...\n\nHere's an example implementation:\n```python\ndef fibonacci(n):\n    # Base cases\n    if n <= 1:\n        return n\n    # Recursive calculation\n    return fibonacci(n-1) + fibonacci(n-2)\n```\n\nNow, write a function that calculates fibonacci numbers. Consider:\n- What programming language to use\n- Whether to use recursion or iteration\n- How to handle edge cases\n- Performance optimization techniques",
  "intent": "code_generation",
  "complexity": "moderate",
  "techniques_used": ["chain_of_thought", "step_by_step", "few_shot"],
  "confidence": 0.92,
  "processing_time_ms": 287,
  "metadata": {
    "tokens_used": 156,
    "model_version": "1.0.0"
  }
}
```

## Service URLs and Configuration

### Environment Variables
```bash
# API Gateway (docker-compose.yml)
INTENT_CLASSIFIER_URL=http://intent-classifier:8001
TECHNIQUE_SELECTOR_URL=http://technique-selector:8002
PROMPT_GENERATOR_URL=http://prompt-generator:8003
```

### Service Endpoints
- **Intent Classifier**: `POST http://intent-classifier:8001/api/v1/intents/classify`
- **Technique Selector**: `POST http://technique-selector:8002/api/v1/select`
- **Prompt Generator**: `POST http://prompt-generator:8003/api/v1/generate`

## Error Handling

### Service Failures
1. **Intent Classification Fails**: Use default intent "general" and complexity "moderate"
2. **Technique Selection Fails**: Fall back to suggested techniques from intent classifier
3. **Prompt Generation Fails**: Return error to user (critical failure)

### Caching Strategy
- Cache intent classification results by text hash (1 hour TTL)
- Cache enhanced prompts by text hash + techniques (1 hour TTL)
- Skip ML calls for cached results to improve performance

## Performance Optimizations

### Current Performance
- Average end-to-end latency: ~300ms
- Intent classification: ~100ms (30ms with dev TorchServe)
- Technique selection: ~20ms
- Prompt generation: ~150ms
- Database save: ~30ms

### Optimization Opportunities
1. **Parallel Processing**: Some operations could be parallelized
2. **Connection Pooling**: Reuse HTTP connections between services
3. **Result Caching**: Aggressive caching for common prompts
4. **Batch Processing**: Support multiple prompts in single request

## Testing the Endpoint

### Using the Test Script
```bash
./scripts/test-enhance-endpoint.sh
```

### Manual Testing with cURL
```bash
# 1. Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}' \
  | jq -r '.access_token')

# 2. Test enhancement
curl -X POST http://localhost:8000/api/v1/enhance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "Explain machine learning",
    "context": {"audience": "beginners"},
    "prefer_techniques": ["step_by_step", "analogical"]
  }' | jq .
```

## Monitoring and Debugging

### Log Locations
- API Gateway: `docker compose logs api-gateway`
- Intent Classifier: `docker compose logs intent-classifier`
- Technique Selector: `docker compose logs technique-selector`
- Prompt Generator: `docker compose logs prompt-generator`

### Common Issues
1. **CORS Errors**: Check CORS configuration in middleware
2. **Service Timeouts**: Verify all services are healthy
3. **Authentication Errors**: Ensure valid JWT token
4. **Invalid Techniques**: Check technique IDs match implemented techniques

## Next Steps

1. **Frontend Integration**: Wire up the enhancement UI to use this endpoint
2. **Error Recovery**: Implement circuit breakers for service failures
3. **Performance**: Add request queuing and rate limiting
4. **Monitoring**: Add Prometheus metrics for service calls
5. **Testing**: Comprehensive E2E tests for all scenarios