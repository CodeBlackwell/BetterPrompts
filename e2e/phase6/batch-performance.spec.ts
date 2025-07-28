import { test, expect } from '@playwright/test';
import { BatchUploadPage } from './page-objects/BatchUploadPage';
import { ProgressTracker } from './page-objects/ProgressTracker';
import { ResultsDownloader } from './page-objects/ResultsDownloader';
import { CSVGenerator } from './utils/csv-generator';
import { WebSocketHelper, PollingHelper, ProgressValidator } from './utils/async-helpers';
import { DownloadValidator } from './utils/download-validator';
import * as path from 'path';
import * as fs from 'fs';

// Performance test configuration
const PERF_TEST_TIMEOUT = 600000; // 10 minutes for performance tests
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Performance thresholds based on requirements
const PERFORMANCE_REQUIREMENTS = {
  throughput: {
    min: 100, // prompts per minute
    target: 150, // target throughput
  },
  updateFrequency: {
    max: 2000, // milliseconds between updates
    tolerance: 200, // +/- 200ms tolerance
  },
  processingTime: {
    batch10: 6000, // 6 seconds for 10 prompts
    batch100: 60000, // 60 seconds for 100 prompts
    batch1000: 600000, // 10 minutes for 1000 prompts
  },
  scalability: {
    linearThreshold: 0.9, // 90% linear scaling efficiency
  },
  concurrency: {
    maxParallel: 5, // max parallel batches per user
    degradationThreshold: 0.8, // 80% of single batch performance
  }
};

