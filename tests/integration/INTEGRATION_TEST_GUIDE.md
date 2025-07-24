# BetterPrompts Integration Test Guide

## Overview

This guide provides comprehensive documentation for the BetterPrompts microservices integration tests. These tests verify the interactions between all services, ensuring the system works correctly as a whole.

## Architecture Coverage

### Services Tested

1. **API Gateway** (Go/Gin)
   - Authentication & authorization
   - Request routing
   - Rate limiting
   - CORS handling
   - Health checks

2. **Intent Classifier** (Python/FastAPI)
   - ML model integration via TorchServe
   - Intent classification
   - Complexity analysis
   - Caching

3. **Technique Selector** (Go/Gin)
   - Technique selection logic
   - Rule-based engine
   - Effectiveness scoring

4. **Prompt Generator** (Python/FastAPI)
   - Prompt enhancement
   - Technique application
   - LLM integration (mocked in tests)

5. **Supporting Services**
   - PostgreSQL with pgvector
   - Redis cache
   - TorchServe (mocked)
   - Nginx reverse proxy

## Test Categories

### 1. Authentication Flow Tests

**File:** `go/api_gateway_integration_test.go`, `frontend/frontend_api_integration.test.ts`

Tests complete authentication cycle:
- User registration
- Login with credentials
- JWT token generation and validation
- Session persistence
- Protected route access
- Logout and session cleanup

### 2. Enhancement Pipeline Tests

**File:** `python/test_backend_services_integration.py`, `go/api_gateway_integration_test.go`

Tests the complete enhancement flow:
- Request → API Gateway
- API Gateway → Intent Classifier
- Intent Classifier → TorchServe
- API Gateway → Technique Selector
- API Gateway → Prompt Generator
- Response aggregation and return

### 3. Caching Strategy Tests

**File:** `python/test_backend_services_integration.py`

Tests Redis caching:
- Cache hits and misses
- TTL management
- Cache invalidation
- Cache warming strategies
- Cross-service cache coordination

### 4. Error Handling Tests

**File:** All test files

Tests error propagation and recovery:
- Service failures
- Network timeouts
- Invalid requests
- Circuit breaker activation
- Graceful degradation

### 5. Performance Tests

**File:** `frontend/frontend_api_integration.test.ts`

Tests system performance:
- Concurrent request handling
- Response time monitoring
- Rate limiting behavior
- Resource usage tracking

## Running Integration Tests

### Prerequisites

1. Docker and Docker Compose installed
2. Go 1.23+
3. Python 3.11+
4. Node.js 20+
5. At least 8GB RAM available

### Quick Start

```bash
# Run all integration tests
cd tests/integration
./run_integration_tests.sh

# Run specific test suites
./run_integration_tests.sh go       # Go tests only
./run_integration_tests.sh python   # Python tests only
./run_integration_tests.sh frontend # Frontend tests only
```

### Using Docker Compose

```bash
# Start integration test environment
docker-compose -f docker-compose.integration-test.yml up -d

# Wait for services to be ready
docker-compose -f docker-compose.integration-test.yml run --rm integration-test-runner

# View logs
docker-compose -f docker-compose.integration-test.yml logs -f

# Cleanup
docker-compose -f docker-compose.integration-test.yml down -v
```

### Local Development

```bash
# Start services (from project root)
docker-compose up -d

# Run integration tests
cd tests/integration
./run_integration_tests.sh

# Run with coverage
go test -v -tags=integration -cover ./go/...
python -m pytest --cov=. python/
```

## Test Configuration

### Environment Variables

