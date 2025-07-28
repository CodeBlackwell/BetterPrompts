import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { PerformanceDashboardPage } from './pages/PerformanceDashboardPage';
import { AdminPage } from './pages/AdminPage';

test.describe('Dashboard Stress Tests - High Load Scenarios', () => {
  let browser: Browser;
  let dashboardPages: { context: BrowserContext; page: Page; dashboard: PerformanceDashboardPage }[] = [];

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test.afterAll(async () => {
    // Clean up all contexts
    for (const { context } of dashboardPages) {
      await context.close();
    }
  });

  test('should handle multiple concurrent dashboard users', async () => {
    const concurrentUsers = 10;
    const setupPromises = [];

    // Create multiple browser contexts to simulate different users
    for (let i = 0; i < concurrentUsers; i++) {
      setupPromises.push(createDashboardUser(browser, i));
    }

    dashboardPages = await Promise.all(setupPromises);

    // Verify all dashboards loaded successfully
    for (const { dashboard } of dashboardPages) {
      const metrics = await dashboard.captureMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
    }

    // Simulate concurrent interactions
    const interactionPromises = dashboardPages.map(async ({ page, dashboard }, index) => {
      // Each user performs different actions
      switch (index % 4) {
        case 0:
          // Change date range
          await dashboard.selectDateRange('7d');
          break;
        case 1:
          // Switch views
          await dashboard.switchToHeatMapView();
          break;
        case 2:
          // Apply filters
          await dashboard.openFilterPanel();
          await dashboard.filterByTechnique('chain_of_thought');
          break;
        case 3:
          // Export data
          await dashboard.exportData('json');
          break;
      }
    });

    await Promise.all(interactionPromises);

    // Verify dashboards remain responsive
    const responseChecks = dashboardPages.map(async ({ page }) => {
      const startTime = Date.now();
      await page.click('[data-testid="refresh-metrics"]');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // Should refresh within 3 seconds
    });

    await Promise.all(responseChecks);
  });

  test('should maintain performance with rapid filter changes', async ({ page }) => {
    const adminPage = new AdminPage(page);
    await adminPage.loginAsAdmin();
    
    const dashboard = new PerformanceDashboardPage(page);
    await dashboard.goto();

    const techniques = ['chain_of_thought', 'few_shot', 'role_playing', 'structured_output'];
    const dateRanges = ['24h', '7d', '30d', '90d'] as const;

    // Rapidly change filters
    for (let i = 0; i < 20; i++) {
      const technique = techniques[i % techniques.length];
      const dateRange = dateRanges[i % dateRanges.length];

      // Change both filters quickly
      await Promise.all([
        dashboard.selectDateRange(dateRange),
        dashboard.openFilterPanel().then(() => dashboard.filterByTechnique(technique))
      ]);

      // Verify dashboard updates without errors
      const metrics = await dashboard.captureMetrics();
      expect(metrics).toBeDefined();
      
      // Check for UI responsiveness
      const isResponsive = await page.evaluate(() => {
        const start = performance.now();
        document.body.style.backgroundColor = 'red';
        document.body.style.backgroundColor = '';
        return performance.now() - start < 50; // UI thread not blocked
      });
      
      expect(isResponsive).toBeTruthy();
    }
  });

  test('should handle continuous real-time updates under load', async ({ page }) => {
    const adminPage = new AdminPage(page);
    await adminPage.loginAsAdmin();
    
    const dashboard = new PerformanceDashboardPage(page);
    await dashboard.goto();

    // Start monitoring memory usage
    const initialMemory = await getPageMemoryUsage(page);

    // Generate continuous load for 2 minutes
    const loadGenerator = generateContinuousLoad(page, 120000); // 2 minutes

    // Monitor dashboard behavior during load
    const monitoringInterval = setInterval(async () => {
      try {
        // Check if charts are still updating
        const chartUpdateTime = await measureChartUpdateTime(page);
        expect(chartUpdateTime).toBeLessThan(100); // Charts should update quickly

        // Check for memory leaks
        const currentMemory = await getPageMemoryUsage(page);
        const memoryIncrease = (currentMemory - initialMemory) / initialMemory;
        expect(memoryIncrease).toBeLessThan(0.5); // Less than 50% increase

        // Verify no UI freezing
        const uiResponsive = await checkUIResponsiveness(page);
        expect(uiResponsive).toBeTruthy();
      } catch (error) {
        clearInterval(monitoringInterval);
        throw error;
      }
    }, 5000); // Check every 5 seconds

    // Wait for load test to complete
    await loadGenerator;
    clearInterval(monitoringInterval);

    // Final health check
    const finalMetrics = await dashboard.captureMetrics();
    expect(finalMetrics).toBeDefined();
    expect(finalMetrics.errorRate).toBeLessThan(0.05); // Error rate should stay low
  });

  test('should handle large data exports during high load', async ({ page, context }) => {
    const adminPage = new AdminPage(page);
    await adminPage.loginAsAdmin();
    
    const dashboard = new PerformanceDashboardPage(page);
    await dashboard.goto();

    // Select maximum date range for large dataset
    await dashboard.selectDateRange('90d');

    // Start background load
    const loadPromise = generateContinuousLoad(page, 30000); // 30 seconds

    // Attempt multiple concurrent exports
    const exportPromises = [];
    
    // CSV export
    const csvDownloadPromise = page.waitForEvent('download');
    await dashboard.exportData('csv');
    exportPromises.push(csvDownloadPromise);

    // JSON export
    const jsonDownloadPromise = page.waitForEvent('download');
    await dashboard.exportData('json');
    exportPromises.push(jsonDownloadPromise);

    // PDF export (most resource intensive)
    const pdfDownloadPromise = page.waitForEvent('download');
    await dashboard.exportData('pdf');
    exportPromises.push(pdfDownloadPromise);

    // Verify all exports complete successfully
    const downloads = await Promise.all(exportPromises);
    
    for (const download of downloads) {
      expect(download).toBeDefined();
      const path = await download.path();
      expect(path).toBeTruthy();
      
      // Verify file size is reasonable
      const stats = require('fs').statSync(path!);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
      expect(stats.size).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    }

    // Dashboard should remain functional
    await loadPromise;
    const postExportMetrics = await dashboard.captureMetrics();
    expect(postExportMetrics).toBeDefined();
  });

  test('should gracefully degrade when approaching resource limits', async ({ page }) => {
    const adminPage = new AdminPage(page);
    await adminPage.loginAsAdmin();
    
    const dashboard = new PerformanceDashboardPage(page);
    await dashboard.goto();

    // Monitor for degradation indicators
    let degradationDetected = false;
    
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('performance')) {
        degradationDetected = true;
      }
    });

    // Create extreme load conditions
    const extremeLoadPromises = [];
    
    // 1. Open multiple heavy views simultaneously
    extremeLoadPromises.push(dashboard.switchToHeatMapView());
    extremeLoadPromises.push(dashboard.switchToTrendsView());
    
    // 2. Request large date range
    extremeLoadPromises.push(dashboard.selectDateRange('90d'));
    
    // 3. Apply multiple filters
    extremeLoadPromises.push(
      dashboard.openFilterPanel().then(async () => {
        await dashboard.filterByTechnique('chain_of_thought');
        await dashboard.filterByUserSegment('enterprise');
      })
    );

    // 4. Generate high API load
    extremeLoadPromises.push(generateHighAPILoad(page, 50));

    await Promise.all(extremeLoadPromises);

    // Check for graceful degradation
    if (degradationDetected) {
      // Verify degradation features
      const degradationIndicator = await page.locator('.performance-degradation-notice');
      await expect(degradationIndicator).toBeVisible();
      
      // Verify reduced functionality message
      const message = await degradationIndicator.textContent();
      expect(message).toContain('reduced functionality');
      
      // Core features should still work
      const criticalMetrics = await dashboard.captureMetrics();
      expect(criticalMetrics.totalRequests).toBeGreaterThan(0);
    }

    // Verify no crashes or errors
    const errorCount = await page.evaluate(() => {
      return (window as any).__errorCount || 0;
    });
    expect(errorCount).toBe(0);
  });

  test('should maintain data accuracy during concurrent updates', async ({ page }) => {
    const adminPage = new AdminPage(page);
    await adminPage.loginAsAdmin();
    
    const dashboard = new PerformanceDashboardPage(page);
    await dashboard.goto();

    // Capture baseline metrics
    const baselineMetrics = await dashboard.getApplicationMetrics();
    
    // Generate known traffic pattern
    const requestCount = 100;
    const knownPrompts = await generateKnownTraffic(page, requestCount);
    
    // Wait for metrics to update (considering 5-second update interval)
    await page.waitForTimeout(7000);
    
    // Verify metric accuracy
    const updatedMetrics = await dashboard.getApplicationMetrics();
    
    // Throughput should reflect the requests
    const expectedMinThroughput = requestCount / 10; // Over ~10 seconds
    expect(updatedMetrics.throughput).toBeGreaterThan(expectedMinThroughput * 0.8); // Allow 20% variance
    
    // Error rate should be accurate
    const errorRequests = knownPrompts.filter(p => p.error).length;
    const expectedErrorRate = errorRequests / requestCount;
    expect(Math.abs(updatedMetrics.errorRate - expectedErrorRate)).toBeLessThan(0.05); // Within 5%
    
    // Technique accuracy should be tracked correctly
    const accurateRequests = knownPrompts.filter(p => p.accurate).length;
    const expectedAccuracy = accurateRequests / requestCount;
    expect(Math.abs(updatedMetrics.techniqueAccuracy - expectedAccuracy)).toBeLessThan(0.1); // Within 10%
  });
});

