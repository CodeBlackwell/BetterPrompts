import { test, expect, APIRequestContext } from '@playwright/test';
import { RateLimitHeaderValidator } from './utils/rate-limit-header-validator';
import { RateLimitTester } from './utils/rate-limit-tester';

test.describe('Rate Limit Headers Validation', () => {
  let apiContext: APIRequestContext;
  let headerValidator: RateLimitHeaderValidator;
  let rateLimitTester: RateLimitTester;
  const baseURL = process.env.API_BASE_URL || 'http://localhost/api/v1';
  
  const testConfig = {
    apiKey: 'test-key-headers',
    perUserLimit: 1000,
    windowDuration: 60000,
  };

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
    });
    
    headerValidator = new RateLimitHeaderValidator();
    rateLimitTester = new RateLimitTester(apiContext, baseURL);
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Required Headers', () => {
    test('should include all required headers on 200 response', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey },
        data: { text: 'Test required headers' },
      });

      expect(response.ok()).toBe(true);

      const validation = headerValidator.validateSuccessHeaders(response);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.headers.limit).toBeDefined();
      expect(validation.headers.remaining).toBeDefined();
      expect(validation.headers.reset).toBeDefined();
    });

    test('should parse header values correctly', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey },
        data: { text: 'Test header parsing' },
      });

      const validation = headerValidator.validateSuccessHeaders(response);
      
      expect(validation.parsedValues.limit).toBe(testConfig.perUserLimit);
      expect(validation.parsedValues.remaining).toBeGreaterThanOrEqual(0);
      expect(validation.parsedValues.remaining).toBeLessThanOrEqual(testConfig.perUserLimit);
      expect(validation.parsedValues.reset).toBeInstanceOf(Date);
      expect(validation.parsedValues.reset!.getTime()).toBeGreaterThan(Date.now());
    });

    test('should validate header value formats', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey },
        data: { text: 'Test header formats' },
      });

      const headers = response.headers();
      
      // Limit should be a positive integer
      expect(headers['x-ratelimit-limit']).toMatch(/^\d+$/);
      expect(parseInt(headers['x-ratelimit-limit'])).toBeGreaterThan(0);
      
      // Remaining should be a non-negative integer
      expect(headers['x-ratelimit-remaining']).toMatch(/^\d+$/);
      expect(parseInt(headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
      
      // Reset should be a Unix timestamp
      expect(headers['x-ratelimit-reset']).toMatch(/^\d+$/);
      expect(parseInt(headers['x-ratelimit-reset'])).toBeGreaterThan(Date.now() / 1000);
    });
  });

  test.describe('Optional Headers', () => {
    test('should include reset-after header when present', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey },
        data: { text: 'Test reset-after header' },
      });

      const validation = headerValidator.validateSuccessHeaders(response, {
        requireOptional: true,
      });

      if (validation.headers.resetAfter) {
        expect(validation.parsedValues.resetAfter).toBeGreaterThan(0);
        expect(validation.parsedValues.resetAfter).toBeLessThanOrEqual(testConfig.windowDuration / 1000);
      } else {
        // It's optional, so just note it in warnings
        expect(validation.warnings).toContain('Missing optional header: x-ratelimit-reset-after');
      }
    });

    test('should include bucket identifier when using bucketed rate limiting', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey },
        data: { text: 'Test bucket header' },
      });

      const validation = headerValidator.validateSuccessHeaders(response);

      if (validation.headers.bucket) {
        expect(validation.parsedValues.bucket).toBeTruthy();
        // Bucket format depends on implementation
        expect(validation.parsedValues.bucket).toMatch(/^[a-zA-Z0-9_-]+$/);
      }
    });
  });

  test.describe('429 Response Headers', () => {
    test('should include Retry-After header on 429', async () => {
      // First exhaust the rate limit
      await rateLimitTester.testPerUserRateLimit(
        testConfig.apiKey + '-429',
        testConfig.perUserLimit + 10,
        { stopOnRateLimit: false }
      );

      // Make another request to get 429
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey + '-429' },
        data: { text: 'Test 429 headers' },
        failOnStatusCode: false,
      });

      expect(response.status()).toBe(429);

      const validation = headerValidator.validate429Headers(response);
      
      expect(validation.valid).toBe(true);
      expect(validation.headers.retryAfter).toBeDefined();
      expect(validation.parsedValues.retryAfter).toBeGreaterThan(0);
    });

    test('should support both seconds and HTTP-date formats for Retry-After', async () => {
      // Exhaust rate limit
      await rateLimitTester.testPerUserRateLimit(
        testConfig.apiKey + '-retry-format',
        testConfig.perUserLimit + 10,
        { stopOnRateLimit: false }
      );

      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey + '-retry-format' },
        data: { text: 'Test retry-after format' },
        failOnStatusCode: false,
      });

      const retryAfter = response.headers()['retry-after'];
      expect(retryAfter).toBeDefined();

      // Check if it's seconds (numeric) or HTTP-date
      if (/^\d+$/.test(retryAfter)) {
        // Seconds format
        expect(parseInt(retryAfter)).toBeGreaterThan(0);
        expect(parseInt(retryAfter)).toBeLessThanOrEqual(testConfig.windowDuration / 1000);
      } else {
        // HTTP-date format
        const date = new Date(retryAfter);
        expect(date.getTime()).toBeGreaterThan(Date.now());
        expect(date.getTime()).toBeLessThan(Date.now() + testConfig.windowDuration);
      }
    });

    test('should still include rate limit headers on 429', async () => {
      // Exhaust rate limit
      await rateLimitTester.testPerUserRateLimit(
        testConfig.apiKey + '-429-ratelimit',
        testConfig.perUserLimit + 10,
        { stopOnRateLimit: false }
      );

      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey + '-429-ratelimit' },
        data: { text: 'Test 429 rate limit headers' },
        failOnStatusCode: false,
      });

      const validation = headerValidator.validate429Headers(response);
      
      // Should have rate limit headers even on 429
      if (validation.headers.limit) {
        expect(validation.parsedValues.limit).toBe(testConfig.perUserLimit);
      }
      
      if (validation.headers.remaining) {
        expect(validation.parsedValues.remaining).toBe(0);
      }
    });
  });

  test.describe('Header Consistency', () => {
    test('should maintain consistent headers across requests', async () => {
      const responses: any[] = [];
      const numRequests = 10;

      // Make sequential requests
      for (let i = 0; i < numRequests; i++) {
        const response = await apiContext.post('/enhance', {
          headers: { 'X-API-Key': testConfig.apiKey + '-consistency' },
          data: { text: `Consistency test ${i}` },
        });
        responses.push(response);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const progression = headerValidator.validateHeaderProgression(responses);
      
      expect(progression.consistent).toBe(true);
      expect(progression.errors).toHaveLength(0);
      
      // All should have same limit
      const limits = progression.progression.map(p => p.limit);
      expect(new Set(limits).size).toBe(1);
      
      // Remaining should decrease monotonically within same window
      for (let i = 1; i < progression.progression.length; i++) {
        const prev = progression.progression[i - 1];
        const curr = progression.progression[i];
        
        if (curr.reset === prev.reset) {
          expect(curr.remaining).toBeLessThanOrEqual(prev.remaining);
        }
      }
    });

    test('should have internally consistent header values', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey },
        data: { text: 'Internal consistency test' },
      });

      const validation = headerValidator.validateSuccessHeaders(response, {
        checkConsistency: true,
      });

      expect(validation.valid).toBe(true);
      
      // Remaining should not exceed limit
      expect(validation.parsedValues.remaining!).toBeLessThanOrEqual(validation.parsedValues.limit!);
      
      // If reset-after is present, it should align with reset time
      if (validation.parsedValues.resetAfter !== undefined) {
        const expectedReset = Date.now() + validation.parsedValues.resetAfter * 1000;
        const actualReset = validation.parsedValues.reset!.getTime();
        const deviation = Math.abs(expectedReset - actualReset);
        
        expect(deviation).toBeLessThan(5000); // Within 5 seconds
      }
    });
  });

  test.describe('Reset Time Accuracy', () => {
    test('should have accurate reset timestamps', async () => {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey },
        data: { text: 'Reset accuracy test' },
      });

      const timing = await headerValidator.checkResetTimingAccuracy(
        response,
        testConfig.windowDuration
      );

      expect(timing.accurate).toBe(true);
      expect(timing.deviation).toBeLessThan(1000); // Within 1 second
      
      // Reset should be at window boundary
      const resetMs = timing.resetTime.getTime();
      expect(resetMs % testConfig.windowDuration).toBeLessThan(1000);
    });

    test('should update reset time when window rolls over', async () => {
      const firstResponse = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey + '-reset-rollover' },
        data: { text: 'First window request' },
      });

      const firstValidation = headerValidator.validateSuccessHeaders(firstResponse);
      const firstReset = firstValidation.parsedValues.reset!;

      // Wait until just after reset time
      const waitTime = firstReset.getTime() - Date.now() + 1000;
      if (waitTime > 0 && waitTime < testConfig.windowDuration) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const secondResponse = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': testConfig.apiKey + '-reset-rollover' },
        data: { text: 'Second window request' },
      });

      const secondValidation = headerValidator.validateSuccessHeaders(secondResponse);
      const secondReset = secondValidation.parsedValues.reset!;

      // Reset time should have advanced
      expect(secondReset.getTime()).toBeGreaterThan(firstReset.getTime());
      
      // Should be roughly one window duration later
      const resetDiff = secondReset.getTime() - firstReset.getTime();
      expect(resetDiff).toBeGreaterThanOrEqual(testConfig.windowDuration - 5000);
      expect(resetDiff).toBeLessThanOrEqual(testConfig.windowDuration + 5000);
      
      // Remaining should have reset to near limit
      expect(secondValidation.parsedValues.remaining!).toBeGreaterThan(
        testConfig.perUserLimit - 10
      );
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle first request of a new window correctly', async () => {
      const uniqueKey = `test-key-first-${Date.now()}`;
      
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': uniqueKey },
        data: { text: 'First request in window' },
      });

      const validation = headerValidator.validateSuccessHeaders(response);
      
      expect(validation.valid).toBe(true);
      expect(validation.parsedValues.limit).toBe(testConfig.perUserLimit);
      expect(validation.parsedValues.remaining).toBe(testConfig.perUserLimit - 1);
    });

    test('should handle requests at exact rate limit boundary', async () => {
      const uniqueKey = `test-key-boundary-${Date.now()}`;
      
      // Make exactly limit number of requests
      const result = await rateLimitTester.testPerUserRateLimit(
        uniqueKey,
        testConfig.perUserLimit
      );

      expect(result.successfulRequests).toBe(testConfig.perUserLimit);
      
      // Last successful request should show remaining = 0
      const lastHeader = result.headers[result.headers.length - 1];
      expect(lastHeader.remaining).toBe(0);
      
      // Next request should be rate limited
      const overLimitResponse = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': uniqueKey },
        data: { text: 'Over limit request' },
        failOnStatusCode: false,
      });
      
      expect(overLimitResponse.status()).toBe(429);
    });

    test('should handle timezone differences correctly', async () => {
      // Make requests with different timezone indicators
      const timezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'UTC',
      ];

      for (const tz of timezones) {
        const response = await apiContext.post('/enhance', {
          headers: { 
            'X-API-Key': testConfig.apiKey,
            'X-Timezone': tz, // If API supports timezone headers
          },
          data: { text: `Timezone test ${tz}` },
        });

        const validation = headerValidator.validateSuccessHeaders(response);
        expect(validation.valid).toBe(true);
        
        // Reset time should be consistent regardless of timezone
        const resetTime = validation.parsedValues.reset!;
        expect(resetTime.getTime()).toBeGreaterThan(Date.now());
        expect(resetTime.getTime()).toBeLessThan(Date.now() + testConfig.windowDuration);
      }
    });
  });
});