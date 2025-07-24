import { test, expect } from '@playwright/test';
import { AuthHelper, TestUser } from '../helpers/auth.helper';

test.describe('Admin Flow', () => {
  let authHelper: AuthHelper;
  let adminUser: TestUser;
  let regularUser: TestUser;

  test.beforeAll(async ({ browser }) => {
    // Create admin user - In a real scenario, this would be seeded in the database
    const page = await browser.newPage();
    authHelper = new AuthHelper(page);
    
    // Admin user would typically be created with special privileges
    adminUser = {
      email: 'admin@betterprompts.com',
      username: 'admin',
      password: 'Admin123!@#',
      firstName: 'Admin',
      lastName: 'User'
    };
    
    // Create a regular user for testing
    regularUser = AuthHelper.generateTestUser('regular');
    await authHelper.register(regularUser);
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    
    // Login as admin
    await authHelper.login(adminUser.email, adminUser.password);
  });

  test('admin dashboard overview', async ({ page }) => {
    await test.step('Navigate to admin dashboard', async () => {
      await page.goto('/admin');
      
      // Verify admin access
      await expect(page).toHaveURL(/\/admin/);
      await expect(page.locator('h1')).toContainText('Admin Dashboard');
    });

    await test.step('View system statistics', async () => {
      // Check key metrics
      await expect(page.locator('[data-testid="total-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-enhancements"]')).toBeVisible();
      await expect(page.locator('[data-testid="api-requests"]')).toBeVisible();
      
      // Verify charts/graphs
      await expect(page.locator('[data-testid="usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="growth-chart"]')).toBeVisible();
    });

    await test.step('Check system health', async () => {
      const healthStatus = page.locator('[data-testid="system-health"]');
      await expect(healthStatus).toBeVisible();
      
      // Check service statuses
      const services = ['api-gateway', 'intent-classifier', 'prompt-generator', 'database'];
      for (const service of services) {
        const serviceStatus = page.locator(`[data-testid="service-${service}"]`);
        await expect(serviceStatus).toBeVisible();
        await expect(serviceStatus).toHaveClass(/status-(healthy|operational)/);
      }
    });

    await test.step('View recent activity', async () => {
      const activityFeed = page.locator('[data-testid="activity-feed"]');
      await expect(activityFeed).toBeVisible();
      
      // Should show recent activities
      const activities = await activityFeed.locator('.activity-item').all();
      expect(activities.length).toBeGreaterThan(0);
    });
  });

  test('admin user management', async ({ page }) => {
    await page.goto('/admin/users');
    
    await test.step('View user list', async () => {
      await expect(page.locator('h2')).toContainText('User Management');
      
      // Check user table
      const userTable = page.locator('[data-testid="users-table"]');
      await expect(userTable).toBeVisible();
      
      // Verify columns
      await expect(userTable.locator('th:has-text("Email")')).toBeVisible();
      await expect(userTable.locator('th:has-text("Username")')).toBeVisible();
      await expect(userTable.locator('th:has-text("Status")')).toBeVisible();
      await expect(userTable.locator('th:has-text("Role")')).toBeVisible();
      await expect(userTable.locator('th:has-text("Created")')).toBeVisible();
    });

    await test.step('Search and filter users', async () => {
      // Search by email
      const searchInput = page.locator('[data-testid="user-search"]');
      await searchInput.fill(regularUser.email);
      await page.keyboard.press('Enter');
      
      // Wait for filtered results
      await page.waitForTimeout(500);
      
      // Apply status filter
      const statusFilter = page.locator('[data-testid="status-filter"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('active');
      }
      
      // Apply role filter
      const roleFilter = page.locator('[data-testid="role-filter"]');
      if (await roleFilter.isVisible()) {
        await roleFilter.selectOption('user');
      }
    });

    await test.step('Edit user details', async () => {
      // Find the regular user
      const userRow = page.locator(`tr:has-text("${regularUser.email}")`);
      await userRow.locator('button:has-text("Edit")').click();
      
      // Edit user modal/page
      await page.waitForSelector('[data-testid="edit-user-form"]');
      
      // Update user role
      const roleSelect = page.locator('[data-testid="user-role"]');
      await roleSelect.selectOption('premium');
      
      // Update user status if needed
      const statusToggle = page.locator('[data-testid="user-status-toggle"]');
      if (await statusToggle.isVisible()) {
        const isActive = await statusToggle.isChecked();
        if (!isActive) {
          await statusToggle.check();
        }
      }
      
      // Save changes
      await page.click('button:has-text("Save Changes")');
      await expect(page.locator('text=User updated successfully')).toBeVisible();
    });

    await test.step('Suspend user account', async () => {
      // Find a user to suspend
      const userRow = page.locator('tr').filter({ hasText: regularUser.email });
      await userRow.locator('button:has-text("Actions")').click();
      await page.click('text=Suspend Account');
      
      // Confirm suspension
      const confirmModal = page.locator('[data-testid="confirm-suspend"]');
      await confirmModal.locator('button:has-text("Confirm")').click();
      
      // Verify suspension
      await expect(page.locator('text=Account suspended')).toBeVisible();
      await expect(userRow.locator('[data-testid="status-badge"]')).toContainText('Suspended');
    });

    await test.step('View user activity', async () => {
      const userRow = page.locator('tr').first();
      await userRow.locator('button:has-text("View Activity")').click();
      
      // User activity page/modal
      await page.waitForSelector('[data-testid="user-activity"]');
      
      // Check activity details
      await expect(page.locator('[data-testid="enhancement-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="last-login"]')).toBeVisible();
      await expect(page.locator('[data-testid="api-usage"]')).toBeVisible();
      
      // View enhancement history
      const enhancementHistory = page.locator('[data-testid="user-enhancement-history"]');
      if (await enhancementHistory.isVisible()) {
        const enhancements = await enhancementHistory.locator('.enhancement-item').all();
        // User might have enhancements
        expect(enhancements.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test('admin system monitoring', async ({ page }) => {
    await page.goto('/admin/monitoring');
    
    await test.step('View real-time metrics', async () => {
      await expect(page.locator('h2')).toContainText('System Monitoring');
      
      // CPU usage
      const cpuMetric = page.locator('[data-testid="cpu-usage"]');
      await expect(cpuMetric).toBeVisible();
      const cpuValue = await cpuMetric.textContent();
      expect(cpuValue).toMatch(/\d+%/);
      
      // Memory usage
      const memoryMetric = page.locator('[data-testid="memory-usage"]');
      await expect(memoryMetric).toBeVisible();
      
      // Request rate
      const requestRate = page.locator('[data-testid="request-rate"]');
      await expect(requestRate).toBeVisible();
      
      // Response time
      const responseTime = page.locator('[data-testid="response-time"]');
      await expect(responseTime).toBeVisible();
    });

    await test.step('Check service logs', async () => {
      // Navigate to logs section
      await page.click('[data-testid="logs-tab"]');
      
      // Select service
      const serviceSelect = page.locator('[data-testid="service-select"]');
      await serviceSelect.selectOption('api-gateway');
      
      // Select log level
      const logLevel = page.locator('[data-testid="log-level"]');
      await logLevel.selectOption('error');
      
      // View logs
      const logsContainer = page.locator('[data-testid="logs-container"]');
      await expect(logsContainer).toBeVisible();
      
      // Should be able to see log entries
      await page.waitForTimeout(1000); // Wait for logs to load
      const logEntries = await logsContainer.locator('.log-entry').all();
      // Might or might not have errors
      expect(logEntries.length).toBeGreaterThanOrEqual(0);
    });

    await test.step('Set up alerts', async () => {
      await page.click('[data-testid="alerts-tab"]');
      
      // Create new alert
      await page.click('button:has-text("New Alert")');
      
      // Configure alert
      await page.fill('[data-testid="alert-name"]', 'High Error Rate');
      
      const metricSelect = page.locator('[data-testid="alert-metric"]');
      await metricSelect.selectOption('error-rate');
      
      const conditionSelect = page.locator('[data-testid="alert-condition"]');
      await conditionSelect.selectOption('greater-than');
      
      await page.fill('[data-testid="alert-threshold"]', '5');
      
      const windowSelect = page.locator('[data-testid="alert-window"]');
      await windowSelect.selectOption('5-minutes');
      
      // Set notification channel
      const notificationChannel = page.locator('[data-testid="notification-channel"]');
      await notificationChannel.selectOption('email');
      
      // Save alert
      await page.click('button:has-text("Save Alert")');
      await expect(page.locator('text=Alert created')).toBeVisible();
    });
  });

  test('admin configuration management', async ({ page }) => {
    await page.goto('/admin/configuration');
    
    await test.step('Update rate limits', async () => {
      await page.click('[data-testid="rate-limits-tab"]');
      
      // Update default rate limit
      const defaultLimit = page.locator('[data-testid="default-rate-limit"]');
      await defaultLimit.clear();
      await defaultLimit.fill('100');
      
      // Update premium rate limit
      const premiumLimit = page.locator('[data-testid="premium-rate-limit"]');
      await premiumLimit.clear();
      await premiumLimit.fill('1000');
      
      // Save changes
      await page.click('button:has-text("Save Rate Limits")');
      await expect(page.locator('text=Rate limits updated')).toBeVisible();
    });

    await test.step('Configure model settings', async () => {
      await page.click('[data-testid="models-tab"]');
      
      // Enable/disable models
      const gpt4Toggle = page.locator('[data-testid="model-gpt4-toggle"]');
      if (await gpt4Toggle.isVisible()) {
        await gpt4Toggle.check();
      }
      
      // Set model priorities
      const prioritySelect = page.locator('[data-testid="default-model"]');
      await prioritySelect.selectOption('claude-3');
      
      // Configure model parameters
      await page.fill('[data-testid="max-tokens"]', '2000');
      await page.fill('[data-testid="temperature"]', '0.7');
      
      // Save configuration
      await page.click('button:has-text("Save Model Settings")');
      await expect(page.locator('text=Model settings saved')).toBeVisible();
    });

    await test.step('Manage feature flags', async () => {
      await page.click('[data-testid="features-tab"]');
      
      // Toggle feature flags
      const features = [
        { name: 'batch-enhancement', enabled: true },
        { name: 'api-v2', enabled: false },
        { name: 'collaborative-editing', enabled: true }
      ];
      
      for (const feature of features) {
        const toggle = page.locator(`[data-testid="feature-${feature.name}"]`);
        if (await toggle.isVisible()) {
          const isChecked = await toggle.isChecked();
          if (isChecked !== feature.enabled) {
            await toggle.click();
          }
        }
      }
      
      // Save feature flags
      await page.click('button:has-text("Save Features")');
      await expect(page.locator('text=Feature flags updated')).toBeVisible();
    });
  });

  test('admin analytics and reporting', async ({ page }) => {
    await page.goto('/admin/analytics');
    
    await test.step('View usage analytics', async () => {
      // Date range selector
      const dateRange = page.locator('[data-testid="date-range"]');
      await dateRange.selectOption('last-30-days');
      
      // View different metrics
      await expect(page.locator('[data-testid="total-enhancements-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-growth-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="technique-usage-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="api-usage-chart"]')).toBeVisible();
    });

    await test.step('Generate reports', async () => {
      await page.click('[data-testid="reports-tab"]');
      
      // Select report type
      const reportType = page.locator('[data-testid="report-type"]');
      await reportType.selectOption('monthly-summary');
      
      // Select month
      const monthSelect = page.locator('[data-testid="report-month"]');
      await monthSelect.selectOption('current');
      
      // Generate report
      await page.click('button:has-text("Generate Report")');
      
      // Wait for report generation
      await page.waitForSelector('[data-testid="report-ready"]', { timeout: 15000 });
      
      // Download report
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('button:has-text("Download Report")')
      ]);
      
      expect(download.suggestedFilename()).toContain('admin-report');
    });

    await test.step('View cost analysis', async () => {
      await page.click('[data-testid="costs-tab"]');
      
      // Check cost breakdown
      await expect(page.locator('[data-testid="api-costs"]')).toBeVisible();
      await expect(page.locator('[data-testid="infrastructure-costs"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-costs"]')).toBeVisible();
      
      // Cost per user metric
      const costPerUser = page.locator('[data-testid="cost-per-user"]');
      await expect(costPerUser).toBeVisible();
      const costValue = await costPerUser.textContent();
      expect(costValue).toMatch(/\$\d+\.\d{2}/);
    });
  });

  test('admin security and compliance', async ({ page }) => {
    await page.goto('/admin/security');
    
    await test.step('View security audit log', async () => {
      await expect(page.locator('h2')).toContainText('Security & Compliance');
      
      // Filter audit logs
      const eventType = page.locator('[data-testid="audit-event-type"]');
      await eventType.selectOption('authentication');
      
      // View audit entries
      const auditTable = page.locator('[data-testid="audit-log-table"]');
      await expect(auditTable).toBeVisible();
      
      const auditEntries = await auditTable.locator('tr').all();
      expect(auditEntries.length).toBeGreaterThan(0);
    });

    await test.step('Manage API access', async () => {
      await page.click('[data-testid="api-access-tab"]');
      
      // View API keys
      const apiKeysTable = page.locator('[data-testid="api-keys-table"]');
      await expect(apiKeysTable).toBeVisible();
      
      // Revoke suspicious key
      const suspiciousKey = apiKeysTable.locator('tr').filter({ hasText: 'Suspicious Activity' });
      if (await suspiciousKey.isVisible()) {
        await suspiciousKey.locator('button:has-text("Revoke")').click();
        await page.click('[data-testid="confirm-revoke"]');
        await expect(page.locator('text=API key revoked')).toBeVisible();
      }
    });

    await test.step('Run security scan', async () => {
      await page.click('[data-testid="security-scan-tab"]');
      
      // Start security scan
      await page.click('button:has-text("Run Security Scan")');
      
      // Wait for scan to complete (mocked in test environment)
      await page.waitForSelector('[data-testid="scan-complete"]', { timeout: 10000 });
      
      // View scan results
      const scanResults = page.locator('[data-testid="scan-results"]');
      await expect(scanResults).toBeVisible();
      
      // Check for vulnerabilities
      const vulnerabilities = await scanResults.locator('.vulnerability-item').all();
      console.log(`Security scan found ${vulnerabilities.length} vulnerabilities`);
    });
  });

  test('admin emergency procedures', async ({ page }) => {
    await page.goto('/admin/emergency');
    
    await test.step('Enable maintenance mode', async () => {
      const maintenanceToggle = page.locator('[data-testid="maintenance-mode-toggle"]');
      await maintenanceToggle.check();
      
      // Set maintenance message
      await page.fill(
        '[data-testid="maintenance-message"]',
        'System maintenance in progress. We\'ll be back shortly.'
      );
      
      // Confirm activation
      await page.click('button:has-text("Activate Maintenance Mode")');
      await page.click('[data-testid="confirm-maintenance"]');
      
      // Verify maintenance mode active
      await expect(page.locator('[data-testid="maintenance-status"]')).toContainText('Active');
    });

    await test.step('Emergency shutdown procedure', async () => {
      // This would only be tested in a safe test environment
      const shutdownButton = page.locator('button:has-text("Emergency Shutdown")');
      await expect(shutdownButton).toBeVisible();
      await expect(shutdownButton).toBeDisabled(); // Should require special permissions
    });

    await test.step('Disable maintenance mode', async () => {
      const maintenanceToggle = page.locator('[data-testid="maintenance-mode-toggle"]');
      await maintenanceToggle.uncheck();
      
      await page.click('button:has-text("Deactivate Maintenance Mode")');
      await expect(page.locator('[data-testid="maintenance-status"]')).toContainText('Inactive');
    });
  });
});