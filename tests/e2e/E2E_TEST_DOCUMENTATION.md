# E2E Test Documentation - BetterPrompts Enhancement Flow

## Overview

This E2E test suite validates the complete user journey for the BetterPrompts enhancement flow, from user registration through prompt enhancement and result viewing.

## Test Structure

```
tests/e2e/
├── specs/
│   ├── enhancement-flow.spec.ts    # Main enhancement flow tests
│   └── prompt-classification.spec.ts # API-level tests
├── helpers/
│   ├── auth.helper.ts              # Authentication utilities
│   └── enhancement.helper.ts       # Enhancement workflow helpers
├── data/
│   └── test-prompts.ts            # Test data and prompts
├── playwright.config.ts            # API test configuration
├── playwright-ui.config.ts         # UI test configuration
└── package.json                    # Test dependencies and scripts
```

## Test Coverage

### 1. Complete Enhancement Flow
- New user registration
- Navigation to enhancement page
- Simple prompt enhancement
- Result verification
- Technique explanations
- History tracking

### 2. Multiple Prompt Types
- Simple prompts (summaries, questions)
- Moderate complexity (code generation, analysis)
- Complex prompts (business plans, research)
- Edge cases (very short, multilingual)

### 3. Error Handling
- Empty prompt validation
- Very long prompt handling
- Network error recovery
- Rate limiting

### 4. Responsive Design
- Mobile viewport (375x667)
- Tablet viewport (768x1024)
- Desktop viewport (1920x1080)

### 5. Accessibility
- Keyboard navigation
- ARIA labels
- Focus indicators
- Color contrast

### 6. Performance
- Enhancement response time (<2s SLA)
- Rapid sequential enhancements
- Concurrent request handling

## Running the Tests

### Prerequisites

1. Install dependencies:
```bash
cd tests/e2e
npm install
```

2. Ensure services are running:
```bash
# From project root
docker compose up -d

# Frontend (in separate terminal)
cd frontend
npm run dev
```

### Test Commands

```bash
# Run all E2E tests
npm test

# Run only UI tests (enhancement flow)
npm run test:ui

# Run specific enhancement flow test
npm run test:enhancement

# Run tests with UI mode (interactive)
npm run test:ui -- --ui

# Run tests in headed mode (see browser)
npm run test:headed

# Debug tests
npm run test:debug

# Generate new tests with recorder
npm run test:codegen
```

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    cd tests/e2e
    npm ci
    npx playwright install
    npm run test:all
  env:
    CI: true
```

## Test Data

### Default Test User
```typescript
{
  email: 'test.e2e@example.com',
  username: 'teste2e',
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User'
}
```

### Test Prompts
- Simple: "Write a summary of this article"
- Code: "Write a Python function to implement binary search"
- Creative: "Write a short story about a time traveler"
- Complex: "Create a comprehensive business plan..."

## Page Objects & Helpers

### AuthHelper
- `register()` - Register new user
- `login()` - Login existing user
- `logout()` - Logout current user
- `isLoggedIn()` - Check auth status
- `generateTestUser()` - Create unique test user

### EnhancementHelper
- `enhancePrompt()` - Complete enhancement workflow
- `extractEnhancementResult()` - Get enhancement details
- `copyEnhancedPrompt()` - Copy to clipboard
- `viewTechniqueExplanation()` - View technique details
- `provideFeedback()` - Submit user feedback

## Expected Elements

### Login Page
- `input[name="email"]` - Email field
- `input[name="password"]` - Password field
- `button[type="submit"]` - Submit button

### Enhancement Page
- `textarea[placeholder*="Enter your prompt"]` - Prompt input
- `button:has-text("Enhance")` - Enhance button
- `[data-testid="enhanced-prompt"]` - Result area
- `[data-testid="technique-chip"]` - Technique tags
- `[data-testid="copy-button"]` - Copy button

## Debugging Tests

### View Test Reports
```bash
npm run test:report
```

### Debug Selectors
```javascript
// Use Playwright Inspector
await page.pause();

// Or use slowMo for debugging
{ slowMo: 100 }
```

### Screenshots on Failure
Tests automatically capture screenshots on failure in:
`test-results/*/screenshot.png`

## Best Practices

1. **Isolation**: Each test clears auth state before running
2. **Unique Data**: Generate unique users/data per test
3. **Explicit Waits**: Use proper wait conditions
4. **Error Messages**: Capture and assert error states
5. **Accessibility**: Include a11y checks in flows

## Troubleshooting

### Common Issues

1. **Services not running**
   - Ensure Docker containers are up
   - Check frontend is on port 3000
   - Verify API gateway on port 8090

2. **Authentication failures**
   - Clear browser storage
   - Check JWT token expiration
   - Verify API auth endpoints

3. **Timeout errors**
   - Increase timeout in config
   - Check network conditions
   - Verify service health

### Environment Variables

```bash
# Optional overrides
FRONTEND_URL=http://localhost:3000
API_BASE_URL=http://localhost/api/v1
CI=true  # For CI environments
```

## Extending Tests

### Add New Test Case
```typescript
test('new enhancement feature', async ({ page }) => {
  const auth = new AuthHelper(page);
  const enhancement = new EnhancementHelper(page);
  
  await auth.login('user@example.com', 'password');
  await enhancement.navigateToEnhancePage();
  
  const result = await enhancement.enhancePrompt('Test prompt');
  expect(result.enhancedPrompt).toContain('expected text');
});
```

### Add New Helper Method
```typescript
// In enhancement.helper.ts
async compareEnhancements(prompt1: string, prompt2: string): Promise<void> {
  // Implementation
}
```

## Performance Benchmarks

- Login: <1s
- Enhancement: <2s
- Page navigation: <500ms
- Copy to clipboard: <100ms

## Future Improvements

1. Visual regression testing
2. API mocking for edge cases
3. Load testing integration
4. Cross-browser mobile testing
5. Accessibility audit automation