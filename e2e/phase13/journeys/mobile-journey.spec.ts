import { test, expect, devices } from '@playwright/test';
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
 * Mobile User Journey Test Suite
 * 
 * Complete mobile experience workflow:
 * 1. Mobile access on phone
 * 2. Touch navigation
 * 3. Register with autofill
 * 4. Voice/dictation enhancement
 * 5. Share functionality
 * 6. Switch to tablet
 * 7. Continue session
 * 8. Offline mode
 * 9. Sync when online
 */

test.describe('Mobile User Journey', () => {
  let orchestrator: JourneyOrchestrator;
  let metricsCollector: MetricsCollector;
  let validator: JourneyValidator;

  // Test on multiple devices
  const mobileDevices = [
    { name: 'iPhone 13', device: devices['iPhone 13'] },
    { name: 'Pixel 5', device: devices['Pixel 5'] }
  ];

  mobileDevices.forEach(({ name, device }) => {
    test.use({ ...device });

    test(`should complete mobile journey on ${name}`, async ({ browser }) => {
      // Create mobile context
      const context = await browser.newContext({
        ...device,
        permissions: ['geolocation'],
        geolocation: { latitude: 37.7749, longitude: -122.4194 },
        locale: 'en-US'
      });
      
      const page = await context.newPage();
      
      // Initialize utilities
      metricsCollector = createMetricsCollector();
      await metricsCollector.initialize(page);
      validator = createJourneyValidator(page, context);

      // Configure journey
      const journey = createJourney()
        .name('Mobile User Experience')
        .description('Complete mobile workflow from access to sync')
        .withTimingTargets('8min', '45s')
        .withRetryPolicy(2, 1000)
        .beforeJourney(async (ctx: JourneyContext) => {
          console.log(`📱 Starting mobile journey on ${name}...`);
          ctx.userData = {
            email: `mobile_${Date.now()}@example.com`,
            password: 'MobileUser123!',
            deviceId: `${name}_${Date.now()}`
          };
          ctx.sessionData = {
            device: name,
            touchInteractions: 0,
            offlineActions: []
          };
        })
        
        // Step 1: Mobile Access
        .addStep('Mobile Access on Phone',
          async (ctx: JourneyContext) => {
            const loadTimer = metricsCollector.startTiming('mobile.initial_load');
            await ctx.page.goto('/');
            loadTimer();
            
            // Check viewport
            const viewport = ctx.page.viewportSize();
            ctx.storage.set('viewport', viewport);
            
            // Check mobile optimizations
            const hasViewportMeta = await ctx.page.evaluate(() => {
              const meta = document.querySelector('meta[name="viewport"]');
              return meta?.getAttribute('content')?.includes('width=device-width');
            });
            expect(hasViewportMeta).toBe(true);
            
            // Check touch-friendly elements
            const buttons = await ctx.page.locator('button, a').all();
            let touchFriendlyCount = 0;
            
            for (const button of buttons.slice(0, 5)) {
              const box = await button.boundingBox();
              if (box && box.width >= 44 && box.height >= 44) {
                touchFriendlyCount++;
              }
            }
            
            ctx.storage.set('touchFriendlyElements', touchFriendlyCount);
          },
          async (ctx: JourneyContext) => {
            const viewport = ctx.storage.get('viewport');
            expect(viewport.width).toBeLessThan(500); // Mobile width
            
            const touchFriendly = ctx.storage.get('touchFriendlyElements');
            expect(touchFriendly).toBeGreaterThan(0);
          }
        )
        
        // Step 2: Touch Navigation
        .addStep('Touch Navigation',
          async (ctx: JourneyContext) => {
            // Test hamburger menu
            const menuButton = ctx.page.locator('[aria-label*="menu" i]').first();
            await menuButton.tap();
            ctx.sessionData.touchInteractions++;
            
            // Wait for menu
            await ctx.page.waitForSelector('[role="navigation"], .mobile-menu');
            
            // Navigate via touch
            await ctx.page.locator('a:has-text("Features")').tap();
            ctx.sessionData.touchInteractions++;
            
            // Test swipe gesture (scroll)
            await ctx.page.evaluate(() => {
              window.scrollTo(0, 0);
            });
            
            await ctx.page.touchscreen.swipe({
              start: { x: 200, y: 400 },
              end: { x: 200, y: 100 },
              steps: 10
            });
            
            // Check scroll worked
            const scrollY = await ctx.page.evaluate(() => window.scrollY);
            ctx.storage.set('scrolledDistance', scrollY);
            
            // Test pinch zoom prevention
            const zoomScale = await ctx.page.evaluate(() => {
              return window.visualViewport?.scale || 1;
            });
            expect(zoomScale).toBe(1);
          },
          async (ctx: JourneyContext) => {
            expect(ctx.sessionData.touchInteractions).toBeGreaterThan(0);
            const scrolled = ctx.storage.get('scrolledDistance');
            expect(scrolled).toBeGreaterThan(0);
          }
        )
        
        // Step 3: Register with Autofill
        .addStep('Register with Autofill',
          async (ctx: JourneyContext) => {
            await ctx.page.goto('/register');
            
            // Check autofill attributes
            const emailInput = ctx.page.locator('input[type="email"]');
            const hasAutocomplete = await emailInput.getAttribute('autocomplete');
            expect(hasAutocomplete).toBeTruthy();
            
            // Fill form
            await emailInput.fill(ctx.userData.email);
            await ctx.page.fill('input[type="password"]', ctx.userData.password);
            
            // Check input mode for mobile keyboard
            const inputMode = await emailInput.getAttribute('inputmode');
            expect(['email', null]).toContain(inputMode);
            
            // Submit
            await ctx.page.locator('button[type="submit"]').tap();
            await ctx.page.waitForURL(/dashboard|welcome/);
            
            // Store session
            const sessionId = await ctx.page.evaluate(() => {
              return window.sessionStorage.getItem('sessionId');
            });
            ctx.sessionData.sessionId = sessionId;
          },
          async (ctx: JourneyContext) => {
            expect(ctx.page.url()).toMatch(/dashboard|welcome/);
            expect(ctx.sessionData.sessionId).toBeTruthy();
          }
        )
        
        // Step 4: Voice Enhancement (Simulated)
        .addStep('Voice/Dictation Enhancement',
          async (ctx: JourneyContext) => {
            await ctx.page.goto('/enhance');
            
            // Simulate voice input
            const voiceButton = ctx.page.locator('[aria-label*="voice" i], [data-testid="voice-input"]');
            
            if (await voiceButton.count() > 0) {
              await voiceButton.tap();
              
              // Simulate transcription
              await ctx.page.fill('textarea', 'Create a presentation about renewable energy sources');
              
              // Enhance
              await ctx.page.locator('button:has-text("Enhance")').tap();
              await ctx.page.waitForSelector('.enhanced-result');
              
              ctx.storage.set('voiceInputUsed', true);
            } else {
              // Regular input
              await ctx.page.fill('textarea', 'Mobile test prompt');
              await ctx.page.locator('button:has-text("Enhance")').tap();
              await ctx.page.waitForSelector('.enhanced-result');
              
              ctx.storage.set('voiceInputUsed', false);
            }
          },
          async (ctx: JourneyContext) => {
            const enhancedResult = await ctx.page.locator('.enhanced-result').count();
            expect(enhancedResult).toBeGreaterThan(0);
          }
        )
        
        // Step 5: Share Functionality
        .addStep('Share Functionality',
          async (ctx: JourneyContext) => {
            // Check for share button
            const shareButton = ctx.page.locator('[aria-label*="share" i], button:has-text("Share")');
            
            if (await shareButton.count() > 0) {
              await shareButton.tap();
              
              // Check share options
              const shareMenu = await ctx.page.waitForSelector('.share-menu, [role="menu"]');
              
              // Test native share if available
              const nativeShare = ctx.page.locator('[data-share="native"]');
              if (await nativeShare.count() > 0) {
                // Would trigger navigator.share() in real scenario
                ctx.storage.set('nativeShareAvailable', true);
              }
              
              // Copy link option
              const copyLink = ctx.page.locator('button:has-text("Copy Link")');
              if (await copyLink.count() > 0) {
                await copyLink.tap();
                ctx.storage.set('linkCopied', true);
              }
            }
          },
          async (ctx: JourneyContext) => {
            // Sharing should be available on mobile
            const linkCopied = ctx.storage.get('linkCopied');
            expect(linkCopied).toBe(true);
          }
        )
        
        // Step 6: Switch to Tablet (Simulated)
        .addStep('Switch to Tablet',
          async (ctx: JourneyContext) => {
            // Store current session data
            const sessionData = await ctx.page.evaluate(() => {
              return {
                userId: window.localStorage.getItem('userId'),
                sessionId: window.sessionStorage.getItem('sessionId'),
                enhanceHistory: window.localStorage.getItem('enhanceHistory')
              };
            });
            
            ctx.storage.set('phoneSessionData', sessionData);
            
            // Simulate device switch by changing viewport
            await ctx.page.setViewportSize({ width: 768, height: 1024 });
            
            // Reload to simulate fresh tablet access
            await ctx.page.reload();
            
            console.log('📱➡️📱 Switched from phone to tablet view');
          },
          async (ctx: JourneyContext) => {
            const viewport = ctx.page.viewportSize();
            expect(viewport?.width).toBe(768); // Tablet width
          }
        )
        
        // Step 7: Continue Session
        .addStep('Continue Session on Tablet',
          async (ctx: JourneyContext) => {
            // Check if session persisted
            const currentSession = await ctx.page.evaluate(() => {
              return {
                userId: window.localStorage.getItem('userId'),
                sessionId: window.sessionStorage.getItem('sessionId')
              };
            });
            
            const phoneSession = ctx.storage.get('phoneSessionData');
            
            // User ID should persist (localStorage)
            expect(currentSession.userId).toBe(phoneSession.userId);
            
            // Navigate to history
            await ctx.page.goto('/history');
            
            // Should see previous enhancements
            const historyItems = await ctx.page.locator('.history-item').count();
            expect(historyItems).toBeGreaterThan(0);
          },
          async (ctx: JourneyContext) => {
            // Session continuity validated
            const url = ctx.page.url();
            expect(url).toContain('/history');
          }
        )
        
        // Step 8: Offline Mode
        .addStep('Offline Mode',
          async (ctx: JourneyContext) => {
            // Go offline
            await ctx.page.context().setOffline(true);
            console.log('📵 Device is now offline');
            
            // Try to enhance (should work with offline support)
            await ctx.page.goto('/enhance');
            
            // Check offline indicator
            const offlineIndicator = await ctx.page.locator('[data-testid="offline-indicator"], .offline-badge').count();
            
            if (offlineIndicator > 0) {
              ctx.storage.set('offlineModeDetected', true);
              
              // Try offline action
              await ctx.page.fill('textarea', 'Offline test prompt');
              
              // Should queue for later
              const queueMessage = await ctx.page.locator('text=/queued|offline|sync/i').count();
              ctx.storage.set('offlineQueueWorking', queueMessage > 0);
              
              // Store offline action
              ctx.sessionData.offlineActions.push({
                type: 'enhance',
                timestamp: Date.now()
              });
            }
          },
          async (ctx: JourneyContext) => {
            const offlineDetected = ctx.storage.get('offlineModeDetected');
            expect(offlineDetected).toBe(true);
          }
        )
        
        // Step 9: Sync When Online
        .addStep('Sync When Online',
          async (ctx: JourneyContext) => {
            // Go back online
            await ctx.page.context().setOffline(false);
            console.log('📶 Device is back online');
            
            // Wait for sync
            await ctx.page.waitForTimeout(2000);
            
            // Check sync indicator
            const syncIndicator = await ctx.page.locator('[data-testid="sync-indicator"], .syncing').count();
            
            if (syncIndicator > 0) {
              // Wait for sync to complete
              await ctx.page.waitForSelector('text=/synced|updated|complete/i', {
                timeout: 10000
              });
              
              ctx.storage.set('syncCompleted', true);
            }
            
            // Verify data synced
            const enhanceCount = await ctx.page.locator('.history-item').count();
            ctx.storage.set('finalEnhanceCount', enhanceCount);
          },
          async (ctx: JourneyContext) => {
            // Should be back online
            const isOnline = await ctx.page.evaluate(() => navigator.onLine);
            expect(isOnline).toBe(true);
            
            // Data should be synced
            const syncCompleted = ctx.storage.get('syncCompleted');
            if (syncCompleted) {
              const count = ctx.storage.get('finalEnhanceCount');
              expect(count).toBeGreaterThan(0);
            }
          }
        )
        
        .afterJourney(async (ctx: JourneyContext) => {
          console.log(`✅ Mobile journey completed on ${name}!`);
          
          // Mobile-specific metrics
          const mobileMetrics = {
            device: ctx.sessionData.device,
            touchInteractions: ctx.sessionData.touchInteractions,
            offlineActionsQueued: ctx.sessionData.offlineActions.length,
            voiceInputAvailable: ctx.storage.get('voiceInputUsed'),
            nativeShareAvailable: ctx.storage.get('nativeShareAvailable')
          };
          
          console.log('📱 Mobile Metrics:', mobileMetrics);
          
          // Record business metrics
          metricsCollector.recordJourneyMetric(
            'Mobile User Experience',
            'Device Usage',
            'touch_interactions',
            ctx.sessionData.touchInteractions,
            true
          );
        })
        
        .build();

      // Execute journey
      orchestrator = new JourneyOrchestrator(journey, browser, context, page);
      const metrics = await orchestrator.executeJourney();
      
      // Validate mobile experience
      expect(metrics.errors.length).toBe(0);
      expect(metrics.totalDuration).toBeLessThan(8 * 60 * 1000); // Under 8 minutes
      
      // Cleanup
      await context.close();
    });
  });

  test.afterEach(async () => {
    if (metricsCollector && validator) {
      const fs = require('fs').promises;
      await fs.mkdir('./e2e/phase13/reports', { recursive: true });
      
      const dashboard = metricsCollector.generateDashboard();
      await fs.writeFile('e2e/phase13/reports/mobile-metrics.html', dashboard);
      
      const validationReport = validator.generateReport();
      await fs.writeFile('e2e/phase13/reports/mobile-validation.md', validationReport);
    }
  });
});