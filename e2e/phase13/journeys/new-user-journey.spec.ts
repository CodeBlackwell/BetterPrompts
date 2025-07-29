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
 * New User Journey Test Suite
 * 
 * Complete journey from first visit to active user:
 * 1. Homepage visit
 * 2. Try anonymous enhancement
 * 3. Register account
 * 4. Verify email
 * 5. Login
 * 6. First prompt enhancement
 * 7. View history
 * 8. Batch upload
 * 9. Update settings
 */

test.describe('New User Journey', () => {
  let orchestrator: JourneyOrchestrator;
  let metricsCollector: MetricsCollector;
  let validator: JourneyValidator;

  test.beforeEach(async ({ browser, context, page }) => {
    metricsCollector = createMetricsCollector();
    await metricsCollector.initialize(page);
    validator = createJourneyValidator(page, context);
    
    // Add standard data integrity checks
    const integrityChecks = JourneyValidator.createStandardDataIntegrityChecks(page);
    integrityChecks.forEach(check => validator.addDataIntegrityCheck(check));
  });

  test('should complete full new user onboarding journey', async ({ browser, context, page }) => {
    // Configure journey
    const journey = createJourney()
      .name('New User Onboarding')
      .description('Complete journey from first visit to active user')
      .withTimingTargets('5min', '30s')
      .withRetryPolicy(2, 1000)
      .beforeJourney(async (ctx: JourneyContext) => {
        console.log('🚀 Starting new user journey...');
        ctx.userData = {
          email: `testuser_${Date.now()}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User'
        };
      })
      
      // Step 1: Homepage Visit
      .addStep('Visit Homepage', 
        async (ctx: JourneyContext) => {
          const stopTimer = metricsCollector.startTiming('homepage.load');
          await ctx.page.goto('/');
          stopTimer();
          
          // Track page load metrics
          const perfTimings = await metricsCollector.measurePageLoad('/');
          ctx.storage.set('homepageMetrics', perfTimings);
        },
        async (ctx: JourneyContext) => {
          // Validate homepage loaded
          await expect(ctx.page).toHaveTitle(/BetterPrompts/);
          await expect(ctx.page.locator('h1')).toContainText(/Better Prompts/i);
          
          // Validate navigation elements
          const navResult = await validator.validateUIConsistency([
            {
              selector: 'nav',
              property: 'visible',
              expectedValue: true,
              description: 'Navigation menu visible'
            },
            {
              selector: '[data-testid="try-now-button"], button:has-text("Try Now")',
              property: 'visible',
              expectedValue: true,
              description: 'Try Now button visible'
            }
          ]);
          
          expect(navResult.valid).toBe(true);
        }
      )
      
      // Step 2: Try Anonymous Enhancement
      .addStep('Try Anonymous Enhancement',
        async (ctx: JourneyContext) => {
          // Click try now button
          await metricsCollector.trackInteraction('click', 'try-now-button', async () => {
            await ctx.page.click('[data-testid="try-now-button"], button:has-text("Try Now")');
          });
          
          // Wait for enhancement page
          await ctx.page.waitForURL(/\/enhance|\/try/);
          
          // Enter sample prompt
          const samplePrompt = 'Write a summary of climate change impacts';
          await ctx.page.fill('[data-testid="prompt-input"], textarea[placeholder*="prompt"]', samplePrompt);
          
          // Submit enhancement
          const enhanceTimer = metricsCollector.startTiming('anonymous.enhance');
          await ctx.page.click('[data-testid="enhance-button"], button:has-text("Enhance")');
          
          // Wait for results
          await ctx.page.waitForSelector('[data-testid="enhanced-prompt"], .enhanced-result', {
            timeout: 30000
          });
          enhanceTimer();
          
          // Store enhanced prompt
          const enhancedPrompt = await ctx.page.textContent('[data-testid="enhanced-prompt"], .enhanced-result');
          ctx.storage.set('anonymousEnhancedPrompt', enhancedPrompt);
        },
        async (ctx: JourneyContext) => {
          // Validate enhancement worked
          const enhancedPrompt = ctx.storage.get('anonymousEnhancedPrompt');
          expect(enhancedPrompt).toBeTruthy();
          expect(enhancedPrompt.length).toBeGreaterThan(50);
          
          // Check for registration prompt
          const registerPrompt = await ctx.page.locator('text=/save|register|sign up/i').count();
          expect(registerPrompt).toBeGreaterThan(0);
        }
      )
      
      // Step 3: Register Account
      .addStep('Register Account',
        async (ctx: JourneyContext) => {
          // Click register/sign up
          await ctx.page.click('a:has-text("Register"), button:has-text("Sign Up")');
          await ctx.page.waitForURL(/\/register|\/signup/);
          
          // Fill registration form
          const { email, password, firstName, lastName } = ctx.userData;
          
          await ctx.page.fill('[name="email"], #email', email);
          await ctx.page.fill('[name="password"], #password', password);
          await ctx.page.fill('[name="confirmPassword"], #confirmPassword', password);
          await ctx.page.fill('[name="firstName"], #firstName', firstName);
          await ctx.page.fill('[name="lastName"], #lastName', lastName);
          
          // Accept terms if present
          const termsCheckbox = ctx.page.locator('[name="acceptTerms"], #acceptTerms');
          if (await termsCheckbox.count() > 0) {
            await termsCheckbox.check();
          }
          
          // Submit registration
          const registerTimer = metricsCollector.startTiming('user.register');
          await ctx.page.click('button[type="submit"]:has-text("Register"), button:has-text("Sign Up")');
          
          // Wait for success
          await ctx.page.waitForURL(/\/verify|\/welcome|\/dashboard/, { timeout: 10000 });
          registerTimer();
          
          // Check for verification message
          const verificationMessage = await ctx.page.locator('text=/verify|confirm|check.*email/i').count();
          ctx.storage.set('requiresEmailVerification', verificationMessage > 0);
        },
        async (ctx: JourneyContext) => {
          // Validate registration success
          const currentUrl = ctx.page.url();
          expect(currentUrl).toMatch(/verify|welcome|dashboard/);
          
          // Check session established
          const session = await validator.validateSession();
          expect(session.isValid).toBe(true);
          expect(session.userId).toBeTruthy();
        }
      )
      
      // Step 4: Verify Email (if required)
      .addStep('Verify Email',
        async (ctx: JourneyContext) => {
          const requiresVerification = ctx.storage.get('requiresEmailVerification');
          if (!requiresVerification) {
            console.log('📧 Email verification not required, skipping...');
            return;
          }
          
          // In real scenario, we'd check email
          // For testing, look for verification link or simulate
          const verifyLink = await ctx.page.locator('a:has-text("Verify Email")').first();
          
          if (await verifyLink.count() > 0) {
            await verifyLink.click();
          } else {
            // Simulate verification by visiting verify endpoint
            const email = ctx.userData.email;
            const verifyUrl = `/verify-email?token=test_${Date.now()}&email=${encodeURIComponent(email)}`;
            await ctx.page.goto(verifyUrl);
          }
          
          // Wait for verification success
          await ctx.page.waitForSelector('text=/verified|confirmed|success/i', {
            timeout: 10000
          });
        },
        async (ctx: JourneyContext) => {
          if (!ctx.storage.get('requiresEmailVerification')) {
            return;
          }
          
          // Validate email verified
          const successMessage = await ctx.page.locator('text=/verified|confirmed|success/i').count();
          expect(successMessage).toBeGreaterThan(0);
        }
      )
      
      // Step 5: Login
      .addStep('Login',
        async (ctx: JourneyContext) => {
          // Navigate to login if not already there
          const currentUrl = ctx.page.url();
          if (!currentUrl.includes('/login') && !currentUrl.includes('/dashboard')) {
            await ctx.page.goto('/login');
          }
          
          // If already logged in from registration, skip
          if (currentUrl.includes('/dashboard')) {
            console.log('✅ Already logged in from registration');
            return;
          }
          
          // Fill login form
          const { email, password } = ctx.userData;
          await ctx.page.fill('[name="email"], #email', email);
          await ctx.page.fill('[name="password"], #password', password);
          
          // Submit login
          const loginTimer = metricsCollector.startTiming('user.login');
          await ctx.page.click('button[type="submit"]:has-text("Login"), button:has-text("Sign In")');
          
          // Wait for dashboard
          await ctx.page.waitForURL(/\/dashboard|\/home/, { timeout: 10000 });
          loginTimer();
          
          // Store auth token if available
          const authToken = await ctx.page.evaluate(() => {
            return window.localStorage.getItem('authToken') || 
                   window.sessionStorage.getItem('authToken');
          });
          ctx.sessionData.authToken = authToken;
        },
        async (ctx: JourneyContext) => {
          // Validate logged in
          expect(ctx.page.url()).toMatch(/dashboard|home/);
          
          // Validate session
          const session = await validator.validateSession();
          expect(session.isValid).toBe(true);
          expect(session.userId).toBeTruthy();
          
          // Check user data persistence
          await validator.validateDataPersistence('userId', session.userId);
        }
      )
      
      // Step 6: First Prompt Enhancement
      .addStep('First Prompt Enhancement',
        async (ctx: JourneyContext) => {
          // Navigate to enhance page
          await ctx.page.click('a:has-text("Enhance"), [data-testid="enhance-nav"]');
          await ctx.page.waitForURL(/\/enhance/);
          
          // Enter prompt
          const testPrompt = 'Explain quantum computing to a 10-year-old';
          await ctx.page.fill('[data-testid="prompt-input"], textarea', testPrompt);
          
          // Select technique if available
          const techniqueSelector = ctx.page.locator('[data-testid="technique-selector"], select[name="technique"]');
          if (await techniqueSelector.count() > 0) {
            await techniqueSelector.selectOption({ index: 1 }); // Select first technique
          }
          
          // Enhance prompt
          const enhanceTimer = metricsCollector.startTiming('authenticated.enhance');
          await ctx.page.click('[data-testid="enhance-button"], button:has-text("Enhance")');
          
          // Wait for result
          await ctx.page.waitForSelector('[data-testid="enhanced-prompt"], .enhanced-result', {
            timeout: 30000
          });
          const enhanceTime = enhanceTimer();
          
          // Store result
          const enhancedPrompt = await ctx.page.textContent('[data-testid="enhanced-prompt"], .enhanced-result');
          ctx.storage.set('firstEnhancedPrompt', enhancedPrompt);
          
          // Record business metric
          metricsCollector.recordJourneyMetric(
            'New User Onboarding',
            'First Enhancement',
            'enhancement_time',
            enhanceTime
          );
        },
        async (ctx: JourneyContext) => {
          // Validate enhancement
          const enhancedPrompt = ctx.storage.get('firstEnhancedPrompt');
          expect(enhancedPrompt).toBeTruthy();
          expect(enhancedPrompt.length).toBeGreaterThan(100);
          
          // Check if saved to history
          const saveButton = await ctx.page.locator('button:has-text("Save")').count();
          expect(saveButton).toBeGreaterThan(0);
        }
      )
      
      // Step 7: View History
      .addStep('View History',
        async (ctx: JourneyContext) => {
          // Navigate to history
          await ctx.page.click('a:has-text("History"), [data-testid="history-nav"]');
          await ctx.page.waitForURL(/\/history/);
          
          // Wait for history to load
          await ctx.page.waitForSelector('[data-testid="history-list"], .history-items', {
            timeout: 10000
          });
          
          // Count history items
          const historyItems = await ctx.page.locator('[data-testid="history-item"], .history-entry').count();
          ctx.storage.set('historyCount', historyItems);
          
          // Try to view a history item
          if (historyItems > 0) {
            await ctx.page.click('[data-testid="history-item"]:first-child, .history-entry:first-child');
            await ctx.page.waitForSelector('[data-testid="history-detail"], .prompt-detail');
          }
        },
        async (ctx: JourneyContext) => {
          // Validate history loaded
          const historyCount = ctx.storage.get('historyCount');
          expect(historyCount).toBeGreaterThanOrEqual(0);
          
          // If user enhanced prompts, should have history
          if (ctx.storage.get('firstEnhancedPrompt')) {
            expect(historyCount).toBeGreaterThan(0);
          }
        }
      )
      
      // Step 8: Batch Upload
      .addStep('Batch Upload',
        async (ctx: JourneyContext) => {
          // Navigate to batch upload
          await ctx.page.click('a:has-text("Batch"), [data-testid="batch-nav"]');
          await ctx.page.waitForURL(/\/batch/);
          
          // Create test CSV content
          const csvContent = `prompt,technique
"Write a blog post about AI",chain_of_thought
"Create a marketing strategy",tree_of_thoughts
"Explain machine learning",few_shot`;
          
          // Create file and upload
          const buffer = Buffer.from(csvContent);
          await ctx.page.setInputFiles('input[type="file"], [data-testid="file-upload"]', {
            name: 'test-batch.csv',
            mimeType: 'text/csv',
            buffer
          });
          
          // Start batch processing
          const batchTimer = metricsCollector.startTiming('batch.process');
          await ctx.page.click('button:has-text("Process"), [data-testid="process-batch"]');
          
          // Wait for processing to complete
          await ctx.page.waitForSelector('text=/complete|finished|done/i', {
            timeout: 60000
          });
          const batchTime = batchTimer();
          
          // Check results
          const processedCount = await ctx.page.locator('[data-testid="processed-count"], .processed-count').textContent();
          ctx.storage.set('batchProcessedCount', processedCount);
          
          // Record metric
          metricsCollector.recordJourneyMetric(
            'New User Onboarding',
            'Batch Upload',
            'batch_processing_time',
            batchTime
          );
        },
        async (ctx: JourneyContext) => {
          // Validate batch processing
          const processedCount = ctx.storage.get('batchProcessedCount');
          expect(processedCount).toBeTruthy();
          expect(parseInt(processedCount) || 0).toBeGreaterThan(0);
        }
      )
      
      // Step 9: Update Settings
      .addStep('Update Settings',
        async (ctx: JourneyContext) => {
          // Navigate to settings
          await ctx.page.click('a:has-text("Settings"), [data-testid="settings-nav"]');
          await ctx.page.waitForURL(/\/settings/);
          
          // Update profile
          await ctx.page.fill('[name="displayName"], #displayName', 'Test User Updated');
          
          // Update preferences
          const darkModeToggle = ctx.page.locator('[data-testid="dark-mode-toggle"], #darkMode');
          if (await darkModeToggle.count() > 0) {
            await darkModeToggle.click();
          }
          
          // Save settings
          await ctx.page.click('button:has-text("Save"), [data-testid="save-settings"]');
          
          // Wait for success message
          await ctx.page.waitForSelector('text=/saved|updated|success/i');
          
          // Store preferences
          const preferences = await ctx.page.evaluate(() => {
            return {
              darkMode: window.localStorage.getItem('darkMode') === 'true',
              displayName: window.localStorage.getItem('displayName')
            };
          });
          ctx.sessionData.preferences = preferences;
        },
        async (ctx: JourneyContext) => {
          // Validate settings saved
          const successMessage = await ctx.page.locator('text=/saved|updated|success/i').count();
          expect(successMessage).toBeGreaterThan(0);
          
          // Validate preferences persisted
          const preferences = ctx.sessionData.preferences;
          expect(preferences).toBeTruthy();
          await validator.validateDataPersistence('displayName', preferences.displayName);
        }
      )
      
      .afterJourney(async (ctx: JourneyContext) => {
        console.log('✅ New user journey completed successfully!');
        
        // Run final data integrity checks
        const integrityResult = await validator.runDataIntegrityChecks();
        expect(integrityResult.valid).toBe(true);
        
        // Validate complete user state
        const finalValidation = await validator.validateSession();
        expect(finalValidation.isValid).toBe(true);
        
        // Generate reports
        const metricsReport = metricsCollector.exportMetrics();
        const validationReport = validator.generateReport();
        
        // Store reports
        ctx.storage.set('metricsReport', metricsReport);
        ctx.storage.set('validationReport', validationReport);
      })
      
      .build();

    // Create and execute journey
    orchestrator = new JourneyOrchestrator(journey, browser, context, page);
    const metrics = await orchestrator.executeJourney();
    
    // Generate journey report
    const report = orchestrator.generateReport();
    console.log(report);
    
    // Assert journey completed successfully
    expect(metrics.errors.length).toBe(0);
    expect(metrics.totalDuration).toBeLessThan(5 * 60 * 1000); // Under 5 minutes
    
    // Verify all steps completed
    const state = orchestrator.getState();
    expect(state.stepHistory.length).toBe(journey.steps.length);
  });

  test.afterEach(async () => {
    // Export metrics dashboard
    const dashboard = metricsCollector.generateDashboard();
    const fs = require('fs').promises;
    await fs.writeFile('e2e/phase13/reports/new-user-journey-metrics.html', dashboard);
    
    // Export validation report
    const validationReport = validator.generateReport();
    await fs.writeFile('e2e/phase13/reports/new-user-validation.md', validationReport);
  });
});