# Phase 7 - Enterprise API Integration E2E Tests

This directory contains comprehensive End-to-End tests for US-004: Enterprise API integration and developer experience.

## Overview

Phase 7 tests validate the complete enterprise API functionality including:
- RESTful API endpoints with consistent patterns
- API key lifecycle management
- Rate limiting with precise controls
- Webhook integration with delivery guarantees
- OpenAPI contract validation
- Comprehensive developer experience features

## Test Structure

```
phase7/
├── utils/                     # Test utilities
│   ├── api-client.ts         # Type-safe API client with retry logic
│   ├── rate-limiter-tester.ts # Precise rate limit testing
│   ├── webhook-server.ts     # Mock webhook receiver
│   ├── webhook-server.js     # JS version for direct execution
│   ├── openapi-validator.ts  # Contract validation
│   └── openapi-loader.ts     # OpenAPI spec loader
├── fixtures/                  # Test data
│   ├── test-data.json        # Common test data
│   └── openapi.yaml          # OpenAPI specification
├── docs/                      # Documentation
│   ├── api-developer-guide.md # Comprehensive API guide
│   └── BetterPrompts-API.postman_collection.json
├── sdk-examples/              # SDK examples in multiple languages
│   ├── javascript/
│   ├── python/
│   ├── go/
│   └── java/
├── us-004-api-integration.spec.ts    # Main API tests
├── api-contract.spec.ts              # OpenAPI validation
├── webhook-delivery.spec.ts          # Webhook functionality
├── playwright.config.ts              # Test configuration
├── package.json                      # Dependencies
└── tsconfig.json                     # TypeScript config
```

## Running the Tests

### Prerequisites

1. Ensure Docker is running
2. Start the BetterPrompts services:
   ```bash
   cd ../..
   docker compose up -d
   ```

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# API Integration tests
npm run test:api

# Contract validation tests
npm run test:contract

# Webhook tests
npm run test:webhook
```

### Run with UI Mode

```bash
npm run test:ui
```

## Test Coverage

### API Endpoints (us-004-api-integration.spec.ts)

✅ **Enhancement Endpoints**
- POST /enhance - Single prompt enhancement
- POST /batch - Batch processing (authenticated)
- Parameter validation and error handling

✅ **Techniques Endpoints**
- GET /techniques - List all techniques
- Filtering by category and complexity

✅ **History Endpoints**
- GET /history - Paginated history (authenticated)
- GET /history/{id} - Specific item
- DELETE /history/{id} - Soft delete
- Date range and intent filtering

✅ **Authentication**
- API key validation (X-API-Key header)
- Bearer token authentication
- Missing/invalid authentication handling

✅ **Rate Limiting**
- 1000 req/min default limit enforcement
- Rate limit headers validation
- 429 status with Retry-After
- Boundary testing and reset behavior
- Graceful degradation under load

✅ **Error Handling**
- Consistent error format across all endpoints
- Request ID tracking
- Appropriate HTTP status codes

### Contract Validation (api-contract.spec.ts)

✅ **OpenAPI Compliance**
- Request/Response schema validation
- Required fields verification
- Data type validation
- Enum value validation

✅ **API Coverage**
- Tracks tested vs untested endpoints
- Generates coverage report
- Validates all documented endpoints

### Webhook Integration (webhook-delivery.spec.ts)

✅ **Webhook Registration**
- URL validation
- Event subscription management
- Secret generation

✅ **Event Delivery**
- enhancement.completed events
- batch.finished events
- HMAC signature validation
- Event ordering

✅ **Reliability**
- Retry mechanism with exponential backoff
- Timeout handling
- Delivery history tracking

## Key Features Tested

### 1. API Design
- RESTful patterns with consistent naming
- URL path versioning (/api/v1/)
- JSON request/response format
- Comprehensive error handling

### 2. Key Management
- API key generation and lifecycle
- Secure storage practices
- Key rotation support
- Metadata tracking

### 3. Rate Limiting
- Per-key rate limiting (not IP-based)
- Accurate rate limit headers
- Graceful handling at limits
- Enterprise tier support (10,000/min)

### 4. Developer Experience
- Clear, actionable error messages
- Request ID tracking
- OpenAPI 3.0 specification
- SDK examples in 4 languages
- Postman collection with examples

## Utilities

### API Client (api-client.ts)
- Full TypeScript support with interfaces
- Automatic retry logic for transient failures
- Rate limit header parsing
- Request ID generation and tracking

### Rate Limiter Tester (rate-limiter-tester.ts)
- Precise timing control for boundary testing
- Burst traffic simulation
- Reset behavior validation
- Accuracy measurements

### Webhook Server (webhook-server.ts)
- HMAC signature validation
- Event capture and analysis
- Failure simulation for retry testing
- Delivery tracking

### OpenAPI Validator (openapi-validator.ts)
- Request/Response validation against spec
- Coverage tracking
- Detailed error reporting
- Schema compliance checking

## Developer Resources

### API Documentation
See `docs/api-developer-guide.md` for:
- Getting started guide
- Authentication methods
- All endpoints with examples
- Rate limiting details
- Webhook integration
- Error handling patterns

### Postman Collection
Import `docs/BetterPrompts-API.postman_collection.json` for:
- All API endpoints with examples
- Pre-configured authentication
- Test scripts for validation
- Environment variables setup

### SDK Examples
Complete examples in:
- **JavaScript**: Modern async/await with axios
- **Python**: Requests library with retry logic
- **Go**: Native HTTP client with structs
- **Java**: OkHttp with Jackson

Each example includes:
- Basic enhancement
- Advanced options
- Error handling
- Rate limit handling
- Webhook signature verification

## Test Results

After running tests, check:
- `test-results/html` - HTML test report
- `test-results/results.json` - JSON results
- `test-results/contract-validation-report.md` - API coverage

## Notes

- Tests use real API calls, not mocks
- Webhook tests start a local server on port 8889
- Rate limit tests may take time due to timing requirements
- Contract tests validate against OpenAPI spec