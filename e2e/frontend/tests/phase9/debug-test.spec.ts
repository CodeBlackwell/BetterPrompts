import { test, expect } from '@playwright/test';

test('debug - check homepage loads', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Check if the anonymous prompt input exists
  const promptInput = page.locator('[data-testid="anonymous-prompt-input"]');
  await expect(promptInput).toBeVisible({ timeout: 10000 });
  
  // Type something
  await promptInput.fill('Test input');
  
  // Check character count updates
  const charCount = page.locator('[data-testid="anonymous-character-count"]');
  await expect(charCount).toContainText('10');
  
  // Check button is enabled
  const enhanceButton = page.locator('[data-testid="anonymous-enhance-button"]');
  await expect(enhanceButton).toBeEnabled();
  
  console.log('✅ All basic elements found and working');
});