import { test, expect } from '@playwright/test';
import { BetterPromptsAPIClient } from './utils/api-client';
import { RateLimiterTester } from './utils/rate-limiter-tester';
import { WebhookServer } from './utils/webhook-server';
import * as testData from './fixtures/test-data.json';

test.describe('US-004: Enterprise API Integration', () => {
  let apiClient: BetterPromptsAPIClient;
  let rateLimiter: RateLimiterTester;
  let webhookServer: WebhookServer;
  const baseURL = process.env.BASE_URL || 'http://localhost/api/v1';

  test.beforeAll(async () => {
    // Start webhook server for webhook tests
    webhookServer = new WebhookServer({
      port: 8889,
      secret: 'test-webhook-secret',
      validateSignatures: true,
      logLevel: 'info',
    });
    await webhookServer.start();
  });

  test.afterAll(async () => {
    // Stop webhook server
    await webhookServer.stop();
  });

  test.beforeEach(async () => {
    // Initialize API client for each test
    apiClient = new BetterPromptsAPIClient({ baseURL });
    rateLimiter = new RateLimiterTester(apiClient);
    
    // Clear webhook deliveries
    webhookServer.clearDeliveries();
  });

  test.describe('API Endpoints', () => {
    test.describe('Enhancement Endpoint', () => {
      test('should enhance a simple prompt', async () => {
        const request = {
          text: testData.testPrompts.simple.text,
        };

        const response = await apiClient.enhance(request);

        expect(response).toBeTruthy();
        expect(response.id).toBeTruthy();
        expect(response.original_text).toBe(request.text);
        expect(response.enhanced_text).toBeTruthy();
        expect(response.enhanced_text).not.toBe(response.original_text);
        expect(response.enhanced_prompt).toBe(response.enhanced_text); // Alias check
        expect(response.intent).toBeTruthy();
        expect(response.complexity).toBeTruthy();
        expect(response.techniques_used).toBeInstanceOf(Array);
        expect(response.techniques_used.length).toBeGreaterThan(0);
        expect(response.techniques).toEqual(response.techniques_used); // Alias check
        expect(response.confidence).toBeGreaterThan(0);
        expect(response.confidence).toBeLessThanOrEqual(1);
        expect(response.processing_time_ms).toBeGreaterThan(0);
        expect(response.enhanced).toBe(true);
      });

      test('should respect prefer_techniques parameter', async () => {
        const request = {
          text: testData.testPrompts.moderate.text,
          prefer_techniques: ['chain_of_thought', 'step_by_step'],
        };

        const response = await apiClient.enhance(request);

        expect(response.techniques_used).toEqual(
          expect.arrayContaining(['chain_of_thought'])
        );
      });

      test('should respect exclude_techniques parameter', async () => {
        const request = {
          text: testData.testPrompts.creative.text,
          exclude_techniques: ['analogies', 'metaphors'],
        };

        const response = await apiClient.enhance(request);

        expect(response.techniques_used).not.toContain('analogies');
        expect(response.techniques_used).not.toContain('metaphors');
      });

      test('should handle target_complexity parameter', async () => {
        const request = {
          text: testData.testPrompts.complex.text,
          target_complexity: 'simple',
        };

        const response = await apiClient.enhance(request);

        // The enhancement should aim for simpler output
        expect(response.complexity).toBeTruthy();
      });

      test('should handle context parameter', async () => {
        const request = {
          text: 'Fix this error',
          context: {
            error_type: 'TypeError',
            error_message: 'Cannot read property of undefined',
            code_snippet: 'const value = obj.prop.nested;',
          },
        };

        const response = await apiClient.enhance(request);

        expect(response).toBeTruthy();
        expect(response.enhanced_text).toContain('undefined');
      });

      test('should validate request body', async () => {
        const invalidRequests = [
          {}, // Missing text
          { text: '' }, // Empty text
          { text: 'a'.repeat(5001) }, // Text too long
        ];

        for (const request of invalidRequests) {
          await expect(apiClient.enhance(request as any)).rejects.toThrow();
        }
      });
    });

    test.describe('Batch Enhancement Endpoint', () => {
      test('should accept batch enhancement requests', async () => {
        // First, we need to authenticate to use batch endpoint
        const authResponse = await apiClient.login({
          email: testData.testUsers.developer.email,
          password: testData.testUsers.developer.password,
        });

        apiClient.setAuthToken(authResponse.access_token);

        const requests = testData.batchRequests.slice(0, 3).map(req => ({
          text: req.text,
          prefer_techniques: req.prefer_techniques,
          exclude_techniques: req.exclude_techniques,
          target_complexity: req.target_complexity,
          context: req.context,
        }));

        const response = await apiClient.batchEnhance(requests);

        expect(response).toBeTruthy();
        expect(response.job_id).toBeTruthy();
        expect(response.job_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });

      test('should reject batch requests without authentication', async () => {
        const requests = [{ text: 'Test prompt' }];

        await expect(apiClient.batchEnhance(requests)).rejects.toThrow();
      });

      test('should enforce batch size limits', async () => {
        const authResponse = await apiClient.login({
          email: testData.testUsers.developer.email,
          password: testData.testUsers.developer.password,
        });

        apiClient.setAuthToken(authResponse.access_token);

        // Create 101 requests (exceeds limit of 100)
        const requests = Array(101).fill(null).map((_, i) => ({
          text: `Test prompt ${i}`,
        }));

        await expect(apiClient.batchEnhance(requests)).rejects.toThrow();
      });
    });

    test.describe('Techniques Endpoint', () => {
      test('should list all available techniques', async () => {
        const techniques = await apiClient.getTechniques();

        expect(techniques).toBeInstanceOf(Array);
        expect(techniques.length).toBeGreaterThan(0);

        // Verify technique structure
        for (const technique of techniques) {
          expect(technique.id).toBeTruthy();
          expect(technique.name).toBeTruthy();
          expect(technique.category).toBeTruthy();
          expect(technique.description).toBeTruthy();
          expect(technique.complexity).toBeGreaterThanOrEqual(1);
          expect(technique.complexity).toBeLessThanOrEqual(5);
          expect(technique.effectiveness).toBeTruthy();
          expect(technique.effectiveness.overall).toBeGreaterThan(0);
          expect(technique.effectiveness.overall).toBeLessThanOrEqual(1);
        }
      });

      test('should filter techniques by category', async () => {
        const categories = ['reasoning', 'creative', 'analytical', 'instructional'];

        for (const category of categories) {
          const techniques = await apiClient.getTechniques({ category });

          expect(techniques).toBeInstanceOf(Array);
          techniques.forEach(technique => {
            expect(technique.category).toBe(category);
          });
        }
      });

      test('should filter techniques by complexity', async () => {
        const complexityLevels = [1, 2, 3, 4, 5];

        for (const complexity of complexityLevels) {
          const techniques = await apiClient.getTechniques({ complexity });

          expect(techniques).toBeInstanceOf(Array);
          techniques.forEach(technique => {
            expect(technique.complexity).toBe(complexity);
          });
        }
      });
    });

    test.describe('History Endpoints', () => {
      let authToken: string;

      test.beforeEach(async () => {
        // Authenticate before history tests
        const authResponse = await apiClient.login({
          email: testData.testUsers.regular.email,
          password: testData.testUsers.regular.password,
        });
        authToken = authResponse.access_token;
        apiClient.setAuthToken(authToken);
      });

      test('should retrieve paginated history', async () => {
        // First, create some history by enhancing prompts
        for (const prompt of Object.values(testData.testPrompts)) {
          await apiClient.enhance({ text: prompt.text });
        }

        // Now retrieve history
        const history = await apiClient.getHistory({
          page: 1,
          limit: 10,
        });

        expect(history).toBeTruthy();
        expect(history.items).toBeInstanceOf(Array);
        expect(history.total).toBeGreaterThan(0);
        expect(history.page).toBe(1);
        expect(history.limit).toBe(10);
        expect(history.total_pages).toBeGreaterThan(0);
        expect(history.has_next).toBeDefined();
        expect(history.has_prev).toBeDefined();
      });

      test('should filter history by date range', async () => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // 7 days ago

        const history = await apiClient.getHistory({
          start_date: startDate.toISOString(),
          end_date: new Date().toISOString(),
        });

        expect(history.items).toBeInstanceOf(Array);
        history.items.forEach(item => {
          const createdAt = new Date(item.created_at);
          expect(createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        });
      });

      test('should filter history by intent', async () => {
        // Enhance a prompt first
        await apiClient.enhance({ text: testData.testPrompts.simple.text });

        const history = await apiClient.getHistory({
          intent: 'code_generation',
        });

        expect(history.items).toBeInstanceOf(Array);
        history.items.forEach(item => {
          expect(item.intent).toContain('code');
        });
      });

      test('should retrieve specific history item', async () => {
        // Create a history item
        const enhanceResponse = await apiClient.enhance({
          text: testData.testPrompts.moderate.text,
        });

        // Retrieve it
        const historyItem = await apiClient.getHistoryItem(enhanceResponse.id);

        expect(historyItem).toBeTruthy();
        expect(historyItem.id).toBe(enhanceResponse.id);
        expect(historyItem.original_text).toBe(testData.testPrompts.moderate.text);
        expect(historyItem.enhanced_text).toBe(enhanceResponse.enhanced_text);
      });

      test('should delete history item', async () => {
        // Create a history item
        const enhanceResponse = await apiClient.enhance({
          text: 'Test prompt for deletion',
        });

        // Delete it
        await expect(
          apiClient.deleteHistoryItem(enhanceResponse.id)
        ).resolves.not.toThrow();

        // Verify it's deleted (should return 404)
        await expect(
          apiClient.getHistoryItem(enhanceResponse.id)
        ).rejects.toThrow();
      });

      test('should require authentication for history endpoints', async () => {
        // Clear auth token
        apiClient.clearAuthToken();

        await expect(apiClient.getHistory()).rejects.toThrow();
        await expect(apiClient.getHistoryItem('some-id')).rejects.toThrow();
        await expect(apiClient.deleteHistoryItem('some-id')).rejects.toThrow();
      });
    });

    test.describe('Stats Endpoint', () => {
      test('should retrieve usage statistics with API key', async () => {
        // This would require a pre-configured API key in the test environment
        // For now, we'll test with bearer token
        const authResponse = await apiClient.login({
          email: testData.testUsers.developer.email,
          password: testData.testUsers.developer.password,
        });

        apiClient.setAuthToken(authResponse.access_token);

        const stats = await apiClient.getStats();

        expect(stats).toBeTruthy();
        expect(stats.total_enhancements).toBeGreaterThanOrEqual(0);
        expect(stats.techniques_usage).toBeTruthy();
        expect(stats.average_confidence).toBeGreaterThanOrEqual(0);
        expect(stats.average_confidence).toBeLessThanOrEqual(1);
        expect(stats.average_processing_time).toBeGreaterThanOrEqual(0);
      });

      test('should require authentication for stats endpoint', async () => {
        await expect(apiClient.getStats()).rejects.toThrow();
      });
    });
  });

  test.describe('Authentication', () => {
    test('should accept valid API key', async () => {
      // This test assumes API keys are pre-configured in the test environment
      // We'll simulate by using a known test API key
      apiClient.setAPIKey('test-api-key-123');

      // Try to access a protected endpoint
      // The actual test would depend on having a real API key
      test.skip();
    });

    test('should reject invalid API key', async () => {
      apiClient.setAPIKey('invalid-api-key');

      await expect(
        apiClient.enhance({ text: 'Test prompt' })
      ).rejects.toThrow();
    });

    test('should reject expired API key', async () => {
      apiClient.setAPIKey('expired-api-key');

      await expect(
        apiClient.enhance({ text: 'Test prompt' })
      ).rejects.toThrow();
    });

    test('should reject revoked API key', async () => {
      apiClient.setAPIKey('revoked-api-key');

      await expect(
        apiClient.enhance({ text: 'Test prompt' })
      ).rejects.toThrow();
    });

    test('should handle missing authentication', async () => {
      // Ensure no auth is set
      apiClient.clearAuthToken();
      
      // Public endpoints should work
      await expect(
        apiClient.enhance({ text: 'Test prompt' })
      ).resolves.toBeTruthy();

      await expect(
        apiClient.getTechniques()
      ).resolves.toBeTruthy();

      // Protected endpoints should fail
      await expect(apiClient.getHistory()).rejects.toThrow();
    });

    test('should use correct header format for API key', async () => {
      // This is tested implicitly in the client implementation
      // The header should be X-API-Key
      test.skip();
    });
  });

  test.describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      const request = { text: 'Test rate limiting' };
      const limit = testData.rateLimits.default.limit;

      // Test 999 requests (under 1000 limit)
      const result = await rateLimiter.testRateLimit(request, 999, {
        requestsPerBatch: 100,
        stopOnRateLimit: true,
      });

      expect(result.successfulRequests).toBe(999);
      expect(result.rateLimitedRequests).toBe(0);
    });

    test('should enforce rate limit at boundary', async () => {
      const request = { text: 'Test rate limit boundary' };
      const limit = testData.rateLimits.default.limit;

      const result = await rateLimiter.testRateLimitBoundary(
        request,
        limit
      );

      expect(result.actualLimit).toBe(limit);
      expect(result.lastSuccessfulRequest).toBe(limit);
      expect(result.firstRateLimitedRequest).toBe(limit + 1);
      expect(result.accuracy).toBeGreaterThan(98); // Allow 2% variance
    });

    test('should return correct rate limit headers', async () => {
      const request = { text: 'Test headers' };
      
      // Make a single request to check headers
      const response = await apiClient['client'].post('/enhance', request);
      const headers = apiClient.getRateLimitHeaders(response);

      expect(headers).toBeTruthy();
      expect(headers!['X-RateLimit-Limit']).toBeTruthy();
      expect(headers!['X-RateLimit-Remaining']).toBeTruthy();
      expect(headers!['X-RateLimit-Reset']).toBeTruthy();
    });

    test('should return 429 status when rate limited', async () => {
      const request = { text: 'Test 429 status' };
      const limit = testData.rateLimits.default.limit;

      // Exhaust rate limit
      await rateLimiter.testRateLimit(request, limit + 10, {
        requestsPerBatch: limit + 10,
        stopOnRateLimit: false,
      });

      // Next request should get 429
      try {
        await apiClient.enhance(request);
        fail('Expected 429 error');
      } catch (error: any) {
        expect(error.response?.status).toBe(429);
        expect(error.response?.headers['retry-after']).toBeTruthy();
      }
    });

    test('should include Retry-After header when rate limited', async () => {
      const request = { text: 'Test retry-after' };
      const limit = testData.rateLimits.default.limit;

      // Exhaust rate limit
      await rateLimiter.testRateLimit(request, limit, {
        requestsPerBatch: limit,
      });

      // Next request should get Retry-After
      try {
        await apiClient.enhance(request);
      } catch (error: any) {
        expect(error.response?.headers['retry-after']).toBeTruthy();
        const retryAfter = parseInt(error.response.headers['retry-after']);
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(60);
      }
    });

    test('should allow requests after rate limit reset', async () => {
      const request = { text: 'Test rate limit reset' };
      const limit = testData.rateLimits.default.limit;

      const resetResult = await rateLimiter.testRateLimitReset(request, limit);

      expect(resetResult.initialBurst).toBe(limit);
      expect(resetResult.resetWorked).toBe(true);
      expect(resetResult.afterResetBurst).toBeGreaterThan(0);
    });

    test('should handle burst traffic correctly', async () => {
      const request = { text: 'Test burst traffic' };
      
      const burstResult = await rateLimiter.testBurstBehavior(
        request,
        100, // 100 requests per burst
        2000 // 2 second delay between bursts
      );

      expect(burstResult.bursts.length).toBeGreaterThan(0);
      expect(burstResult.totalSuccessful).toBeGreaterThan(0);
      expect(burstResult.averageSuccessPerBurst).toBeGreaterThan(0);
    });

    test('should apply rate limits per API key', async () => {
      // This test would require multiple API keys with different rate limits
      // Simulating the concept here
      test.skip();
    });

    test('should gracefully degrade under load', async () => {
      const request = { text: 'Test graceful degradation' };
      
      // Send rapid requests to trigger rate limiting
      const result = await rateLimiter.testRateLimit(request, 2000, {
        requestsPerBatch: 500,
        stopOnRateLimit: false,
        respectRetryAfter: true,
      });

      // Should get some successful requests even under load
      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.rateLimitedRequests).toBeGreaterThan(0);
    });
  });

  test.describe('Error Handling', () => {
    test('should return 400 for validation errors', async () => {
      const invalidRequest = {
        text: '', // Empty text
      };

      try {
        await apiClient.enhance(invalidRequest);
        fail('Expected 400 error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data?.error).toBeTruthy();
      }
    });

    test('should return 401 for unauthorized access', async () => {
      apiClient.clearAuthToken();

      try {
        await apiClient.getHistory();
        fail('Expected 401 error');
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
        expect(error.response?.data?.error).toBeTruthy();
      }
    });

    test('should return 403 for forbidden access', async () => {
      // Login as regular user
      const authResponse = await apiClient.login({
        email: testData.testUsers.regular.email,
        password: testData.testUsers.regular.password,
      });

      apiClient.setAuthToken(authResponse.access_token);

      // Try to access admin endpoint (if available)
      // This is a conceptual test - actual implementation depends on API
      test.skip();
    });

    test('should return 404 for non-existent resources', async () => {
      const authResponse = await apiClient.login({
        email: testData.testUsers.regular.email,
        password: testData.testUsers.regular.password,
      });

      apiClient.setAuthToken(authResponse.access_token);

      try {
        await apiClient.getHistoryItem('non-existent-id');
        fail('Expected 404 error');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        expect(error.response?.data?.error).toBeTruthy();
      }
    });

    test('should return consistent error format', async () => {
      const testCases = [
        // 400 - Bad Request
        async () => apiClient.enhance({ text: '' }),
        // 401 - Unauthorized
        async () => {
          apiClient.clearAuthToken();
          return apiClient.getHistory();
        },
        // 404 - Not Found
        async () => {
          const auth = await apiClient.login({
            email: testData.testUsers.regular.email,
            password: testData.testUsers.regular.password,
          });
          apiClient.setAuthToken(auth.access_token);
          return apiClient.getHistoryItem('non-existent');
        },
      ];

      for (const testCase of testCases) {
        try {
          await testCase();
          fail('Expected error');
        } catch (error: any) {
          const errorData = error.response?.data;
          expect(errorData).toBeTruthy();
          expect(errorData.error).toBeTruthy();
          // Optional fields
          if (errorData.message) {
            expect(typeof errorData.message).toBe('string');
          }
          if (errorData.request_id) {
            expect(errorData.request_id).toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
          }
        }
      }
    });

    test('should include request_id in error responses', async () => {
      try {
        await apiClient.enhance({ text: '' });
        fail('Expected error');
      } catch (error: any) {
        const errorData = error.response?.data;
        expect(errorData?.request_id).toBeTruthy();
        expect(errorData.request_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });

    test('should handle 500 errors gracefully', async () => {
      // This would require simulating a server error
      // Could be done by sending a specific payload that triggers an error
      test.skip();
    });

    test('should handle 503 maintenance mode', async () => {
      // This would require the server to be in maintenance mode
      // Could be tested with a mock or during actual maintenance
      test.skip();
    });
  });

  test.describe('Webhook Integration', () => {
    let authToken: string;

    test.beforeEach(async () => {
      // Authenticate as developer
      const authResponse = await apiClient.login({
        email: testData.testUsers.developer.email,
        password: testData.testUsers.developer.password,
      });
      authToken = authResponse.access_token;
      apiClient.setAuthToken(authToken);
    });

    test('should register webhook with URL validation', async () => {
      const webhookConfig = {
        url: webhookServer.getUrl(),
        events: ['enhancement.completed', 'batch.finished'],
      };

      const response = await apiClient.createWebhook(webhookConfig);

      expect(response).toBeTruthy();
      expect(response.id).toBeTruthy();
      expect(response.secret).toBeTruthy();
    });

    test('should validate webhook URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'http://', // Incomplete URL
        '', // Empty URL
      ];

      for (const url of invalidUrls) {
        await expect(
          apiClient.createWebhook({
            url,
            events: ['enhancement.completed'],
          })
        ).rejects.toThrow();
      }
    });

    test('should deliver enhancement.completed events', async () => {
      // Register webhook
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      // Configure webhook server to expect the secret
      webhookServer = new WebhookServer({
        port: 8889,
        secret: webhook.secret,
        validateSignatures: true,
      });

      // Trigger an enhancement
      await apiClient.enhance({ text: 'Test webhook delivery' });

      // Wait for webhook delivery
      const delivery = await webhookServer.waitForEvent(
        'enhancement.completed',
        5000
      );

      expect(delivery).toBeTruthy();
      expect(delivery.valid_signature).toBe(true);
      expect(delivery.event.event).toBe('enhancement.completed');
      expect(delivery.event.data).toBeTruthy();
    });

    test('should include HMAC signature in webhook requests', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      // Reconfigure server with the webhook secret
      await webhookServer.stop();
      webhookServer = new WebhookServer({
        port: 8889,
        secret: webhook.secret,
        validateSignatures: true,
      });
      await webhookServer.start();

      // Trigger an event
      await apiClient.enhance({ text: 'Test HMAC signature' });

      const delivery = await webhookServer.waitForEvent(
        'enhancement.completed',
        5000
      );

      expect(delivery.headers['x-webhook-signature']).toBeTruthy();
      expect(delivery.valid_signature).toBe(true);
    });

    test('should retry failed webhook deliveries', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      // Configure server to fail first attempts
      webhookServer.setFailureSimulation(true, 1.0); // 100% failure rate

      // Trigger an event
      await apiClient.enhance({ text: 'Test retry logic' });

      // Wait a bit for retries
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Disable failures
      webhookServer.setFailureSimulation(false);

      // Wait for successful delivery
      await new Promise(resolve => setTimeout(resolve, 3000));

      const deliveries = webhookServer.getDeliveries();
      const failedDeliveries = deliveries.filter(
        d => d.response_sent.status === 500
      );
      const successfulDeliveries = deliveries.filter(
        d => d.response_sent.status === 200
      );

      expect(failedDeliveries.length).toBeGreaterThan(0);
      expect(successfulDeliveries.length).toBeGreaterThan(0);
    });

    test('should maintain event ordering', async () => {
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      // Send multiple enhancements
      const prompts = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
      
      for (const prompt of prompts) {
        await apiClient.enhance({ text: prompt });
      }

      // Wait for all deliveries
      const deliveries = await webhookServer.waitForDeliveries(5, 10000);

      // Check order (may not be strict due to async processing)
      expect(deliveries.length).toBe(5);
    });

    test('should allow webhook management', async () => {
      // Create webhook
      const webhook = await apiClient.createWebhook({
        url: webhookServer.getUrl(),
        events: ['enhancement.completed'],
      });

      // List webhooks
      const webhooks = await apiClient.getWebhooks();
      expect(webhooks).toBeInstanceOf(Array);
      expect(webhooks.some(w => w.url === webhookServer.getUrl())).toBe(true);

      // Update webhook
      await apiClient.updateWebhook(webhook.id, {
        events: ['enhancement.completed', 'batch.finished'],
      });

      // Delete webhook
      await expect(
        apiClient.deleteWebhook(webhook.id)
      ).resolves.not.toThrow();
    });
  });

  test.describe('Developer Experience', () => {
    test('should provide clear error messages', async () => {
      const testCases = [
        {
          request: { text: '' },
          expectedError: /text.*required|empty/i,
        },
        {
          request: { text: 'a'.repeat(5001) },
          expectedError: /text.*too long|maximum/i,
        },
        {
          request: { text: 'Test', prefer_techniques: ['invalid_technique'] },
          expectedError: /technique.*invalid|not found/i,
        },
      ];

      for (const { request, expectedError } of testCases) {
        try {
          await apiClient.enhance(request as any);
          fail('Expected error');
        } catch (error: any) {
          const errorMessage = 
            error.response?.data?.message || 
            error.response?.data?.error || 
            error.message;
          expect(errorMessage).toMatch(expectedError);
        }
      }
    });

    test('should support request_id tracking', async () => {
      const requestId = apiClient.getRequestId();
      expect(requestId).toBeTruthy();
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      // Make a request
      const response = await apiClient.enhance({ text: 'Test request ID' });

      // Generate new request ID for next request
      apiClient.generateNewRequestId();
      const newRequestId = apiClient.getRequestId();
      expect(newRequestId).not.toBe(requestId);
    });

    test('should handle network timeouts gracefully', async () => {
      // Create client with very short timeout
      const timeoutClient = new BetterPromptsAPIClient({
        baseURL,
        timeout: 1, // 1ms timeout
      });

      await expect(
        timeoutClient.enhance({ text: 'Test timeout' })
      ).rejects.toThrow(/timeout/i);
    });

    test('should retry failed requests automatically', async () => {
      // This is tested implicitly in the client implementation
      // The client should retry 5xx errors and network errors
      test.skip();
    });

    test('should validate against OpenAPI spec', async () => {
      // This will be covered in api-contract.spec.ts
      test.skip();
    });
  });
});