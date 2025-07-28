import { test, expect } from '@playwright/test';
import { unlockUser } from './utils/unlock-users';

test.describe('Admin Login Redirect', () => {
  test('should redirect admin to /admin/analytics after login', async ({ page }) => {
    // Ensure admin is unlocked
    await unlockUser('admin@betterprompts.ai');
    
    // Go to login page
    await page.goto('http://localhost:3000/login');
    
    // Fill in credentials
    await page.fill('[data-testid="email-input"]', 'admin@betterprompts.ai');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    // Click login and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('[data-testid="login-button"]')
    ]);
    
    // Check final URL
    const url = page.url();
    console.log('Final URL after login:', url);
    
    // Should be redirected to admin analytics
    expect(url).toContain('/admin/analytics');
    
    // Check if we can see admin navigation
    await expect(page.locator('[data-testid="admin-nav"]')).toBeVisible();
  });
});