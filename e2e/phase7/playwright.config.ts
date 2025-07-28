import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  },

  projects: [
    {
      name: 'api-tests',
      use: { 
        ...devices['Desktop Chrome'],
        // API tests don't need viewport
        viewport: null,
        // Disable browser UI for API tests
        headless: true,
      },
    },
    {
      name: 'contract-tests',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: null,
        headless: true,
      },
    },
    {
      name: 'webhook-tests',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: null,
        headless: true,
      },
    },
  ],

  webServer: [
    {
      command: 'cd ../.. && docker compose up -d',
      port: 80,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Webhook receiver mock server
      command: 'node utils/webhook-server.js',
      port: 8888,
      timeout: 10000,
      reuseExistingServer: true,
    }
  ],
});