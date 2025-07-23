# Authentication E2E Test Documentation

## Overview

This documentation covers the comprehensive end-to-end tests for the BetterPrompts authentication system. The tests validate the complete authentication flow including registration, login, protected routes, token refresh, and security features.

## Test Structure

```
tests/e2e/
├── specs/
│   ├── authentication-flow.spec.ts    # Main auth flow tests
│   └── auth-security.spec.ts         # Security-specific tests
├── helpers/
│   ├── auth.helper.ts                # Basic auth utilities
│   └── auth-test.helper.ts          # Extended test utilities
└── run-auth-tests.sh                 # Test runner script
```

## Test Coverage

### 1. Registration Tests (`authentication-flow.spec.ts`)
- ✅ Successful user registration with validation
- ✅ Registration form validation errors
- ✅ Duplicate email/username prevention
- ✅ Password strength indicator functionality
- ✅ Terms acceptance requirement
- ✅ Auto-login after registration

### 2. Login Tests
- ✅ Successful login with email
- ✅ Login with username support
- ✅ Invalid credentials handling
- ✅ Remember me functionality
- ✅ Redirect to protected route after login
- ✅ Prevent access to login when authenticated

### 3. Protected Routes
- ✅ Access control for authenticated routes
- ✅ Redirect to login for unauthenticated access
- ✅ Preserve intended destination after login
- ✅ Profile page functionality
- ✅ Password change workflow

### 4. Token Management
- ✅ Automatic token refresh before expiry
- ✅ Handle expired refresh tokens
- ✅ Token persistence across page refreshes
- ✅ Secure token storage

### 5. Logout
- ✅ Complete session cleanup
- ✅ Cookie clearing
- ✅ Redirect to login after logout
- ✅ Prevent access to protected routes after logout

### 6. Session Management
- ✅ Session persistence across refreshes
- ✅ Multiple tab/window handling
- ✅ Session timeout handling
- ✅ Graceful expired session handling

### 7. Security Features (`auth-security.spec.ts`)
- ✅ Password complexity enforcement
- ✅ Password masking and visibility toggle
- ✅ Account lockout after failed attempts
- ✅ CSRF protection validation
- ✅ XSS prevention in forms
- ✅ SQL injection prevention
- ✅ Secure cookie flags
- ✅ Rate limiting on auth endpoints

## Running the Tests

### Prerequisites

1. Install test dependencies:
```bash
cd tests/e2e
npm install
```

2. Ensure services are running:
```bash
# Frontend
cd frontend
npm run dev

# Backend services
docker compose up -d
```

### Run All Auth Tests

```bash
# Using the test runner script
./run-auth-tests.sh

# Or directly with Playwright
npx playwright test specs/authentication-flow.spec.ts specs/auth-security.spec.ts
```

### Run Specific Test Suites

```bash
# Main authentication flow
npx playwright test specs/authentication-flow.spec.ts

# Security tests only
npx playwright test specs/auth-security.spec.ts

# Specific test
npx playwright test -g "successful login"
```

### Run in Different Modes

```bash
# Headed mode (see browser)
./run-auth-tests.sh --headed

# Debug mode
./run-auth-tests.sh --debug

# UI mode
./run-auth-tests.sh --ui
```

## Test Helpers

### AuthHelper (auth.helper.ts)
Basic authentication operations:
- `register()` - Register new user
- `login()` - Login with credentials
- `logout()` - Logout current user
- `isLoggedIn()` - Check auth status
- `getAuthToken()` - Get current token
- `clearAuth()` - Clear all auth data
- `generateTestUser()` - Create unique test user

### AuthTestHelper (auth-test.helper.ts)
Extended test utilities:
- `assertOnLoginPage()` - Verify on login page
- `assertAuthenticated()` - Verify user is authenticated
- `assertErrorMessage()` - Check for specific errors
- `fillLoginForm()` - Fill login form fields
- `fillRegistrationForm()` - Fill registration fields
- `getPasswordStrength()` - Get password strength value
- `simulateTokenExpiry()` - Force token expiration
- `testProtectedRoute()` - Test route protection

## Test Data

