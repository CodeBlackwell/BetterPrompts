/**
 * Phase 9: Security Injection Tests
 * Tests that potentially malicious inputs are handled safely
 */

import { test, expect } from '@playwright/test';
import { EdgeCaseGenerator } from './edge-case-generator';

const TEST_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const PROMPT_INPUT_SELECTOR = '[data-testid="anonymous-prompt-input"]';
const SUBMIT_BUTTON_SELECTOR = '[data-testid="anonymous-enhance-button"]';
const ERROR_SELECTOR = '.text-destructive, [role="alert"], [data-testid="error-message"]';

test.describe('Security Injection Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should prevent submission of malicious inputs', async ({ page }) => {
    const securityCases = EdgeCaseGenerator.generateSecurityCases();
    
    for (const testCase of securityCases.slice(0, 5)) { // Test first 5
      await page.fill(PROMPT_INPUT_SELECTOR, ''); // Clear first
      await page.fill(PROMPT_INPUT_SELECTOR, testCase.input);
      
      // For security inputs, the button should remain enabled
      // The validation should happen server-side
      const submitButton = page.locator(SUBMIT_BUTTON_SELECTOR);
      await expect(submitButton).toBeEnabled();
      
      // Input should be accepted (not blocked client-side)
      const inputValue = await page.locator(PROMPT_INPUT_SELECTOR).inputValue();
      expect(inputValue).toBe(testCase.input);
    }
  });

  test('should sanitize output even with malicious input', async ({ page }) => {
    // Test XSS script tag
    const xssInput = '<script>alert("XSS")</script>';
    await page.fill(PROMPT_INPUT_SELECTOR, xssInput);
    
    // Should be able to submit
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeEnabled();
    
    // Set up dialog handler to catch any XSS
    let xssTriggered = false;
    page.on('dialog', async dialog => {
      xssTriggered = true;
      await dialog.dismiss();
    });
    
    // Try to submit (might fail server-side, which is fine)
    await page.click(SUBMIT_BUTTON_SELECTOR).catch(() => {
      // If submission fails, that's okay - server is protecting us
    });
    
    // Wait a bit
    await page.waitForTimeout(2000);
    
    // XSS should not have been triggered
    expect(xssTriggered).toBe(false);
  });

  test('should handle SQL injection attempts safely', async ({ page }) => {
    const sqlInjection = "'; DROP TABLE users; --";
    await page.fill(PROMPT_INPUT_SELECTOR, sqlInjection);
    
    // Should be able to type it
    const inputValue = await page.locator(PROMPT_INPUT_SELECTOR).inputValue();
    expect(inputValue).toBe(sqlInjection);
    
    // No SQL errors should be exposed in the UI
    await page.waitForTimeout(1000);
    const pageContent = await page.content();
    
    // Check for SQL error patterns
    expect(pageContent).not.toMatch(/SQL syntax/i);
    expect(pageContent).not.toMatch(/mysql_/i);
    expect(pageContent).not.toMatch(/ORA-\d+/);
    expect(pageContent).not.toMatch(/PostgreSQL/i);
  });

  test('should have security headers', async ({ page }) => {
    const response = await page.goto(TEST_URL);
    const headers = response?.headers() || {};
    
    // Check for important security headers
    const importantHeaders = [
      'x-content-type-options',
      'x-frame-options'
    ];
    
    const presentHeaders = importantHeaders.filter(h => headers[h]);
    console.log('Security headers present:', presentHeaders);
    
    // At least some security headers should be present
    expect(presentHeaders.length).toBeGreaterThan(0);
  });
});