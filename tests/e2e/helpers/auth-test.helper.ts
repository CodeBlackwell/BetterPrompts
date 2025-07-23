import { Page, expect } from '@playwright/test';

export class AuthTestHelper {
  constructor(private page: Page) {}

  // Verify user is on login page
  async assertOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/login/);
    await expect(this.page.locator('h1')).toContainText(/Sign in|Login/i);
  }

  // Verify user is on registration page
  async assertOnRegisterPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/register/);
    await expect(this.page.locator('h1')).toContainText(/Sign up|Register|Create account/i);
  }

  // Verify user is authenticated
  async assertAuthenticated(): Promise<void> {
    // Check for auth token
    const token = await this.page.evaluate(() => {
      return localStorage.getItem('access_token') || 
             sessionStorage.getItem('access_token');
    });
    expect(token).toBeTruthy();

    // Check that we're not on auth pages
    const currentUrl = this.page.url();
    expect(currentUrl).not.toContain('/login');
    expect(currentUrl).not.toContain('/register');
  }

  // Verify user is not authenticated
  async assertNotAuthenticated(): Promise<void> {
    const token = await this.page.evaluate(() => {
      return localStorage.getItem('access_token') || 
             sessionStorage.getItem('access_token');
    });
    expect(token).toBeFalsy();
  }

  // Check for specific error message
  async assertErrorMessage(message: string): Promise<void> {
    const errorLocator = this.page.locator(`text=${message}`);
    await expect(errorLocator).toBeVisible();
  }

  // Check for success message/toast
  async assertSuccessMessage(message: string): Promise<void> {
    const successLocator = this.page.locator(`text=${message}`);
    await expect(successLocator).toBeVisible();
  }

  // Verify form validation error
  async assertFieldError(fieldName: string, errorMessage: string): Promise<void> {
    const field = this.page.locator(`input[name="${fieldName}"]`);
    const fieldContainer = field.locator('..');
    const error = fieldContainer.locator(`text=${errorMessage}`);
    await expect(error).toBeVisible();
  }

  // Wait for auth redirect
  async waitForAuthRedirect(expectedUrl: string | RegExp, timeout = 10000): Promise<void> {
    await this.page.waitForURL(expectedUrl, { timeout });
  }

  // Get current user info from UI
  async getCurrentUserInfo(): Promise<{ email?: string; name?: string } | null> {
    try {
      // Try different selectors for user info
      const userMenuButton = this.page.locator('[data-testid="user-menu"], [aria-label="User menu"]');
      
      if (await userMenuButton.isVisible()) {
        // Get text from user menu
        const userText = await userMenuButton.textContent();
        return { name: userText?.trim() };
      }

      // Try profile link
      const profileLink = this.page.locator('a[href="/profile"]');
      if (await profileLink.isVisible()) {
        const profileText = await profileLink.textContent();
        return { name: profileText?.trim() };
      }

      return null;
    } catch {
      return null;
    }
  }

  // Simulate token expiry
  async simulateTokenExpiry(): Promise<void> {
    await this.page.evaluate(() => {
      // Manipulate token expiry in localStorage
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const data = JSON.parse(authStorage);
        if (data.state && data.state.tokenExpiry) {
          // Set expiry to past
          data.state.tokenExpiry = Date.now() - 1000;
          localStorage.setItem('auth-storage', JSON.stringify(data));
        }
      }
    });
  }

  // Get auth token expiry time
  async getTokenExpiry(): Promise<number | null> {
    return await this.page.evaluate(() => {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const data = JSON.parse(authStorage);
        return data.state?.tokenExpiry || null;
      }
      return null;
    });
  }

  // Check if "Remember Me" is working
  async assertRememberMeActive(): Promise<void> {
    const cookies = await this.page.context().cookies();
    const authCookie = cookies.find(c => 
      c.name === 'access_token' || 
      c.name === 'auth_token' ||
      c.name.includes('auth')
    );
    
    expect(authCookie).toBeTruthy();
    if (authCookie) {
      // Check cookie has long expiry (> 24 hours)
      const expiryDate = new Date(authCookie.expires * 1000);
      const now = new Date();
      const hoursDiff = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(24);
    }
  }

  // Fill login form
  async fillLoginForm(email: string, password: string, rememberMe = false): Promise<void> {
    await this.page.fill('input[name="email"], input[name="username"], input[type="email"]', email);
    await this.page.fill('input[name="password"], input[type="password"]', password);
    
    if (rememberMe) {
      const rememberCheckbox = this.page.locator('input[name="rememberMe"], input[type="checkbox"][name="remember"]');
      if (await rememberCheckbox.isVisible()) {
        await rememberCheckbox.check();
      }
    }
  }

  // Fill registration form
  async fillRegistrationForm(data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void> {
    if (data.firstName) {
      await this.page.fill('input[name="firstName"], input[name="first_name"]', data.firstName);
    }
    if (data.lastName) {
      await this.page.fill('input[name="lastName"], input[name="last_name"]', data.lastName);
    }
    
    await this.page.fill('input[name="email"], input[type="email"]', data.email);
    await this.page.fill('input[name="username"]', data.username);
    await this.page.fill('input[name="password"]', data.password);
    await this.page.fill('input[name="confirmPassword"], input[name="confirm_password"]', data.password);
    
    // Accept terms if present
    const termsCheckbox = this.page.locator('input[name="acceptTerms"], input[name="terms"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }
  }

  // Submit form
  async submitForm(): Promise<void> {
    await this.page.click('button[type="submit"]');
  }

  // Navigate to auth pages
  async gotoLogin(): Promise<void> {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoRegister(): Promise<void> {
    await this.page.goto('/register');
    await this.page.waitForLoadState('networkidle');
  }

  // Utility to test protected route access
  async testProtectedRoute(route: string): Promise<boolean> {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle');
    
    // If redirected to login, route is protected
    const currentUrl = this.page.url();
    return !currentUrl.includes('/login');
  }

  // Check password strength indicator
  async getPasswordStrength(): Promise<number> {
    const strengthIndicator = this.page.locator('[data-testid="password-strength"], [aria-label*="password strength"]');
    
    if (await strengthIndicator.isVisible()) {
      // Try to get strength from data attribute
      const strength = await strengthIndicator.getAttribute('data-strength');
      if (strength) {
        return parseInt(strength, 10);
      }
      
      // Try to count filled bars/dots
      const filledBars = await strengthIndicator.locator('.filled, .active').count();
      return filledBars;
    }
    
    return 0;
  }

  // Wait for navigation after auth action
  async waitForPostAuthNavigation(): Promise<void> {
    // Wait for either dashboard, home, or onboarding
    await this.page.waitForURL(/\/(dashboard|home|onboarding|enhance)/, { 
      timeout: 10000,
      waitUntil: 'networkidle' 
    });
  }

  // Check if session is expired
  async isSessionExpired(): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;
    
    return Date.now() > expiry;
  }

  // Force logout by clearing all auth data
  async forceLogout(): Promise<void> {
    await this.page.evaluate(() => {
      // Clear all possible auth storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth-storage');
      sessionStorage.clear();
      
      // Clear any auth-related items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('auth') || key.includes('token') || key.includes('user')) {
          localStorage.removeItem(key);
        }
      });
    });
    
    // Clear cookies
    await this.page.context().clearCookies();
  }
}