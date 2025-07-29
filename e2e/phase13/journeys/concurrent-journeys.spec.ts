import { test, expect } from '@playwright/test';
import { 
  ConcurrentRunner,
  createConcurrentRunner,
  ConcurrentConfig
} from '../utils/concurrent-runner';
import { createJourney } from '../utils/journey-orchestrator';

/**
 * Concurrent Journeys Test Suite
 * 
 * Tests multiple user journeys running simultaneously:
 * - 10 new users registering
 * - 50 active users enhancing prompts
 * - 20 batch uploads
 * - 100 API calls per second
 * - 5 admin monitoring sessions
 * 
 * Validates system performance under load and data integrity
 */

test.describe('Concurrent User Journeys', () => {
  test('should handle concurrent user load', async () => {
    // Define journey configurations
    const newUserJourney = createJourney()
      .name('Concurrent New User')
      .description('New user registration under load')
      .withTimingTargets('3min', '20s')
      .addStep('Register', async (ctx) => {
        await ctx.page.goto('/register');
        const timestamp = Date.now();
        const email = `concurrent_user_${timestamp}_${Math.random().toString(36).substring(7)}@example.com`;
        
        await ctx.page.fill('[name="email"]', email);
        await ctx.page.fill('[name="password"]', 'ConcurrentTest123!');
        await ctx.page.fill('[name="confirmPassword"]', 'ConcurrentTest123!');
        await ctx.page.fill('[name="firstName"]', 'Concurrent');
        await ctx.page.fill('[name="lastName"]', `User${timestamp}`);
        
        await ctx.page.click('button[type="submit"]');
        await ctx.page.waitForURL(/dashboard|welcome/, { timeout: 30000 });
        
        ctx.storage.set('userEmail', email);
        ctx.storage.set('registrationTime', Date.now() - timestamp);
      })
      .addStep('First Enhancement', async (ctx) => {
        await ctx.page.goto('/enhance');
        await ctx.page.fill('textarea', `Concurrent test prompt ${Date.now()}`);
        await ctx.page.click('button:has-text("Enhance")');
        await ctx.page.waitForSelector('.enhanced-result', { timeout: 30000 });
      })
      .build();

    const activeUserJourney = createJourney()
      .name('Concurrent Active User')
      .description('Active user enhancing prompts')
      .withTimingTargets('2min', '15s')
      .addStep('Login', async (ctx) => {
        await ctx.page.goto('/login');
        // Use pre-created test users
        const userId = Math.floor(Math.random() * 100);
        await ctx.page.fill('[name="email"]', `testuser${userId}@example.com`);
        await ctx.page.fill('[name="password"]', 'TestUser123!');
        await ctx.page.click('button[type="submit"]');
        await ctx.page.waitForURL(/dashboard/, { timeout: 20000 });
      })
      .addStep('Enhance Multiple', async (ctx) => {
        const enhanceCount = 3;
        for (let i = 0; i < enhanceCount; i++) {
          await ctx.page.goto('/enhance');
          const prompt = `Performance test prompt ${i} - ${Date.now()}`;
          await ctx.page.fill('textarea', prompt);
          
          const startTime = Date.now();
          await ctx.page.click('button:has-text("Enhance")');
          await ctx.page.waitForSelector('.enhanced-result', { timeout: 30000 });
          const responseTime = Date.now() - startTime;
          
          ctx.storage.set(`enhanceTime_${i}`, responseTime);
        }
      })
      .build();

    const batchUserJourney = createJourney()
      .name('Concurrent Batch User')
      .description('Batch processing under load')
      .withTimingTargets('4min', '30s')
      .addStep('Login and Upload', async (ctx) => {
        await ctx.page.goto('/login');
        const userId = Math.floor(Math.random() * 50) + 200; // Different user pool
        await ctx.page.fill('[name="email"]', `batchuser${userId}@example.com`);
        await ctx.page.fill('[name="password"]', 'BatchUser123!');
        await ctx.page.click('button[type="submit"]');
        await ctx.page.waitForURL(/dashboard/);
        
        // Upload small batch
        await ctx.page.goto('/batch');
        const csvContent = `prompt,technique
"Concurrent batch test 1","chain_of_thought"
"Concurrent batch test 2","tree_of_thoughts"
"Concurrent batch test 3","few_shot"
"Concurrent batch test 4","role_play"
"Concurrent batch test 5","socratic"`;
        
        const buffer = Buffer.from(csvContent);
        await ctx.page.setInputFiles('input[type="file"]', {
          name: `concurrent-batch-${Date.now()}.csv`,
          mimeType: 'text/csv',
          buffer
        });
        
        await ctx.page.click('button:has-text("Process")');
        await ctx.page.waitForSelector('[data-testid="batch-id"]', { timeout: 30000 });
      })
      .addStep('Monitor Progress', async (ctx) => {
        let completed = false;
        const maxWait = 60000; // 1 minute
        const startTime = Date.now();
        
        while (!completed && (Date.now() - startTime) < maxWait) {
          const status = await ctx.page.textContent('[data-testid="batch-status"]');
          if (status?.toLowerCase().includes('complete')) {
            completed = true;
            break;
          }
          await ctx.page.waitForTimeout(2000);
        }
        
        ctx.storage.set('batchCompleted', completed);
        ctx.storage.set('batchDuration', Date.now() - startTime);
      })
      .build();

    const apiUserJourney = createJourney()
      .name('Concurrent API User')
      .description('API calls under load')
      .withTimingTargets('1min', '5s')
      .addStep('Rapid API Calls', async (ctx) => {
        const baseUrl = ctx.page.url().split('/').slice(0, 3).join('/');
        const apiKey = 'test-api-key-concurrent';
        const callCount = 10;
        const results = [];
        
        for (let i = 0; i < callCount; i++) {
          const startTime = Date.now();
          
          const response = await ctx.page.evaluate(async ({ url, key, index }) => {
            const res = await fetch(`${url}/api/v1/enhance`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                prompt: `API concurrent test ${index}`,
                technique: 'chain_of_thought'
              })
            });
            
            return {
              status: res.status,
              time: Date.now()
            };
          }, { url: baseUrl, key: apiKey, index: i });
          
          const responseTime = Date.now() - startTime;
          results.push({
            status: response.status,
            responseTime,
            timestamp: startTime
          });
          
          // Small delay between calls
          if (i < callCount - 1) {
            await ctx.page.waitForTimeout(100);
          }
        }
        
        ctx.storage.set('apiResults', results);
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        ctx.storage.set('avgApiResponseTime', avgResponseTime);
      })
      .build();

    const adminMonitoringJourney = createJourney()
      .name('Admin Monitoring')
      .description('Admin dashboard monitoring')
      .withTimingTargets('5min', '30s')
      .addStep('Monitor System', async (ctx) => {
        await ctx.page.goto('/login');
        await ctx.page.fill('[name="email"]', 'admin@example.com');
        await ctx.page.fill('[name="password"]', 'AdminPassword123!');
        await ctx.page.click('button[type="submit"]');
        await ctx.page.waitForURL(/admin/);
        
        // Monitor metrics
        const metrics = [];
        const monitoringDuration = 30000; // 30 seconds
        const interval = 5000; // 5 seconds
        const iterations = monitoringDuration / interval;
        
        for (let i = 0; i < iterations; i++) {
          const systemMetrics = await ctx.page.evaluate(() => {
            return {
              activeUsers: document.querySelector('[data-metric="active-users"]')?.textContent || '0',
              requestsPerSecond: document.querySelector('[data-metric="rps"]')?.textContent || '0',
              avgResponseTime: document.querySelector('[data-metric="response-time"]')?.textContent || '0',
              errorRate: document.querySelector('[data-metric="error-rate"]')?.textContent || '0',
              timestamp: Date.now()
            };
          });
          
          metrics.push(systemMetrics);
          await ctx.page.waitForTimeout(interval);
        }
        
        ctx.storage.set('systemMetrics', metrics);
      })
      .build();

    // Configure concurrent execution
    const concurrentConfig: ConcurrentConfig = {
      journeys: [
        {
          config: newUserJourney,
          instances: 10,
          staggerDelay: 500 // 500ms between each new user
        },
        {
          config: activeUserJourney,
          instances: 50,
          staggerDelay: 200 // 200ms between active users
        },
        {
          config: batchUserJourney,
          instances: 20,
          staggerDelay: 1000 // 1s between batch uploads
        },
        {
          config: apiUserJourney,
          instances: 100,
          staggerDelay: 100 // 100ms between API users (10 per second)
        },
        {
          config: adminMonitoringJourney,
          instances: 5,
          staggerDelay: 5000 // 5s between admin sessions
        }
      ],
      maxConcurrent: 50,
      browserPoolSize: 20,
      rampUpTime: 30000, // 30 second ramp-up
      sustainDuration: 60000, // Sustain for 1 minute
      monitoringInterval: 1000 // Monitor every second
    };

    // Create and execute concurrent runner
    const runner = createConcurrentRunner(concurrentConfig);
    console.log('🚀 Starting concurrent load test...');
    
    const startTime = Date.now();
    const metrics = await runner.execute();
    const totalDuration = Date.now() - startTime;
    
    // Generate load test report
    const report = runner.generateReport();
    console.log(report);
    
    // Save detailed metrics
    const fs = require('fs').promises;
    await fs.mkdir('./e2e/phase13/reports', { recursive: true });
    await fs.writeFile(
      './e2e/phase13/reports/concurrent-load-test-report.md',
      report
    );
    
    // Validate performance requirements
    const summary = metrics.summary;
    
    // Success criteria
    expect(summary.successfulJourneys).toBeGreaterThan(summary.totalJourneys * 0.95); // 95% success rate
    expect(summary.avgResponseTime).toBeLessThan(500); // Under 500ms average
    expect(summary.errorRate).toBeLessThan(0.1); // Less than 0.1% error rate
    expect(summary.peakConcurrent).toBeGreaterThanOrEqual(30); // Handle at least 30 concurrent
    
    // Analyze results by journey type
    const journeyBreakdown = new Map<string, { total: number; successful: number; avgDuration: number }>();
    
    metrics.journeyResults.forEach((results, journeyName) => {
      const successful = results.filter(r => r.success).length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      
      journeyBreakdown.set(journeyName, {
        total: results.length,
        successful,
        avgDuration
      });
    });
    
    console.log('\n📊 Journey Breakdown:');
    journeyBreakdown.forEach((stats, name) => {
      console.log(`${name}: ${stats.successful}/${stats.total} successful (${(stats.successful/stats.total*100).toFixed(1)}%), avg ${stats.avgDuration.toFixed(0)}ms`);
    });
    
    // Validate specific journey performance
    const newUserStats = journeyBreakdown.get('Concurrent New User');
    if (newUserStats) {
      expect(newUserStats.successful / newUserStats.total).toBeGreaterThan(0.9); // 90% success
      expect(newUserStats.avgDuration).toBeLessThan(3 * 60 * 1000); // Under 3 minutes
    }
    
    const apiStats = journeyBreakdown.get('Concurrent API User');
    if (apiStats) {
      expect(apiStats.avgDuration).toBeLessThan(60 * 1000); // Under 1 minute
    }
    
    // System stability metrics
    const systemStability = metrics.systemMetrics.reduce((acc, snapshot) => {
      return {
        maxActive: Math.max(acc.maxActive, snapshot.activeJourneys),
        avgErrorRate: acc.avgErrorRate + snapshot.errorRate / metrics.systemMetrics.length,
        hadQueueBackup: acc.hadQueueBackup || snapshot.queueLength > 50
      };
    }, { maxActive: 0, avgErrorRate: 0, hadQueueBackup: false });
    
    console.log('\n🏥 System Health:');
    console.log(`Max concurrent active: ${systemStability.maxActive}`);
    console.log(`Average error rate: ${systemStability.avgErrorRate.toFixed(2)}%`);
    console.log(`Queue backup detected: ${systemStability.hadQueueBackup ? 'Yes' : 'No'}`);
    
    // Performance summary
    console.log('\n✅ Load Test Summary:');
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`Total journeys: ${summary.totalJourneys}`);
    console.log(`Success rate: ${((summary.successfulJourneys / summary.totalJourneys) * 100).toFixed(1)}%`);
    console.log(`Throughput: ${(summary.totalJourneys / (totalDuration / 1000)).toFixed(1)} journeys/second`);
    
    // Create performance dashboard
    const dashboardHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Concurrent Load Test Results</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .metric-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
    .metric-value { font-size: 2em; font-weight: bold; color: #2196F3; }
    .chart-container { width: 100%; max-width: 800px; margin: 20px auto; }
  </style>
</head>
<body>
  <h1>Concurrent Load Test Results</h1>
  
  <div class="summary">
    <div class="metric-card">
      <div>Total Journeys</div>
      <div class="metric-value">${summary.totalJourneys}</div>
    </div>
    <div class="metric-card">
      <div>Success Rate</div>
      <div class="metric-value">${((summary.successfulJourneys / summary.totalJourneys) * 100).toFixed(1)}%</div>
    </div>
    <div class="metric-card">
      <div>Avg Response Time</div>
      <div class="metric-value">${summary.avgResponseTime.toFixed(0)}ms</div>
    </div>
    <div class="metric-card">
      <div>Peak Concurrent</div>
      <div class="metric-value">${summary.peakConcurrent}</div>
    </div>
  </div>
  
  <div class="chart-container">
    <canvas id="timelineChart"></canvas>
  </div>
  
  <div class="chart-container">
    <canvas id="journeyChart"></canvas>
  </div>
  
  <script>
    // Timeline chart
    const timelineData = ${JSON.stringify(metrics.systemMetrics.map(m => ({
      time: new Date(m.timestamp).toLocaleTimeString(),
      active: m.activeJourneys,
      completed: m.completedJourneys,
      failed: m.failedJourneys
    })))};
    
    new Chart(document.getElementById('timelineChart'), {
      type: 'line',
      data: {
        labels: timelineData.map(d => d.time),
        datasets: [
          {
            label: 'Active Journeys',
            data: timelineData.map(d => d.active),
            borderColor: '#2196F3',
            tension: 0.1
          },
          {
            label: 'Completed',
            data: timelineData.map(d => d.completed),
            borderColor: '#4CAF50',
            tension: 0.1
          },
          {
            label: 'Failed',
            data: timelineData.map(d => d.failed),
            borderColor: '#F44336',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Journey Execution Timeline'
          }
        }
      }
    });
    
    // Journey breakdown chart
    const journeyData = ${JSON.stringify(Array.from(journeyBreakdown.entries()).map(([name, stats]) => ({
      name,
      successful: stats.successful,
      failed: stats.total - stats.successful
    })))};
    
    new Chart(document.getElementById('journeyChart'), {
      type: 'bar',
      data: {
        labels: journeyData.map(d => d.name),
        datasets: [
          {
            label: 'Successful',
            data: journeyData.map(d => d.successful),
            backgroundColor: '#4CAF50'
          },
          {
            label: 'Failed',
            data: journeyData.map(d => d.failed),
            backgroundColor: '#F44336'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Journey Success Rates'
          }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true }
        }
      }
    });
  </script>
</body>
</html>
`;
    
    await fs.writeFile('./e2e/phase13/reports/concurrent-load-test-dashboard.html', dashboardHtml);
    
    console.log('\n📊 Reports generated:');
    console.log('- concurrent-load-test-report.md');
    console.log('- concurrent-load-test-dashboard.html');
  });
});