# Phase 13: End-to-End User Journey Tests

## Overview

Phase 13 implements comprehensive end-to-end user journey tests for the BetterPrompts platform. These tests validate complete workflows across all user personas, ensuring seamless integration of all features.

## Test Coverage

### Journey Test Suites

1. **New User Journey** (`new-user-journey.spec.ts`)
   - 9-step onboarding flow from landing to dashboard
   - Validates registration, tutorial, first enhancement
   - Target duration: 6 minutes

2. **Power User Journey** (`power-user-journey.spec.ts`)
   - 8-step batch processing workflow
   - Tests 100-prompt batch with error handling
   - Includes retry logic and reporting

3. **Developer Journey** (`developer-journey.spec.ts`)
   - 9-step API integration flow
   - API key management, rate limiting, webhooks
   - Plan upgrade simulation

4. **Mobile User Journey** (`mobile-journey.spec.ts`)
   - 9-step mobile experience
   - Touch gestures, offline mode, device switching
   - Tests on iPhone 13 and Pixel 5

5. **Accessibility Journey** (`accessibility-journey.spec.ts`)
   - 9-step accessible workflow
   - WCAG 2.1 AA compliance validation
   - Screen reader and keyboard navigation

6. **Concurrent Load Test** (`concurrent-journeys.spec.ts`)
   - 185 concurrent users simulation
   - Performance validation under load
   - Real-time metrics and dashboards

## Prerequisites

### System Requirements
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- 4GB RAM minimum
- 10GB disk space

### Software Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Playwright browsers
npm run playwright:install

# Install system dependencies (if needed)
npm run playwright:install-deps
```

## Setup Instructions

### 1. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Required: database credentials, API keys, test user info
```

### 2. Database Preparation
The following test users must exist in your database:
- `poweruser@example.com` / `PowerUser123!`
- `admin@example.com` / `AdminPassword123!`
- `testuser{0-99}@example.com` / `TestUser123!`
- `batchuser{200-249}@example.com` / `BatchUser123!`

### 3. Seed Test Data
```bash
# Run the seed script to create test users
npm run seed:test-data

# Or manually create users in your database
```

### 4. Start Services
```bash
# Using Docker Compose (recommended)
docker-compose up -d

# Or start services manually
# - Frontend: http://localhost:3000
# - API: http://localhost:8080
# - Database: PostgreSQL on localhost:5432
# - Redis: localhost:6379
```

## Running Tests

### All Journey Tests
```bash
# Run all Phase 13 tests
npm run test:e2e:phase13

# Run in headed mode (see browser)
npm run test:e2e:phase13:headed

# Run with UI mode
npm run test:ui -- e2e/phase13
```

### Individual Journey Tests
```bash
# New user journey
npm run test:e2e:phase13:new-user

# Power user journey
npm run test:e2e:phase13:power-user

# Developer journey
npm run test:e2e:phase13:developer

# Mobile journey
npm run test:e2e:phase13:mobile

# Accessibility journey
npm run test:e2e:phase13:accessibility

# Load test
npm run test:e2e:phase13:concurrent
```

### Using the Shell Script
```bash
# Make script executable
chmod +x e2e/phase13/run-tests.sh

# Run all tests
./e2e/phase13/run-tests.sh

# Run specific journey
./e2e/phase13/run-tests.sh --journey new-user

# Run with debugging
./e2e/phase13/run-tests.sh --headed --debug

# See all options
./e2e/phase13/run-tests.sh --help
```

### Advanced Options
```bash
# Run with custom timeout
npx playwright test e2e/phase13 --timeout=1200000

# Run with specific browser
npx playwright test e2e/phase13 --project=chromium

# Run with retries disabled
npx playwright test e2e/phase13 --retries=0

# Generate and view report
npx playwright test e2e/phase13 --reporter=html
npx playwright show-report
```

## Test Reports

### Generated Reports
- **HTML Report**: `playwright-report/index.html`
- **JUnit XML**: `test-results/junit.xml`
- **Journey Reports**: `e2e/phase13/reports/`
- **Performance Dashboards**: `e2e/phase13/reports/*-metrics.html`
- **Load Test Dashboard**: `e2e/phase13/reports/concurrent-load-test-dashboard.html`

### Viewing Reports
```bash
# Open Playwright HTML report
npm run report

# Open specific dashboard (macOS)
open e2e/phase13/reports/concurrent-load-test-dashboard.html

# Open specific dashboard (Linux)
xdg-open e2e/phase13/reports/concurrent-load-test-dashboard.html
```

## Troubleshooting

### Common Issues

#### 1. Test Users Not Found
**Error**: "Login failed for poweruser@example.com"
**Solution**: Run `npm run seed:test-data` or manually create users

#### 2. Services Not Running
**Error**: "Connection refused to localhost:3000"
**Solution**: Ensure all services are running with `docker-compose ps`

#### 3. Browser Not Installed
**Error**: "Executable doesn't exist at..."
**Solution**: Run `npm run playwright:install`

#### 4. Timeout Errors
**Error**: "Test timeout of 900000ms exceeded"
**Solution**: 
- Increase timeout in playwright.config.ts
- Check if services are responding slowly
- Run tests individually

#### 5. Permission Errors
**Error**: "EACCES: permission denied"
**Solution**: 
- Check file permissions
- Run `chmod +x e2e/phase13/run-tests.sh`
- Ensure write access to reports/ and downloads/

### Debug Mode
```bash
# Run with Playwright Inspector
npx playwright test e2e/phase13 --debug

# Run with verbose logging
DEBUG=pw:api npx playwright test e2e/phase13

# Run with slow motion
npx playwright test e2e/phase13 --headed --slow-mo=1000
```

### Environment Variables
Key variables for debugging:
- `HEADLESS=false` - Show browser
- `SLOW_MO=1000` - Slow down actions
- `DEBUG=true` - Enable debug logging
- `SCREENSHOT_ON_FAILURE=true` - Capture screenshots
- `VIDEO_ON_FAILURE=true` - Record videos

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run playwright:install
      - run: npm run test:e2e:phase13
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            playwright-report/
            test-results/
            e2e/phase13/reports/
```

### GitLab CI
```yaml
# .gitlab-ci.yml
e2e-tests:
  stage: test
  image: mcr.microsoft.com/playwright:v1.40.0-focal
  script:
    - npm ci
    - npm run test:e2e:phase13
  artifacts:
    when: always
    paths:
      - playwright-report/
      - test-results/
      - e2e/phase13/reports/
    expire_in: 1 week
```

## Maintenance

### Regular Tasks
1. **Update Test Data**: Keep test users and data current
2. **Update Selectors**: Maintain data-testid attributes
3. **Review Performance**: Check test execution times
4. **Update Dependencies**: Keep Playwright updated

### Best Practices
1. Use data-testid attributes for reliable selectors
2. Avoid hard-coded waits
3. Implement proper error handling
4. Keep tests independent
5. Clean up test data after runs

## Contributing

### Adding New Journey Tests
1. Create new test file in `journeys/` directory
2. Use `createJourney()` builder pattern
3. Add npm script to package.json
4. Update this README
5. Add to CI/CD pipeline

### Code Style
- TypeScript with strict mode
- ESLint configuration
- Prettier formatting
- Meaningful test descriptions

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test output and logs
3. Check Playwright documentation
4. File issue in project repository