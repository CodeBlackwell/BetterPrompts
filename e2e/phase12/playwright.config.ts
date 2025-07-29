import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Phase 12: Mobile & Accessibility testing
 */
export default defineConfig({
  testDir: './',
  testMatch: '**/*.spec.ts',
  
  // Test timeout
  timeout: 60 * 1000,
  expect: {
    timeout: 10000
  },

  // Run tests in parallel
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
    ['list']
  ],

  // Global test settings
  use: {
    // Base URL - update this to match your environment
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace on failure
    trace: 'retain-on-failure',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',

    // Viewport size (default)
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Permissions
    permissions: ['geolocation'],
    
    // Emulate mobile features
    isMobile: false,
    hasTouch: false,
    
    // User agent
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },

  // Project configurations for different browsers and devices
  projects: [
    // Desktop browsers
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

    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 }
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 }
      },
    },
    {
      name: 'mobile-safari-landscape',
      use: { 
        ...devices['iPhone 13 landscape'],
        viewport: { width: 844, height: 390 }
      },
    },

    // Tablets
    {
      name: 'tablet-safari',
      use: { 
        ...devices['iPad (gen 7)'],
        viewport: { width: 810, height: 1080 }
      },
    },
    {
      name: 'tablet-chrome',
      use: { 
        ...devices['Galaxy Tab S4'],
        viewport: { width: 712, height: 1138 }
      },
    },

    // Accessibility testing profile
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Emulate vision deficiency
        colorScheme: 'no-preference',
        // Reduce motion
        reducedMotion: 'reduce',
        // Force colors
        forcedColors: 'none',
      },
    },

    // High contrast mode
    {
      name: 'high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        forcedColors: 'active',
      },
    },
  ],

  // Web server configuration (if needed)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,
});