# API Gateway Integration Tests Documentation

## Overview

The integration tests verify proper communication between the API Gateway and all backend services (Intent Classifier, Technique Selector, and Prompt Generator). These tests ensure the complete enhancement flow works correctly from end to end.

## Test Structure

### Test Files

1. **service_integration_test.go** - Main integration test suite
   - Complete enhancement flow tests
   - Service communication verification
   - Error handling scenarios
   - Performance benchmarks

2. **client_integration_test.go** - Individual client tests
   - Intent Classifier client tests
   - Technique Selector client tests
   - Prompt Generator client tests
   - Timeout and context cancellation tests

3. **enhance_integration_test.go** - Enhancement handler validation
   - Request validation tests
   - Response format verification

## Test Architecture

### Mock Service Setup

The tests use HTTP test servers to simulate the backend services:

```go
// Mock Intent Classifier
mockIntentServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    // Simulate intent classification
}))

// Mock Technique Selector
mockTechniqueServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    // Simulate technique selection
}))

// Mock Prompt Generator
mockPromptServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    // Simulate prompt generation
}))
```

### Test Scenarios

#### 1. Complete Enhancement Flow
- User submits a prompt
- Intent classifier analyzes the text
- Technique selector chooses appropriate techniques
- Prompt generator creates enhanced prompt
- Response includes all metadata

#### 2. Error Handling
- Intent classification failure
- Technique selection failure
- Prompt generation failure
- Timeout scenarios
- Invalid input handling

#### 3. Performance Testing
- End-to-end latency measurement
- Concurrent request handling
- Service communication overhead

## Running the Tests

### Quick Run
```bash
# Using the provided script
cd backend/services/api-gateway
./test-integration.sh

# Or run directly
go test ./internal/handlers -v -run TestServiceIntegrationTestSuite
```

### Run Specific Tests
```bash
# Test service integration
go test ./internal/handlers -v -run TestServiceIntegrationTestSuite

# Test individual clients
go test ./internal/handlers -v -run TestIntentClassifierClient_Integration
go test ./internal/handlers -v -run TestTechniqueSelectorClient_Integration
go test ./internal/handlers -v -run TestPromptGeneratorClient_Integration

# Test timeouts
go test ./internal/handlers -v -run TestServiceClientTimeout
```

### Run with Real Services
```bash
# Start all services first
docker compose up -d

# Run integration tests with real services
./test-integration.sh --real
```

## Test Data Examples

### Sample Requests

1. **Code Generation**
```json
{
    "text": "Write a Python function to implement binary search",
    "context": {
        "language": "python",
        "level": "intermediate"
    }
}
```

2. **Simple Question**
```json
{
    "text": "What is machine learning?",
    "context": {
        "audience": "beginners"
    }
}
```

3. **Complex Analysis**
```json
{
    "text": "Analyze the performance implications of microservices",
    "prefer_techniques": ["structured_output", "comparison"],
    "target_complexity": "complex"
}
```

### Expected Responses

1. **Successful Enhancement**
```json
{
    "id": "history-id",
    "original_text": "Write a Python function...",
    "enhanced_text": "Let me help you step by step...",
    "intent": "code_generation",
    "complexity": "moderate",
    "techniques_used": ["chain_of_thought", "few_shot"],
    "confidence": 0.95,
    "processing_time_ms": 250,
    "metadata": {
        "tokens_used": 150,
        "model_version": "gpt-4"
    }
}
```

## Mock Service Behaviors

### Intent Classifier Mock

The mock responds based on input text patterns:
- "simple question" → `intent: question_answering, complexity: simple`
- "complex analysis" → `intent: data_analysis, complexity: complex`
- "error trigger" → Returns 500 error
- Default → `intent: code_generation, complexity: moderate`

### Technique Selector Mock

Selects techniques based on intent:
- `code_generation` → ["chain_of_thought", "few_shot"]
- `question_answering` → ["zero_shot"]
- `data_analysis` → ["chain_of_thought", "structured_output", "tree_of_thoughts"]

### Prompt Generator Mock

Generates enhanced prompts based on techniques:
- `chain_of_thought` → Adds step-by-step breakdown
- `few_shot` → Adds examples
- `zero_shot` → Direct answer format

## Performance Benchmarks

The integration tests include performance measurements:

```go
func TestEnhanceFlow_Performance() {
    // Measures average enhancement time over 10 iterations
    // Asserts that average time is under 2 seconds (SLA)
}
```

Expected performance:
- Mock services: <100ms end-to-end
- Real services: <2s end-to-end
- Timeout threshold: 10s per service

## Debugging Integration Issues

### Common Problems

1. **Service Connection Failures**
   - Check service URLs in environment variables
   - Verify services are running: `docker compose ps`
   - Check network connectivity

2. **Timeout Errors**
   - Increase client timeout in service initialization
   - Check service health endpoints
   - Monitor service logs

3. **Response Format Mismatches**
   - Verify API contracts between services
   - Check JSON field names and types
   - Review service documentation

### Debugging Commands

```bash
# Check service logs
docker compose logs intent-classifier
docker compose logs technique-selector
docker compose logs prompt-generator

# Test individual service endpoints
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health

# Test with verbose logging
go test ./internal/handlers -v -run TestServiceIntegrationTestSuite
```

## Test Coverage

The integration tests cover:

- ✅ Happy path enhancement flow
- ✅ Service-specific error handling
- ✅ Timeout and cancellation scenarios
- ✅ Request validation
- ✅ Response format verification
- ✅ Performance SLA validation
- ✅ Context propagation
- ✅ Header forwarding
- ✅ Authentication context handling

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Integration Tests
  run: |
    cd backend/services/api-gateway
    go test ./internal/handlers -v -run "Integration" -timeout 60s
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./backend/services/api-gateway/integration_coverage.out
```

## Extending the Tests

### Adding New Test Cases

1. Add to `ServiceIntegrationTestSuite`:
```go
func (suite *ServiceIntegrationTestSuite) TestNewScenario() {
    // Setup request
    req := handlers.EnhanceRequest{...}
    
    // Make request
    w := httptest.NewRecorder()
    httpReq := httptest.NewRequest("POST", "/api/v1/enhance", body)
    suite.router.ServeHTTP(w, httpReq)
    
    // Verify response
    assert.Equal(suite.T(), http.StatusOK, w.Code)
}
```

2. Update mock server behaviors as needed

3. Add corresponding client tests if new endpoints are added

## Best Practices

1. **Isolation**: Each test should be independent
2. **Deterministic**: Mock responses should be predictable
3. **Comprehensive**: Cover both success and failure paths
4. **Fast**: Integration tests should complete quickly
5. **Maintainable**: Keep mock logic simple and documented