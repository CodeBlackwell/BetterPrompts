import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: '**/*.spec.ts',
  
  // Reasonable timeout for rate limit tests
  timeout: 30 * 1000,
  
  // Run tests in parallel within files, but files sequentially
  // to avoid rate limit interference
  fullyParallel: false,
  workers: 1,
  
  // Retry failed tests once
  retries: 1,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
  ],
  
  use: {
    // Base URL for API tests
    baseURL: process.env.API_BASE_URL || 'http://localhost/api/v1',
    
    // No browser needed for API tests
    headless: true,
    
    // Longer timeout for API requests during load tests
    actionTimeout: 30 * 1000,
    
    // Capture trace on failure
    trace: 'on-first-retry',
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    
    // Ignore HTTPS errors for local testing
    ignoreHTTPSErrors: true,
  },
  
  // Configure projects for different test scenarios
  projects: [
    {
      name: 'rate-limiting',
      testMatch: 'us-015-rate-limiting.spec.ts',
      use: {
        // Specific configuration for rate limit tests
        extraHTTPHeaders: {
          'X-Test-Suite': 'rate-limiting',
        },
      },
    },
    {
      name: 'concurrent-access',
      testMatch: 'ec-06-concurrent-access.spec.ts',
      use: {
        // Higher timeout for load tests
        actionTimeout: 60 * 1000,
      },
    },
    {
      name: 'headers',
      testMatch: 'rate-limit-headers.spec.ts',
    },
    {
      name: 'distributed',
      testMatch: 'distributed-limiting.spec.ts',
      use: {
        // Only run if multiple endpoints configured
        extraHTTPHeaders: {
          'X-Test-Mode': 'distributed',
        },
      },
    },
  ],
  
  // Global setup/teardown
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),
});