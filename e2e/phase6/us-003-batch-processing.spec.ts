import { test, expect } from '@playwright/test';
import { BatchUploadPage } from './page-objects/BatchUploadPage';
import { ProgressTracker } from './page-objects/ProgressTracker';
import { ResultsDownloader } from './page-objects/ResultsDownloader';
import { CSVGenerator } from './utils/csv-generator';
import { WebSocketHelper, PollingHelper, ProgressValidator } from './utils/async-helpers';
import { DownloadValidator } from './utils/download-validator';
import * as path from 'path';
import * as fs from 'fs';

// Test configuration
const TEST_TIMEOUT = 300000; // 5 minutes for batch processing tests
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

test.describe('US-003: Batch Prompt Processing via CSV Upload', () => {
  let uploadPage: BatchUploadPage;
  let progressTracker: ProgressTracker;
  let resultsDownloader: ResultsDownloader;
  let wsHelper: WebSocketHelper;
  let pollingHelper: PollingHelper;

  test.beforeEach(async ({ page, context }) => {
    // Set download path
    await context.route('**/*', route => route.continue());
    
    // Initialize page objects
    uploadPage = new BatchUploadPage(page);
    progressTracker = new ProgressTracker(page);
    resultsDownloader = new ResultsDownloader(page);
    wsHelper = new WebSocketHelper(page);
    pollingHelper = new PollingHelper(page);

    // Ensure user is authenticated (from Phase 4)
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'Test123!@#');
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

  test.describe('File Upload Methods', () => {
    test('should upload CSV via file picker', async ({ page }) => {
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      
      // Verify file is loaded
      expect(await uploadPage.getPromptCount()).toBe(10);
      expect(await uploadPage.isUploadEnabled()).toBe(true);
      
      // Check preview
      const preview = await uploadPage.getPreviewContent();
      expect(preview.length).toBeGreaterThan(0);
    });

    test('should upload CSV via drag and drop', async ({ page }) => {
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaDragDrop(csvFile);
      
      expect(await uploadPage.getPromptCount()).toBe(10);
      expect(await uploadPage.isUploadEnabled()).toBe(true);
    });

    test('should upload content via paste', async ({ page }) => {
      await uploadPage.goto();
      
      const content = `prompt,category,priority
"Test prompt 1",test,high
"Test prompt 2",test,medium
"Test prompt 3",test,low`;
      
      await uploadPage.uploadViaPaste(content);
      
      expect(await uploadPage.getPromptCount()).toBe(3);
      expect(await uploadPage.isUploadEnabled()).toBe(true);
    });

    test('should support TXT file format', async ({ page }) => {
      await uploadPage.goto();
      
      await uploadPage.selectFormat('TXT');
      const txtFile = path.join(FIXTURES_DIR, 'valid-prompts.txt');
      await uploadPage.uploadViaFilePicker(txtFile);
      
      expect(await uploadPage.getPromptCount()).toBe(10);
      expect(await uploadPage.isUploadEnabled()).toBe(true);
    });
  });

  test.describe('File Validation', () => {
    test('should reject empty files', async ({ page }) => {
      await uploadPage.goto();
      
      const emptyFile = path.join(FIXTURES_DIR, 'empty.csv');
      await uploadPage.uploadViaFilePicker(emptyFile);
      
      expect(await uploadPage.hasError()).toBe(true);
      const error = await uploadPage.getErrorMessage();
      expect(error).toContain('empty');
    });

    test('should reject files exceeding size limit', async ({ page }) => {
      await uploadPage.goto();
      
      // Generate oversized file
      const oversizedFile = await CSVGenerator.generateOversizedFile('oversized.csv', 11);
      await uploadPage.uploadViaFilePicker(oversizedFile);
      
      expect(await uploadPage.hasError()).toBe(true);
      const error = await uploadPage.getErrorMessage();
      expect(error).toContain('size limit');
    });

    test('should reject files with >1000 prompts', async ({ page }) => {
      await uploadPage.goto();
      
      // Generate file with too many prompts
      const tooManyFile = await CSVGenerator.generateExceedingPromptLimit('too-many.csv', 1001);
      await uploadPage.uploadViaFilePicker(tooManyFile);
      
      expect(await uploadPage.hasError()).toBe(true);
      const error = await uploadPage.getErrorMessage();
      expect(error).toContain('1000');
    });

    test('should handle invalid CSV format', async ({ page }) => {
      await uploadPage.goto();
      
      const invalidFile = path.join(FIXTURES_DIR, 'invalid-format.csv');
      await uploadPage.uploadViaFilePicker(invalidFile);
      
      expect(await uploadPage.hasError()).toBe(true);
      const errors = await uploadPage.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should handle special characters and unicode', async ({ page }) => {
      await uploadPage.goto();
      
      const unicodeFile = path.join(FIXTURES_DIR, 'unicode-special.csv');
      await uploadPage.uploadViaFilePicker(unicodeFile);
      
      expect(await uploadPage.hasError()).toBe(false);
      expect(await uploadPage.getPromptCount()).toBe(10);
      
      // Verify special chars are preserved in preview
      const preview = await uploadPage.getPreviewContent();
      expect(preview.some(row => row.includes('量子コンピューティング'))).toBe(true);
      expect(preview.some(row => row.includes('🌍'))).toBe(true);
    });
  });

  test.describe('Async Processing with WebSocket', () => {
    test('should process batch with real-time progress updates', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      // Upload file
      const csvFile = path.join(FIXTURES_DIR, 'valid-100.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      // Get batch ID and navigate to progress
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Connect WebSocket
      await wsHelper.connect(batchId);
      expect(await wsHelper.isConnected()).toBe(true);
      
      // Track progress updates
      const startTime = Date.now();
      const progressUpdates = [];
      
      // Wait for 25%, 50%, 75%, 100%
      for (const milestone of [25, 50, 75, 100]) {
        const update = await wsHelper.waitForProgress(milestone);
        progressUpdates.push(update);
        
        // Verify UI updates
        const uiProgress = await progressTracker.getProgress();
        expect(Math.abs(uiProgress - milestone)).toBeLessThanOrEqual(5);
      }
      
      // Validate progress sequence
      ProgressValidator.validateProgressSequence(progressUpdates);
      
      // Verify completion
      const finalUpdate = await wsHelper.waitForCompletion();
      expect(finalUpdate.status).toBe('completed');
      expect(finalUpdate.processedCount).toBe(100);
      
      // Verify throughput meets requirements (100 prompts/min)
      const elapsedMs = Date.now() - startTime;
      const throughput = (100 / (elapsedMs / 1000 / 60));
      expect(throughput).toBeGreaterThan(100);
      
      await wsHelper.disconnect();
    });

    test('should handle WebSocket reconnection', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Connect and then simulate disconnect
      await wsHelper.connect(batchId);
      await wsHelper.simulateDisconnect();
      
      // Wait a bit and reconnect
      await page.waitForTimeout(2000);
      await wsHelper.connect(batchId);
      
      // Should continue receiving updates
      const update = await wsHelper.getLatestProgress();
      expect(update).toBeTruthy();
    });

    test('should fall back to polling when WebSocket fails', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      
      // Use polling instead of WebSocket
      const finalStatus = await pollingHelper.pollUntilComplete(batchId, {
        interval: 2000,
        onProgress: (update) => {
          console.log(`Polling progress: ${update.progress}%`);
        }
      });
      
      expect(finalStatus.status).toBe('completed');
      expect(finalStatus.processedCount).toBe(10);
    });
  });

  test.describe('Progress Tracking Features', () => {
    test('should display accurate progress information', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Verify initial state
      expect(await progressTracker.getStatus()).toBe('processing');
      expect(await progressTracker.getTotalCount()).toBe(10);
      
      // Verify progress updates
      await progressTracker.waitForProgress(50);
      
      // Check all metrics
      expect(await progressTracker.getProcessedCount()).toBeGreaterThan(0);
      expect(await progressTracker.getElapsedTime()).not.toBe('00:00');
      expect(await progressTracker.getThroughput()).toBeGreaterThan(0);
      
      // Verify ETA
      const eta = await progressTracker.getETA();
      expect(eta).toBeTruthy();
    });

    test('should support pause and resume', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-100.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Wait for some progress
      await progressTracker.waitForProgress(20);
      
      // Pause
      await progressTracker.pause();
      const pausedProgress = await progressTracker.getProgress();
      
      // Wait and verify no progress
      await page.waitForTimeout(3000);
      expect(await progressTracker.getProgress()).toBe(pausedProgress);
      
      // Resume
      await progressTracker.resume();
      
      // Verify progress continues
      await progressTracker.waitForProgress(pausedProgress + 10);
    });

    test('should support cancellation', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-100.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Wait for some progress
      await progressTracker.waitForProgress(10);
      
      // Cancel
      await progressTracker.cancel();
      
      // Verify cancelled state
      expect(await progressTracker.getStatus()).toBe('cancelled');
      expect(await progressTracker.canResume()).toBe(false);
    });

    test('should display milestone notifications', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-100.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Wait for milestones
      await progressTracker.waitForProgress(25);
      await progressTracker.waitForProgress(50);
      
      const notifications = await progressTracker.getMilestoneNotifications();
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications.some(n => n.includes('25%'))).toBe(true);
      expect(notifications.some(n => n.includes('50%'))).toBe(true);
    });
  });

  test.describe('Results Download', () => {
    test('should download results in CSV format', async ({ page, context }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      
      // Wait for completion
      await pollingHelper.pollUntilComplete(batchId);
      
      // Navigate to results
      await resultsDownloader.goto(batchId);
      await resultsDownloader.waitForResultsReady();
      
      // Download CSV
      const results = await resultsDownloader.downloadAndParseCSV();
      
      // Verify results
      expect(results.length).toBe(10);
      results.forEach(result => {
        expect(result.originalPrompt).toBeTruthy();
        expect(result.enhancedPrompt).toBeTruthy();
        expect(result.technique).toBeTruthy();
        expect(result.confidence).toBeGreaterThan(0);
      });
      
      // Verify integrity
      const integrity = DownloadValidator.verifyContentIntegrity(csvFile, 'downloads/results.csv');
      expect(integrity.valid).toBe(true);
    });

    test('should download results in JSON format', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await pollingHelper.pollUntilComplete(batchId);
      
      await resultsDownloader.goto(batchId);
      const results = await resultsDownloader.downloadAndParseJSON();
      
      expect(results.length).toBe(10);
      expect(results[0]).toHaveProperty('originalPrompt');
      expect(results[0]).toHaveProperty('enhancedPrompt');
      expect(results[0]).toHaveProperty('technique');
    });

    test('should download results in ZIP format for large batches', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-100.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await pollingHelper.pollUntilComplete(batchId);
      
      await resultsDownloader.goto(batchId);
      const zipData = await resultsDownloader.downloadAndExtractZIP();
      
      expect(zipData.results.length).toBe(100);
      expect(zipData.summary).toHaveProperty('totalCount');
      expect(zipData.summary.totalCount).toBe(100);
      expect(zipData.metadata).toHaveProperty('batchId');
    });

    test('should preserve prompt order in results', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await pollingHelper.pollUntilComplete(batchId);
      
      await resultsDownloader.goto(batchId);
      const results = await resultsDownloader.downloadAndParseCSV();
      
      // Load original file
      const originalPrompts = CSVGenerator.loadCSV(csvFile);
      
      // Verify order
      results.forEach((result, index) => {
        expect(result.originalPrompt).toBe(originalPrompts[index].prompt);
      });
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle partial failures gracefully', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      // Create file with some problematic prompts
      const testFile = await CSVGenerator.generateFile('test-with-errors.csv', {
        count: 20,
        includeSpecialChars: true,
        includeUnicode: true
      });
      
      await uploadPage.uploadViaFilePicker(testFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await pollingHelper.pollUntilComplete(batchId);
      
      await resultsDownloader.goto(batchId);
      
      // Check summary
      const summary = await resultsDownloader.getProcessingSummary();
      expect(summary.total).toBe(20);
      expect(summary.successful).toBeGreaterThan(0);
      
      // If there are errors, should be able to retry
      if (summary.failed > 0) {
        const newBatchId = await resultsDownloader.retryFailed();
        expect(newBatchId).toBeTruthy();
      }
    });

    test('should resume processing after network interruption', async ({ page, context }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-100.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      const batchId = await uploadPage.getBatchId();
      await progressTracker.goto(batchId);
      
      // Wait for some progress
      await progressTracker.waitForProgress(30);
      
      // Simulate network interruption
      await context.setOffline(true);
      await page.waitForTimeout(3000);
      
      // Restore network
      await context.setOffline(false);
      
      // Should continue processing
      await progressTracker.waitForCompletion();
      expect(await progressTracker.isComplete()).toBe(true);
    });

    test('should handle concurrent batch uploads', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      // Start first batch
      await uploadPage.goto();
      const file1 = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(file1);
      await uploadPage.clickUpload();
      const batchId1 = await uploadPage.getBatchId();
      
      // Start second batch in new tab
      const newPage = await page.context().newPage();
      const uploadPage2 = new BatchUploadPage(newPage);
      await uploadPage2.goto();
      const file2 = await CSVGenerator.generateFile('batch2.csv', { count: 10 });
      await uploadPage2.uploadViaFilePicker(file2);
      await uploadPage2.clickUpload();
      const batchId2 = await uploadPage2.getBatchId();
      
      // Both should process independently
      const status1 = await pollingHelper.pollUntilComplete(batchId1);
      const status2 = await pollingHelper.pollUntilComplete(batchId2);
      
      expect(status1.status).toBe('completed');
      expect(status2.status).toBe('completed');
      
      await newPage.close();
    });
  });

  test.describe('Notification System', () => {
    test('should show in-app notifications for batch events', async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      
      // Should show start notification
      await uploadPage.clickUpload();
      await expect(page.getByText(/batch processing started/i)).toBeVisible();
      
      const batchId = await uploadPage.getBatchId();
      
      // Should show completion notification
      await pollingHelper.pollUntilComplete(batchId);
      await expect(page.getByText(/batch processing completed/i)).toBeVisible();
    });

    test('should respect user notification preferences', async ({ page }) => {
      // Set notification preferences
      await page.goto('/settings/notifications');
      await page.uncheck('input[name="batchStart"]');
      await page.check('input[name="batchComplete"]');
      await page.click('button:has-text("Save")');
      
      await uploadPage.goto();
      
      const csvFile = path.join(FIXTURES_DIR, 'valid-10.csv');
      await uploadPage.uploadViaFilePicker(csvFile);
      await uploadPage.clickUpload();
      
      // Should not show start notification
      await expect(page.getByText(/batch processing started/i)).not.toBeVisible();
      
      const batchId = await uploadPage.getBatchId();
      await pollingHelper.pollUntilComplete(batchId);
      
      // Should show completion notification
      await expect(page.getByText(/batch processing completed/i)).toBeVisible();
    });
  });
});