# BetterPrompts E2E Test Suite

Comprehensive end-to-end test suite for BetterPrompts using Playwright, covering all major user journeys, microservices orchestration, and performance validation.

## Overview

This test suite provides complete coverage of:
- New user onboarding flow
- Power user workflows (batch processing, API usage, history management)
- Admin operations (user management, monitoring, configuration)
- Enhancement scenarios (simple to complex prompts, error handling)
- Cross-device responsiveness
- Performance monitoring and assertions
- Microservices orchestration validation

## Test Structure

```
tests/e2e/
├── specs/                      # Test specifications
│   ├── new-user-flow.spec.ts   # New user journey tests
│   ├── power-user-flow.spec.ts # Advanced user feature tests
│   ├── admin-flow.spec.ts      # Admin functionality tests
│   └── enhancement-scenarios.spec.ts # Core enhancement tests
├── helpers/                    # Test utilities
│   ├── auth.helper.ts          # Authentication helpers
│   ├── enhancement.helper.ts   # Enhancement workflow helpers
│   └── performance.helper.ts   # Performance monitoring
├── data/                       # Test data
│   └── test-prompts.ts         # Categorized test prompts
├── reporters/                  # Custom reporters
│   └── performance-reporter.ts # Performance metrics reporter
├── global-setup.ts             # Pre-test setup
├── global-teardown.ts          # Post-test cleanup
├── playwright.config.ts        # Main configuration
└── playwright.config.comprehensive.ts # Extended configuration
```

## Running Tests

### Prerequisites

Ensure all services are running:
```bash
# Start all services
docker compose up -d

# Verify services are healthy
docker compose ps
```

### Basic Test Execution

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npx playwright test new-user-flow.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in UI mode (interactive)
npx playwright test --ui
```

### Test Configurations

```bash
# Use comprehensive configuration with performance monitoring
npx playwright test --config=playwright.config.comprehensive.ts

# Run only on specific browser
npx playwright test --project=chromium

# Run mobile tests
npx playwright test --project=mobile-chrome

# Run API tests only
npx playwright test --project=api
```

### Parallel Execution

```bash
# Run with specific number of workers
npx playwright test --workers=4

# Run tests sequentially
npx playwright test --workers=1
```

## Test Categories

### 1. New User Flow (`new-user-flow.spec.ts`)
- Landing page experience
- Registration process
- Email verification simulation
- Onboarding flow
- First enhancement creation
- Help resources access
- Responsive design validation
- Error handling during registration

### 2. Power User Flow (`power-user-flow.spec.ts`)
- Batch enhancement processing
- Enhancement history management
- API key generation and management
- Advanced settings configuration
- Large prompt handling
- Collaboration features
- Data export functionality
- Usage analytics

### 3. Admin Flow (`admin-flow.spec.ts`)
- Dashboard overview
- User management (search, edit, suspend)
- System monitoring (metrics, logs, alerts)
- Configuration management (rate limits, models, features)
- Analytics and reporting
- Security and compliance
- Emergency procedures

### 4. Enhancement Scenarios (`enhancement-scenarios.spec.ts`)
- Simple prompt enhancement
- Complex prompt enhancement
- Batch processing with mixed complexity
- API usage and rate limiting
- Error handling and recovery
- Performance testing
- Cross-device responsiveness

## Performance Monitoring

### Built-in Performance Assertions

Each test includes performance assertions:
```typescript
// Enhancement should complete within 3 seconds
expect(enhanceTime).toBeLessThan(3000);

// Complete flow should take less than 60 seconds
expect(totalTime).toBeLessThan(60000);
```

### Performance Helper Usage

```typescript
const perfHelper = new PerformanceHelper(page);

// Measure custom action
await perfHelper.measureAction('enhancement', async () => {
  await enhancementHelper.enhancePrompt(prompt);
});