### Default Test User Format
```typescript
{
  email: 'test.{timestamp}@example.com',
  username: 'test{timestamp}',
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User'
}
```

### Security Test Patterns
- SQL Injection: `admin' OR '1'='1`
- XSS: `<script>alert("XSS")</script>`
- Weak passwords: Various patterns tested
- Rate limiting: Rapid request testing

## Page Objects & Selectors

### Login Page
- Email input: `input[name="email"]`
- Password input: `input[name="password"]`
- Remember me: `input[name="rememberMe"]`
- Submit button: `button[type="submit"]`

### Registration Page
- First name: `input[name="first_name"]`
- Last name: `input[name="last_name"]`
- Email: `input[name="email"]`
- Username: `input[name="username"]`
- Password: `input[name="password"]`
- Confirm password: `input[name="confirm_password"]`
- Terms checkbox: `input[name="acceptTerms"]`

### Common Elements
- User menu: `[data-testid="user-menu"]`
- Password strength: `[data-testid="password-strength"]`
- Error messages: `text={error message}`
- Success toasts: Toast notification elements

## Expected Behaviors

### Registration Flow
1. User fills registration form
2. Password strength updates in real-time
3. Form validates on submission
4. Successful registration redirects to onboarding
5. User is automatically logged in
6. Auth token is stored

### Login Flow
1. User enters credentials
2. Optional remember me selection
3. Form validates on submission
4. Successful login redirects to dashboard/intended route
5. Auth token and refresh token stored
6. User info loaded into state

### Token Refresh Flow
1. Token approaching expiry (5 min before)
2. Automatic refresh triggered
3. New access token obtained
4. No user interruption
5. Failed refresh redirects to login

### Logout Flow
1. User initiates logout
2. API logout endpoint called
3. All tokens cleared
4. Local storage cleared
5. Cookies removed
6. Redirect to login page

## Security Validations

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Account Lockout
- 5 failed attempts trigger lockout
- 30-minute lockout period
- Shows remaining time
- Prevents brute force attacks

### Session Security
- HTTPOnly cookies
- Secure flag in production
- SameSite protection
- Token rotation on sensitive operations

## Troubleshooting

### Common Issues

1. **Services not running**
   - Ensure frontend is on port 3000
   - Check API gateway on port 8090
   - Verify database is accessible

2. **Test timeouts**
   - Increase timeout in playwright config
   - Check network conditions
   - Verify service health

3. **Authentication failures**
   - Clear browser storage between tests
   - Check token expiration logic
   - Verify API responses

4. **Flaky tests**
   - Add explicit waits for elements
   - Use network idle state
   - Check for race conditions

### Debug Commands

```bash
# Run single test with debugging
npx playwright test -g "test name" --debug

# Show browser during tests
npx playwright test --headed

# Slow down execution
npx playwright test --slow-mo=1000

# Generate trace for debugging
npx playwright test --trace on
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Auth E2E Tests
  run: |
    cd tests/e2e
    npm ci
    npx playwright install
    npx playwright test specs/authentication-flow.spec.ts specs/auth-security.spec.ts
  env:
    CI: true
```

### Environment Variables

```bash
# Required for tests
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost:8090
TEST_TIMEOUT=30000
```

## Best Practices

1. **Test Isolation**: Each test clears auth state
2. **Unique Data**: Generate unique users per test
3. **Explicit Waits**: Use proper wait conditions
4. **Error Handling**: Test both success and failure paths
5. **Security Focus**: Include security validations
6. **Accessibility**: Test keyboard navigation and ARIA

## Extending the Tests

### Add New Auth Test

```typescript
test('new authentication feature', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  const testUser = AuthHelper.generateTestUser();
  
  // Your test logic here
});
```

### Add New Security Test

```typescript
test('new security validation', async ({ page }) => {
  const authTestHelper = new AuthTestHelper(page);
  
  // Security test logic
  await authTestHelper.assertSecurityFeature();
});
```

## Performance Benchmarks

- Registration: <3s
- Login: <2s  
- Token refresh: <500ms
- Logout: <1s
- Page navigation: <1s

The authentication E2E tests provide comprehensive coverage of all authentication flows and security features, ensuring a robust and secure authentication system.