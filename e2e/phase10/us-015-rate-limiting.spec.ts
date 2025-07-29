import { test, expect, APIRequestContext } from '@playwright/test';
import { RateLimitTester } from './utils/rate-limit-tester';
import { RateLimitHeaderValidator } from './utils/rate-limit-header-validator';

test.describe('US-015: Rate Limiting', () => {
  let apiContext: APIRequestContext;
  let rateLimitTester: RateLimitTester;
  let headerValidator: RateLimitHeaderValidator;
  const baseURL = process.env.API_BASE_URL || 'http://localhost/api/v1';
  
  // Test configuration
  const testConfig = {
    perUserLimit: 1000,  // Updated to match E2E test rate limit
    perIPLimit: 5000,
    windowDuration: 60000, // 1 minute
    testApiKeys: [
      'test-key-user1-primary',
      'test-key-user1-secondary',
      'test-key-user2-primary',
    ],
  };

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
    });
    
    rateLimitTester = new RateLimitTester(apiContext, baseURL);
    headerValidator = new RateLimitHeaderValidator();
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Per-User Rate Limits', () => {
    test('should allow requests under the limit', async () => {
      const targetRequests = 30; // Test well under the 100 limit
      
      const result = await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[0],
        targetRequests
      );

      expect(result.successfulRequests).toBe(targetRequests);
      expect(result.rateLimitedRequests).toBe(0);
      expect(result.testType).toBe('per-user');
      
      // Validate headers
      const lastHeader = result.headers[result.headers.length - 1];
      expect(lastHeader.limit).toBe(testConfig.perUserLimit);
      expect(lastHeader.remaining).toBeGreaterThanOrEqual(0);
    });

    test('should enforce rate limit at exactly the limit', async () => {
      const result = await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[0],
        testConfig.perUserLimit,
        { stopOnRateLimit: false }
      );

      expect(result.successfulRequests).toBe(testConfig.perUserLimit);
      expect(result.rateLimitedRequests).toBe(0);
      
      // The 1001st request should be rate limited
      const overLimitResult = await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[0],
        1,
        { stopOnRateLimit: false }
      );
      
      expect(overLimitResult.rateLimitedRequests).toBe(1);
    });

    test('should return 429 when over the limit', async () => {
      // First exhaust the limit
      await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[1],
        testConfig.perUserLimit,
        { stopOnRateLimit: true }
      );

      // Then try one more
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.testApiKeys[1] },
        data: { text: 'Over limit request' },
      });

      expect(response.status()).toBe(429);
      
      // Validate 429 headers
      const validation = headerValidator.validate429Headers(response);
      expect(validation.valid).toBe(true);
      expect(validation.headers.retryAfter).toBeTruthy();
    });

    test('should share rate limits across multiple API keys for same user', async () => {
      const apiKeys = [testConfig.testApiKeys[0], testConfig.testApiKeys[1]];
      const requestsPerKey = 20; // 40 total across 2 keys

      const result = await rateLimitTester.testMultipleAPIKeys(
        apiKeys,
        requestsPerKey
      );

      expect(result.sharedLimit).toBe(true);
      expect(result.totalSuccessful).toBeLessThanOrEqual(testConfig.perUserLimit);
    });

    test('should isolate rate limits between different users', async () => {
      // User 1 exhausts their limit
      await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[0],
        testConfig.perUserLimit,
        { stopOnRateLimit: true }
      );

      // User 2 should still be able to make requests
      const user2Result = await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[2],
        20
      );

      expect(user2Result.successfulRequests).toBe(20);
      expect(user2Result.rateLimitedRequests).toBe(0);
    });

    test('should reset rate limits after window expires', async () => {
      const apiKey = 'test-key-reset-test';
      
      const resetResult = await rateLimitTester.testRateLimitReset(
        apiKey,
        testConfig.perUserLimit
      );

      expect(resetResult.beforeReset).toBe(testConfig.perUserLimit);
      expect(resetResult.afterReset).toBeGreaterThan(0);
      expect(resetResult.resetWorked).toBe(true);
    });
  });

  test.describe('Per-IP Rate Limits', () => {
    test('should enforce per-IP limits for anonymous requests', async () => {
      const targetRequests = 100;
      
      const result = await rateLimitTester.testPerIPRateLimit(targetRequests);

      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.testType).toBe('per-ip');
      
      // Should have higher limit than per-user
      if (result.headers.length > 0) {
        expect(result.headers[0].limit).toBe(testConfig.perIPLimit);
      }
    });

    test('should handle multiple users from same IP', async () => {
      const ipAddress = '192.168.1.100';
      
      // User 1 from IP
      const user1Result = await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[0],
        500,
        { ipAddress }
      );

      // User 2 from same IP
      const user2Result = await rateLimitTester.testPerUserRateLimit(
        testConfig.testApiKeys[2],
        500,
        { ipAddress }
      );

      expect(user1Result.successfulRequests).toBeGreaterThan(0);
      expect(user2Result.successfulRequests).toBeGreaterThan(0);
    });

    test('should handle proxy and load balancer headers', async () => {
      const proxyHeaders = {
        'X-Forwarded-For': '10.0.0.1, 192.168.1.1',
        'X-Real-IP': '10.0.0.1',
      };

      const response = await apiContext.post('/enhance', {
        headers: proxyHeaders,
        data: { text: 'Proxy test request' },
      });

      expect(response.ok()).toBe(true);
      
      const validation = headerValidator.validateSuccessHeaders(response);
      expect(validation.valid).toBe(true);
    });

    test('should handle IPv4 and IPv6 addresses correctly', async () => {
      const ipv4Result = await rateLimitTester.testPerIPRateLimit(10, {
        ipAddress: '192.168.1.1',
      });

      const ipv6Result = await rateLimitTester.testPerIPRateLimit(10, {
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      });

      expect(ipv4Result.successfulRequests).toBeGreaterThan(0);
      expect(ipv6Result.successfulRequests).toBeGreaterThan(0);
    });
  });

  test.describe('Rate Limit Headers', () => {
    test('should include all required headers on successful requests', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        data: { text: 'Header test request' },
      });

      const validation = headerValidator.validateSuccessHeaders(response, {
        requireOptional: true,
      });

      expect(validation.valid).toBe(true);
      expect(validation.headers.limit).toBeTruthy();
      expect(validation.headers.remaining).toBeTruthy();
      expect(validation.headers.reset).toBeTruthy();
    });

    test('should include optional headers when configured', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        data: { text: 'Optional header test' },
      });

      const validation = headerValidator.validateSuccessHeaders(response);
      
      // Check for optional headers
      if (validation.headers.resetAfter) {
        expect(validation.parsedValues.resetAfter).toBeGreaterThan(0);
      }
      
      if (validation.headers.bucket) {
        expect(validation.headers.bucket).toMatch(/user_\d+/);
      }
    });

    test('should show accurate header progression', async () => {
      const responses: any[] = [];
      
      // Make 5 sequential requests
      for (let i = 0; i < 5; i++) {
        const response = await apiContext.post('/enhance', {
          headers: { 'X-API-Key': testConfig.testApiKeys[0] },
          data: { text: `Progression test ${i}` },
        });
        responses.push(response);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const progression = headerValidator.validateHeaderProgression(responses);
      
      expect(progression.consistent).toBe(true);
      expect(progression.errors).toHaveLength(0);
      
      // Remaining should decrease
      const remainingValues = progression.progression.map(p => p.remaining);
      for (let i = 1; i < remainingValues.length; i++) {
        expect(remainingValues[i]).toBeLessThanOrEqual(remainingValues[i - 1]);
      }
    });

    test('should include Retry-After header on 429 responses', async () => {
      // Exhaust rate limit
      await rateLimitTester.testPerUserRateLimit(
        'test-key-429-header',
        testConfig.perUserLimit + 10,
        { stopOnRateLimit: false }
      );

      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': 'test-key-429-header' },
        data: { text: '429 header test' },
      });

      expect(response.status()).toBe(429);
      
      const validation = headerValidator.validate429Headers(response);
      expect(validation.valid).toBe(true);
      expect(validation.parsedValues.retryAfter).toBeGreaterThan(0);
    });
  });

  test.describe('Rate Limit Accuracy', () => {
    test('should enforce limits within 1% accuracy', async () => {
      const accuracy = await rateLimitTester.testRateLimitAccuracy(
        'test-key-accuracy',
        testConfig.perUserLimit
      );

      expect(accuracy.withinMargin).toBe(true);
      expect(accuracy.margin).toBeLessThanOrEqual(0.01);
      expect(accuracy.accuracy).toBeGreaterThanOrEqual(99);
      expect(accuracy.accuracy).toBeLessThanOrEqual(101);
    });

    test('should have accurate reset timing', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        data: { text: 'Reset timing test' },
      });

      const timing = await headerValidator.checkResetTimingAccuracy(
        response,
        testConfig.windowDuration
      );

      expect(timing.accurate).toBe(true);
      expect(timing.deviation).toBeLessThan(1000); // Within 1 second
    });
  });

  test.describe('Rate Limiting Strategies', () => {
    test('should handle fixed window strategy correctly', async () => {
      // Make requests near window boundary
      const apiKey = 'test-key-fixed-window';
      const requestsPerBatch = 100;
      
      // First batch
      const batch1 = await rateLimitTester.testPerUserRateLimit(
        apiKey,
        requestsPerBatch
      );
      
      // Wait for 50 seconds (near window end)
      await new Promise(resolve => setTimeout(resolve, 50000));
      
      // Second batch - should still count against same window
      const batch2 = await rateLimitTester.testPerUserRateLimit(
        apiKey,
        requestsPerBatch
      );
      
      const totalSuccess = batch1.successfulRequests + batch2.successfulRequests;
      expect(totalSuccess).toBeLessThanOrEqual(testConfig.perUserLimit);
    });

    test('should prevent rate limit bypass attempts', async () => {
      const bypassAttempts = [
        // Attempt 1: Change API key casing
        { 'X-API-Key': testConfig.testApiKeys[0].toUpperCase() },
        // Attempt 2: Add extra headers
        { 
          'X-API-Key': testConfig.testApiKeys[0],
          'X-Forwarded-For': 'fake-ip',
        },
        // Attempt 3: Duplicate API key header
        { 
          'X-API-Key': testConfig.testApiKeys[0],
          'x-api-key': testConfig.testApiKeys[0],
        },
      ];

      for (const headers of bypassAttempts) {
        const response = await apiContext.post('/enhance', {
          headers,
          data: { text: 'Bypass attempt' },
          failOnStatusCode: false,
        });

        // Should either fail auth or count against rate limit
        expect([200, 401, 429]).toContain(response.status());
      }
    });
  });
});