// Assert performance thresholds
perfHelper.assertPerformance({
  enhancementTime: 3000,
  apiResponseTime: 200,
  loadTime: 5000
});
```

### Performance Reports

After test execution, find performance reports in:
- `test-results/performance/performance-report.json` - Detailed metrics
- `test-results/performance/performance-report.md` - Markdown summary
- `test-results/html-report/index.html` - Visual test report

## Test Data

### Prompt Categories

Test prompts are categorized by:
- **Complexity**: simple, moderate, complex
- **Category**: text_summarization, code_generation, creative_writing, etc.
- **Expected Techniques**: Techniques that should be suggested

### Example Test Prompt Structure

```typescript
{
  input: 'Write a Python function to implement binary search',
  category: 'code_generation',
  expectedTechniques: ['few_shot', 'chain_of_thought'],
  enhancementPatterns: [/algorithm/, /example/, /edge cases/],
  complexity: 'moderate'
}
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
- name: Run E2E Tests
  run: |
    npm run test:e2e
  env:
    CI: true
    FRONTEND_URL: ${{ secrets.FRONTEND_URL }}
    API_BASE_URL: ${{ secrets.API_BASE_URL }}
```

### Environment Variables

- `CI` - Set to `true` in CI environments
- `FRONTEND_URL` - Frontend base URL (default: http://localhost:3000)
- `API_BASE_URL` - API base URL (default: http://localhost/api/v1)
- `SEED_TEST_DATA` - Set to `true` to seed test data
- `CLEANUP_OLD_RESULTS` - Set to `true` to clean old test artifacts

## Debugging Failed Tests

### View Test Artifacts

Failed tests generate:
- Screenshots: `test-results/screenshots/`
- Videos: `test-results/videos/`
- Traces: `test-results/artifacts/`

### View Traces

```bash
# Open trace viewer
npx playwright show-trace test-results/artifacts/trace.zip
```

### Debug Mode

```bash
# Run with debug mode
PWDEBUG=1 npx playwright test new-user-flow.spec.ts
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach` to set up clean state
- Clean up after tests in `afterEach`

### 2. Reliable Selectors
- Use `data-testid` attributes
- Avoid brittle CSS selectors
- Use text content for user-visible elements

### 3. Proper Waits
- Use Playwright's auto-waiting
- Avoid fixed timeouts
- Wait for specific conditions

### 4. Performance Awareness
- Set reasonable timeout expectations
- Monitor test execution times
- Use parallel execution wisely

## Troubleshooting

### Common Issues

1. **Services not healthy**
   ```bash
   # Check service logs
   docker compose logs api-gateway
   docker compose logs intent-classifier
   ```

2. **Tests timing out**
   - Increase timeout in test or config
   - Check if services are responding
   - Verify network connectivity

3. **Flaky tests**
   - Add proper waits
   - Check for race conditions
   - Use test retries

### Debug Commands

```bash
# Run single test in debug mode
npx playwright test --debug new-user-flow.spec.ts

# Run with verbose logging
DEBUG=pw:api npx playwright test

# Generate code while clicking through UI
npx playwright codegen http://localhost:3000
```

## Extending the Test Suite

### Adding New Tests

1. Create new spec file in `specs/`
2. Import necessary helpers
3. Follow existing patterns
4. Add performance assertions
5. Update this README

### Adding New Helpers

1. Create helper in `helpers/`
2. Export class with clear methods
3. Add TypeScript types
4. Document usage

### Custom Reporters

1. Implement Reporter interface
2. Add to `playwright.config.ts`
3. Generate useful output formats

## Maintenance

### Regular Tasks

- Review and update test data
- Check for deprecated selectors
- Update performance thresholds
- Clean up old test artifacts
- Review flaky tests

### Version Updates

When updating Playwright:
```bash
npm update @playwright/test
npx playwright install
```

## Contact

For questions or issues with the E2E test suite:
- Check test logs first
- Review this documentation
- Contact the QA team