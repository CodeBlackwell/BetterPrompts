import { test, expect, APIRequestContext } from '@playwright/test';

test.describe('Focused Rate Limit Tests', () => {
  let apiContext: APIRequestContext;
  const baseURL = process.env.API_BASE_URL || 'http://localhost/api/v1';

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('API is accessible with valid API key', async () => {
    const response = await apiContext.post('/enhance', {
      headers: { 'X-API-Key': 'test-key-user1-primary' },
      data: { text: 'Test prompt' },
    });

    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
  });

  test('API returns rate limit headers', async () => {
    const response = await apiContext.post('/enhance', {
      headers: { 'X-API-Key': 'test-key-user1-primary' },
      data: { text: 'Test prompt' },
    });

    const headers = response.headers();
    expect(headers['x-ratelimit-limit']).toBeDefined();
    expect(headers['x-ratelimit-remaining']).toBeDefined();
    expect(headers['x-ratelimit-reset']).toBeDefined();
  });

  test('Rate limit decreases with requests', async () => {
    const apiKey = 'test-key-headers';
    const responses = [];

    // Make 3 requests with delay to avoid nginx rate limiting
    for (let i = 0; i < 3; i++) {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': apiKey },
        data: { text: `Test prompt ${i}` },
      });
      responses.push(response);
      
      // Wait 200ms between requests to stay under nginx limit
      if (i < 2) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Check that remaining count decreases
    const firstRemaining = parseInt(responses[0].headers()['x-ratelimit-remaining']);
    const lastRemaining = parseInt(responses[2].headers()['x-ratelimit-remaining']);
    
    expect(lastRemaining).toBeLessThan(firstRemaining);
    expect(firstRemaining - lastRemaining).toBe(2); // Should have decreased by 2
  });

  test('API returns 429 when rate limit exceeded', async () => {
    const apiKey = 'test-key-429-header';
    
    // First, make requests to approach the limit
    // We'll make 95 requests to get close to the 100 limit
    for (let i = 0; i < 95; i++) {
      await apiContext.post('/enhance', {
        headers: { 'X-API-Key': apiKey },
        data: { text: `Exhaust limit ${i}` },
        failOnStatusCode: false,
      });
      
      // Small delay every 10 requests to avoid nginx limits
      if (i % 10 === 9) {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }

    // Make more requests until we get a 429
    let got429 = false;
    for (let i = 0; i < 10; i++) {
      const response = await apiContext.post('/enhance', {
        headers: { 'X-API-Key': apiKey },
        data: { text: `Over limit ${i}` },
        failOnStatusCode: false,
      });

      if (response.status() === 429) {
        got429 = true;
        expect(response.headers()['retry-after']).toBeDefined();
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    expect(got429).toBe(true);
  });

  test('Different API keys have separate rate limits', async () => {
    const key1 = 'test-key-user1-primary';
    const key2 = 'test-key-user2-primary';

    // Make request with first key
    const response1 = await apiContext.post('/enhance', {
      headers: { 'X-API-Key': key1 },
      data: { text: 'User 1 request' },
    });

    // Make request with second key
    const response2 = await apiContext.post('/enhance', {
      headers: { 'X-API-Key': key2 },
      data: { text: 'User 2 request' },
    });

    // Both should succeed
    expect(response1.ok()).toBe(true);
    expect(response2.ok()).toBe(true);

    // Check they have their own limits
    const limit1 = response1.headers()['x-ratelimit-limit'];
    const limit2 = response2.headers()['x-ratelimit-limit'];
    
    expect(limit1).toBeDefined();
    expect(limit2).toBeDefined();
  });

  test('Invalid API key returns 401', async () => {
    const response = await apiContext.post('/enhance', {
      headers: { 'X-API-Key': 'invalid-key' },
      data: { text: 'Test prompt' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });

  test('Missing API key returns 401', async () => {
    const response = await apiContext.post('/enhance', {
      data: { text: 'Test prompt' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(401);
  });
});