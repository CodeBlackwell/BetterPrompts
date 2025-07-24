import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

export default defineConfig({
  testDir: './specs',
  
  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  
  // Global timeout settings
  timeout: 60 * 1000, // 60 seconds per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },
  
  // Reporting
  reporter: [
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    ['./reporters/performance-reporter.ts'], // Custom performance reporter
  ],
  
  // Output directory for test artifacts
  outputDir: 'test-results/artifacts',
  
  // Global test settings
  use: {
    // Base URLs
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // Trace settings for debugging
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'on',
    
    // Action and navigation timeouts
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
    
    // Browser context options
    contextOptions: {
      recordVideo: {
        dir: 'test-results/videos',
        size: { width: 1280, height: 720 }
      },
    },
    
    // Custom test attributes
    testIdAttribute: 'data-testid',
    
    // Performance monitoring
    launchOptions: {
      args: ['--enable-precise-memory-info'],
    },
  },

  // Test projects for different scenarios
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Performance testing capabilities
        launchOptions: {
          args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
        },
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Mobile devices
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        isMobile: true,
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 13'],
        isMobile: true,
      },
    },

    // Tablet devices
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
      },
    },

    // API testing project
    {
      name: 'api',
      use: {
        baseURL: process.env.API_BASE_URL || 'http://localhost/api/v1',
        extraHTTPHeaders: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      },
      testMatch: /api-.*\.spec\.ts$/,
    },

    // Performance testing project
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--js-flags=--expose-gc',
            '--disable-dev-shm-usage',
          ],
        },
      },
      testMatch: /performance-.*\.spec\.ts$/,
    },

    // Accessibility testing project
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Enable accessibility testing
        contextOptions: {
          // Force color scheme for contrast testing
          colorScheme: 'light',
        },
      },
      testMatch: /accessibility-.*\.spec\.ts$/,
    },
  ],

  // Web servers configuration
  webServer: [
    {
      command: process.env.CI 
        ? 'echo "Using existing services"' 
        : 'cd ../.. && docker compose up -d',
      url: 'http://localhost/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 3 * 60 * 1000, // 3 minutes
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: process.env.CI 
        ? 'echo "Using existing frontend"' 
        : 'cd ../../frontend && npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 2 * 60 * 1000, // 2 minutes
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],

  // Global setup and teardown
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),
});