# API Gateway Authentication Handler Tests Documentation

## Overview

The `auth_test.go` file contains comprehensive unit tests for all authentication handlers in the API Gateway service. These tests ensure the security and reliability of user authentication, registration, token management, and profile operations.

## Test Structure

### Test Suite Architecture

The tests use the `testify/suite` package to organize tests into a cohesive suite with proper setup and teardown:

```go
type AuthHandlerTestSuite struct {
    suite.Suite
    handler      *handlers.AuthHandler
    userService  *MockUserService
    jwtManager   *MockJWTManager
    cacheService *MockCacheService
    logger       *logrus.Logger
    router       *gin.Engine
}
```

### Mock Services

The tests use mock implementations of all dependencies:

1. **MockUserService** - Simulates database operations for users
2. **MockJWTManager** - Handles JWT token generation and validation
3. **MockCacheService** - Simulates Redis cache operations

### Test Categories

#### 1. Registration Tests
- ✅ Successful user registration
- ✅ Password mismatch validation
- ✅ Duplicate email detection
- ✅ Password validation errors

#### 2. Login Tests  
- ✅ Successful login with correct credentials
- ✅ Invalid credentials handling
- ✅ Account locked due to failed attempts
- ✅ Inactive account prevention
- ✅ Remember me functionality with cookies

#### 3. Token Refresh Tests
- ✅ Successful token refresh
- ✅ Invalid refresh token handling
- ✅ Token not found in cache
- ✅ User role updates during refresh

#### 4. Logout Tests
- ✅ Successful logout with token invalidation
- ✅ Cookie clearing
- ✅ Cache cleanup

#### 5. Profile Operations Tests
- ✅ Get profile for authenticated user
- ✅ Unauthorized access prevention
- ✅ Update profile information
- ✅ Change password with validation
- ✅ Incorrect current password handling

#### 6. Email Verification Tests
- ✅ Successful email verification
- ✅ Invalid or expired token handling

## Running the Tests

### Prerequisites

1. Install test dependencies:
```bash
cd backend/services/api-gateway
go mod download
```

2. Install testify if not already installed:
```bash
go get github.com/stretchr/testify
```

### Run All Auth Tests

```bash
# From the api-gateway directory
go test ./internal/handlers -v -run TestAuthHandlerTestSuite
```

### Run Specific Test Cases

```bash
# Run only registration tests
go test ./internal/handlers -v -run "TestAuthHandlerTestSuite/TestRegister"

# Run only login tests
go test ./internal/handlers -v -run "TestAuthHandlerTestSuite/TestLogin"

# Run a specific test
go test ./internal/handlers -v -run "TestAuthHandlerTestSuite/TestLogin_Success"
```

### Run with Coverage

```bash
# Generate coverage report
go test ./internal/handlers -v -coverprofile=coverage.out -run TestAuthHandlerTestSuite

# View coverage in terminal
go tool cover -func=coverage.out

# Generate HTML coverage report
go tool cover -html=coverage.out -o coverage.html
```

### Run with Race Detection

```bash
go test ./internal/handlers -v -race -run TestAuthHandlerTestSuite
```

## Test Data

### Default Test User
```go
{
    ID:           "test-user-id",
    Email:        "test@example.com",
    Username:     "testuser",
    FirstName:    "Test",
    LastName:     "User",
    IsActive:     true,
    IsVerified:   true,
    Roles:        []string{"user"},
    Tier:         "free",
}
```

### Test Passwords
- Valid password hash for "password123": `$2a$10$9Y0cXMdgpPMj2YqQdNIoFuEJfBVP.60g9V7HvJogFKnKMKdIKtHXq`
- Password requirements: Min 8 characters, max 72 characters

### Test Tokens
- Access token format: "access-token" (mocked)
- Refresh token format: "refresh-token" (mocked)
- Token expiry: 15 minutes (default), 30 days (remember me)

## Mock Expectations

### UserService Mocks

```go
// Create user
suite.userService.On("CreateUser", mock.Anything, req).Return(user, nil)

// Get user by email/username
suite.userService.On("GetUserByEmailOrUsername", mock.Anything, emailOrUsername).Return(user, nil)

// Update last login
suite.userService.On("UpdateLastLoginAt", mock.Anything, userID).Return(nil)

// Increment failed login
suite.userService.On("IncrementFailedLogin", mock.Anything, userID).Return(nil)
```

