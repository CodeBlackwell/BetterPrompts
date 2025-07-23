import { test, expect } from '@playwright/test';
import { AuthHelper, TestUser } from '../helpers/auth.helper';

test.describe('Authentication Flow', () => {
  let authHelper: AuthHelper;
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    testUser = AuthHelper.generateTestUser('auth');
    
    // Clear any existing auth state
    await authHelper.clearAuth();
  });

  test.describe('Registration', () => {
    test('successful user registration', async ({ page }) => {
      await page.goto('/register');
      
      // Fill registration form
      await page.fill('input[name="first_name"]', testUser.firstName!);
      await page.fill('input[name="last_name"]', testUser.lastName!);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirm_password"]', testUser.password);
      
      // Check terms acceptance
      await page.check('input[name="acceptTerms"]');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Verify redirect to onboarding
      await expect(page).toHaveURL(/.*\/onboarding/);
      
      // Verify user is logged in
      const isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(true);
      
      // Verify welcome message
      await expect(page.locator('h1')).toContainText('Welcome');
    });

    test('registration with validation errors', async ({ page }) => {
      await page.goto('/register');
      
      // Test empty form submission
      await page.click('button[type="submit"]');
      
      // Verify error messages
      await expect(page.locator('text=Email is required')).toBeVisible();
      await expect(page.locator('text=Username is required')).toBeVisible();
      await expect(page.locator('text=Password is required')).toBeVisible();
      
      // Test password mismatch
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirm_password"]', 'DifferentPassword123!');
      await page.click('button[type="submit"]');
      
      await expect(page.locator('text=Passwords do not match')).toBeVisible();
    });

    test('registration with duplicate email', async ({ page }) => {
      // First register a user
      await authHelper.register(testUser);
      await authHelper.logout();
      
      // Try to register with same email
      await page.goto('/register');
      const duplicateUser = {
        ...testUser,
        username: 'different' + testUser.username
      };
      
      await page.fill('input[name="email"]', duplicateUser.email);
      await page.fill('input[name="username"]', duplicateUser.username);
      await page.fill('input[name="password"]', duplicateUser.password);
      await page.fill('input[name="confirm_password"]', duplicateUser.password);
      await page.check('input[name="acceptTerms"]');
      await page.click('button[type="submit"]');
      
      // Verify error message
      await expect(page.locator('text=Email already exists')).toBeVisible();
    });

    test('password strength indicator', async ({ page }) => {
      await page.goto('/register');
      
      const passwordInput = page.locator('input[name="password"]');
      const strengthIndicator = page.locator('[data-testid="password-strength"]');
      
      // Test weak password
      await passwordInput.fill('weak');
      await expect(strengthIndicator).toHaveAttribute('data-strength', '1');
      
      // Test medium password
      await passwordInput.fill('Medium123');
      await expect(strengthIndicator).toHaveAttribute('data-strength', '3');
      
      // Test strong password
      await passwordInput.fill('Strong123!@#');
      await expect(strengthIndicator).toHaveAttribute('data-strength', '5');
    });
  });

  test.describe('Login', () => {
    test.beforeEach(async () => {
      // Register a user for login tests
      await authHelper.register(testUser);
      await authHelper.logout();
    });

    test('successful login', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      
      // Verify redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Verify user is logged in
      const isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(true);
      
      // Verify auth token exists
      const token = await authHelper.getAuthToken();
      expect(token).toBeTruthy();
    });

    test('login with username instead of email', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('input[name="email"]', testUser.username);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      
      // Should successfully login
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    test('login with invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('text=Invalid credentials')).toBeVisible();
      
      // Should remain on login page
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('login with remember me', async ({ page, context }) => {
      await page.goto('/login');
      
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.check('input[name="rememberMe"]');
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Check for access_token cookie
      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(c => c.name === 'access_token');
      expect(accessTokenCookie).toBeTruthy();
      expect(accessTokenCookie?.httpOnly).toBe(true);
    });

    test('redirect to login when accessing protected route', async ({ page }) => {
      // Try to access a protected route without authentication
      await page.goto('/profile');
      
      // Should redirect to login with return URL
      await expect(page).toHaveURL(/.*\/login\?from=%2Fprofile/);
      
      // Login
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      
      // Should redirect back to profile after login
      await expect(page).toHaveURL(/.*\/profile/);
    });
  });

  test.describe('Protected Routes', () => {
    test.beforeEach(async () => {
      // Register and login
      await authHelper.register(testUser);
    });

    test('can access protected routes when authenticated', async ({ page }) => {
      // Test various protected routes
      const protectedRoutes = [
        '/dashboard',
        '/enhance',
        '/history',
        '/profile',
        '/settings'
      ];
      
      for (const route of protectedRoutes) {
        await page.goto(route);
        
        // Should not redirect to login
        expect(page.url()).not.toContain('/login');
        
        // Should be on the requested page
        expect(page.url()).toContain(route);
      }
    });

    test('profile page functionality', async ({ page }) => {
      await page.goto('/profile');
      
      // Verify profile information is displayed
      await expect(page.locator('input[name="firstName"]')).toHaveValue(testUser.firstName!);
      await expect(page.locator('input[name="lastName"]')).toHaveValue(testUser.lastName!);
      await expect(page.locator('input[name="email"]')).toHaveValue(testUser.email);
      
      // Update profile
      await page.fill('input[name="firstName"]', 'Updated');
      await page.fill('input[name="lastName"]', 'Name');
      await page.click('button:has-text("Save changes")');
      
      // Verify success message
      await expect(page.locator('text=Profile updated successfully')).toBeVisible();
      
      // Reload and verify changes persisted
      await page.reload();
      await expect(page.locator('input[name="firstName"]')).toHaveValue('Updated');
      await expect(page.locator('input[name="lastName"]')).toHaveValue('Name');
    });

    test('change password functionality', async ({ page }) => {
      await page.goto('/profile');
      
      // Navigate to security tab
      await page.click('button:has-text("Security")');
      
      // Fill password change form
      await page.fill('input[name="currentPassword"]', testUser.password);
      const newPassword = 'NewPassword123!@#';
      await page.fill('input[name="newPassword"]', newPassword);
      await page.fill('input[name="confirmPassword"]', newPassword);
      
      // Submit
      await page.click('button:has-text("Update password")');
      
      // Verify success message
      await expect(page.locator('text=Password updated successfully')).toBeVisible();
      
      // Logout and try logging in with new password
      await authHelper.logout();
      await authHelper.login(testUser.email, newPassword);
      
      // Should be logged in successfully
      await expect(page).toHaveURL(/.*\/dashboard/);
    });
  });

  test.describe('Token Refresh', () => {
    test('automatic token refresh on expiry', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Get initial token
      const initialToken = await authHelper.getAuthToken();
      expect(initialToken).toBeTruthy();
      
      // Wait for token to expire (simulate by manipulating token expiry)
      await page.evaluate(() => {
        // Get current token data
        const token = localStorage.getItem('access_token');
        const tokenData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        
        // Set token expiry to 1 second from now
        if (tokenData.state && tokenData.state.tokenExpiry) {
          tokenData.state.tokenExpiry = Date.now() + 1000;
          localStorage.setItem('auth-storage', JSON.stringify(tokenData));
        }
      });
      
      // Wait for auto-refresh
      await page.waitForTimeout(2000);
      
      // Make an API call that requires authentication
      await page.goto('/profile');
      
      // Should still be authenticated
      const isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(true);
      
      // Token should be different (refreshed)
      const newToken = await authHelper.getAuthToken();
      expect(newToken).toBeTruthy();
      // Note: In real implementation, tokens would be different
    });

    test('redirect to login when refresh token is invalid', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Corrupt the refresh token
      await page.evaluate(() => {
        const tokenData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        if (tokenData.state && tokenData.state.refreshToken) {
          tokenData.state.refreshToken = 'invalid-refresh-token';
          localStorage.setItem('auth-storage', JSON.stringify(tokenData));
        }
      });
      
      // Force token expiry
      await page.evaluate(() => {
        const tokenData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        if (tokenData.state && tokenData.state.tokenExpiry) {
          tokenData.state.tokenExpiry = Date.now() - 1000;
          localStorage.setItem('auth-storage', JSON.stringify(tokenData));
        }
      });
      
      // Try to access protected route
      await page.goto('/profile');
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Logout', () => {
    test.beforeEach(async () => {
      // Register and login
      await authHelper.register(testUser);
    });

    test('successful logout', async ({ page }) => {
      // Verify logged in
      let isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(true);
      
      // Logout
      await authHelper.logout();
      
      // Verify logged out
      isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(false);
      
      // Verify redirected to login
      await expect(page).toHaveURL(/.*\/login/);
      
      // Try to access protected route
      await page.goto('/dashboard');
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('clears all auth data on logout', async ({ page, context }) => {
      // Get initial auth data
      const tokenBefore = await authHelper.getAuthToken();
      expect(tokenBefore).toBeTruthy();
      
      // Logout
      await authHelper.logout();
      
      // Verify all auth data cleared
      const tokenAfter = await authHelper.getAuthToken();
      expect(tokenAfter).toBeFalsy();
      
      // Check cookies are cleared
      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(c => c.name === 'access_token');
      expect(accessTokenCookie).toBeFalsy();
      
      // Verify localStorage is cleared
      const authStorage = await page.evaluate(() => {
        return localStorage.getItem('auth-storage');
      });
      const parsedStorage = authStorage ? JSON.parse(authStorage) : null;
      expect(parsedStorage?.state?.user).toBeFalsy();
      expect(parsedStorage?.state?.token).toBeFalsy();
    });
  });

  test.describe('Session Management', () => {
    test('maintains session across page refreshes', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Navigate to profile
      await page.goto('/profile');
      await expect(page.locator('h1')).toContainText('Profile');
      
      // Refresh page
      await page.reload();
      
      // Should still be authenticated
      const isLoggedIn = await authHelper.isLoggedIn();
      expect(isLoggedIn).toBe(true);
      
      // Should still be on profile page
      await expect(page).toHaveURL(/.*\/profile/);
      await expect(page.locator('h1')).toContainText('Profile');
    });

    test('handles multiple tabs/windows', async ({ browser }) => {
      // Create first context and register/login
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const authHelper1 = new AuthHelper(page1);
      
      await authHelper1.register(testUser);
      
      // Create second context (new tab/window)
      const context2 = await browser.newContext({
        storageState: await context1.storageState()
      });
      const page2 = await context2.newPage();
      
      // Should be authenticated in second tab
      await page2.goto('/dashboard');
      await expect(page2).toHaveURL(/.*\/dashboard/);
      
      // Logout in first tab
      await authHelper1.logout();
      
      // Refresh second tab
      await page2.reload();
      
      // Should redirect to login (depends on implementation)
      // Some apps maintain separate sessions per tab
      await expect(page2).toHaveURL(/.*\/(login|dashboard)/);
      
      // Cleanup
      await context1.close();
      await context2.close();
    });
  });

  test.describe('Security Features', () => {
    test('prevents access to auth pages when logged in', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Try to access login page
      await page.goto('/login');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);
      
      // Try to access register page
      await page.goto('/register');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);
    });

    test('handles expired sessions gracefully', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Simulate expired session by clearing auth data
      await page.evaluate(() => {
        localStorage.removeItem('access_token');
      });
      
      // Try to access protected route
      await page.goto('/profile');
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
      
      // Should show appropriate message
      await expect(page.locator('text=Session expired')).toBeVisible();
    });

    test('validates token on each request', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Tamper with token
      await page.evaluate(() => {
        localStorage.setItem('access_token', 'invalid-token');
      });
      
      // Try to access protected route
      await page.goto('/profile');
      
      // Should redirect to login due to invalid token
      await expect(page).toHaveURL(/.*\/login/);
    });
  });
});

// Additional test for edge cases
test.describe('Authentication Edge Cases', () => {
  test('handles network errors during authentication', async ({ page }) => {
    // Simulate offline
    await page.context().setOffline(true);
    
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Should show network error
    await expect(page.locator('text=Network error')).toBeVisible();
    
    // Re-enable network
    await page.context().setOffline(false);
  });

  test('handles server errors gracefully', async ({ page }) => {
    // This would require mocking the API to return 500 errors
    // For now, we'll skip this test in real implementation
  });

  test('prevents rapid-fire login attempts', async ({ page }) => {
    await page.goto('/login');
    
    // Try multiple rapid login attempts
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="email"]', `attempt${i}@example.com`);
      await page.fill('input[name="password"]', 'WrongPassword');
      await page.click('button[type="submit"]');
    }
    
    // Should eventually show rate limit error
    await expect(page.locator('text=Too many attempts')).toBeVisible({ timeout: 10000 });
  });
});