// Helper functions
async function createDashboardUser(browser: Browser, index: number) {
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Login as admin (in real scenario, would use different users)
  const adminPage = new AdminPage(page);
  await adminPage.loginAsAdmin();
  
  const dashboard = new PerformanceDashboardPage(page);
  await dashboard.goto();
  
  return { context, page, dashboard };
}

async function generateContinuousLoad(page: Page, duration: number) {
  const endTime = Date.now() + duration;
  const apiUrl = process.env.API_URL || 'http://localhost/api/v1';
  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  
  const requests = [];
  
  while (Date.now() < endTime) {
    // Send batches of requests
    const batchSize = 10;
    const batch = [];
    
    for (let i = 0; i < batchSize; i++) {
      batch.push(
        page.request.post(`${apiUrl}/enhance`, {
          data: {
            prompt: `Load test prompt ${Date.now()}-${i}`,
            techniques: ['auto']
          },
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }).catch(() => {}) // Ignore errors for load testing
      );
    }
    
    requests.push(...batch);
    await page.waitForTimeout(500); // 500ms between batches
  }
  
  await Promise.all(requests);
}

async function getPageMemoryUsage(page: Page): Promise<number> {
  return page.evaluate(() => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  });
}

async function measureChartUpdateTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const start = performance.now();
    const charts = document.querySelectorAll('canvas');
    
    charts.forEach(canvas => {
      const chart = (window as any).Chart.getChart(canvas);
      if (chart) {
        chart.update('none'); // Update without animation
      }
    });
    
    return performance.now() - start;
  });
}

