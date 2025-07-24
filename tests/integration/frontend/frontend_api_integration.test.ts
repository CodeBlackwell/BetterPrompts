/**
 * Frontend → API Gateway Integration Tests
 * Tests the complete integration between Next.js frontend and API Gateway
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import axios, { AxiosInstance } from 'axios';

// Test configuration
const config = {
  frontend: {
    baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  api: {
    baseUrl: process.env.API_GATEWAY_URL || 'http://localhost/api/v1',
  },
  auth: {
    testUser: {
      email: 'integration@test.com',
      password: 'IntegrationTest123!',
      name: 'Integration Test User',
    },
  },
  timeouts: {
    api: 10000,
    ui: 30000,
  },
};

// Helper class for API interactions
class APIClient {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: config.timeouts.api,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });
  }

  async login(email: string, password: string): Promise<void> {
    const response = await this.client.post('/auth/login', { email, password });
    this.authToken = response.data.token;
  }

  async register(email: string, password: string, name: string): Promise<any> {
    return this.client.post('/auth/register', { email, password, name });
  }

  async enhance(text: string): Promise<any> {
    return this.client.post('/enhance', { text });
  }

  async getHistory(): Promise<any> {
    return this.client.get('/history');
  }

  async submitFeedback(enhancementId: string, rating: number, feedback: string): Promise<any> {
    return this.client.post('/feedback', { enhancementId, rating, feedback });
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuth(): void {
    this.authToken = null;
  }
}

// Test fixtures
test.describe('Frontend → API Gateway Integration', () => {
  let apiClient: APIClient;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    apiClient = new APIClient(config.api.baseUrl);
  });

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      baseURL: config.frontend.baseUrl,
      // Store auth state
      storageState: undefined,
    });
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Authentication Flow', () => {
    test('should complete full authentication cycle', async () => {
      // 1. Navigate to home page
      await page.goto('/');
      
      // 2. Click login button
      await page.click('[data-testid="login-button"]');
      
      // 3. Fill login form
      await page.fill('[data-testid="email-input"]', config.auth.testUser.email);
      await page.fill('[data-testid="password-input"]', config.auth.testUser.password);
      
      // 4. Submit form
      await page.click('[data-testid="submit-login"]');
      
      // 5. Wait for redirect to dashboard
      await page.waitForURL('**/dashboard');
      
      // 6. Verify auth token is stored
      const localStorage = await page.evaluate(() => window.localStorage);
      expect(localStorage).toHaveProperty('authToken');
      
      // 7. Verify API calls work with auth
      const authToken = await page.evaluate(() => window.localStorage.getItem('authToken'));
      apiClient.setAuthToken(authToken!);
      
      const historyResponse = await apiClient.getHistory();
      expect(historyResponse.status).toBe(200);
    });

    test('should handle authentication errors gracefully', async () => {
      await page.goto('/login');
      
      // Try invalid credentials
      await page.fill('[data-testid="email-input"]', 'invalid@test.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="submit-login"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
      
      // Should not redirect
      expect(page.url()).toContain('/login');
    });

    test('should persist session across page reloads', async () => {
      // Login first
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', config.auth.testUser.email);
      await page.fill('[data-testid="password-input"]', config.auth.testUser.password);
      await page.click('[data-testid="submit-login"]');
      await page.waitForURL('**/dashboard');
      
      // Store auth state
      const storageState = await context.storageState();
      
      // Create new context with stored state
      const newContext = await page.context().browser()!.newContext({
        storageState,
      });
      const newPage = await newContext.newPage();
      
      // Navigate directly to protected route
      await newPage.goto('/dashboard');
      
      // Should not redirect to login
      expect(newPage.url()).toContain('/dashboard');
      
      await newContext.close();
    });
  });

  test.describe('Enhancement Pipeline', () => {
    test('should complete full enhancement flow', async () => {
      await page.goto('/');
      
      // Enter prompt
      const testPrompt = 'Explain how recursion works in programming';
      await page.fill('[data-testid="prompt-input"]', testPrompt);
      
      // Click enhance button
      await page.click('[data-testid="enhance-button"]');
      
      // Wait for loading state
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
      
      // Wait for results
      await expect(page.locator('[data-testid="enhanced-prompt"]')).toBeVisible({ timeout: 15000 });
      
      // Verify enhanced prompt is displayed
      const enhancedText = await page.locator('[data-testid="enhanced-prompt"]').textContent();
      expect(enhancedText).toBeTruthy();
      expect(enhancedText!.length).toBeGreaterThan(testPrompt.length);
      
      // Verify techniques are shown
      const techniques = await page.locator('[data-testid="technique-tag"]').all();
      expect(techniques.length).toBeGreaterThan(0);
      
      // Verify copy button works
      await page.click('[data-testid="copy-button"]');
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(enhancedText);
    });

    test('should handle enhancement errors', async () => {
      await page.goto('/');
      
      // Mock API error
      await page.route('**/api/v1/enhance', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });
      
      // Try to enhance
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="enhance-button"]');
      
      // Should show error
      await expect(page.locator('[data-testid="error-alert"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-alert"]')).toContainText('Failed to enhance');
    });

    test('should show real-time status updates', async () => {
      await page.goto('/');
      
      // Slow down API response to see status updates
      await page.route('**/api/v1/enhance', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        route.continue();
      });
      
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="enhance-button"]');
      
      // Check status updates
      await expect(page.locator('[data-testid="status-message"]')).toContainText('Analyzing intent');
      await expect(page.locator('[data-testid="status-message"]')).toContainText('Selecting techniques');
      await expect(page.locator('[data-testid="status-message"]')).toContainText('Generating enhanced prompt');
    });
  });

  test.describe('Caching Behavior', () => {
    test('should cache enhancement results', async () => {
      await page.goto('/');
      
      const testPrompt = 'What is machine learning?';
      
      // First request
      await page.fill('[data-testid="prompt-input"]', testPrompt);
      await page.click('[data-testid="enhance-button"]');
      await page.waitForSelector('[data-testid="enhanced-prompt"]');
      
      const firstResult = await page.locator('[data-testid="enhanced-prompt"]').textContent();
      
      // Clear and try again
      await page.click('[data-testid="clear-button"]');
      await page.fill('[data-testid="prompt-input"]', testPrompt);
      
      // Measure time for second request
      const startTime = Date.now();
      await page.click('[data-testid="enhance-button"]');
      await page.waitForSelector('[data-testid="enhanced-prompt"]');
      const endTime = Date.now();
      
      const secondResult = await page.locator('[data-testid="enhanced-prompt"]').textContent();
      
      // Results should be identical
      expect(secondResult).toBe(firstResult);
      
      // Second request should be faster (cached)
      expect(endTime - startTime).toBeLessThan(500);
    });

    test('should invalidate cache on user preference change', async () => {
      // Login first
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', config.auth.testUser.email);
      await page.fill('[data-testid="password-input"]', config.auth.testUser.password);
      await page.click('[data-testid="submit-login"]');
      await page.waitForURL('**/dashboard');
      
      // Navigate to preferences
      await page.goto('/preferences');
      
      // Change technique preference
      await page.click('[data-testid="technique-preference-cot"]');
      await page.click('[data-testid="save-preferences"]');
      
      // Verify cache is cleared
      const cacheStatus = await page.evaluate(() => {
        return window.localStorage.getItem('enhancement-cache-cleared');
      });
      expect(cacheStatus).toBeTruthy();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle network failures gracefully', async () => {
      await page.goto('/');
      
      // Simulate offline
      await context.setOffline(true);
      
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="enhance-button"]');
      
      // Should show offline message
      await expect(page.locator('[data-testid="offline-alert"]')).toBeVisible();
      
      // Go back online
      await context.setOffline(false);
      
      // Should allow retry
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="enhanced-prompt"]')).toBeVisible({ timeout: 15000 });
    });

    test('should handle service timeouts', async () => {
      await page.goto('/');
      
      // Mock slow response
      await page.route('**/api/v1/enhance', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 20000));
        route.continue();
      });
      
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="enhance-button"]');
      
      // Should show timeout error after 15 seconds
      await expect(page.locator('[data-testid="timeout-error"]')).toBeVisible({ timeout: 16000 });
      await expect(page.locator('[data-testid="timeout-error"]')).toContainText('Request timed out');
    });

    test('should recover from partial failures', async () => {
      await page.goto('/');
      
      let requestCount = 0;
      
      // Fail first request, succeed on retry
      await page.route('**/api/v1/enhance', (route) => {
        requestCount++;
        if (requestCount === 1) {
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Service temporarily unavailable' }),
          });
        } else {
          route.continue();
        }
      });
      
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="enhance-button"]');
      
      // Should show error with retry option
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Retry should succeed
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="enhanced-prompt"]')).toBeVisible();
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should track and display performance metrics', async () => {
      await page.goto('/');
      
      // Enable performance monitoring
      await page.evaluate(() => {
        window.localStorage.setItem('enable-performance-monitoring', 'true');
      });
      await page.reload();
      
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="enhance-button"]');
      await page.waitForSelector('[data-testid="enhanced-prompt"]');
      
      // Check performance metrics are displayed
      await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
      
      const metrics = await page.locator('[data-testid="performance-metrics"]').textContent();
      expect(metrics).toContain('Intent Classification:');
      expect(metrics).toContain('Technique Selection:');
      expect(metrics).toContain('Prompt Generation:');
      expect(metrics).toContain('Total Time:');
    });

    test('should warn on slow responses', async () => {
      await page.goto('/');
      
      // Mock slow API
      await page.route('**/api/v1/enhance', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enhanced_prompt: 'Enhanced: Test prompt',
            techniques_applied: ['chain_of_thought'],
          }),
        });
      });
      
      await page.fill('[data-testid="prompt-input"]', 'Test prompt');
      await page.click('[data-testid="enhance-button"]');
      
      // Should show slow response warning
      await expect(page.locator('[data-testid="slow-response-warning"]')).toBeVisible({ timeout: 3000 });
      
      // Should still complete successfully
      await expect(page.locator('[data-testid="enhanced-prompt"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Service Health Monitoring', () => {
    test('should display service health status', async () => {
      await page.goto('/');
      
      // Click on status indicator
      await page.click('[data-testid="service-status-indicator"]');
      
      // Should show health modal
      await expect(page.locator('[data-testid="health-modal"]')).toBeVisible();
      
      // Check individual service statuses
      const services = ['API Gateway', 'Intent Classifier', 'Technique Selector', 'Prompt Generator'];
      
      for (const service of services) {
        const serviceStatus = page.locator(`[data-testid="service-${service.toLowerCase().replace(' ', '-')}-status"]`);
        await expect(serviceStatus).toBeVisible();
        const status = await serviceStatus.getAttribute('data-status');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(status);
      }
    });

    test('should auto-refresh health status', async () => {
      await page.goto('/');
      await page.click('[data-testid="service-status-indicator"]');
      
      // Get initial status
      const initialStatus = await page.locator('[data-testid="service-api-gateway-status"]').getAttribute('data-status');
      
      // Wait for auto-refresh (every 30 seconds)
      await page.waitForTimeout(31000);
      
      // Status should have been checked again
      const updatedStatus = await page.locator('[data-testid="service-api-gateway-status"]').getAttribute('data-status');
      
      // The check happened (status might be the same but the timestamp should be different)
      const lastChecked = await page.locator('[data-testid="last-health-check"]').textContent();
      expect(lastChecked).toContain('seconds ago');
    });
  });
});

// Run the tests
if (require.main === module) {
  // This allows running the file directly for debugging
  console.log('Run this test file using: npx playwright test frontend_api_integration.test.ts');
}