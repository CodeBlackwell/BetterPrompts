# API Gateway Test Suite

Comprehensive test coverage for the BetterPrompts API Gateway service.

## Test Structure

```
internal/
├── auth/
│   └── jwt_test.go              # JWT token generation and validation tests
├── middleware/
│   ├── auth_test.go             # Authentication middleware tests
│   └── ratelimit_test.go        # Rate limiting middleware tests
└── handlers/
    ├── auth_test.go             # Authentication handler tests (existing)
    ├── enhance_test.go          # Enhance endpoint tests
    └── validation_test.go       # Request validation tests
```

## Test Coverage

### Authentication Middleware (`auth_test.go`)
- ✅ JWT token validation
- ✅ Bearer token extraction
- ✅ Cookie-based authentication fallback
- ✅ Development mode bypass
- ✅ Role-based access control
- ✅ Permission-based access control
- ✅ Optional authentication
- ✅ Helper functions (GetUserID, HasRole, etc.)

### Rate Limiting Middleware (`ratelimit_test.go`)
- ✅ Basic rate limiting functionality
- ✅ User-based rate limiting
- ✅ IP-based rate limiting
- ✅ Endpoint-specific rate limiting
- ✅ Custom key functions
- ✅ Skip functions (health checks)
- ✅ Error handling and fallback
- ✅ Multiple middleware composition
- ✅ Cache failure scenarios

### Enhance Handler (`enhance_test.go`)
- ✅ Successful prompt enhancement flow
- ✅ Authenticated user enhancement
- ✅ Intent classification caching
- ✅ Technique selection fallback
- ✅ Error handling at each step
- ✅ Database save failures
- ✅ Context-aware enhancement
- ✅ Validation errors

### JWT Authentication (`jwt_test.go`)
- ✅ Token generation (access & refresh)
- ✅ Token validation
- ✅ Token expiry handling
- ✅ Invalid token scenarios
- ✅ Refresh token flow
- ✅ Claims structure validation
- ✅ Edge cases (special characters, long data)
- ✅ Security tests (wrong secret, algorithm)

### Request Validation (`validation_test.go`)
- ✅ Field validation (required, min, max)
- ✅ Email format validation
- ✅ Numeric range validation
- ✅ Enum validation (oneof)
- ✅ Array validation with dive
- ✅ JSON parsing errors
- ✅ Type mismatch errors
- ✅ Multiple validation errors

## Running Tests

### Run All Tests
```bash
make test
```

### Run with Coverage
```bash
make test-coverage
```

### Run Specific Test Suite
```bash
# Run auth middleware tests
make test-package PKG=internal/middleware

# Run handler tests
make test-package PKG=internal/handlers

# Run JWT tests
make test-package PKG=internal/auth
```

### Run Specific Test
```bash
make test-specific TEST=TestAuthMiddleware_ValidToken
```

### Run with Race Detection
```bash
make test-race
```

### Run with Verbose Output
```bash
make test-verbose
```

## Test Patterns

### Mock Services
All external dependencies are mocked using testify/mock:
- `MockIntentClassifierClient`
- `MockTechniqueSelectorClient`
- `MockPromptGeneratorClient`
- `MockDatabaseService`
- `MockCacheService`
- `MockJWTManager`

### Test Suites
Tests use testify/suite for better organization:
```go
type AuthMiddlewareTestSuite struct {
    suite.Suite
    router     *gin.Engine
    jwtManager *auth.JWTManager
    logger     *logrus.Logger
}
```

### Helper Functions
Common test helpers for request creation:
```go
func (suite *TestSuite) makeRequest(method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder
```

## Security Testing

### Authentication Tests
- Invalid tokens are rejected
- Expired tokens are handled properly
- Development bypass is only available in dev mode
- Role and permission checks work correctly

### Rate Limiting Tests
- Requests are properly limited
- User and IP-based limiting work independently
- Cache failures don't break the application
- Headers are set correctly

### Validation Tests
- Input validation prevents injection attacks
- Type validation prevents type confusion
- Length limits are enforced

## Performance Considerations

- Tests run with `-race` flag to detect race conditions
- Benchmarks available with `make bench`
- Parallel test execution where appropriate
- Mock services prevent external dependencies

## CI/CD Integration

### GitHub Actions
```bash
# Run in CI environment
make ci-test
make ci-lint
```

### Coverage Requirements
- Minimum 80% coverage for critical paths
- 100% coverage for security-related code
- Integration tests for all endpoints

## Production Scenarios

### TorchServe Note
While TorchServe is not used in local development, tests include scenarios for production deployment:
- Service unavailability handling
- Timeout scenarios
- Circuit breaker functionality (when implemented)

## Adding New Tests

1. Create test file following naming convention: `*_test.go`
2. Use test suites for organization
3. Mock all external dependencies
4. Include both success and failure scenarios
5. Test edge cases and security concerns
6. Update this README with new coverage

## Debugging Tests

### Run Single Test with Logs
```bash
go test -v -run TestAuthMiddleware_ValidToken ./internal/middleware
```

### Debug with Delve
```bash
dlv test ./internal/handlers -- -test.run TestEnhancePrompt_Success
```

### Check Coverage Gaps
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```