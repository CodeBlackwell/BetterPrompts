import { Page } from '@playwright/test';

export interface TestUser {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export class AuthHelper {
  constructor(private page: Page) {}

  async register(user: TestUser): Promise<void> {
    await this.page.goto('/register');
    
    if (user.firstName) {
      await this.page.fill('input[name="first_name"]', user.firstName);
    }
    if (user.lastName) {
      await this.page.fill('input[name="last_name"]', user.lastName);
    }
    
    await this.page.fill('input[name="email"]', user.email);
    await this.page.fill('input[name="username"]', user.username);
    await this.page.fill('input[name="password"]', user.password);
    await this.page.fill('input[name="confirm_password"]', user.password);
    await this.page.check('input[name="acceptTerms"]');
    await this.page.click('button[type="submit"]');
    
    // Wait for registration to complete
    await this.page.waitForURL('**/onboarding', { timeout: 10000 });
  }

  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    
    // Check remember me if available
    const rememberMe = this.page.locator('input[name="rememberMe"]');
    if (await rememberMe.isVisible()) {
      await rememberMe.check();
    }
    
    await this.page.click('button[type="submit"]');
    
    // Wait for login to complete
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  async logout(): Promise<void> {
    // Try different logout methods
    const userMenu = this.page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await this.page.click('text=Logout');
    } else {
      // Direct navigation to logout
      await this.page.goto('/logout');
    }
    
    await this.page.waitForURL('**/login');
  }

  async isLoggedIn(): Promise<boolean> {
    // Check for auth token in localStorage
    const token = await this.page.evaluate(() => {
      return localStorage.getItem('access_token');
    });
    
    return !!token;
  }

  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('access_token');
    });
  }

  async clearAuth(): Promise<void> {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  // Generate unique test user
  static generateTestUser(prefix = 'test'): TestUser {
    const timestamp = Date.now();
    return {
      email: `${prefix}.${timestamp}@example.com`,
      username: `${prefix}${timestamp}`,
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'User'
    };
  }
}