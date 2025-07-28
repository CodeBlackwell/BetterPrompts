import { test, expect } from '@playwright/test';
import { unlockUser } from './utils/unlock-users';

test.describe('Admin Login Redirect Debug', () => {
  test('should debug admin login and redirect', async ({ page }) => {
    // Ensure admin is unlocked
    await unlockUser('admin@betterprompts.ai');
    
    // Listen for console messages
    page.on('console', msg => {
      console.log(`Browser Console [${msg.type()}]:`, msg.text());
    });
    
    // Listen for page errors
    page.on('pageerror', err => {
      console.log('Page Error:', err.message);
    });
    
    // Go to login page
    await page.goto('http://localhost:3000/login');
    
    // Take screenshot before login
    await page.screenshot({ path: 'before-login.png' });
    
    // Fill in credentials
    await page.fill('[data-testid="email-input"]', 'admin@betterprompts.ai');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    // Click login without waiting for navigation
    await page.click('[data-testid="login-button"]');
    
    // Wait a bit to see what happens
    await page.waitForTimeout(5000);
    
    // Take screenshot after login attempt
    await page.screenshot({ path: 'after-login.png' });
    
    // Check for error alerts
    const errorAlert = await page.locator('[role="alert"]').first();
    if (await errorAlert.isVisible()) {
      const errorText = await errorAlert.textContent();
      console.log('Error Alert:', errorText);
    }
    
    // Check current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Check if we're still on login page
    if (currentUrl.includes('/login')) {
      console.log('Still on login page, checking for errors...');
      
      // Try to get the error message
      const errorMessage = await page.locator('text=error').first();
      if (await errorMessage.isVisible()) {
        console.log('Error message found:', await errorMessage.textContent());
      }
    }
    
    // If we made it to admin page, check for nav
    if (currentUrl.includes('/admin')) {
      await expect(page.locator('[data-testid="admin-nav"]')).toBeVisible();
      console.log('Successfully redirected to admin!');
    }
  });
});