### JWTManager Mocks

```go
// Generate token pair
suite.jwtManager.On("GenerateTokenPair", userID, email, roles).
    Return("access-token", "refresh-token", nil)

// Validate refresh token
suite.jwtManager.On("ValidateRefreshToken", token).Return(claims, nil)

// Get config
suite.jwtManager.On("GetConfig").Return(auth.JWTConfig{AccessExpiry: 15 * time.Minute})
```

### CacheService Mocks

```go
// Store session
suite.cacheService.On("StoreSession", mock.Anything, key, value, ttl).Return(nil)

// Get session
suite.cacheService.On("GetSession", mock.Anything, key, mock.Anything).Return(nil)

// Delete session
suite.cacheService.On("DeleteSession", mock.Anything, key).Return(nil)
```

## Common Test Patterns

### Making HTTP Requests

```go
func (suite *AuthHandlerTestSuite) makeRequest(method, path string, body interface{}) *httptest.ResponseRecorder {
    var req *http.Request
    if body != nil {
        jsonBody, _ := json.Marshal(body)
        req = httptest.NewRequest(method, path, bytes.NewBuffer(jsonBody))
        req.Header.Set("Content-Type", "application/json")
    } else {
        req = httptest.NewRequest(method, path, nil)
    }
    
    rec := httptest.NewRecorder()
    suite.router.ServeHTTP(rec, req)
    return rec
}
```

### Simulating Authenticated Requests

```go
suite.router.POST("/auth/profile", func(c *gin.Context) {
    // Simulate authenticated user context
    c.Set("user_id", "test-user-id")
    suite.handler.UpdateProfile(c)
})
```

### Asserting Responses

```go
// Check status code
assert.Equal(suite.T(), http.StatusOK, rec.Code)

// Parse and check JSON response
var resp models.UserLoginResponse
err := json.Unmarshal(rec.Body.Bytes(), &resp)
require.NoError(suite.T(), err)
assert.Equal(suite.T(), expectedValue, resp.Field)
```

## Troubleshooting

### Common Issues

1. **Mock expectations not met**
   - Check that all mocked methods are called with correct arguments
   - Use `mock.Anything` for dynamic values like context
   - Ensure mock expectations match actual handler implementation

2. **JSON marshaling errors**
   - Verify request/response structures match model definitions
   - Check for nil pointer dereferences with sql.Null* types

3. **Password verification failures**
   - Use the correct bcrypt hash for test passwords
   - Ensure password validation logic matches production code

4. **Context issues**
   - Remember to set user_id in context for authenticated endpoints
   - Use middleware simulation for protected routes

## Extending the Tests

### Adding New Test Cases

1. Add test method to the suite:
```go
func (suite *AuthHandlerTestSuite) TestNewFeature_Success() {
    // Setup
    suite.router.POST("/auth/new-feature", suite.handler.NewFeature)
    
    // Create request
    req := models.NewFeatureRequest{...}
    
    // Mock expectations
    suite.userService.On("Method", args).Return(result, nil)
    
    // Make request
    rec := suite.makeRequest("POST", "/auth/new-feature", req)
    
    // Assertions
    assert.Equal(suite.T(), http.StatusOK, rec.Code)
}
```

2. Ensure mocks are properly set up and expectations are verified

3. Add appropriate test data and helper methods as needed

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Run Auth Handler Tests
  run: |
    cd backend/services/api-gateway
    go test ./internal/handlers -v -race -coverprofile=coverage.out -run TestAuthHandlerTestSuite
    go tool cover -func=coverage.out
```

### Coverage Requirements

- Target: 80% coverage for authentication handlers
- Critical paths must have 100% coverage (login, registration, token refresh)
- Error handling paths should be thoroughly tested

## Security Considerations

The tests validate several security aspects:

1. **Password Security**
   - Passwords are never stored in plain text
   - Password hashes use bcrypt with appropriate cost factor
   - Password validation enforces minimum requirements

2. **Token Security**
   - Tokens are properly validated before use
   - Refresh tokens are stored in cache with TTL
   - Expired tokens are rejected

3. **Account Security**
   - Failed login attempts are tracked
   - Accounts can be locked after too many failures
   - Inactive accounts cannot login

4. **Session Security**
   - Sessions are properly invalidated on logout
   - Cookies are set with HttpOnly flag
   - Token rotation is supported via refresh endpoint