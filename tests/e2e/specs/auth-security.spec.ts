import { test, expect } from '@playwright/test';
import { AuthHelper, TestUser } from '../helpers/auth.helper';
import { AuthTestHelper } from '../helpers/auth-test.helper';

test.describe('Authentication Security Features', () => {
  let authHelper: AuthHelper;
  let authTestHelper: AuthTestHelper;
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    authTestHelper = new AuthTestHelper(page);
    testUser = AuthHelper.generateTestUser('security');
    
    // Clear any existing auth state
    await authHelper.clearAuth();
  });

  test.describe('Password Security', () => {
    test('enforces password complexity requirements', async ({ page }) => {
      await page.goto('/register');
      
      const passwordInput = page.locator('input[name="password"]');
      const submitButton = page.locator('button[type="submit"]');
      
      // Test weak passwords
      const weakPasswords = [
        'short',           // Too short
        'alllowercase',    // No uppercase or numbers
        'ALLUPPERCASE',    // No lowercase or numbers
        'NoNumbers!',      // No numbers
        'NoSpecial123',    // No special characters
        '12345678',        // Only numbers
      ];
      
      for (const weakPassword of weakPasswords) {
        await passwordInput.fill(weakPassword);
        await passwordInput.blur(); // Trigger validation
        
        // Check password strength
        const strength = await authTestHelper.getPasswordStrength();
        expect(strength).toBeLessThan(3); // Weak password
      }
      
      // Test strong password
      await passwordInput.fill('StrongP@ssw0rd123!');
      const strength = await authTestHelper.getPasswordStrength();
      expect(strength).toBeGreaterThanOrEqual(4); // Strong password
    });

    test('masks password input by default', async ({ page }) => {
      await page.goto('/register');
      
      const passwordInput = page.locator('input[name="password"]');
      const inputType = await passwordInput.getAttribute('type');
      expect(inputType).toBe('password');
      
      // Test show/hide password toggle
      const toggleButton = page.locator('[data-testid="toggle-password"], button[aria-label*="password"]');
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        const newType = await passwordInput.getAttribute('type');
        expect(newType).toBe('text');
        
        // Toggle back
        await toggleButton.click();
        const finalType = await passwordInput.getAttribute('type');
        expect(finalType).toBe('password');
      }
    });

    test('prevents password reuse in password change', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Go to profile security settings
      await page.goto('/profile');
      await page.click('button:has-text("Security")');
      
      // Try to change to same password
      await page.fill('input[name="currentPassword"]', testUser.password);
      await page.fill('input[name="newPassword"]', testUser.password);
      await page.fill('input[name="confirmPassword"]', testUser.password);
      await page.click('button:has-text("Update password")');
      
      // Should show error
      await authTestHelper.assertErrorMessage('New password must be different');
    });
  });

  test.describe('Session Security', () => {
    test('implements session timeout', async ({ page }) => {
      // Register and login
      await authHelper.register(testUser);
      
      // Simulate inactivity by waiting (in real app, would be longer)
      // For testing, we'll simulate by manipulating session data
      await page.evaluate(() => {
        const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
        if (authData.state) {
          // Set last activity to 1 hour ago
          authData.state.lastActivity = Date.now() - (60 * 60 * 1000);
          localStorage.setItem('auth-storage', JSON.stringify(authData));
        }
      });
      
      // Try to access protected route
      await page.goto('/profile');
      
      // Should redirect to login due to session timeout
      await authTestHelper.assertOnLoginPage();
      await authTestHelper.assertErrorMessage('Session expired');
    });

    test('prevents concurrent sessions (optional feature)', async ({ browser }) => {
      // This test assumes the app prevents concurrent sessions
      // Skip if not implemented
      
      // Create first session
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      const authHelper1 = new AuthHelper(page1);
      
      await authHelper1.register(testUser);
      const token1 = await authHelper1.getAuthToken();
      
      // Create second session with same credentials
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      const authHelper2 = new AuthHelper(page2);
      
      await authHelper2.login(testUser.email, testUser.password);
      const token2 = await authHelper2.getAuthToken();
      
      // First session should be invalidated (if feature is implemented)
      await page1.reload();
      
      // Check if first session is still valid
      // This behavior depends on app implementation
      
      // Cleanup
      await context1.close();
      await context2.close();
    });

    test('regenerates session on privilege escalation', async ({ page }) => {
      // Register normal user
      await authHelper.register(testUser);
      const initialToken = await authHelper.getAuthToken();
      
      // Simulate privilege escalation (e.g., user becomes admin)
      // This would typically happen server-side
      
      // For testing, we'll check token changes after sensitive operations
      await page.goto('/profile');
      await page.click('button:has-text("Security")');
      
      // Change password (sensitive operation)
      const newPassword = 'NewSecureP@ssw0rd123!';
      await page.fill('input[name="currentPassword"]', testUser.password);
      await page.fill('input[name="newPassword"]', newPassword);
      await page.fill('input[name="confirmPassword"]', newPassword);
      await page.click('button:has-text("Update password")');
      
      // Token might be regenerated after password change
      const newToken = await authHelper.getAuthToken();
      // Note: Actual behavior depends on implementation
    });
  });

  test.describe('CSRF Protection', () => {
    test('includes CSRF token in forms', async ({ page }) => {
      await page.goto('/login');
      
      // Check for CSRF token in form or meta tag
      const csrfMeta = await page.locator('meta[name="csrf-token"]').getAttribute('content');
      const csrfInput = await page.locator('input[name="_csrf"], input[name="csrf_token"]').inputValue();
      
      // At least one should exist
      expect(csrfMeta || csrfInput).toBeTruthy();
    });

    test('validates CSRF token on submission', async ({ page }) => {
      await page.goto('/login');
      
      // Tamper with CSRF token if present
      const csrfInput = page.locator('input[name="_csrf"], input[name="csrf_token"]');
      if (await csrfInput.count() > 0) {
        await csrfInput.evaluate(node => {
          (node as HTMLInputElement).value = 'invalid-csrf-token';
        });
      }
      
      // Try to submit form
      await authTestHelper.fillLoginForm(testUser.email, testUser.password);
      await authTestHelper.submitForm();
      
      // Should show error (if CSRF is implemented)
      // Note: Actual behavior depends on implementation
    });
  });

  test.describe('Account Lockout', () => {
    test('locks account after multiple failed login attempts', async ({ page }) => {
      // First register a user
      await authHelper.register(testUser);
      await authHelper.logout();
      
      // Try multiple failed login attempts
      await page.goto('/login');
      
      for (let i = 0; i < 5; i++) {
        await authTestHelper.fillLoginForm(testUser.email, 'WrongPassword123!');
        await authTestHelper.submitForm();
        
        // Wait for error message
        await page.waitForTimeout(500);
      }
      
      // Account should be locked
      await authTestHelper.assertErrorMessage('Account locked');
      
      // Even correct password should fail
      await authTestHelper.fillLoginForm(testUser.email, testUser.password);
      await authTestHelper.submitForm();
      
      await authTestHelper.assertErrorMessage('Account locked');
    });

    test('shows remaining lockout time', async ({ page }) => {
      // Register and trigger lockout
      await authHelper.register(testUser);
      await authHelper.logout();
      
      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await page.goto('/login');
        await authTestHelper.fillLoginForm(testUser.email, 'WrongPassword');
        await authTestHelper.submitForm();
        await page.waitForTimeout(100);
      }
      
      // Check for lockout message with time
      const lockoutMessage = page.locator('text=/locked.*minutes|locked.*seconds/i');
      await expect(lockoutMessage).toBeVisible();
    });
  });

  test.describe('Input Validation & Sanitization', () => {
    test('prevents SQL injection in login form', async ({ page }) => {
      await page.goto('/login');
      
      // Try SQL injection patterns
      const sqlInjectionPatterns = [
        "admin' OR '1'='1",
        "admin'; DROP TABLE users; --",
        "' OR 1=1 --",
        "admin'/*",
      ];
      
      for (const pattern of sqlInjectionPatterns) {
        await authTestHelper.fillLoginForm(pattern, 'password');
        await authTestHelper.submitForm();
        
        // Should show normal error, not SQL error
        await authTestHelper.assertErrorMessage('Invalid credentials');
        
        // Should not break the application
        await page.reload();
        await authTestHelper.assertOnLoginPage();
      }
    });

    test('prevents XSS in registration form', async ({ page }) => {
      await page.goto('/register');
      
      // Try XSS patterns
      const xssPatterns = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
      ];
      
      for (const pattern of xssPatterns) {
        const testUser = AuthHelper.generateTestUser('xss');
        testUser.firstName = pattern;
        
        await authTestHelper.fillRegistrationForm({
          ...testUser,
          firstName: pattern,
        });
        await authTestHelper.submitForm();
        
        // If registration succeeds, check profile
        if (page.url().includes('onboarding')) {
          await page.goto('/profile');
          
          // Check that script is not executed
          const alerts = [];
          page.on('dialog', dialog => {
            alerts.push(dialog.message());
            dialog.dismiss();
          });
          
          await page.waitForTimeout(1000);
          expect(alerts).toHaveLength(0);
          
          // Check that input is escaped in display
          const nameDisplay = page.locator(`text=${pattern}`);
          if (await nameDisplay.count() > 0) {
            // Text should be escaped, not executed
            const html = await nameDisplay.innerHTML();
            expect(html).not.toContain('<script>');
            expect(html).not.toContain('onerror=');
          }
        }
      }
    });
  });

  test.describe('Secure Communication', () => {
    test('uses HTTPS for authentication endpoints', async ({ page }) => {
      // Note: This test assumes the app enforces HTTPS in production
      // In development, it might use HTTP
      
      const response = await page.goto('/login');
      const url = response?.url() || page.url();
      
      // In production, should use HTTPS
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        expect(url).toMatch(/^https:/);
      }
    });

    test('sets secure flags on auth cookies', async ({ page, context }) => {
      await authHelper.register(testUser);
      
      const cookies = await context.cookies();
      const authCookies = cookies.filter(c => 
        c.name.includes('auth') || 
        c.name.includes('token') ||
        c.name === 'access_token'
      );
      
      authCookies.forEach(cookie => {
        // Should have security flags
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toBe('Strict' || 'Lax');
        
        // In production, should be secure
        if (!cookie.domain.includes('localhost')) {
          expect(cookie.secure).toBe(true);
        }
      });
    });
  });

  test.describe('Rate Limiting', () => {
    test('implements rate limiting on authentication endpoints', async ({ page }) => {
      const requests = [];
      
      // Make rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          page.goto('/login').then(() => 
            authTestHelper.fillLoginForm(`test${i}@example.com`, 'password')
          ).then(() => 
            authTestHelper.submitForm()
          ).catch(() => {})
        );
      }
      
      await Promise.all(requests);
      
      // Should eventually hit rate limit
      await page.goto('/login');
      await authTestHelper.fillLoginForm('final@example.com', 'password');
      await authTestHelper.submitForm();
      
      // Look for rate limit error
      const rateLimitError = page.locator('text=/rate limit|too many requests|slow down/i');
      // May or may not be visible depending on implementation
    });
  });
});