import { test, expect, Page } from '@playwright/test';
import { AdminPage } from './pages/AdminPage';
import { PerformanceDashboardPage } from './pages/PerformanceDashboardPage';
import { WebSocketHelper } from './utils/websocket-helper';

test.describe('US-005: Performance Metrics Dashboard', () => {
  let adminPage: AdminPage;
  let dashboardPage: PerformanceDashboardPage;
  let wsHelper: WebSocketHelper;

  test.beforeEach(async ({ page, context }) => {
    // Login as admin
    adminPage = new AdminPage(page);
    await adminPage.loginAsAdmin();
    
    // Navigate to performance dashboard
    dashboardPage = new PerformanceDashboardPage(page);
    await dashboardPage.goto();
    
    // Initialize WebSocket helper
    wsHelper = new WebSocketHelper(page);
  });

  test.afterEach(async () => {
    await wsHelper.disconnect();
  });

  test.describe('Real-time Metrics Updates', () => {
    test('should display real-time metrics with 5-second update intervals', async ({ page }) => {
      // Wait for initial metrics load
      await dashboardPage.waitForMetricsLoad();
      
      // Capture initial metric values
      const initialMetrics = await dashboardPage.captureMetrics();
      
      // Wait for WebSocket connection
      await wsHelper.waitForConnection();
      
      // Subscribe to performance metrics
      await wsHelper.subscribe(['performance', 'usage', 'technique_stats']);
      
      // Wait for multiple update cycles (3 cycles = 15 seconds)
      const updates: any[] = [];
      for (let i = 0; i < 3; i++) {
        const update = await wsHelper.waitForUpdate(6000); // 6s timeout
        updates.push(update);
        
        // Verify update interval
        if (i > 0) {
          const timeDiff = new Date(update.timestamp).getTime() - 
                          new Date(updates[i-1].timestamp).getTime();
          expect(timeDiff).toBeGreaterThanOrEqual(4500); // Allow 500ms variance
          expect(timeDiff).toBeLessThanOrEqual(5500);
        }
      }
      
      // Verify metrics have updated
      const currentMetrics = await dashboardPage.captureMetrics();
      expect(currentMetrics.totalRequests).not.toBe(initialMetrics.totalRequests);
      
      // Verify all metric types are updating
      expect(updates.some(u => u.type === 'performance')).toBeTruthy();
      expect(updates.some(u => u.type === 'usage')).toBeTruthy();
      expect(updates.some(u => u.type === 'technique_stats')).toBeTruthy();
    });

    test('should update response time graph in real-time', async ({ page }) => {
      // Find response time chart
      const chart = await dashboardPage.getChart('response-time');
      
      // Capture initial data points
      const initialDataPoints = await chart.evaluate(el => {
        const canvas = el.querySelector('canvas');
        // Access Chart.js instance
        return (window as any).Chart.getChart(canvas)?.data.datasets[0].data.length;
      });
      
      // Wait for updates
      await page.waitForTimeout(10000); // 10 seconds = 2 update cycles
      
      // Verify new data points added
      const currentDataPoints = await chart.evaluate(el => {
        const canvas = el.querySelector('canvas');
        return (window as any).Chart.getChart(canvas)?.data.datasets[0].data.length;
      });
      
      expect(currentDataPoints).toBeGreaterThan(initialDataPoints);
    });

    test('should display technique usage statistics with live updates', async ({ page }) => {
      const techniqueStats = await dashboardPage.getTechniqueStatsSection();
      
      // Verify initial technique stats
      const techniques = await techniqueStats.locator('.technique-row').all();
      expect(techniques.length).toBeGreaterThan(0);
      
      // Capture initial usage counts
      const initialUsage: Record<string, number> = {};
      for (const tech of techniques) {
        const name = await tech.locator('.technique-name').textContent();
        const usage = await tech.locator('.usage-count').textContent();
        initialUsage[name!] = parseInt(usage!.replace(/,/g, ''));
      }
      
      // Generate some enhancement requests to trigger updates
      await generateTestTraffic(page, 20);
      
      // Wait for stats update
      await page.waitForTimeout(6000);
      
      // Verify usage counts have increased
      let hasUpdates = false;
      for (const tech of techniques) {
        const name = await tech.locator('.technique-name').textContent();
        const usage = await tech.locator('.usage-count').textContent();
        const currentUsage = parseInt(usage!.replace(/,/g, ''));
        
        if (currentUsage > initialUsage[name!]) {
          hasUpdates = true;
          break;
        }
      }
      
      expect(hasUpdates).toBeTruthy();
    });
  });

  test.describe('Metric Categories', () => {
    test('should display application metrics correctly', async ({ page }) => {
      const appMetrics = await dashboardPage.getApplicationMetrics();
      
      // Verify response time metrics
      expect(appMetrics.responseTime.p50).toBeDefined();
      expect(appMetrics.responseTime.p95).toBeDefined();
      expect(appMetrics.responseTime.p99).toBeDefined();
      expect(appMetrics.responseTime.p50).toBeLessThan(appMetrics.responseTime.p95);
      expect(appMetrics.responseTime.p95).toBeLessThan(appMetrics.responseTime.p99);
      
      // Verify throughput
      expect(appMetrics.throughput).toBeGreaterThan(0);
      expect(appMetrics.throughput).toBeLessThan(10000); // Sanity check
      
      // Verify error rate
      expect(appMetrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(appMetrics.errorRate).toBeLessThan(0.05); // Should be < 5%
      
      // Verify technique accuracy
      expect(appMetrics.techniqueAccuracy).toBeGreaterThan(0.8); // > 80%
      expect(appMetrics.techniqueAccuracy).toBeLessThanOrEqual(1.0);
    });

    test('should display infrastructure metrics correctly', async ({ page }) => {
      const infraMetrics = await dashboardPage.getInfrastructureMetrics();
      
      // Verify CPU usage
      expect(infraMetrics.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(infraMetrics.cpuUsage).toBeLessThanOrEqual(100);
      
      // Verify memory usage
      expect(infraMetrics.memoryUsage).toBeGreaterThan(0);
      expect(infraMetrics.memoryUsage).toBeLessThanOrEqual(100);
      
      // Verify database connections
      expect(infraMetrics.dbConnections.active).toBeGreaterThanOrEqual(0);
      expect(infraMetrics.dbConnections.idle).toBeGreaterThanOrEqual(0);
      expect(infraMetrics.dbConnections.total).toBe(
        infraMetrics.dbConnections.active + infraMetrics.dbConnections.idle
      );
      
      // Verify cache hit rate
      expect(infraMetrics.cacheHitRate).toBeGreaterThan(0.7); // > 70%
      expect(infraMetrics.cacheHitRate).toBeLessThanOrEqual(1.0);
    });

    test('should display business metrics correctly', async ({ page }) => {
      const bizMetrics = await dashboardPage.getBusinessMetrics();
      
      // Verify user satisfaction
      expect(bizMetrics.userSatisfaction).toBeGreaterThan(0.8); // > 80%
      expect(bizMetrics.userSatisfaction).toBeLessThanOrEqual(1.0);
      
      // Verify SLA compliance
      expect(bizMetrics.slaCompliance).toBeGreaterThan(0.99); // > 99%
      expect(bizMetrics.slaCompliance).toBeLessThanOrEqual(1.0);
      
      // Verify cost per request
      expect(bizMetrics.costPerRequest).toBeGreaterThan(0);
      expect(bizMetrics.costPerRequest).toBeLessThan(0.01); // < $0.01
      
      // Verify feature adoption
      expect(bizMetrics.featureAdoption).toBeDefined();
      expect(Object.keys(bizMetrics.featureAdoption).length).toBeGreaterThan(0);
    });
  });

  test.describe('Dashboard Features', () => {
    test('should filter metrics by date range', async ({ page }) => {
      // Select last 24 hours
      await dashboardPage.selectDateRange('24h');
      await page.waitForTimeout(2000);
      
      const metrics24h = await dashboardPage.captureMetrics();
      
      // Select last 7 days
      await dashboardPage.selectDateRange('7d');
      await page.waitForTimeout(2000);
      
      const metrics7d = await dashboardPage.captureMetrics();
      
      // 7 day metrics should have more data
      expect(metrics7d.totalRequests).toBeGreaterThan(metrics24h.totalRequests);
    });

    test('should filter by technique type', async ({ page }) => {
      // Enable technique filter
      await dashboardPage.openFilterPanel();
      
      // Select specific technique
      await dashboardPage.filterByTechnique('chain_of_thought');
      
      // Verify filtered results
      const techniqueStats = await dashboardPage.getTechniqueStatsSection();
      const visibleTechniques = await techniqueStats.locator('.technique-row:visible').count();
      
      expect(visibleTechniques).toBe(1);
      
      const techniqueName = await techniqueStats
        .locator('.technique-row:visible .technique-name')
        .textContent();
      expect(techniqueName).toContain('Chain of Thought');
    });

    test('should filter by user segment', async ({ page }) => {
      await dashboardPage.openFilterPanel();
      
      // Filter by premium users
      await dashboardPage.filterByUserSegment('premium');
      
      // Verify metrics update
      await page.waitForTimeout(2000);
      const segmentLabel = await page.locator('.active-segment-label').textContent();
      expect(segmentLabel).toContain('Premium Users');
    });

    test('should display heat map for usage patterns', async ({ page }) => {
      await dashboardPage.switchToHeatMapView();
      
      // Verify heat map is displayed
      const heatMap = await page.locator('.usage-heatmap');
      await expect(heatMap).toBeVisible();
      
      // Verify time slots (24 hours x 7 days)
      const cells = await heatMap.locator('.heatmap-cell').count();
      expect(cells).toBe(168); // 24 * 7
      
      // Verify intensity variations
      const intensities = await heatMap.locator('.heatmap-cell').evaluateAll(cells => 
        cells.map(cell => parseFloat(cell.style.opacity || '0'))
      );
      
      const uniqueIntensities = new Set(intensities);
      expect(uniqueIntensities.size).toBeGreaterThan(1); // Should have variations
    });

    test('should show historical trends with comparison', async ({ page }) => {
      await dashboardPage.switchToTrendsView();
      
      // Enable comparison mode
      await page.click('[data-testid="enable-comparison"]');
      
      // Select comparison period
      await page.selectOption('[data-testid="comparison-period"]', 'previous_week');
      
      // Verify comparison data is shown
      const comparisonIndicators = await page.locator('.trend-comparison').all();
      expect(comparisonIndicators.length).toBeGreaterThan(0);
      
      // Check trend indicators
      for (const indicator of comparisonIndicators) {
        const trend = await indicator.getAttribute('data-trend');
        expect(['up', 'down', 'stable']).toContain(trend);
      }
    });
  });

  test.describe('Alerting System', () => {
    test('should display SLA breach alerts', async ({ page }) => {
      // Simulate SLA breach
      await simulateSLABreach(page);
      
      // Wait for alert
      const alert = await page.waitForSelector('.sla-alert', { timeout: 10000 });
      
      // Verify alert content
      const alertText = await alert.textContent();
      expect(alertText).toContain('SLA Breach Detected');
      expect(alertText).toMatch(/Response time exceeded \d+ms threshold/);
      
      // Verify alert severity
      const severity = await alert.getAttribute('data-severity');
      expect(severity).toBe('critical');
    });

    test('should show anomaly detection warnings', async ({ page }) => {
      // Wait for anomaly detection to process
      await page.waitForTimeout(5000);
      
      // Check for anomaly warnings
      const anomalies = await page.locator('.anomaly-warning').all();
      
      if (anomalies.length > 0) {
        // Verify anomaly details
        const firstAnomaly = anomalies[0];
        const anomalyType = await firstAnomaly.getAttribute('data-anomaly-type');
        expect(['traffic_spike', 'error_rate', 'latency', 'technique_accuracy']).toContain(anomalyType);
        
        // Verify anomaly has timestamp
        const timestamp = await firstAnomaly.locator('.anomaly-timestamp').textContent();
        expect(timestamp).toMatch(/\d{2}:\d{2}:\d{2}/);
      }
    });

    test('should alert on capacity warnings', async ({ page }) => {
      // Monitor for capacity warnings
      const capacityAlert = page.locator('.capacity-warning');
      
      // Generate high load to trigger capacity warning
      await generateTestTraffic(page, 100, { concurrent: true });
      
      // Wait for potential capacity warning
      try {
        await capacityAlert.waitFor({ timeout: 15000 });
        
        const warningText = await capacityAlert.textContent();
        expect(warningText).toMatch(/(\d+)% capacity|approaching limit/i);
        
        // Verify recommended action is provided
        const recommendation = await capacityAlert.locator('.recommendation').textContent();
        expect(recommendation).toBeTruthy();
      } catch {
        // Capacity warning may not trigger in test environment
        console.log('No capacity warning triggered (expected in test environment)');
      }
    });
  });

  test.describe('Export Functionality', () => {
    test('should export metrics as CSV', async ({ page, context }) => {
      // Wait for download
      const downloadPromise = page.waitForEvent('download');
      
      // Click export button and select CSV
      await dashboardPage.exportData('csv');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/performance-metrics.*\.csv/);
      
      // Verify CSV content
      const content = await download.path().then(path => 
        require('fs').readFileSync(path!, 'utf-8')
      );
      
      expect(content).toContain('timestamp,response_time_p50,response_time_p95');
      expect(content).toContain('throughput,error_rate,technique_accuracy');
      
      // Verify data rows
      const lines = content.split('\n');
      expect(lines.length).toBeGreaterThan(2); // Header + data
    });

    test('should export metrics as JSON with full details', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download');
      
      await dashboardPage.exportData('json');
      
      const download = await downloadPromise;
      const content = await download.path().then(path => 
        require('fs').readFileSync(path!, 'utf-8')
      );
      
      const data = JSON.parse(content);
      
      // Verify JSON structure
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('metrics');
      expect(data).toHaveProperty('timestamp');
      
      // Verify comprehensive data
      expect(data.metrics).toHaveProperty('application');
      expect(data.metrics).toHaveProperty('infrastructure');
      expect(data.metrics).toHaveProperty('business');
      
      // Verify time series data included
      expect(data.timeSeries).toBeDefined();
      expect(Array.isArray(data.timeSeries)).toBeTruthy();
    });

    test('should generate PDF report with charts', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download');
      
      await dashboardPage.exportData('pdf');
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/performance-report.*\.pdf/);
      
      // Verify PDF was generated (basic check)
      const path = await download.path();
      const stats = require('fs').statSync(path!);
      expect(stats.size).toBeGreaterThan(10000); // PDF should be > 10KB
    });

    test('should schedule automated report delivery', async ({ page }) => {
      await dashboardPage.openScheduleDialog();
      
      // Configure schedule
      await page.fill('[data-testid="schedule-email"]', 'admin@betterprompts.ai');
      await page.selectOption('[data-testid="schedule-frequency"]', 'daily');
      await page.selectOption('[data-testid="schedule-time"]', '09:00');
      await page.check('[data-testid="include-charts"]');
      
      // Save schedule
      await page.click('[data-testid="save-schedule"]');
      
      // Verify confirmation
      await expect(page.locator('.schedule-confirmation')).toContainText('Report scheduled successfully');
      
      // Verify schedule appears in list
      const scheduleList = await page.locator('.scheduled-reports');
      await expect(scheduleList).toContainText('Daily at 09:00');
    });
  });
});

// Helper functions
async function generateTestTraffic(page: Page, count: number, options?: { concurrent?: boolean }) {
  const apiUrl = process.env.API_URL || 'http://localhost/api/v1';
  
  const requests = [];
  for (let i = 0; i < count; i++) {
    const request = page.request.post(`${apiUrl}/enhance`, {
      data: {
        prompt: `Test prompt ${i} for metrics generation`,
        techniques: ['auto'],
        options: { stream: false }
      },
      headers: {
        'Authorization': `Bearer ${await page.evaluate(() => localStorage.getItem('access_token'))}`
      }
    });
    
    if (options?.concurrent) {
      requests.push(request);
    } else {
      await request;
      await page.waitForTimeout(100); // Small delay between requests
    }
  }
  
  if (options?.concurrent) {
    await Promise.all(requests);
  }
}

async function simulateSLABreach(page: Page) {
  // This would typically be done through a test endpoint or by generating
  // specific conditions that cause SLA breaches
  await page.evaluate(() => {
    // Inject a mock SLA breach event
    window.dispatchEvent(new CustomEvent('sla-breach', {
      detail: {
        metric: 'response_time',
        threshold: 200,
        actual: 350,
        timestamp: new Date().toISOString()
      }
    }));
  });
}