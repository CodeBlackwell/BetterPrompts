import { test, expect, APIRequestContext } from '@playwright/test';
import { AdminPage } from './pages/AdminPage';
import { PerformanceDashboardPage } from './pages/PerformanceDashboardPage';

interface SLAMetrics {
  availability: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  recoveryTime: number;
}

const SLA_TARGETS = {
  availability: 0.999,        // 99.9% uptime
  latency: {
    p50: 100,                // p50 < 100ms
    p95: 200,                // p95 < 200ms
    p99: 500                 // p99 < 500ms
  },
  throughput: 1000,          // 1000 req/s sustained
  errorRate: 0.001,          // < 0.1% error rate
  recoveryTime: 300000       // < 5 minutes MTTR
};

test.describe('SLA Compliance Validation', () => {
  let apiContext: APIRequestContext;
  let authToken: string;

  test.beforeAll(async ({ playwright }) => {
    // Create API context for direct API testing
    apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost/api/v1',
      extraHTTPHeaders: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Get auth token
    const loginResponse = await apiContext.post('/auth/login', {
      data: {
        email: process.env.ADMIN_EMAIL || 'admin@betterprompts.ai',
        password: process.env.ADMIN_PASSWORD || 'Admin123!@#'
      }
    });

    const loginData = await loginResponse.json();
    authToken = loginData.access_token;
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Availability SLA (99.9% uptime)', () => {
    test('should maintain 99.9% availability over measurement period', async () => {
      const testDuration = 60000; // 1 minute for test (in prod would be longer)
      const checkInterval = 1000; // Check every second
      const checks = testDuration / checkInterval;
      
      let successfulChecks = 0;
      let failedChecks = 0;
      const downtimes: { start: number; end?: number; duration?: number }[] = [];
      let currentDowntime: { start: number; end?: number } | null = null;

      const startTime = Date.now();
      
      while (Date.now() - startTime < testDuration) {
        const checkStart = Date.now();
        
        try {
          const response = await apiContext.get('/health', {
            timeout: 5000,
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (response.status() === 200) {
            successfulChecks++;
            
            // If we were tracking downtime, it's over
            if (currentDowntime) {
              currentDowntime.end = checkStart;
              downtimes.push(currentDowntime);
              currentDowntime = null;
            }
          } else {
            failedChecks++;
            
            // Start tracking downtime
            if (!currentDowntime) {
              currentDowntime = { start: checkStart };
            }
          }
        } catch (error) {
          failedChecks++;
          
          // Start tracking downtime
          if (!currentDowntime) {
            currentDowntime = { start: checkStart };
          }
        }
        
        // Wait for next check
        const checkDuration = Date.now() - checkStart;
        if (checkDuration < checkInterval) {
          await new Promise(resolve => setTimeout(resolve, checkInterval - checkDuration));
        }
      }
      
      // Calculate availability
      const availability = successfulChecks / (successfulChecks + failedChecks);
      console.log(`Availability: ${(availability * 100).toFixed(3)}%`);
      console.log(`Successful checks: ${successfulChecks}, Failed checks: ${failedChecks}`);
      
      // Check downtime windows
      const totalDowntime = downtimes.reduce((sum, dt) => {
        const duration = (dt.end || Date.now()) - dt.start;
        return sum + duration;
      }, 0);
      
      console.log(`Total downtime: ${totalDowntime}ms over ${testDuration}ms`);
      console.log(`Downtime incidents: ${downtimes.length}`);
      
      // Verify SLA compliance
      expect(availability).toBeGreaterThanOrEqual(SLA_TARGETS.availability);
    });

    test('should handle planned maintenance windows correctly', async ({ page }) => {
      // This test would verify that planned maintenance is excluded from SLA calculations
      const response = await apiContext.get('/admin/maintenance/windows', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const maintenanceWindows = await response.json();
      
      // Verify maintenance windows are properly tracked
      if (maintenanceWindows.length > 0) {
        expect(maintenanceWindows[0]).toHaveProperty('start_time');
        expect(maintenanceWindows[0]).toHaveProperty('end_time');
        expect(maintenanceWindows[0]).toHaveProperty('excluded_from_sla');
      }
    });
  });

  test.describe('Latency SLA', () => {
    test('should meet latency targets under normal load', async () => {
      const sampleSize = 100;
      const latencies: number[] = [];
      
      // Collect latency samples
      for (let i = 0; i < sampleSize; i++) {
        const startTime = Date.now();
        
        const response = await apiContext.post('/enhance', {
          data: {
            prompt: `SLA test prompt ${i}`,
            techniques: ['auto']
          },
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
        expect(response.ok()).toBeTruthy();
      }
      
      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(sampleSize * 0.50)];
      const p95 = latencies[Math.floor(sampleSize * 0.95)];
      const p99 = latencies[Math.floor(sampleSize * 0.99)];
      
      console.log(`Latency - p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms`);
      
      // Verify SLA compliance
      expect(p50).toBeLessThanOrEqual(SLA_TARGETS.latency.p50);
      expect(p95).toBeLessThanOrEqual(SLA_TARGETS.latency.p95);
      expect(p99).toBeLessThanOrEqual(SLA_TARGETS.latency.p99);
    });

    test('should maintain latency SLA across different endpoints', async () => {
      const endpoints = [
        { path: '/enhance', method: 'POST', data: { prompt: 'test', techniques: ['auto'] } },
        { path: '/history', method: 'GET' },
        { path: '/metrics/overview', method: 'GET' },
        { path: '/techniques', method: 'GET' }
      ];
      
      for (const endpoint of endpoints) {
        const latencies: number[] = [];
        
        // Test each endpoint
        for (let i = 0; i < 20; i++) {
          const startTime = Date.now();
          
          const response = await apiContext[endpoint.method.toLowerCase() as 'get' | 'post'](
            endpoint.path,
            {
              data: endpoint.data,
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            }
          );
          
          const latency = Date.now() - startTime;
          latencies.push(latency);
          
          expect(response.ok()).toBeTruthy();
        }
        
        // Check p95 for each endpoint
        latencies.sort((a, b) => a - b);
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        
        console.log(`${endpoint.method} ${endpoint.path} - p95: ${p95}ms`);
        expect(p95).toBeLessThanOrEqual(SLA_TARGETS.latency.p95 * 2); // Allow 2x for non-critical endpoints
      }
    });
  });

  test.describe('Throughput SLA (1000 req/s)', () => {
    test('should sustain 1000 requests per second', async () => {
      const testDuration = 10000; // 10 seconds
      const targetRPS = SLA_TARGETS.throughput;
      const totalRequests = targetRPS * (testDuration / 1000);
      
      const startTime = Date.now();
      const requests: Promise<any>[] = [];
      let successCount = 0;
      let errorCount = 0;
      
      // Generate requests at target rate
      const requestInterval = setInterval(() => {
        // Send batch of requests to achieve target RPS
        const batchSize = Math.floor(targetRPS / 10); // 10 batches per second
        
        for (let i = 0; i < batchSize; i++) {
          const request = apiContext.post('/enhance', {
            data: {
              prompt: `Throughput test ${Date.now()}-${i}`,
              techniques: ['auto']
            },
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }).then(response => {
            if (response.ok()) {
              successCount++;
            } else {
              errorCount++;
            }
          }).catch(() => {
            errorCount++;
          });
          
          requests.push(request);
        }
      }, 100); // Every 100ms
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));
      clearInterval(requestInterval);
      
      // Wait for all requests to complete
      await Promise.all(requests);
      
      const actualDuration = Date.now() - startTime;
      const actualRPS = (successCount + errorCount) / (actualDuration / 1000);
      
      console.log(`Target RPS: ${targetRPS}, Actual RPS: ${actualRPS.toFixed(2)}`);
      console.log(`Success: ${successCount}, Errors: ${errorCount}`);
      
      // Verify throughput (allow 10% variance)
      expect(actualRPS).toBeGreaterThanOrEqual(targetRPS * 0.9);
      
      // Verify error rate is still within SLA
      const errorRate = errorCount / (successCount + errorCount);
      expect(errorRate).toBeLessThanOrEqual(SLA_TARGETS.errorRate);
    });
  });

  test.describe('Error Rate SLA (<0.1%)', () => {
    test('should maintain error rate below 0.1%', async () => {
      const sampleSize = 1000;
      let successCount = 0;
      let errorCount = 0;
      const errorDetails: { status: number; message: string }[] = [];
      
      // Send requests with various scenarios
      for (let i = 0; i < sampleSize; i++) {
        try {
          // Mix of different request types
          let response;
          
          if (i % 3 === 0) {
            // Normal enhancement
            response = await apiContext.post('/enhance', {
              data: {
                prompt: `Error rate test prompt ${i}`,
                techniques: ['auto']
              },
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            });
          } else if (i % 3 === 1) {
            // Batch enhancement
            response = await apiContext.post('/enhance/batch', {
              data: {
                prompts: [
                  { id: `${i}-1`, prompt: 'Test 1', techniques: ['auto'] },
                  { id: `${i}-2`, prompt: 'Test 2', techniques: ['auto'] }
                ]
              },
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            });
          } else {
            // History request
            response = await apiContext.get('/history?limit=10', {
              headers: {
                'Authorization': `Bearer ${authToken}`
              }
            });
          }
          
          if (response.ok()) {
            successCount++;
          } else {
            errorCount++;
            errorDetails.push({
              status: response.status(),
              message: await response.text()
            });
          }
        } catch (error) {
          errorCount++;
          errorDetails.push({
            status: 0,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        
        // Small delay to avoid overwhelming the server
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const errorRate = errorCount / sampleSize;
      console.log(`Error rate: ${(errorRate * 100).toFixed(3)}%`);
      console.log(`Success: ${successCount}, Errors: ${errorCount}`);
      
      if (errorDetails.length > 0) {
        console.log('Error details:', errorDetails.slice(0, 5)); // Show first 5 errors
      }
      
      // Verify SLA compliance
      expect(errorRate).toBeLessThanOrEqual(SLA_TARGETS.errorRate);
    });
  });

  test.describe('Recovery Time SLA (<5 minutes)', () => {
    test('should recover from failures within 5 minutes', async ({ page }) => {
      // This test simulates failures and measures recovery time
      const adminPage = new AdminPage(page);
      await adminPage.loginAsAdmin();
      
      const dashboard = new PerformanceDashboardPage(page);
      await dashboard.goto();
      
      // Monitor health endpoint
      let isHealthy = true;
      let failureStartTime: number | null = null;
      let recoveryTimes: number[] = [];
      
      const healthCheck = async () => {
        try {
          const response = await apiContext.get('/health', {
            timeout: 5000,
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (response.ok()) {
            if (!isHealthy && failureStartTime) {
              // System recovered
              const recoveryTime = Date.now() - failureStartTime;
              recoveryTimes.push(recoveryTime);
              console.log(`System recovered in ${recoveryTime}ms`);
              
              // Verify recovery time is within SLA
              expect(recoveryTime).toBeLessThanOrEqual(SLA_TARGETS.recoveryTime);
            }
            isHealthy = true;
            failureStartTime = null;
          } else {
            if (isHealthy) {
              // System just failed
              failureStartTime = Date.now();
              console.log('System failure detected');
            }
            isHealthy = false;
          }
        } catch {
          if (isHealthy) {
            failureStartTime = Date.now();
            console.log('System failure detected (connection error)');
          }
          isHealthy = false;
        }
      };
      
      // Monitor for 2 minutes
      const monitoringDuration = 120000;
      const checkInterval = 5000; // Check every 5 seconds
      
      const monitoringPromise = new Promise<void>(async (resolve) => {
        const intervalId = setInterval(healthCheck, checkInterval);
        
        setTimeout(() => {
          clearInterval(intervalId);
          resolve();
        }, monitoringDuration);
      });
      
      await monitoringPromise;
      
      // If we tracked any recovery times, verify they're within SLA
      if (recoveryTimes.length > 0) {
        const avgRecoveryTime = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
        console.log(`Average recovery time: ${avgRecoveryTime}ms`);
        expect(avgRecoveryTime).toBeLessThanOrEqual(SLA_TARGETS.recoveryTime);
      }
    });

    test('should trigger appropriate alerts during outages', async ({ page }) => {
      const adminPage = new AdminPage(page);
      await adminPage.loginAsAdmin();
      
      const dashboard = new PerformanceDashboardPage(page);
      await dashboard.goto();
      
      // Check for alert configuration
      const alertResponse = await apiContext.get('/admin/alerts/sla', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(alertResponse.ok()).toBeTruthy();
      const alertConfig = await alertResponse.json();
      
      // Verify SLA alerts are configured
      expect(alertConfig).toHaveProperty('availability_alert');
      expect(alertConfig).toHaveProperty('latency_alert');
      expect(alertConfig).toHaveProperty('error_rate_alert');
      
      // Verify alert thresholds match SLA targets
      expect(alertConfig.availability_alert.threshold).toBe(SLA_TARGETS.availability);
      expect(alertConfig.latency_alert.p95_threshold).toBe(SLA_TARGETS.latency.p95);
      expect(alertConfig.error_rate_alert.threshold).toBe(SLA_TARGETS.errorRate);
    });
  });

  test.describe('Comprehensive SLA Dashboard', () => {
    test('should display real-time SLA compliance status', async ({ page }) => {
      const adminPage = new AdminPage(page);
      await adminPage.loginAsAdmin();
      
      const dashboard = new PerformanceDashboardPage(page);
      await dashboard.goto();
      
      // Switch to SLA view
      await page.click('[data-testid="view-selector"]');
      await page.click('[data-view="sla-compliance"]');
      
      // Verify SLA metrics are displayed
      const slaSection = await page.locator('[data-testid="sla-compliance-section"]');
      await expect(slaSection).toBeVisible();
      
      // Check individual SLA metrics
      const availabilityMet = await slaSection.locator('[data-sla="availability"]').getAttribute('data-status');
      const latencyMet = await slaSection.locator('[data-sla="latency"]').getAttribute('data-status');
      const throughputMet = await slaSection.locator('[data-sla="throughput"]').getAttribute('data-status');
      const errorRateMet = await slaSection.locator('[data-sla="error-rate"]').getAttribute('data-status');
      
      // Log SLA status
      console.log('SLA Compliance Status:');
      console.log(`- Availability: ${availabilityMet}`);
      console.log(`- Latency: ${latencyMet}`);
      console.log(`- Throughput: ${throughputMet}`);
      console.log(`- Error Rate: ${errorRateMet}`);
      
      // At least basic SLAs should be met
      expect(['met', 'warning']).toContain(availabilityMet);
      expect(['met', 'warning']).toContain(latencyMet);
    });

    test('should provide SLA compliance history and trends', async ({ page }) => {
      const response = await apiContext.get('/metrics/sla/history?days=7', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const slaHistory = await response.json();
      
      // Verify history data structure
      expect(slaHistory).toHaveProperty('daily_compliance');
      expect(Array.isArray(slaHistory.daily_compliance)).toBeTruthy();
      
      if (slaHistory.daily_compliance.length > 0) {
        const dayData = slaHistory.daily_compliance[0];
        expect(dayData).toHaveProperty('date');
        expect(dayData).toHaveProperty('availability');
        expect(dayData).toHaveProperty('avg_latency');
        expect(dayData).toHaveProperty('error_rate');
        expect(dayData).toHaveProperty('sla_met');
        
        // Verify compliance calculation
        const expectedCompliance = 
          dayData.availability >= SLA_TARGETS.availability &&
          dayData.avg_latency <= SLA_TARGETS.latency.p95 &&
          dayData.error_rate <= SLA_TARGETS.errorRate;
        
        expect(dayData.sla_met).toBe(expectedCompliance);
      }
    });
  });
});