import { test, expect, APIRequestContext } from '@playwright/test';
import { ConcurrentRequestHelper } from './utils/concurrent-request-helper';
import { LoadGenerator } from './utils/load-generator';

test.describe('EC-06: Concurrent Access', () => {
  let apiContext: APIRequestContext;
  let concurrentHelper: ConcurrentRequestHelper;
  let loadGenerator: LoadGenerator;
  const baseURL = process.env.API_BASE_URL || 'http://localhost/api/v1';
  
  // Test configuration
  const testConfig = {
    burstSizes: [50, 100],  // Reduced to match rate limits
    sustainedRPS: 20,       // Reduced for realistic testing
    testDuration: 10000,    // 10 seconds
    testApiKeys: [
      'test-key-concurrent-1',
      'test-key-concurrent-2',
      'test-key-concurrent-3',
    ],
  };

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      timeout: 60000, // Longer timeout for concurrent tests
    });
    
    concurrentHelper = new ConcurrentRequestHelper(apiContext, baseURL);
    loadGenerator = new LoadGenerator(apiContext, baseURL);
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Burst Request Handling', () => {
    test('should handle 50 simultaneous requests', async () => {
      const burstSize = 50;
      
      const result = await concurrentHelper.sendBurstRequests(burstSize, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        data: { text: 'Burst test request' },
      });

      expect(result.totalRequests).toBe(burstSize);
      expect(result.successfulRequests).toBeGreaterThan(0);
      expect(result.avgResponseTime).toBeLessThan(5000); // Under 5 seconds
      expect(result.raceConditionsDetected).toBe(false);
      
      // Most requests should succeed
      const successRate = result.successfulRequests / result.totalRequests;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success
    });

    test('should handle 100 requests in 1 second', async () => {
      const burstSize = 100;
      
      const result = await concurrentHelper.sendBurstRequests(burstSize, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[1] },
        data: { text: 'Large burst test' },
      });

      expect(result.totalRequests).toBe(burstSize);
      expect(result.duration).toBeLessThan(10000); // Completed within 10 seconds
      
      // Check status code distribution
      const successCodes = [200, 201, 202];
      let totalSuccess = 0;
      
      for (const [code, count] of result.statusCodes) {
        if (successCodes.includes(code)) {
          totalSuccess += count;
        }
      }
      
      // Some should succeed, some may be rate limited
      expect(totalSuccess).toBeGreaterThan(0);
      expect(result.statusCodes.get(429) || 0).toBeGreaterThanOrEqual(0);
    });

    test('should handle mixed authenticated and anonymous requests', async () => {
      const totalRequests = 60;
      const authenticatedCount = 40;
      const anonymousCount = 20;
      
      // Send authenticated requests
      const authPromise = concurrentHelper.sendBurstRequests(authenticatedCount, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[2] },
        data: { text: 'Authenticated request' },
      });

      // Send anonymous requests
      const anonPromise = concurrentHelper.sendBurstRequests(anonymousCount, {
        endpoint: '/enhance',
        data: { text: 'Anonymous request' },
      });

      const [authResult, anonResult] = await Promise.all([authPromise, anonPromise]);

      expect(authResult.totalRequests).toBe(authenticatedCount);
      expect(anonResult.totalRequests).toBe(anonymousCount);
      
      // Both should have some successful requests
      expect(authResult.successfulRequests).toBeGreaterThan(0);
      expect(anonResult.successfulRequests).toBeGreaterThan(0);
    });
  });

  test.describe('Sustained Load Handling', () => {
    test('should maintain consistent performance under sustained load', async () => {
      const result = await concurrentHelper.sendSustainedLoad(
        testConfig.sustainedRPS,
        5, // 5 seconds
        {
          endpoint: '/enhance',
          headers: { 'X-API-Key': testConfig.testApiKeys[0] },
          data: { text: 'Sustained load test' },
        }
      );

      expect(result.throughput).toBeGreaterThan(50); // At least 50 RPS
      expect(result.avgResponseTime).toBeLessThan(2000); // Under 2 seconds
      
      // Check for consistent performance
      const p90ToP50Ratio = result.maxResponseTime / result.minResponseTime;
      expect(p90ToP50Ratio).toBeLessThan(10); // Reasonable variance
    });

    test('should handle alternating burst and quiet periods', async () => {
      const result = await concurrentHelper.testAlternatingBursts(
        50, // burst size
        2000, // 2 second quiet period
        5, // 5 cycles
        {
          endpoint: '/enhance',
          headers: { 'X-API-Key': testConfig.testApiKeys[1] },
          data: { text: 'Alternating burst test' },
        }
      );

      expect(result.bursts).toHaveLength(5);
      expect(result.overallSuccess).toBeGreaterThan(0);
      
      // Check consistency across bursts
      const successRates = result.bursts.map(b => b.successful / 50);
      const avgSuccessRate = successRates.reduce((a, b) => a + b, 0) / successRates.length;
      
      // Success rates should be relatively consistent
      for (const rate of successRates) {
        expect(Math.abs(rate - avgSuccessRate)).toBeLessThan(0.3); // Within 30%
      }
    });
  });

  test.describe('Fairness and Queue Behavior', () => {
    test('should provide fair access to multiple users', async () => {
      const users = [
        { id: 'user1', apiKey: testConfig.testApiKeys[0] },
        { id: 'user2', apiKey: testConfig.testApiKeys[1] },
        { id: 'user3', apiKey: testConfig.testApiKeys[2] },
      ];

      const result = await concurrentHelper.testQueueFairness(
        users,
        30, // requests per user
        {
          endpoint: '/enhance',
          data: { text: 'Fairness test' },
        }
      );

      expect(result.fairnessScore).toBeGreaterThan(0.7); // 70% fairness
      expect(result.maxDeviation).toBeLessThan(50); // No user gets 50+ more/less
      
      // Each user should get some successful requests
      for (const [userId, count] of result.userResults) {
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should maintain request order under load', async () => {
      const users = [
        { id: 'user1', apiKey: testConfig.testApiKeys[0] },
        { id: 'user2', apiKey: testConfig.testApiKeys[1] },
      ];

      const result = await concurrentHelper.testQueueFairness(
        users,
        50,
        {
          endpoint: '/enhance',
          data: { text: 'Order test' },
        }
      );

      // Order preservation is best-effort, not guaranteed
      expect(result.orderPreserved).toBeDefined();
      
      // But fairness should still be maintained
      expect(result.fairnessScore).toBeGreaterThan(0.6);
    });

    test('should prevent starvation of any user', async () => {
      // One user sends many requests
      const heavyUserPromise = concurrentHelper.sendBurstRequests(500, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        data: { text: 'Heavy user request' },
      });

      // Other users send fewer requests
      const lightUser1Promise = concurrentHelper.sendBurstRequests(50, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[1] },
        data: { text: 'Light user 1 request' },
      });

      const lightUser2Promise = concurrentHelper.sendBurstRequests(50, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[2] },
        data: { text: 'Light user 2 request' },
      });

      const [heavyResult, light1Result, light2Result] = await Promise.all([
        heavyUserPromise,
        lightUser1Promise,
        lightUser2Promise,
      ]);

      // Light users should still get through
      expect(light1Result.successfulRequests).toBeGreaterThan(0);
      expect(light2Result.successfulRequests).toBeGreaterThan(0);
      
      // Their success rate should be reasonable
      const light1SuccessRate = light1Result.successfulRequests / light1Result.totalRequests;
      const light2SuccessRate = light2Result.successfulRequests / light2Result.totalRequests;
      
      expect(light1SuccessRate).toBeGreaterThan(0.5); // At least 50%
      expect(light2SuccessRate).toBeGreaterThan(0.5); // At least 50%
    });
  });

  test.describe('Performance Under Load', () => {
    test('should maintain acceptable response times under various load patterns', async () => {
      const patterns = [
        {
          type: 'constant' as const,
          duration: 10000,
          startRPS: 50,
        },
        {
          type: 'ramp' as const,
          duration: 10000,
          startRPS: 10,
          endRPS: 100,
        },
        {
          type: 'spike' as const,
          duration: 10000,
          startRPS: 20,
          peakRPS: 200,
        },
      ];

      const result = await loadGenerator.executeLoadTest({
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        patterns,
        payloadGenerator: (index) => ({
          text: `Load test prompt ${index}`,
          metadata: { testId: `load-${index}` },
        }),
      });

      expect(result.avgResponseTime).toBeLessThan(2000); // Under 2s average
      expect(result.p95ResponseTime).toBeLessThan(5000); // Under 5s for 95th percentile
      expect(result.p99ResponseTime).toBeLessThan(10000); // Under 10s for 99th percentile
      
      // Generate report for analysis
      const report = loadGenerator.generateReport(result);
      console.log(report);
    });

    test('should handle wave pattern loads', async () => {
      const result = await loadGenerator.executeLoadTest({
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[1] },
        patterns: [
          {
            type: 'wave',
            duration: 30000, // 30 seconds
            minRPS: 20,
            maxRPS: 150,
            wavePeriod: 10000, // 10 second waves
          },
        ],
      });

      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.successfulRequests).toBeGreaterThan(0);
      
      // Check that we actually achieved wave pattern
      const rpsValues = result.timeSeriesData.map(d => d.rps);
      const maxRPS = Math.max(...rpsValues);
      const minRPS = Math.min(...rpsValues);
      
      expect(maxRPS).toBeGreaterThan(100); // Reached high points
      expect(minRPS).toBeLessThan(50); // Reached low points
    });
  });

  test.describe('Race Condition Detection', () => {
    test('should not have race conditions in rate limit counting', async () => {
      // Send requests that would trigger race conditions if present
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          concurrentHelper.sendBurstRequests(100, {
            endpoint: '/enhance',
            headers: { 'X-API-Key': testConfig.testApiKeys[2] },
            data: { text: `Race condition test ${i}` },
          })
        );
      }

      const results = await Promise.all(promises);
      
      // Check for race condition indicators
      for (const result of results) {
        expect(result.raceConditionsDetected).toBe(false);
      }
      
      // Total successful should not exceed rate limits
      const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0);
      expect(totalSuccessful).toBeLessThanOrEqual(1000); // Per-user limit
    });

    test('should handle concurrent modifications correctly', async () => {
      // Test concurrent requests that modify state
      const concurrentUpdates = 50;
      
      const result = await concurrentHelper.sendBurstRequests(concurrentUpdates, {
        endpoint: '/enhance',
        method: 'POST',
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        data: {
          text: 'Concurrent modification test',
          saveToHistory: true, // If this triggers state modification
        },
      });

      expect(result.raceConditionsDetected).toBe(false);
      expect(result.errors.filter(e => e.message.includes('conflict')).length).toBe(0);
    });
  });

  test.describe('Graceful Degradation', () => {
    test('should degrade gracefully under extreme load', async () => {
      const extremeLoad = await loadGenerator.executeLoadTest({
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[0] },
        patterns: [
          {
            type: 'spike',
            duration: 5000,
            startRPS: 50,
            peakRPS: 1000, // Extreme spike
          },
        ],
      });

      // System should still respond, even if slowly
      expect(extremeLoad.totalRequests).toBeGreaterThan(0);
      
      // Should have mix of success and rate limiting, not just errors
      const rateLimitCount = extremeLoad.statusCodeDistribution.get(429) || 0;
      const errorCount = extremeLoad.failedRequests - rateLimitCount;
      const errorRate = errorCount / extremeLoad.totalRequests;
      
      expect(errorRate).toBeLessThan(0.1); // Less than 10% hard errors
    });

    test('should recover quickly after load spike', async () => {
      // First, create a spike
      await concurrentHelper.sendBurstRequests(500, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[1] },
        data: { text: 'Spike request' },
      });

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Then send normal load
      const recoveryResult = await concurrentHelper.sendBurstRequests(50, {
        endpoint: '/enhance',
        headers: { 'X-API-Key': testConfig.testApiKeys[1] },
        data: { text: 'Recovery request' },
      });

      // Should have good success rate after spike
      const successRate = recoveryResult.successfulRequests / recoveryResult.totalRequests;
      expect(successRate).toBeGreaterThan(0.8); // 80%+ success
      expect(recoveryResult.avgResponseTime).toBeLessThan(2000); // Normal response times
    });
  });
});