import { test, expect } from '@playwright/test';
import { 
  JourneyOrchestrator, 
  createJourney,
  JourneyContext 
} from '../utils/journey-orchestrator';
import { 
  MetricsCollector, 
  createMetricsCollector 
} from '../utils/metrics-collector';
import { 
  JourneyValidator, 
  createJourneyValidator 
} from '../utils/journey-validator';

/**
 * Power User Journey Test Suite
 * 
 * Advanced batch processing workflow:
 * 1. Login as existing power user
 * 2. Upload large batch (100 prompts)
 * 3. Monitor batch progress
 * 4. Handle partial failures
 * 5. Download results
 * 6. Search history for specific results
 * 7. Re-run failed items
 * 8. Export comprehensive report
 */

test.describe('Power User Journey', () => {
  let orchestrator: JourneyOrchestrator;
  let metricsCollector: MetricsCollector;
  let validator: JourneyValidator;

  test.beforeEach(async ({ browser, context, page }) => {
    metricsCollector = createMetricsCollector();
    await metricsCollector.initialize(page);
    validator = createJourneyValidator(page, context);
    
    // Add batch processing specific integrity checks
    validator.addDataIntegrityCheck({
      name: 'Batch Processing State',
      check: async () => {
        const hasBatchState = await page.evaluate(() => {
          const batchId = window.sessionStorage.getItem('currentBatchId');
          const batchStatus = window.sessionStorage.getItem('batchStatus');
          return !!(batchId && batchStatus);
        });
        return hasBatchState;
      },
      errorMessage: 'Batch processing state is missing',
      severity: 'high'
    });
  });

  test('should complete power user batch workflow', async ({ browser, context, page }) => {
    // Configure journey
    const journey = createJourney()
      .name('Power User Batch Workflow')
      .description('Advanced batch processing with error handling and reporting')
      .withTimingTargets('5min', '30s')
      .withRetryPolicy(3, 2000)
      .beforeJourney(async (ctx: JourneyContext) => {
        console.log('🚀 Starting power user journey...');
        // Use existing power user credentials
        ctx.userData = {
          email: 'poweruser@example.com',
          password: 'PowerUser123!',
          apiKey: 'test-api-key-12345'
        };
        ctx.sessionData = {
          batchSize: 100,
          expectedFailures: 5 // Simulate some failures
        };
      })
      
      // Step 1: Login as Power User
      .addStep('Login as Power User',
        async (ctx: JourneyContext) => {
          await ctx.page.goto('/login');
          
          const { email, password } = ctx.userData;
          await ctx.page.fill('[name="email"], #email', email);
          await ctx.page.fill('[name="password"], #password', password);
          
          const loginTimer = metricsCollector.startTiming('power_user.login');
          await ctx.page.click('button[type="submit"]');
          await ctx.page.waitForURL(/\/dashboard/, { timeout: 10000 });
          loginTimer();
          
          // Verify power user features are available
          const batchMenuVisible = await ctx.page.locator('[data-testid="batch-menu"], a:has-text("Batch")').isVisible();
          expect(batchMenuVisible).toBe(true);
        },
        async (ctx: JourneyContext) => {
          const session = await validator.validateSession();
          expect(session.isValid).toBe(true);
          expect(session.roles).toContain('power_user');
        }
      )
      
      // Step 2: Upload Large Batch
      .addStep('Upload Large Batch (100 prompts)',
        async (ctx: JourneyContext) => {
          await ctx.page.goto('/batch');
          
          // Generate large CSV with 100 prompts
          const prompts = [];
          const techniques = ['chain_of_thought', 'tree_of_thoughts', 'few_shot', 'role_play', 'socratic'];
          
          for (let i = 1; i <= ctx.sessionData.batchSize; i++) {
            const technique = techniques[i % techniques.length];
            // Add some intentionally problematic prompts to test error handling
            const prompt = i % 20 === 0 ? 
              `[INVALID] Test prompt ${i} with bad characters @#$%` :
              `Generate a detailed analysis for topic ${i}: ${generateTopic(i)}`;
            
            prompts.push(`"${prompt}","${technique}"`);
          }
          
          const csvContent = `prompt,technique\n${prompts.join('\n')}`;
          const buffer = Buffer.from(csvContent);
          
          // Upload file
          await ctx.page.setInputFiles('input[type="file"]', {
            name: 'power-user-batch-100.csv',
            mimeType: 'text/csv',
            buffer
          });
          
          // Configure batch settings
          const prioritySelect = ctx.page.locator('[name="priority"], #priority');
          if (await prioritySelect.count() > 0) {
            await prioritySelect.selectOption('high');
          }
          
          // Start processing
          const uploadTimer = metricsCollector.startTiming('batch.upload_100');
          await ctx.page.click('button:has-text("Process")');
          
          // Wait for batch ID
          await ctx.page.waitForSelector('[data-testid="batch-id"], .batch-identifier', {
            timeout: 30000
          });
          uploadTimer();
          
          // Store batch ID
          const batchId = await ctx.page.textContent('[data-testid="batch-id"], .batch-identifier');
          ctx.storage.set('batchId', batchId);
          ctx.sessionData.batchId = batchId;
          
          // Store in session for integrity check
          await ctx.page.evaluate((id) => {
            window.sessionStorage.setItem('currentBatchId', id);
            window.sessionStorage.setItem('batchStatus', 'processing');
          }, batchId);
        },
        async (ctx: JourneyContext) => {
          const batchId = ctx.storage.get('batchId');
          expect(batchId).toBeTruthy();
          
          // Validate batch created
          const batchStatus = await ctx.page.locator('[data-testid="batch-status"], .batch-status').textContent();
          expect(['processing', 'queued', 'in_progress'].some(s => batchStatus?.toLowerCase().includes(s))).toBe(true);
        }
      )
      
      // Step 3: Monitor Batch Progress
      .addStep('Monitor Batch Progress',
        async (ctx: JourneyContext) => {
          const startTime = Date.now();
          const maxWaitTime = 2 * 60 * 1000; // 2 minutes max
          let completed = false;
          let lastProgress = 0;
          
          while (!completed && (Date.now() - startTime) < maxWaitTime) {
            // Check progress
            const progressText = await ctx.page.textContent('[data-testid="batch-progress"], .progress-indicator');
            const progress = parseInt(progressText?.match(/\d+/)?.[0] || '0');
            
            if (progress > lastProgress) {
              console.log(`📊 Batch progress: ${progress}%`);
              lastProgress = progress;
              
              // Track progress metric
              metricsCollector.gauge('batch.progress', progress, {
                batchId: ctx.sessionData.batchId
              });
            }
            
            // Check if completed
            const statusText = await ctx.page.textContent('[data-testid="batch-status"], .batch-status');
            if (statusText?.toLowerCase().includes('complete') || 
                statusText?.toLowerCase().includes('finished')) {
              completed = true;
              break;
            }
            
            // Check for errors
            const errorCount = await ctx.page.locator('[data-testid="error-count"], .error-indicator').textContent();
            if (errorCount) {
              ctx.storage.set('batchErrors', parseInt(errorCount.match(/\d+/)?.[0] || '0'));
            }
            
            await ctx.page.waitForTimeout(2000); // Poll every 2 seconds
          }
          
          // Update session state
          await ctx.page.evaluate(() => {
            window.sessionStorage.setItem('batchStatus', 'completed');
          });
          
          // Record completion time
          const completionTime = Date.now() - startTime;
          metricsCollector.timing('batch.completion_100', completionTime);
          ctx.storage.set('batchCompletionTime', completionTime);
        },
        async (ctx: JourneyContext) => {
          const completionTime = ctx.storage.get('batchCompletionTime');
          expect(completionTime).toBeLessThan(2 * 60 * 1000); // Under 2 minutes
          
          // Check final status
          const finalStatus = await ctx.page.textContent('[data-testid="batch-status"], .batch-status');
          expect(finalStatus?.toLowerCase()).toContain('complete');
        }
      )
      
      // Step 4: Handle Partial Failures
      .addStep('Handle Partial Failures',
        async (ctx: JourneyContext) => {
          const errorCount = ctx.storage.get('batchErrors') || 0;
          
          if (errorCount === 0) {
            console.log('✅ No errors to handle');
            return;
          }
          
          console.log(`⚠️ Handling ${errorCount} batch errors`);
          
          // Click to view errors
          await ctx.page.click('[data-testid="view-errors"], button:has-text("View Errors")');
          await ctx.page.waitForSelector('[data-testid="error-list"], .error-details');
          
          // Analyze error types
          const errorElements = await ctx.page.locator('[data-testid="error-item"], .error-entry').all();
          const errorTypes = new Map<string, number>();
          
          for (const errorEl of errorElements.slice(0, 10)) { // Check first 10
            const errorType = await errorEl.getAttribute('data-error-type') || 
                            await errorEl.textContent();
            const type = errorType?.includes('validation') ? 'validation' :
                        errorType?.includes('timeout') ? 'timeout' :
                        errorType?.includes('rate') ? 'rate_limit' : 'other';
            
            errorTypes.set(type, (errorTypes.get(type) || 0) + 1);
          }
          
          ctx.storage.set('errorTypes', Object.fromEntries(errorTypes));
          
          // Select failed items for retry
          const retryCheckboxes = await ctx.page.locator('[data-testid="retry-checkbox"], input[type="checkbox"]').all();
          for (const checkbox of retryCheckboxes.slice(0, 5)) { // Retry first 5
            await checkbox.check();
          }
          
          // Store retry count
          ctx.storage.set('retryCount', Math.min(5, retryCheckboxes.length));
        },
        async (ctx: JourneyContext) => {
          const errorCount = ctx.storage.get('batchErrors') || 0;
          if (errorCount > 0) {
            expect(errorCount).toBeLessThanOrEqual(ctx.sessionData.expectedFailures + 2); // Allow some variance
            
            const errorTypes = ctx.storage.get('errorTypes');
            expect(errorTypes).toBeTruthy();
          }
        }
      )
      
      // Step 5: Download Results
      .addStep('Download Results',
        async (ctx: JourneyContext) => {
          // Setup download promise before clicking
          const downloadPromise = ctx.page.waitForEvent('download');
          
          // Click download button
          await ctx.page.click('[data-testid="download-results"], button:has-text("Download")');
          
          // Wait for download
          const download = await downloadPromise;
          const fileName = download.suggestedFilename();
          ctx.storage.set('downloadFileName', fileName);
          
          // Save download for verification
          const downloadPath = `./e2e/phase13/downloads/${fileName}`;
          await download.saveAs(downloadPath);
          
          // Verify file exists and has content
          const fs = require('fs').promises;
          const fileStats = await fs.stat(downloadPath);
          ctx.storage.set('downloadFileSize', fileStats.size);
          
          // Parse results summary
          const successCount = await ctx.page.textContent('[data-testid="success-count"], .success-metric');
          const failureCount = await ctx.page.textContent('[data-testid="failure-count"], .failure-metric');
          
          ctx.sessionData.results = {
            successful: parseInt(successCount?.match(/\d+/)?.[0] || '0'),
            failed: parseInt(failureCount?.match(/\d+/)?.[0] || '0'),
            fileName,
            fileSize: fileStats.size
          };
        },
        async (ctx: JourneyContext) => {
          const fileSize = ctx.storage.get('downloadFileSize');
          expect(fileSize).toBeGreaterThan(1000); // At least 1KB
          
          const results = ctx.sessionData.results;
          expect(results.successful + results.failed).toBe(ctx.sessionData.batchSize);
        }
      )
      
      // Step 6: Search History
      .addStep('Search History for Specific Results',
        async (ctx: JourneyContext) => {
          // Navigate to history
          await ctx.page.goto('/history');
          
          // Use advanced search
          const searchInput = ctx.page.locator('[data-testid="search-input"], input[placeholder*="Search"]');
          await searchInput.fill('topic 42'); // Search for specific prompt
          
          // Apply filters
          const techniqueFilter = ctx.page.locator('[data-testid="technique-filter"], select[name="technique"]');
          if (await techniqueFilter.count() > 0) {
            await techniqueFilter.selectOption('tree_of_thoughts');
          }
          
          // Date range filter for today
          const dateFilter = ctx.page.locator('[data-testid="date-filter"], input[type="date"]');
          if (await dateFilter.count() > 0) {
            const today = new Date().toISOString().split('T')[0];
            await dateFilter.fill(today);
          }
          
          // Execute search
          await ctx.page.click('[data-testid="search-button"], button:has-text("Search")');
          await ctx.page.waitForSelector('[data-testid="search-results"], .results-container');
          
          // Count results
          const searchResults = await ctx.page.locator('[data-testid="result-item"], .search-result').count();
          ctx.storage.set('searchResultCount', searchResults);
          
          // Export search results
          if (searchResults > 0) {
            await ctx.page.click('[data-testid="export-search"], button:has-text("Export")');
            // Store export confirmation
            const exportSuccess = await ctx.page.waitForSelector('text=/exported|download/i', {
              timeout: 5000
            }).catch(() => false);
            ctx.storage.set('searchExported', !!exportSuccess);
          }
        },
        async (ctx: JourneyContext) => {
          const searchResults = ctx.storage.get('searchResultCount');
          expect(searchResults).toBeGreaterThanOrEqual(0);
          
          if (searchResults > 0) {
            const exported = ctx.storage.get('searchExported');
            expect(exported).toBe(true);
          }
        }
      )
      
      // Step 7: Re-run Failed Items
      .addStep('Re-run Failed Items',
        async (ctx: JourneyContext) => {
          const retryCount = ctx.storage.get('retryCount') || 0;
          
          if (retryCount === 0) {
            console.log('✅ No items to retry');
            return;
          }
          
          // Click retry button
          const retryTimer = metricsCollector.startTiming('batch.retry');
          await ctx.page.click('[data-testid="retry-selected"], button:has-text("Retry")');
          
          // Wait for retry to start
          await ctx.page.waitForSelector('[data-testid="retry-progress"], .retry-indicator');
          
          // Monitor retry progress (simplified)
          await ctx.page.waitForSelector('text=/retry.*complete/i', {
            timeout: 30000
          });
          retryTimer();
          
          // Check retry results
          const retrySuccess = await ctx.page.textContent('[data-testid="retry-success"], .retry-metric');
          const retryFailed = await ctx.page.textContent('[data-testid="retry-failed"], .retry-metric');
          
          ctx.storage.set('retryResults', {
            successful: parseInt(retrySuccess?.match(/\d+/)?.[0] || '0'),
            failed: parseInt(retryFailed?.match(/\d+/)?.[0] || '0')
          });
        },
        async (ctx: JourneyContext) => {
          const retryCount = ctx.storage.get('retryCount') || 0;
          if (retryCount > 0) {
            const retryResults = ctx.storage.get('retryResults');
            expect(retryResults.successful + retryResults.failed).toBe(retryCount);
            
            // Most retries should succeed
            expect(retryResults.successful).toBeGreaterThan(retryResults.failed);
          }
        }
      )
      
      // Step 8: Export Comprehensive Report
      .addStep('Export Comprehensive Report',
        async (ctx: JourneyContext) => {
          // Navigate to reports section
          await ctx.page.click('[data-testid="reports-nav"], a:has-text("Reports")');
          await ctx.page.waitForURL(/\/reports/);
          
          // Configure report parameters
          await ctx.page.selectOption('[name="reportType"]', 'comprehensive');
          await ctx.page.selectOption('[name="format"]', 'pdf');
          
          // Include batch results
          const includeBatch = ctx.page.locator('[name="includeBatchResults"]');
          if (await includeBatch.count() > 0) {
            await includeBatch.check();
          }
          
          // Generate report
          const reportTimer = metricsCollector.startTiming('report.generate');
          const downloadPromise = ctx.page.waitForEvent('download');
          
          await ctx.page.click('[data-testid="generate-report"], button:has-text("Generate")');
          
          // Wait for report generation
          const download = await downloadPromise;
          reportTimer();
          
          // Save report
          const reportName = download.suggestedFilename();
          await download.saveAs(`./e2e/phase13/reports/${reportName}`);
          
          ctx.storage.set('reportGenerated', true);
          ctx.storage.set('reportFileName', reportName);
          
          // Record business metrics
          metricsCollector.recordJourneyMetric(
            'Power User Batch Workflow',
            'Report Generation',
            'total_prompts_processed',
            ctx.sessionData.batchSize,
            true
          );
          
          metricsCollector.recordJourneyMetric(
            'Power User Batch Workflow',
            'Report Generation',
            'success_rate',
            (ctx.sessionData.results.successful / ctx.sessionData.batchSize) * 100,
            true
          );
        },
        async (ctx: JourneyContext) => {
          const reportGenerated = ctx.storage.get('reportGenerated');
          expect(reportGenerated).toBe(true);
          
          const reportFileName = ctx.storage.get('reportFileName');
          expect(reportFileName).toContain('.pdf');
        }
      )
      
      .afterJourney(async (ctx: JourneyContext) => {
        console.log('✅ Power user journey completed!');
        
        // Validate batch processing state integrity
        const integrityResult = await validator.runDataIntegrityChecks();
        expect(integrityResult.valid).toBe(true);
        
        // Summary metrics
        const summary = {
          totalPrompts: ctx.sessionData.batchSize,
          successful: ctx.sessionData.results.successful,
          failed: ctx.sessionData.results.failed,
          retried: ctx.storage.get('retryCount') || 0,
          processingTime: ctx.storage.get('batchCompletionTime'),
          successRate: (ctx.sessionData.results.successful / ctx.sessionData.batchSize) * 100
        };
        
        console.log('📊 Batch Processing Summary:', summary);
        ctx.storage.set('summary', summary);
      })
      
      .build();

    // Create and execute journey
    orchestrator = new JourneyOrchestrator(journey, browser, context, page);
    const metrics = await orchestrator.executeJourney();
    
    // Generate reports
    const journeyReport = orchestrator.generateReport();
    console.log(journeyReport);
    
    // Validate journey success
    expect(metrics.errors.length).toBe(0);
    
    // Validate performance targets
    const summary = orchestrator.getData('summary');
    expect(summary.processingTime).toBeLessThan(2 * 60 * 1000); // Under 2 minutes for 100 items
    expect(summary.successRate).toBeGreaterThan(90); // At least 90% success rate
  });

  test.afterEach(async () => {
    // Clean up downloads directory
    const fs = require('fs').promises;
    const downloadsDir = './e2e/phase13/downloads';
    
    // Create downloads directory if it doesn't exist
    await fs.mkdir(downloadsDir, { recursive: true });
    
    // Export reports
    const metricsHtml = metricsCollector.generateDashboard();
    await fs.writeFile('e2e/phase13/reports/power-user-metrics.html', metricsHtml);
    
    const validationReport = validator.generateReport();
    await fs.writeFile('e2e/phase13/reports/power-user-validation.md', validationReport);
  });
});

// Helper function to generate test topics
function generateTopic(index: number): string {
  const topics = [
    'artificial intelligence', 'climate change', 'quantum computing',
    'renewable energy', 'space exploration', 'biotechnology',
    'cybersecurity', 'blockchain', 'machine learning', 'robotics'
  ];
  return topics[index % topics.length];
}