import { PlaywrightTestConfig } from '@playwright/test';

export const baseConfig: Partial<PlaywrightTestConfig> = {
  testDir: '../tests',
  outputDir: '../artifacts/test-results',
  timeout: 30 * 1000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: '../artifacts/playwright-reports' }],
    ['json', { outputFile: '../artifacts/test-results.json' }],
    ['junit', { outputFile: '../artifacts/junit.xml' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...require('@playwright/test').devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: { 
        ...require('@playwright/test').devices['Desktop Firefox'],
      },
    },
    {
      name: 'webkit',
      use: { 
        ...require('@playwright/test').devices['Desktop Safari'],
      },
    },
  ],
};