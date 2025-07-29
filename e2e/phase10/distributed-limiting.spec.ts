import { test, expect, APIRequestContext } from '@playwright/test';
import { RateLimitTester } from './utils/rate-limit-tester';
import { ConcurrentRequestHelper } from './utils/concurrent-request-helper';

test.describe('Distributed Rate Limiting', () => {
  let apiContexts: APIRequestContext[] = [];
  let rateLimitTesters: RateLimitTester[] = [];
  let concurrentHelper: ConcurrentRequestHelper;
  
  // Simulate multiple server endpoints (in production these would be different instances)
  const serverEndpoints = process.env.DISTRIBUTED_ENDPOINTS?.split(',') || [
    process.env.API_BASE_URL || 'http://localhost/api/v1',
  ];
  
  const testConfig = {
    apiKey: 'test-key-distributed',
    perUserLimit: 1000,
    perIPLimit: 5000,
    windowDuration: 60000,
    distributedTestEnabled: serverEndpoints.length > 1,
  };

  test.beforeAll(async ({ playwright }) => {
    // Create API contexts for each endpoint
    for (const endpoint of serverEndpoints) {
      const context = await playwright.request.newContext({
        baseURL: endpoint,
        ignoreHTTPSErrors: true,
      });
      apiContexts.push(context);
      rateLimitTesters.push(new RateLimitTester(context, endpoint));
    }
    
    // Use first context for concurrent helper
    concurrentHelper = new ConcurrentRequestHelper(apiContexts[0], serverEndpoints[0]);
  });

  test.afterAll(async () => {
    for (const context of apiContexts) {
      await context.dispose();
    }
  });

  test.describe('Cross-Server Rate Limit Coordination', () => {
    test.skip(({ }) => !testConfig.distributedTestEnabled, 'Requires multiple endpoints');
    
    test('should share rate limits across all server instances', async () => {
      const requestsPerServer = Math.floor(testConfig.perUserLimit / serverEndpoints.length);
      const results: any[] = [];

      // Send requests to each server in parallel
      const promises = rateLimitTesters.map((tester, index) =>
        tester.testPerUserRateLimit(
          testConfig.apiKey + '-shared',
          requestsPerServer,
          { stopOnRateLimit: true }
        )
      );

      const serverResults = await Promise.all(promises);
      
      // Total successful requests across all servers should not exceed limit
      const totalSuccessful = serverResults.reduce(
        (sum, result) => sum + result.successfulRequests,
        0
      );
      
      expect(totalSuccessful).toBeLessThanOrEqual(testConfig.perUserLimit);
      expect(totalSuccessful).toBeGreaterThan(testConfig.perUserLimit * 0.95); // Within 5%
      
      // At least one server should hit rate limit
      const anyRateLimited = serverResults.some(r => r.rateLimitedRequests > 0);
      expect(anyRateLimited).toBe(true);
    });

    test('should maintain consistent rate limit state across servers', async () => {
      const testKey = testConfig.apiKey + '-consistency';
      const requestsPerRound = 100;
      
      // Round 1: Send to server 1
      const round1 = await rateLimitTesters[0].testPerUserRateLimit(
        testKey,
        requestsPerRound
      );
      
      // Round 2: Send to server 2 (or same server if only one)
      const serverIndex = rateLimitTesters.length > 1 ? 1 : 0;
      const round2 = await rateLimitTesters[serverIndex].testPerUserRateLimit(
        testKey,
        requestsPerRound
      );
      
      // Headers from different servers should be consistent
      if (round1.headers.length > 0 && round2.headers.length > 0) {
        const server1Limit = round1.headers[0].limit;
        const server2Limit = round2.headers[0].limit;
        
        expect(server1Limit).toBe(server2Limit);
        
        // Remaining should reflect usage across both servers
        const lastHeader2 = round2.headers[round2.headers.length - 1];
        const expectedRemaining = testConfig.perUserLimit - round1.successfulRequests - round2.successfulRequests;
        
        expect(lastHeader2.remaining).toBeCloseTo(expectedRemaining, -1); // Within 10
      }
    });

    test('should handle distributed burst traffic correctly', async () => {
      const burstSize = 200;
      const testKey = testConfig.apiKey + '-burst';
      
      // Send burst to all servers simultaneously
      const promises = apiContexts.map(async (context, index) => {
        const requests = [];
        for (let i = 0; i < burstSize; i++) {
          requests.push(
            context.post('/enhance', {
              headers: { 'X-API-Key': testKey },
              data: { text: `Distributed burst ${index}-${i}` },
              failOnStatusCode: false,
            })
          );
        }
        return Promise.all(requests);
      });

      const allResponses = await Promise.all(promises);
      const flatResponses = allResponses.flat();
      
      // Count successes and rate limits
      let successCount = 0;
      let rateLimitCount = 0;
      
      for (const response of flatResponses) {
        if (response.status() === 200) {
          successCount++;
        } else if (response.status() === 429) {
          rateLimitCount++;
        }
      }
      
      // Should enforce global limit
      expect(successCount).toBeLessThanOrEqual(testConfig.perUserLimit);
      expect(rateLimitCount).toBeGreaterThan(0);
    });
  });

  test.describe('Distributed IP-based Limiting', () => {
    test.skip(({ }) => !testConfig.distributedTestEnabled, 'Requires multiple endpoints');
    
    test('should coordinate IP-based limits across servers', async () => {
      const testIP = '192.168.100.50';
      const requestsPerServer = 1000;
      
      // Send requests from same IP to different servers
      const promises = rateLimitTesters.map(tester =>
        tester.testPerIPRateLimit(requestsPerServer, {
          ipAddress: testIP,
          stopOnRateLimit: true,
        })
      );

      const results = await Promise.all(promises);
      
      const totalSuccessful = results.reduce(
        (sum, result) => sum + result.successfulRequests,
        0
      );
      
      // Should not exceed per-IP limit
      expect(totalSuccessful).toBeLessThanOrEqual(testConfig.perIPLimit);
    });

    test('should handle distributed proxy scenarios', async () => {
      const proxyIPs = [
        '10.0.0.1, 192.168.1.100',
        '10.0.0.2, 192.168.1.100', // Different proxy, same client
        '10.0.0.1, 192.168.1.101', // Same proxy, different client
      ];
      
      const results = await Promise.all(
        proxyIPs.map(async (forwardedFor, index) => {
          const serverIndex = index % apiContexts.length;
          const response = await apiContexts[serverIndex].post('/enhance', {
            headers: { 'X-Forwarded-For': forwardedFor },
            data: { text: `Proxy test ${index}` },
          });
          return {
            forwardedFor,
            status: response.status(),
            headers: response.headers(),
          };
        })
      );
      
      // Verify proper proxy handling
      for (const result of results) {
        expect([200, 429]).toContain(result.status);
      }
    });
  });

  test.describe('Distributed Reset Synchronization', () => {
    test('should synchronize rate limit resets across servers', async () => {
      const testKey = testConfig.apiKey + '-reset-sync';
      
      // Get reset time from first server
      const response1 = await apiContexts[0].post('/enhance', {
        headers: { 'X-API-Key': testKey },
        data: { text: 'Reset sync test 1' },
      });
      
      const reset1 = parseInt(response1.headers()['x-ratelimit-reset'] || '0');
      
      // Get reset time from other servers
      const resetTimes = [reset1];
      
      for (let i = 1; i < apiContexts.length; i++) {
        const response = await apiContexts[i].post('/enhance', {
          headers: { 'X-API-Key': testKey },
          data: { text: `Reset sync test ${i + 1}` },
        });
        
        const reset = parseInt(response.headers()['x-ratelimit-reset'] || '0');
        resetTimes.push(reset);
      }
      
      // All servers should report same or very close reset times
      const minReset = Math.min(...resetTimes);
      const maxReset = Math.max(...resetTimes);
      const deviation = maxReset - minReset;
      
      expect(deviation).toBeLessThanOrEqual(5); // Within 5 seconds
    });

    test('should handle clock skew between servers gracefully', async () => {
      // Simulate requests with simulated clock skew
      const testKey = testConfig.apiKey + '-clock-skew';
      
      // Make requests to different servers
      const responses = await Promise.all(
        apiContexts.map((context, index) =>
          context.post('/enhance', {
            headers: { 
              'X-API-Key': testKey,
              'X-Test-Time-Offset': `${index * 1000}`, // Simulate 1s offset per server
            },
            data: { text: `Clock skew test ${index}` },
          })
        )
      );
      
      // Despite clock skew, rate limiting should still work
      const statuses = responses.map(r => r.status());
      const successCount = statuses.filter(s => s === 200).length;
      
      expect(successCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThanOrEqual(apiContexts.length);
    });
  });

  test.describe('Distributed Failure Scenarios', () => {
    test('should handle partial server failures gracefully', async () => {
      const testKey = testConfig.apiKey + '-partial-failure';
      
      // Simulate one server being "down" by using invalid endpoint
      const workingTesters = rateLimitTesters.slice(0, -1);
      
      if (workingTesters.length === 0) {
        test.skip();
        return;
      }
      
      // Send requests to working servers
      const results = await Promise.all(
        workingTesters.map(tester =>
          tester.testPerUserRateLimit(testKey, 500, { maxDuration: 10000 })
        )
      );
      
      const totalSuccessful = results.reduce(
        (sum, result) => sum + result.successfulRequests,
        0
      );
      
      // Should still enforce limits even with partial failure
      expect(totalSuccessful).toBeLessThanOrEqual(testConfig.perUserLimit);
    });

    test('should recover from temporary distributed storage failures', async () => {
      const testKey = testConfig.apiKey + '-storage-recovery';
      
      // Phase 1: Normal operation
      const phase1 = await rateLimitTesters[0].testPerUserRateLimit(
        testKey,
        100
      );
      
      expect(phase1.successfulRequests).toBe(100);
      
      // Phase 2: Simulate storage issue with special header
      const response = await apiContexts[0].post('/enhance', {
        headers: { 
          'X-API-Key': testKey,
          'X-Test-Simulate-Storage-Failure': 'true',
        },
        data: { text: 'Storage failure test' },
        failOnStatusCode: false,
      });
      
      // Should either fail safely or fall back to local limiting
      expect([200, 429, 503]).toContain(response.status());
      
      // Phase 3: Normal operation should resume
      const phase3 = await rateLimitTesters[0].testPerUserRateLimit(
        testKey,
        50
      );
      
      // Should continue enforcing limits
      expect(phase3.successfulRequests).toBeGreaterThanOrEqual(0);
      expect(phase3.successfulRequests).toBeLessThanOrEqual(50);
    });
  });

  test.describe('Distributed Performance', () => {
    test('should maintain low latency for rate limit checks', async () => {
      const iterations = 100;
      const responseTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const serverIndex = i % apiContexts.length;
        const startTime = Date.now();
        
        const response = await apiContexts[serverIndex].post('/enhance', {
          headers: { 'X-API-Key': testConfig.apiKey },
          data: { text: `Latency test ${i}` },
        });
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
        
        expect(response.ok()).toBe(true);
      }
      
      // Calculate latency metrics
      const avgLatency = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95Latency = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
      
      // Distributed rate limiting should not add significant latency
      expect(avgLatency).toBeLessThan(200); // Average under 200ms
      expect(p95Latency).toBeLessThan(500); // 95th percentile under 500ms
    });

    test('should handle high-concurrency distributed scenarios', async () => {
      const concurrentUsers = 10;
      const requestsPerUser = 100;
      
      // Create unique keys for each user
      const users = Array(concurrentUsers).fill(null).map((_, i) => ({
        id: `user-${i}`,
        apiKey: `${testConfig.apiKey}-concurrent-${i}`,
      }));
      
      // Each user sends requests to random servers
      const userPromises = users.map(async (user) => {
        const requests = [];
        
        for (let i = 0; i < requestsPerUser; i++) {
          const serverIndex = Math.floor(Math.random() * apiContexts.length);
          requests.push(
            apiContexts[serverIndex].post('/enhance', {
              headers: { 'X-API-Key': user.apiKey },
              data: { text: `User ${user.id} request ${i}` },
              failOnStatusCode: false,
            })
          );
        }
        
        const responses = await Promise.all(requests);
        return {
          userId: user.id,
          successCount: responses.filter(r => r.status() === 200).length,
          rateLimitCount: responses.filter(r => r.status() === 429).length,
        };
      });
      
      const results = await Promise.all(userPromises);
      
      // Each user should have their limits enforced independently
      for (const result of results) {
        expect(result.successCount).toBeLessThanOrEqual(testConfig.perUserLimit);
        expect(result.successCount + result.rateLimitCount).toBe(requestsPerUser);
      }
    });
  });

  test.describe('Distributed Edge Cases', () => {
    test('should handle network partitions correctly', async () => {
      if (apiContexts.length < 2) {
        test.skip();
        return;
      }
      
      const testKey = testConfig.apiKey + '-partition';
      
      // Simulate network partition by using different servers
      // without coordination (using special test header)
      const partition1 = await apiContexts[0].post('/enhance', {
        headers: { 
          'X-API-Key': testKey,
          'X-Test-Partition': 'group1',
        },
        data: { text: 'Partition test 1' },
      });
      
      const partition2 = await apiContexts[1].post('/enhance', {
        headers: { 
          'X-API-Key': testKey,
          'X-Test-Partition': 'group2',
        },
        data: { text: 'Partition test 2' },
      });
      
      // Both might succeed initially due to partition
      expect([200, 429]).toContain(partition1.status());
      expect([200, 429]).toContain(partition2.status());
      
      // After partition heals, limits should converge
      const healed = await apiContexts[0].post('/enhance', {
        headers: { 'X-API-Key': testKey },
        data: { text: 'Healed partition test' },
      });
      
      expect([200, 429]).toContain(healed.status());
    });

    test('should handle distributed cache invalidation', async () => {
      const testKey = testConfig.apiKey + '-cache-invalidation';
      
      // Warm up caches on all servers
      await Promise.all(
        apiContexts.map(context =>
          context.post('/enhance', {
            headers: { 'X-API-Key': testKey },
            data: { text: 'Cache warmup' },
          })
        )
      );
      
      // Simulate cache invalidation
      const invalidationResponse = await apiContexts[0].post('/enhance', {
        headers: { 
          'X-API-Key': testKey,
          'X-Test-Invalidate-Cache': 'true',
        },
        data: { text: 'Cache invalidation test' },
      });
      
      expect(invalidationResponse.ok()).toBe(true);
      
      // Verify other servers still have correct state
      const verificationPromises = apiContexts.slice(1).map(context =>
        context.post('/enhance', {
          headers: { 'X-API-Key': testKey },
          data: { text: 'Cache verification' },
        })
      );
      
      const verificationResponses = await Promise.all(verificationPromises);
      
      // All servers should still enforce consistent limits
      for (const response of verificationResponses) {
        expect([200, 429]).toContain(response.status());
        
        if (response.status() === 200) {
          const remaining = parseInt(response.headers()['x-ratelimit-remaining'] || '0');
          expect(remaining).toBeGreaterThanOrEqual(0);
          expect(remaining).toBeLessThan(testConfig.perUserLimit);
        }
      }
    });
  });
});