```bash
# API Gateway
API_GATEWAY_URL=http://localhost:8090/api/v1
JWT_SECRET_KEY=test-secret-key

# Backend Services
INTENT_CLASSIFIER_URL=http://localhost:8001
TECHNIQUE_SELECTOR_URL=http://localhost:8002
PROMPT_GENERATOR_URL=http://localhost:8003

# Database
DATABASE_URL=postgresql://betterprompts:betterprompts@localhost:5432/betterprompts_test

# Redis
REDIS_URL=redis://localhost:6379

# TorchServe
TORCHSERVE_URL=http://localhost:8080
USE_MOCK_TORCHSERVE=true

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Mock Services

The integration tests use mocked versions of external services:

1. **Mock TorchServe** - Simulates ML model inference without requiring actual models
2. **Mock LLM APIs** - Returns predefined responses for OpenAI/Anthropic calls
3. **WireMock** - For complex API mocking scenarios

## Test Data

### Fixtures

- **Users:** Pre-created test users with different roles
- **Prompts:** Sample prompts covering all intent types
- **Techniques:** All available enhancement techniques
- **History:** Sample enhancement history

### Test Scenarios

1. **Happy Path**
   - New user registration → Login → Enhance prompt → View history

2. **Error Recovery**
   - Service failure → Circuit breaker → Fallback → Recovery

3. **Performance Under Load**
   - 100 concurrent users → Rate limiting → Queue management

4. **Cache Effectiveness**
   - Cold start → Warm cache → Cache hit ratio > 80%

## Debugging Failed Tests

### Common Issues

1. **Service Not Ready**
   ```bash
   # Check service health
   curl http://localhost:8090/api/v1/health/ready
   ```

2. **Database Connection**
   ```bash
   # Check database
   docker-compose exec postgres psql -U betterprompts -c "\dt"
   ```

3. **Redis Connection**
   ```bash
   # Check Redis
   docker-compose exec redis redis-cli ping
   ```

4. **Port Conflicts**
   ```bash
   # Check ports
   lsof -i :8090,8001,8002,8003,8080,5432,6379
   ```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway

# Test output
cat test-results/integration/summary.md
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker-compose -f docker-compose.integration-test.yml up -d
      
      - name: Wait for services
        run: ./tests/scripts/wait-for-services.sh
      
      - name: Run integration tests
        run: docker-compose -f docker-compose.integration-test.yml run integration-test-runner
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: integration-test-results
          path: test-results/integration/
```

## Best Practices

1. **Isolation**
   - Use separate test database
   - Clear cache between test runs
   - Reset service state

2. **Determinism**
   - Use fixed timestamps
   - Seed random generators
   - Mock external dependencies

3. **Performance**
   - Run tests in parallel where possible
   - Use connection pooling
   - Cache test dependencies

4. **Maintenance**
   - Update tests with API changes
   - Document new test scenarios
   - Review flaky tests regularly

## Metrics and Reporting

### Coverage Goals

- API Gateway: >80% coverage
- Service Integration: >90% coverage
- Error Paths: >75% coverage
- Frontend Integration: >70% coverage

### Performance Targets

- Setup time: <30 seconds
- Test execution: <5 minutes
- Teardown: <10 seconds

### Reports

Test results are saved in `test-results/integration/`:
- `summary.md` - Overall test summary
- `go-coverage.html` - Go code coverage
- `python-junit.xml` - Python test results
- `frontend-results/` - Playwright HTML report

## Troubleshooting

### Service Won't Start

```bash
# Check Docker resources
docker system df
docker system prune -a

# Increase Docker memory (Docker Desktop)
# Preferences → Resources → Memory: 8GB+
```

### Tests Timeout

```bash
# Increase timeouts in test files
# Go: context.WithTimeout(ctx, 30*time.Second)
# Python: timeout=30
# Frontend: { timeout: 30000 }
```

### Database Issues

```bash
# Reset test database
docker-compose exec postgres psql -U betterprompts -c "DROP DATABASE betterprompts_test;"
docker-compose exec postgres psql -U betterprompts -c "CREATE DATABASE betterprompts_test;"
```

## Contributing

When adding new integration tests:

1. Follow existing patterns
2. Document test scenarios
3. Add to appropriate test suite
4. Update this guide
5. Ensure CI passes

## Resources

- [Go Testing Guide](https://golang.org/pkg/testing/)
- [Pytest Documentation](https://docs.pytest.org/)
- [Playwright Documentation](https://playwright.dev/)
- [Docker Compose Reference](https://docs.docker.com/compose/)