test.describe('Batch Processing Performance Tests', () => {
  let uploadPage: BatchUploadPage;
  let progressTracker: ProgressTracker;
  let resultsDownloader: ResultsDownloader;
  let wsHelper: WebSocketHelper;
  let pollingHelper: PollingHelper;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    uploadPage = new BatchUploadPage(page);
    progressTracker = new ProgressTracker(page);
    resultsDownloader = new ResultsDownloader(page);
    wsHelper = new WebSocketHelper(page);
    pollingHelper = new PollingHelper(page);

    // Ensure user is authenticated
    await page.goto('/login');
    await page.fill('[name="email"]', 'perf-test@example.com');
    await page.fill('[name="password"]', 'PerfTest123!@#');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test.afterEach(async () => {
    // Cleanup generated files
    const generatedDir = path.join(FIXTURES_DIR, 'generated');
    if (fs.existsSync(generatedDir)) {
      fs.rmSync(generatedDir, { recursive: true, force: true });
    }
  });

  test.describe('Throughput Performance', () => {
    test('should process 100 prompts within 60 seconds', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      // Generate 100 prompts
      const testFile = await CSVGenerator.generateFile('perf-100.csv', {
        count: 100,
        promptLength: 'medium'
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      
      const startTime = Date.now();
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      
      // Monitor progress with WebSocket
      await wsHelper.connect(batchId);
      const completion = await wsHelper.waitForCompletion();
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const throughput = (100 / (totalTime / 1000 / 60)); // prompts per minute
      
      // Verify performance requirements
      expect(totalTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.processingTime.batch100);
      expect(throughput).toBeGreaterThan(PERFORMANCE_REQUIREMENTS.throughput.min);
      
      // Log performance metrics
      console.log(`Performance Metrics:
        - Total Time: ${totalTime}ms
        - Throughput: ${throughput.toFixed(2)} prompts/min
        - Average per prompt: ${(totalTime / 100).toFixed(2)}ms
      `);
      
      await wsHelper.disconnect();
    });

    test('should maintain consistent throughput for different batch sizes', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      const batchSizes = [10, 50, 100, 200];
      const results: Array<{ size: number; throughput: number; avgTime: number }> = [];
      
      for (const size of batchSizes) {
        await uploadPage.goto();
        
        const testFile = await CSVGenerator.generateFile(`perf-${size}.csv`, {
          count: size,
          promptLength: 'medium'
        });
        
        await uploadPage.uploadViaFilePicker(testFile);
        
        const startTime = Date.now();
        await uploadPage.clickUpload();
        
        const batchId = await uploadPage.getBatchId();
        const completion = await pollingHelper.pollUntilComplete(batchId);
        const endTime = Date.now();
        
        const totalTime = endTime - startTime;
        const throughput = (size / (totalTime / 1000 / 60));
        const avgTime = totalTime / size;
        
        results.push({ size, throughput, avgTime });
        
        // Wait between tests
        await page.waitForTimeout(2000);
      }
      
      // Verify throughput consistency
      const throughputs = results.map(r => r.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;
      
      // All throughputs should be within 20% of average
      throughputs.forEach(t => {
        const variance = Math.abs(t - avgThroughput) / avgThroughput;
        expect(variance).toBeLessThan(0.2);
      });
      
      console.log('Throughput Consistency Results:', results);
    });

    test('should scale linearly with batch size', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      const batchConfigs = [
        { size: 10, expectedTime: 6000 },
        { size: 50, expectedTime: 30000 },
        { size: 100, expectedTime: 60000 },
      ];
      
      const scalingResults: Array<{ size: number; actualTime: number; expectedTime: number; efficiency: number }> = [];
      
      for (const config of batchConfigs) {
        await uploadPage.goto();
        
        const testFile = await CSVGenerator.generateFile(`scale-${config.size}.csv`, {
          count: config.size,
          promptLength: 'medium'
        });
        
        await uploadPage.uploadViaFilePicker(testFile);
        
        const startTime = Date.now();
        await uploadPage.clickUpload();
        
        const batchId = await uploadPage.getBatchId();
        await pollingHelper.pollUntilComplete(batchId);
        const endTime = Date.now();
        
        const actualTime = endTime - startTime;
        const efficiency = config.expectedTime / actualTime;
        
        scalingResults.push({
          size: config.size,
          actualTime,
          expectedTime: config.expectedTime,
          efficiency
        });
        
        // Verify linear scaling
        expect(efficiency).toBeGreaterThan(PERFORMANCE_REQUIREMENTS.scalability.linearThreshold);
        
        await page.waitForTimeout(2000);
      }
      
      console.log('Scaling Results:', scalingResults);
    });
  });

  test.describe('Progress Update Performance', () => {
    test('should provide updates every 2 seconds', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const testFile = await CSVGenerator.generateFile('update-freq-100.csv', {
        count: 100,
        promptLength: 'medium'
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await wsHelper.connect(batchId);
      
      // Collect messages for 20 seconds
      const messages: any[] = [];
      const startTime = Date.now();
      
      while (Date.now() - startTime < 20000) {
        const allMessages = await wsHelper.getAllMessages();
        messages.push(...allMessages.filter(m => m.type === 'progress'));
        await page.waitForTimeout(100);
      }
      
      // Validate update frequency
      ProgressValidator.validateUpdateFrequency(
        messages,
        PERFORMANCE_REQUIREMENTS.updateFrequency.max
      );
      
      await wsHelper.disconnect();
    });

    test('should maintain update frequency under load', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      // Upload large batch
      const testFile = await CSVGenerator.generateFile('load-test-500.csv', {
        count: 500,
        promptLength: 'long',
        includeSpecialChars: true,
        includeUnicode: true
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Verify updates continue at expected frequency
      const updateChecks = await progressTracker.verifyProgressUpdates(
        PERFORMANCE_REQUIREMENTS.updateFrequency.max,
        5
      );
      
      expect(updateChecks).toBe(true);
    });

    test('should provide accurate ETA calculations', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const testFile = await CSVGenerator.generateFile('eta-test-100.csv', {
        count: 100,
        promptLength: 'medium'
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      const startTime = Date.now();
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      await wsHelper.connect(batchId);
      
      // Collect ETA accuracy at different progress points
      const etaChecks = [];
      
      for (const checkpoint of [20, 40, 60, 80]) {
        const update = await wsHelper.waitForProgress(checkpoint);
        
        if (update.eta) {
          ProgressValidator.validateETA(update, startTime);
          
          const uiEta = await progressTracker.getETA();
          etaChecks.push({
            progress: checkpoint,
            calculatedEta: update.eta,
            displayedEta: uiEta
          });
        }
      }
      
      console.log('ETA Accuracy Checks:', etaChecks);
      
      await wsHelper.disconnect();
    });
  });

  test.describe('Concurrent Processing Performance', () => {
    test('should handle multiple concurrent batches efficiently', async ({ browser }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      const concurrentBatches = 3;
      const contexts = [];
      const pages = [];
      const batchIds = [];
      const startTimes = [];
      
      // Create multiple browser contexts for true concurrency
      for (let i = 0; i < concurrentBatches; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        contexts.push(context);
        pages.push(page);
        
        // Login
        await page.goto('/login');
        await page.fill('[name="email"]', `perf-test-${i}@example.com`);
        await page.fill('[name="password"]', 'PerfTest123!@#');
        await page.click('button[type="submit"]');
        
        // Upload batch
        const uploadPage = new BatchUploadPage(page);
        await uploadPage.goto();
        
        const testFile = await CSVGenerator.generateFile(`concurrent-${i}.csv`, {
          count: 50,
          promptLength: 'medium'
        });
        
        await uploadPage.uploadViaFilePicker(testFile);
        startTimes.push(Date.now());
        await uploadPage.clickUpload();
        
        const batchId = await uploadPage.getBatchId();
        batchIds.push(batchId);
      }
      
      // Wait for all to complete
      const completionTimes = [];
      
      for (let i = 0; i < concurrentBatches; i++) {
        const pollingHelper = new PollingHelper(pages[i]);
        await pollingHelper.pollUntilComplete(batchIds[i]);
        completionTimes.push(Date.now());
      }
      
      // Calculate performance metrics
      const processingTimes = completionTimes.map((end, i) => end - startTimes[i]);
      const avgTime = processingTimes.reduce((a, b) => a + b) / processingTimes.length;
      const throughputs = processingTimes.map(time => (50 / (time / 1000 / 60)));
      const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;
      
      // Compare with single batch performance
      const singleBatchThroughput = PERFORMANCE_REQUIREMENTS.throughput.target;
      const degradation = avgThroughput / singleBatchThroughput;
      
      // Should maintain at least 80% performance
      expect(degradation).toBeGreaterThan(PERFORMANCE_REQUIREMENTS.concurrency.degradationThreshold);
      
      console.log(`Concurrent Processing Results:
        - Concurrent Batches: ${concurrentBatches}
        - Average Processing Time: ${avgTime}ms
        - Average Throughput: ${avgThroughput.toFixed(2)} prompts/min
        - Performance Degradation: ${((1 - degradation) * 100).toFixed(2)}%
      `);
      
      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
    });

    test('should queue batches when at capacity', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      const maxConcurrent = PERFORMANCE_REQUIREMENTS.concurrency.maxParallel;
      const totalBatches = maxConcurrent + 2; // Exceed limit
      const batchIds = [];
      
      // Submit batches rapidly
      for (let i = 0; i < totalBatches; i++) {
        await uploadPage.goto();
        
        const testFile = await CSVGenerator.generateFile(`queue-${i}.csv`, {
          count: 20,
          promptLength: 'short'
        });
        
        await uploadPage.uploadViaFilePicker(testFile);
        await uploadPage.clickUpload();
        
        const batchId = await uploadPage.getBatchId();
        batchIds.push(batchId);
        
        // Don't wait between submissions
      }
      
      // Check statuses
      const statuses = [];
      for (const batchId of batchIds) {
        const status = await pollingHelper.pollStatus(batchId);
        statuses.push(status);
      }
      
      // Some should be queued
      const queuedCount = statuses.filter(s => s.status === 'queued').length;
      const processingCount = statuses.filter(s => s.status === 'processing').length;
      
      expect(processingCount).toBeLessThanOrEqual(maxConcurrent);
      expect(queuedCount).toBeGreaterThan(0);
      
      console.log(`Queue Management:
        - Total Batches: ${totalBatches}
        - Processing: ${processingCount}
        - Queued: ${queuedCount}
      `);
    });
  });

  test.describe('Resource Optimization', () => {
    test('should optimize API calls through batching', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const testFile = await CSVGenerator.generateFile('api-batch-100.csv', {
        count: 100,
        promptLength: 'medium'
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      
      // Monitor network requests
      const apiCalls: any[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/v1/enhance')) {
          apiCalls.push({
            url: request.url(),
            method: request.method(),
            timestamp: Date.now()
          });
        }
      });
      
      await uploadPage.clickUpload();
      const batchId = await uploadPage.getBatchId();
      await pollingHelper.pollUntilComplete(batchId);
      
      // Verify API batching
      // Should make fewer than 100 individual calls
      expect(apiCalls.length).toBeLessThan(100);
      
      // Calculate batch sizes
      const batchSizes = [];
      for (let i = 1; i < apiCalls.length; i++) {
        const timeDiff = apiCalls[i].timestamp - apiCalls[i-1].timestamp;
        if (timeDiff > 100) { // New batch if >100ms gap
          batchSizes.push(1);
        } else {
          batchSizes[batchSizes.length - 1]++;
        }
      }
      
      console.log(`API Batching Results:
        - Total Prompts: 100
        - API Calls Made: ${apiCalls.length}
        - Average Batch Size: ${(100 / apiCalls.length).toFixed(2)}
      `);
    });

    test('should efficiently handle large file downloads', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      // Generate large batch
      const testFile = await CSVGenerator.generateFile('large-download-500.csv', {
        count: 500,
        promptLength: 'long',
        includeMetadata: true
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await pollingHelper.pollUntilComplete(batchId);
      
      await resultsDownloader.goto(batchId);
      
      // Test compressed download
      await resultsDownloader.enableCompression();
      
      const downloadStartTime = Date.now();
      const download = await resultsDownloader.downloadResults('ZIP');
      const downloadPath = await download.path();
      const downloadEndTime = Date.now();
      
      if (downloadPath) {
        const stats = fs.statSync(downloadPath);
        const downloadTime = downloadEndTime - downloadStartTime;
        const downloadSpeed = (stats.size / 1024 / 1024) / (downloadTime / 1000); // MB/s
        
        console.log(`Download Performance:
          - File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB
          - Download Time: ${downloadTime}ms
          - Download Speed: ${downloadSpeed.toFixed(2)} MB/s
        `);
        
        // Should complete within reasonable time
        expect(downloadTime).toBeLessThan(10000); // 10 seconds max
      }
    });

    test('should handle memory efficiently for large batches', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      // Monitor memory usage
      const memorySnapshots = [];
      
      const collectMemoryMetrics = async () => {
        const metrics = await page.evaluate(() => {
          if ('memory' in performance) {
            return {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
              jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
            };
          }
          return null;
        });
        
        if (metrics) {
          memorySnapshots.push({
            timestamp: Date.now(),
            ...metrics
          });
        }
      };
      
      await uploadPage.goto();
      await collectMemoryMetrics(); // Baseline
      
      // Process large batch
      const testFile = await CSVGenerator.generateFile('memory-test-1000.csv', {
        count: 1000,
        promptLength: 'long'
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      await collectMemoryMetrics(); // After upload
      
      await uploadPage.clickUpload();
      const batchId = await uploadPage.getBatchId();
      
      await progressTracker.goto(batchId);
      
      // Collect memory during processing
      const memoryInterval = setInterval(collectMemoryMetrics, 5000);
      
      await pollingHelper.pollUntilComplete(batchId);
      clearInterval(memoryInterval);
      
      await collectMemoryMetrics(); // After completion
      
      // Analyze memory usage
      const maxMemory = Math.max(...memorySnapshots.map(s => s.usedJSHeapSize));
      const baselineMemory = memorySnapshots[0].usedJSHeapSize;
      const memoryIncrease = maxMemory - baselineMemory;
      
      console.log(`Memory Usage Analysis:
        - Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)} MB
        - Peak: ${(maxMemory / 1024 / 1024).toFixed(2)} MB
        - Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB
        - Snapshots: ${memorySnapshots.length}
      `);
      
      // Memory increase should be reasonable (< 100MB for 1000 prompts)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  test.describe('Performance Under Load', () => {
    test('should maintain performance with maximum batch size', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      // Generate maximum allowed prompts
      const testFile = await CSVGenerator.generateFile('max-batch-1000.csv', {
        count: 1000,
        promptLength: 'mixed',
        includeSpecialChars: true,
        includeUnicode: true
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      
      const startTime = Date.now();
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Monitor key metrics during processing
      const metricsLog = [];
      let lastProgress = 0;
      
      const metricsInterval = setInterval(async () => {
        const progress = await progressTracker.getProgress();
        const throughput = await progressTracker.getThroughput();
        const elapsed = Date.now() - startTime;
        
        if (progress > lastProgress) {
          metricsLog.push({
            timestamp: elapsed,
            progress,
            throughput,
            rate: (progress - lastProgress) / (elapsed / 1000)
          });
          lastProgress = progress;
        }
      }, 10000); // Check every 10 seconds
      
      await progressTracker.waitForCompletion();
      clearInterval(metricsInterval);
      
      const totalTime = Date.now() - startTime;
      const avgThroughput = 1000 / (totalTime / 1000 / 60);
      
      // Should complete within time limit
      expect(totalTime).toBeLessThan(PERFORMANCE_REQUIREMENTS.processingTime.batch1000);
      
      // Should maintain minimum throughput
      expect(avgThroughput).toBeGreaterThan(PERFORMANCE_REQUIREMENTS.throughput.min);
      
      console.log(`Maximum Batch Performance:
        - Total Prompts: 1000
        - Total Time: ${(totalTime / 1000).toFixed(2)}s
        - Average Throughput: ${avgThroughput.toFixed(2)} prompts/min
        - Performance Log:`, metricsLog);
    });

    test('should handle system resource constraints gracefully', async ({ page, context }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      // Simulate constrained environment
      await context.route('**/*', async route => {
        // Add artificial latency
        await new Promise(resolve => setTimeout(resolve, 50));
        await route.continue();
      });
      
      // Throttle CPU (simulated)
      await page.evaluate(() => {
        // Create CPU-intensive background task
        let counter = 0;
        setInterval(() => {
          for (let i = 0; i < 1000000; i++) {
            counter += Math.sqrt(i);
          }
        }, 100);
      });
      
      await uploadPage.goto();
      
      const testFile = await CSVGenerator.generateFile('constrained-100.csv', {
        count: 100,
        promptLength: 'medium'
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      
      const startTime = Date.now();
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      const completion = await pollingHelper.pollUntilComplete(batchId);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const degradedThroughput = 100 / (totalTime / 1000 / 60);
      
      // Should still meet minimum requirements despite constraints
      expect(degradedThroughput).toBeGreaterThan(PERFORMANCE_REQUIREMENTS.throughput.min * 0.7);
      
      console.log(`Constrained Environment Performance:
        - Processing Time: ${totalTime}ms
        - Throughput: ${degradedThroughput.toFixed(2)} prompts/min
        - Status: ${completion.status}
      `);
    });
  });

  test.describe('Performance Monitoring and Metrics', () => {
    test('should expose performance metrics for monitoring', async ({ page }) => {
      test.setTimeout(PERF_TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const testFile = await CSVGenerator.generateFile('metrics-test-100.csv', {
        count: 100,
        promptLength: 'medium'
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      
      // Check if metrics endpoint is available
      const metricsResponse = await page.request.get(`/api/v1/batch/${batchId}/metrics`);
      
      if (metricsResponse.ok()) {
        const metrics = await metricsResponse.json();
        
        expect(metrics).toHaveProperty('throughput');
        expect(metrics).toHaveProperty('latency');
        expect(metrics).toHaveProperty('errorRate');
        expect(metrics).toHaveProperty('queueDepth');
        
        console.log('Performance Metrics:', metrics);
      }
      
      // Wait for completion
      await pollingHelper.pollUntilComplete(batchId);
      
      // Get final metrics
      const finalMetrics = await resultsDownloader.goto(batchId);
      const summary = await resultsDownloader.getProcessingSummary();
      
      expect(summary.averageTime).toBeLessThan(600); // <600ms per prompt
      
      // Validate performance against SLA
      const validation = DownloadValidator.validatePerformanceMetrics(
        'downloads/results.csv',
        {
          maxProcessingTime: 600,
          minThroughput: PERFORMANCE_REQUIREMENTS.throughput.min,
          maxErrorRate: 0.05
        }
      );
      
      expect(validation.valid).toBe(true);
    });
  });
});