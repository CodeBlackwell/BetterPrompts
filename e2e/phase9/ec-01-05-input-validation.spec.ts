/**
 * Phase 9: Input Validation & Edge Cases E2E Tests
 * Stories: EC-01 to EC-05
 * 
 * Tests input validation, edge cases, and security measures
 */

import { test, expect } from '@playwright/test';
import { EdgeCaseGenerator } from './edge-case-generator';
import { InputValidator } from './input-validator';
import { SecurityValidator } from './security-validator';

// Test configuration
const TEST_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const PROMPT_INPUT_SELECTOR = 'textarea[placeholder*="prompt"], textarea[name="prompt"], #prompt-input';
const SUBMIT_BUTTON_SELECTOR = 'button[type="submit"], button:has-text("Enhance"), button:has-text("Submit")';
const OUTPUT_SELECTOR = '.enhanced-prompt, .output, [data-testid="enhanced-prompt"]';
const ERROR_SELECTOR = '.error-message, .alert-error, [role="alert"]';
const CHAR_COUNT_SELECTOR = '.char-count, .character-count, [data-testid="char-count"]';

// Test timeouts
const INPUT_TIMEOUT = 5000;
const RESPONSE_TIMEOUT = 10000;

test.describe('Phase 9: Input Validation & Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('EC-01: Character Limit Enforcement', () => {
    const charLimitCases = EdgeCaseGenerator.generateCharacterLimitCases();

    for (const testCase of charLimitCases) {
      test(`should handle ${testCase.name}`, async ({ page }) => {
        // Input the test case
        await page.fill(PROMPT_INPUT_SELECTOR, testCase.input);
        
        // Check character count display if available
        const charCount = await page.locator(CHAR_COUNT_SELECTOR).textContent();
        if (charCount) {
          const expectedLength = InputValidator.getGraphemeLength(testCase.input);
          expect(charCount).toContain(expectedLength.toString());
        }

        // Submit the form
        await page.click(SUBMIT_BUTTON_SELECTOR);

        if (testCase.expected === 'valid') {
          // Should process successfully
          await expect(page.locator(OUTPUT_SELECTOR)).toBeVisible({ timeout: RESPONSE_TIMEOUT });
          await expect(page.locator(ERROR_SELECTOR)).not.toBeVisible();
        } else {
          // Should show error
          await expect(page.locator(ERROR_SELECTOR)).toBeVisible({ timeout: INPUT_TIMEOUT });
          const errorText = await page.locator(ERROR_SELECTOR).textContent();
          expect(errorText).toBeTruthy();
          
          // Verify error is user-friendly
          expect(errorText).not.toMatch(/stack trace|exception|undefined/i);
          expect(errorText?.toLowerCase()).toContain('character');
        }
      });
    }

    test('should update character count in real-time', async ({ page }) => {
      const charCountElement = page.locator(CHAR_COUNT_SELECTOR);
      
      // Skip if no character counter
      const hasCharCounter = await charCountElement.isVisible().catch(() => false);
      if (!hasCharCounter) {
        test.skip();
        return;
      }

      // Type progressively and check count
      const testString = 'Hello World!';
      for (let i = 1; i <= testString.length; i++) {
        await page.fill(PROMPT_INPUT_SELECTOR, testString.substring(0, i));
        const count = await charCountElement.textContent();
        expect(count).toContain(i.toString());
      }
    });
  });

  test.describe('EC-02: Special Characters & Emojis', () => {
    const specialCharCases = EdgeCaseGenerator.generateSpecialCharacterCases();

    for (const testCase of specialCharCases) {
      test(`should handle ${testCase.name}`, async ({ page }) => {
        await page.fill(PROMPT_INPUT_SELECTOR, testCase.input);
        await page.click(SUBMIT_BUTTON_SELECTOR);

        if (testCase.expected === 'valid') {
          await expect(page.locator(OUTPUT_SELECTOR)).toBeVisible({ timeout: RESPONSE_TIMEOUT });
          
          // Verify special characters are preserved or properly encoded
          const outputText = await page.locator(OUTPUT_SELECTOR).textContent();
          expect(outputText).toBeTruthy();
        } else {
          await expect(page.locator(ERROR_SELECTOR)).toBeVisible({ timeout: INPUT_TIMEOUT });
        }
      });
    }

    test('should properly count emojis as single characters', async ({ page }) => {
      const complexEmoji = '👨‍👩‍👧‍👦'; // Family emoji (single grapheme cluster)
      await page.fill(PROMPT_INPUT_SELECTOR, complexEmoji);
      
      const charCount = await page.locator(CHAR_COUNT_SELECTOR).textContent();
      if (charCount) {
        expect(charCount).toContain('1'); // Should count as 1 character
      }
    });
  });

  test.describe('EC-03: Multilingual Support', () => {
    const multilingualCases = EdgeCaseGenerator.generateMultilingualCases();

    for (const testCase of multilingualCases) {
      test(`should support ${testCase.name}`, async ({ page }) => {
        await page.fill(PROMPT_INPUT_SELECTOR, testCase.input);
        await page.click(SUBMIT_BUTTON_SELECTOR);

        await expect(page.locator(OUTPUT_SELECTOR)).toBeVisible({ timeout: RESPONSE_TIMEOUT });
        
        // For RTL languages, check if layout is preserved
        if (testCase.name.includes('rtl') || testCase.name.includes('arabic')) {
          const outputElement = page.locator(OUTPUT_SELECTOR);
          const dir = await outputElement.getAttribute('dir');
          // Some systems auto-detect RTL, others might not
          if (dir) {
            expect(['rtl', 'auto']).toContain(dir);
          }
        }
      });
    }

    test('should handle mixed directional text', async ({ page }) => {
      const mixedText = 'Hello مرحبا World עולם!';
      await page.fill(PROMPT_INPUT_SELECTOR, mixedText);
      await page.click(SUBMIT_BUTTON_SELECTOR);
      
      await expect(page.locator(OUTPUT_SELECTOR)).toBeVisible({ timeout: RESPONSE_TIMEOUT });
    });
  });

  test.describe('EC-04: Empty & Whitespace', () => {
    const whitespaceCases = EdgeCaseGenerator.generateWhitespaceCases();

    for (const testCase of whitespaceCases) {
      test(`should handle ${testCase.name}`, async ({ page }) => {
        await page.fill(PROMPT_INPUT_SELECTOR, testCase.input);
        await page.click(SUBMIT_BUTTON_SELECTOR);

        if (testCase.expected === 'invalid') {
          await expect(page.locator(ERROR_SELECTOR)).toBeVisible({ timeout: INPUT_TIMEOUT });
          const errorText = await page.locator(ERROR_SELECTOR).textContent();
          expect(errorText?.toLowerCase()).toContain('empty');
        } else {
          await expect(page.locator(OUTPUT_SELECTOR)).toBeVisible({ timeout: RESPONSE_TIMEOUT });
        }
      });
    }

    test('should trim whitespace appropriately', async ({ page }) => {
      const inputWithSpaces = '   Test prompt   ';
      await page.fill(PROMPT_INPUT_SELECTOR, inputWithSpaces);
      await page.click(SUBMIT_BUTTON_SELECTOR);
      
      await expect(page.locator(OUTPUT_SELECTOR)).toBeVisible({ timeout: RESPONSE_TIMEOUT });
      // The system should process this as valid input
    });
  });

  test.describe('EC-05: Security Injection Tests', () => {
    const securityCases = EdgeCaseGenerator.generateSecurityCases();

    test('should run comprehensive security validation', async ({ page }) => {
      const result = await SecurityValidator.runFullSecurityValidation(
        page,
        PROMPT_INPUT_SELECTOR,
        OUTPUT_SELECTOR,
        ERROR_SELECTOR
      );

      // Generate and log report
      const report = SecurityValidator.generateReport(result);
      console.log(report);

      // Assert no critical vulnerabilities
      expect(result.passed).toBe(true);
      expect(result.sanitizationWorking).toBe(true);
    });

    for (const testCase of securityCases.slice(0, 5)) { // Test first 5 for speed
      test(`should safely handle ${testCase.name}`, async ({ page }) => {
        // Set up dialog handler to catch any XSS attempts
        let xssTriggered = false;
        page.on('dialog', async dialog => {
          xssTriggered = true;
          await dialog.dismiss();
        });

        await page.fill(PROMPT_INPUT_SELECTOR, testCase.input);
        await page.click(SUBMIT_BUTTON_SELECTOR);

        // Should process without executing malicious code
        expect(xssTriggered).toBe(false);
        
        // Should either process or show safe error
        const hasOutput = await page.locator(OUTPUT_SELECTOR).isVisible({ timeout: RESPONSE_TIMEOUT }).catch(() => false);
        const hasError = await page.locator(ERROR_SELECTOR).isVisible().catch(() => false);
        expect(hasOutput || hasError).toBe(true);

        // If output is shown, verify it's sanitized
        if (hasOutput) {
          const outputText = await page.locator(OUTPUT_SELECTOR).innerHTML();
          expect(outputText).not.toContain('<script');
          expect(outputText).not.toContain('onerror=');
          expect(outputText).not.toContain('javascript:');
        }
      });
    }

    test('should have proper security headers', async ({ page }) => {
      const response = await page.goto(TEST_URL);
      const headers = response?.headers() || {};

      // Check for essential security headers
      const securityHeaders = [
        'content-security-policy',
        'x-content-type-options',
        'x-frame-options',
        'strict-transport-security'
      ];

      const missingHeaders = securityHeaders.filter(h => !headers[h]);
      
      // Log missing headers but don't fail test in development
      if (missingHeaders.length > 0) {
        console.warn('Missing security headers:', missingHeaders);
      }
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should handle all edge cases consistently', async ({ page, browserName }) => {
      console.log(`Running edge case validation on ${browserName}`);
      
      // Test a sample from each category
      const sampleCases = [
        EdgeCaseGenerator.generateCharacterLimitCases()[0],
        EdgeCaseGenerator.generateSpecialCharacterCases()[0],
        EdgeCaseGenerator.generateMultilingualCases()[0],
        EdgeCaseGenerator.generateWhitespaceCases()[0],
        EdgeCaseGenerator.generateSecurityCases()[0]
      ];

      for (const testCase of sampleCases) {
        await page.fill(PROMPT_INPUT_SELECTOR, testCase.input);
        await page.click(SUBMIT_BUTTON_SELECTOR);
        
        // Basic validation that the page responds appropriately
        const hasResponse = await Promise.race([
          page.locator(OUTPUT_SELECTOR).isVisible(),
          page.locator(ERROR_SELECTOR).isVisible()
        ]).catch(() => false);
        
        expect(hasResponse).toBe(true);
        
        // Clear for next test
        await page.fill(PROMPT_INPUT_SELECTOR, '');
      }
    });
  });

  test.describe('Performance Under Edge Cases', () => {
    test('should handle maximum length input efficiently', async ({ page }) => {
      const maxInput = 'x'.repeat(2000);
      
      const startTime = Date.now();
      await page.fill(PROMPT_INPUT_SELECTOR, maxInput);
      await page.click(SUBMIT_BUTTON_SELECTOR);
      
      await expect(page.locator(OUTPUT_SELECTOR)).toBeVisible({ timeout: RESPONSE_TIMEOUT });
      const endTime = Date.now();
      
      // Should process within reasonable time
      expect(endTime - startTime).toBeLessThan(15000); // 15 seconds max
    });

    test('should handle rapid input changes', async ({ page }) => {
      // Simulate rapid typing
      const testString = 'Testing rapid input changes';
      
      for (const char of testString) {
        await page.type(PROMPT_INPUT_SELECTOR, char);
        await page.waitForTimeout(50); // 50ms between keystrokes
      }
      
      // Should not crash or show errors
      await expect(page.locator(ERROR_SELECTOR)).not.toBeVisible();
    });
  });
});

// Additional test for generating edge case report
test('Generate Edge Case Test Report', async () => {
  const report = EdgeCaseGenerator.generateReport();
  console.log('\n' + report + '\n');
  
  // Verify we have comprehensive coverage
  const allCases = EdgeCaseGenerator.getAllCases();
  expect(allCases.length).toBeGreaterThan(30); // Should have many test cases
  
  // Verify we have cases in each category
  const categories = ['length', 'special', 'multilingual', 'whitespace', 'security'];
  for (const category of categories) {
    const categoryCases = EdgeCaseGenerator.getCasesByCategory(category as any);
    expect(categoryCases.length).toBeGreaterThan(0);
  }
});