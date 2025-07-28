import { Page } from '@playwright/test';

export class AdminPage {
  constructor(private page: Page) {}

  async loginAsAdmin() {
    await this.page.goto('/login');
    
    // Use admin credentials from environment or test data
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@betterprompts.ai';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    
    await this.page.fill('[data-testid="email-input"]', adminEmail);
    await this.page.fill('[data-testid="password-input"]', adminPassword);
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for any navigation to occur (more flexible)
    await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    
    // Check if we're on an admin page or dashboard
    const url = this.page.url();
    if (!url.includes('/admin') && !url.includes('/dashboard')) {
      // If not redirected, wait a bit more
      await this.page.waitForURL('**/(admin|dashboard)/**', { timeout: 3000 }).catch(() => {
        console.error('Failed to redirect to admin/dashboard. Current URL:', url);
      });
    }
  }

  async navigateToSection(section: 'dashboard' | 'analytics' | 'users' | 'settings') {
    await this.page.click(`[data-testid="admin-nav-${section}"]`);
    await this.page.waitForURL(`**/admin/${section}`, { timeout: 5000 });
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('**/login', { timeout: 5000 });
  }
}