async function checkUIResponsiveness(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      const start = performance.now();
      
      requestAnimationFrame(() => {
        const frameTime = performance.now() - start;
        resolve(frameTime < 50); // Should schedule within 50ms if UI is responsive
      });
    });
  });
}

async function generateHighAPILoad(page: Page, requestCount: number) {
  const apiUrl = process.env.API_URL || 'http://localhost/api/v1';
  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  
  const requests = [];
  
  for (let i = 0; i < requestCount; i++) {
    requests.push(
      page.request.post(`${apiUrl}/enhance`, {
        data: {
          prompt: `High load test prompt ${i}`,
          techniques: ['chain_of_thought', 'few_shot'], // Multiple techniques for higher load
          options: {
            include_metadata: true,
            detailed_explanation: true
          }
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {})
    );
  }
  
  await Promise.all(requests);
}

async function generateKnownTraffic(page: Page, count: number) {
  const apiUrl = process.env.API_URL || 'http://localhost/api/v1';
  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  
  const results = [];
  
  for (let i = 0; i < count; i++) {
    // Simulate different scenarios
    const shouldError = i % 20 === 0; // 5% error rate
    const isAccurate = i % 10 !== 0; // 90% accuracy
    
    try {
      const response = await page.request.post(`${apiUrl}/enhance`, {
        data: {
          prompt: shouldError ? '' : `Known traffic prompt ${i}`, // Empty prompt causes error
          techniques: ['auto']
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      results.push({
        error: response.status() !== 200,
        accurate: isAccurate && response.status() === 200
      });
    } catch {
      results.push({ error: true, accurate: false });
    }
  }
  
  return results;
}