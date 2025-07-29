import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
  testDir: './',
  testMatch: '*.spec.ts',
  
  // Test timeout for security tests (longer for thorough testing)
  timeout: 60 * 1000,
  
  // Global timeout
  globalTimeout: 30 * 60 * 1000, // 30 minutes
  
  // Expect timeout
  expect: {
    timeout: 10000
  },
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 1 : 0,
  
  // Run tests in parallel
  workers: process.env.CI ? 2 : 4,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
    ['list']
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Security test specific settings
    ignoreHTTPSErrors: false, // Important for security testing
    
    // Headers for API requests
    extraHTTPHeaders: {
      'X-Test-Suite': 'security-phase-11'
    }
  },
  
  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Security-specific browser context
        contextOptions: {
          // Don't ignore HTTPS errors
          ignoreHTTPSErrors: false,
          // Strict cookie handling
          acceptDownloads: false,
          // Permissions
          permissions: [],
        }
      },
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        contextOptions: {
          ignoreHTTPSErrors: false,
        }
      },
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        contextOptions: {
          ignoreHTTPSErrors: false,
        }
      },
    },
    
    // Security-specific test configurations
    {
      name: 'security-headers',
      testMatch: '**/ss-05-encryption.spec.ts',
      use: {
        // Focus on header validation
        ...devices['Desktop Chrome'],
      }
    },
    
    {
      name: 'penetration',
      testMatch: ['**/ss-01-sql-injection.spec.ts', '**/ss-02-xss-protection.spec.ts'],
      use: {
        // More aggressive testing settings
        ...devices['Desktop Chrome'],
        // Longer timeouts for injection tests
        actionTimeout: 30000,
      }
    }
  ],
  
  // Global setup/teardown
  globalSetup: require.resolve('./utils/global-setup'),
  globalTeardown: require.resolve('./utils/global-teardown'),
});