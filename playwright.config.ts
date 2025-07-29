import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Playwright configuration for BetterPrompts E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  
  // Test timeout: 15 minutes for journey tests
  timeout: 15 * 60 * 1000,
  
  // Expect timeout: 30 seconds
  expect: {
    timeout: 30 * 1000,
  },

  // Run tests sequentially for journey tests
  fullyParallel: false,
  
  // Retry failed tests
  retries: process.env.CI ? 2 : 1,
  
  // Number of workers
  workers: process.env.CI ? 1 : 1,
  
  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Global test settings
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace on first retry
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Locale
    locale: 'en-US',
    
    // Timezone
    timezoneId: 'America/Los_Angeles',
    
    // Permissions
    permissions: ['clipboard-read', 'clipboard-write'],
    
    // User agent
    userAgent: 'BetterPrompts E2E Tests',
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],

  // Configure output directories
  outputDir: 'test-results',

  // Web server configuration (optional)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  // Global setup and teardown
  globalSetup: process.env.GLOBAL_SETUP ? './e2e/global-setup.ts' : undefined,
  globalTeardown: process.env.GLOBAL_TEARDOWN ? './e2e/global-teardown.ts' : undefined,
});

// Phase-specific configurations
export const phase13Config = {
  timeout: 20 * 60 * 1000, // 20 minutes for load tests
  workers: 1, // Sequential execution for journeys
  retries: 2, // More retries for flaky journey tests
};