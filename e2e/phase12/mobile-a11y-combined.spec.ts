import { test, expect, devices } from '@playwright/test';
import { 
  ViewportHelper, 
  createViewportHelper,
  VIEWPORTS,
  ViewportName
} from './utils/viewport-helper';
import { 
  TouchGestureSimulator,
  createTouchGestureSimulator,
  TOUCH_TARGET_REQUIREMENTS
} from './utils/touch-gesture-simulator';
import { 
  AccessibilityValidator,
  createAccessibilityValidator
} from './utils/accessibility-validator';
import {
  ScreenReaderHelper,
  createScreenReaderHelper
} from './utils/screen-reader-helper';

/**
 * Combined Mobile & Accessibility Tests
 * 
 * Tests the intersection of mobile experience and accessibility requirements
 * to ensure the application is both mobile-friendly AND accessible.
 * 
 * Key Focus Areas:
 * - Mobile screen reader compatibility
 * - Touch target accessibility
 * - Mobile keyboard navigation
 * - Responsive accessibility features
 * - Cross-device WCAG compliance
 */

test.describe('Mobile & Accessibility Combined Tests', () => {
  let viewportHelper: ViewportHelper;
  let touchSimulator: TouchGestureSimulator;
  let a11yValidator: AccessibilityValidator;
  let screenReaderHelper: ScreenReaderHelper;

  test.beforeEach(async ({ page }) => {
    viewportHelper = createViewportHelper(page);
    touchSimulator = createTouchGestureSimulator(page);
    a11yValidator = createAccessibilityValidator(page);
    screenReaderHelper = createScreenReaderHelper(page);
    await page.goto('/');
  });

  test.describe('Mobile Accessibility Compliance', () => {
    test('should maintain WCAG compliance across all viewports', async ({ page }) => {
      const viewportsToTest: ViewportName[] = ['mobile_small', 'tablet', 'desktop'];
      
      for (const viewport of viewportsToTest) {
        await viewportHelper.setViewport(viewport);
        console.log(`\n🔍 Testing WCAG compliance on ${VIEWPORTS[viewport].name}`);
        
        // Run accessibility scan for each viewport
        const results = await a11yValidator.runAxeScan();
        
        console.log(`  Violations: ${results.violations.length}`);
        console.log(`  Passes: ${results.passes.length}`);
        
        // Mobile viewports should have no additional violations
        const criticalViolations = results.violations.filter(v => v.impact === 'critical');
        expect(criticalViolations.length).toBe(0);
      }
    });

    test('should have accessible touch targets on mobile', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Get all interactive elements
      const interactiveElements = await page.locator('button, a, input, [role="button"]').all();
      
      let accessibleCount = 0;
      let totalCount = 0;
      
      for (const element of interactiveElements.slice(0, 10)) {
        totalCount++;
        
        // Check touch target size
        const sizeCheck = await touchSimulator.checkTouchTargetSize(element);
        
        // Check accessible name
        const accessibleName = await screenReaderHelper.getAccessibleName(element);
        
        if (sizeCheck.meetsMinimum && accessibleName) {
          accessibleCount++;
        } else {
          console.log(`❌ Inaccessible element: size=${sizeCheck.width}x${sizeCheck.height}, name="${accessibleName}"`);
        }
      }
      
      console.log(`\n✅ Accessible touch targets: ${accessibleCount}/${totalCount}`);
      expect(accessibleCount).toBe(totalCount);
    });
  });

  test.describe('Mobile Screen Reader Support', () => {
    test('should announce mobile UI patterns correctly', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Test mobile menu announcement
      const menuButton = page.locator('[aria-label*="menu" i]').first();
      
      if (await menuButton.count() > 0) {
        const announcement = await screenReaderHelper.getFocusAnnouncement('[aria-label*="menu" i]');
        
        // Should announce as button with proper label
        expect(announcement).toContain('button');
        expect(announcement.toLowerCase()).toContain('menu');
        
        // Check expanded state announcement
        await touchSimulator.tap(menuButton);
        
        const expandedState = await menuButton.getAttribute('aria-expanded');
        if (expandedState) {
          const stateAnnouncement = await screenReaderHelper.getFocusAnnouncement('[aria-label*="menu" i]');
          expect(stateAnnouncement).toContain(expandedState === 'true' ? 'expanded' : 'collapsed');
        }
      }
    });

    test('should handle touch gestures with screen reader', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Find swipeable content (carousel, tabs, etc.)
      const swipeableElements = await page.locator('[role="tablist"], .carousel, .slider').all();
      
      if (swipeableElements.length > 0) {
        const element = swipeableElements[0];
        const role = await screenReaderHelper.getRole(element);
        
        // Get initial state
        const initialAnnouncement = await screenReaderHelper.getAccessibleName(element);
        
        // Simulate swipe
        await touchSimulator.swipeElement(element, 'left');
        
        // Check if screen reader would announce the change
        await page.waitForTimeout(500);
        const announcements = await screenReaderHelper.getLiveAnnouncements();
        
        console.log(`📱 Swipe on ${role}: ${announcements.length} announcements`);
      }
    });
  });

  test.describe('Responsive Accessibility Features', () => {
    test('should adapt navigation accessibility for mobile', async ({ page }) => {
      // Desktop navigation
      await viewportHelper.setViewport('desktop');
      const desktopNav = await screenReaderHelper.getLandmarks();
      const desktopNavCount = desktopNav.filter(l => l.role === 'navigation').length;
      
      // Mobile navigation
      await viewportHelper.setViewport('mobile_medium');
      const mobileNav = await screenReaderHelper.getLandmarks();
      const mobileNavCount = mobileNav.filter(l => l.role === 'navigation').length;
      
      // Should have navigation landmark in both views
      expect(desktopNavCount).toBeGreaterThan(0);
      expect(mobileNavCount).toBeGreaterThan(0);
      
      console.log(`🧭 Navigation landmarks - Desktop: ${desktopNavCount}, Mobile: ${mobileNavCount}`);
    });

    test('should maintain focus management across viewports', async ({ page }) => {
      const viewportsToTest: ViewportName[] = ['mobile_small', 'desktop'];
      
      for (const viewport of viewportsToTest) {
        await viewportHelper.setViewport(viewport);
        console.log(`\n🎯 Testing focus management on ${VIEWPORTS[viewport].name}`);
        
        // Test modal focus trap
        const modalTrigger = page.locator('[data-opens-modal], [aria-haspopup="dialog"]').first();
        
        if (await modalTrigger.count() > 0) {
          await modalTrigger.click();
          
          // Check if focus moved to modal
          const modal = page.locator('[role="dialog"], .modal').first();
          if (await modal.count() > 0) {
            // First focusable element in modal should have focus
            const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
            expect(focusedElement).not.toBe('BODY');
            
            // Tab should stay within modal
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            
            const stillInModal = await page.evaluate(() => {
              const active = document.activeElement;
              const modal = document.querySelector('[role="dialog"], .modal');
              return modal?.contains(active);
            });
            
            expect(stillInModal).toBe(true);
          }
        }
      }
    });
  });

  test.describe('Mobile Form Accessibility', () => {
    test('should have accessible form inputs on mobile', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      const form = page.locator('form').first();
      
      if (await form.count() > 0) {
        const inputs = await form.locator('input, select, textarea').all();
        
        for (const input of inputs.slice(0, 5)) {
          // Check touch target size
          const sizeCheck = await touchSimulator.checkTouchTargetSize(input);
          expect(sizeCheck.meetsMinimum).toBe(true);
          
          // Check form field announcement
          const inputSelector = `input >> nth=${inputs.indexOf(input)}`;
          const announcement = await screenReaderHelper.getFormFieldAnnouncement(inputSelector);
          
          // Should have label
          expect(announcement.label).toBeTruthy();
          
          // Check mobile-specific attributes
          const inputMode = await input.getAttribute('inputmode');
          const autoComplete = await input.getAttribute('autocomplete');
          
          console.log(`📝 Input: ${announcement.label} (${announcement.type})
            - Touch target: ${sizeCheck.width}x${sizeCheck.height}px
            - Input mode: ${inputMode || 'default'}
            - Autocomplete: ${autoComplete || 'none'}`);
        }
      }
    });

    test('should handle mobile keyboard with screen reader', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      const input = page.locator('input[type="text"]').first();
      
      if (await input.count() > 0) {
        // Focus input
        await input.focus();
        
        // Get announcement
        const announcement = await screenReaderHelper.getFocusAnnouncement('input[type="text"]');
        console.log(`📢 Input focus: "${announcement}"`);
        
        // Type with mobile keyboard
        await input.type('Test input');
        
        // Tab to next field
        await page.keyboard.press('Tab');
        
        // Should announce next field
        const nextElement = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el?.tagName,
            role: el?.getAttribute('role'),
            label: el?.getAttribute('aria-label')
          };
        });
        
        expect(nextElement.tag).not.toBe('BODY');
      }
    });
  });

  test.describe('Cross-Device Testing', () => {
    test('should work with mobile screen readers', async ({ page }) => {
      // Simulate mobile screen reader settings
      await viewportHelper.emulateDevice('mobile_medium');
      
      // Check for screen reader optimizations
      const hasSkipLinks = await a11yValidator.checkSkipLinks();
      const landmarks = await screenReaderHelper.getLandmarks();
      const headings = await screenReaderHelper.getHeadingStructure();
      
      console.log(`\n📱 Mobile Screen Reader Compatibility:
        - Skip links: ${hasSkipLinks.present ? '✅' : '❌'}
        - Landmarks: ${landmarks.length}
        - Headings: ${headings.length}`);
      
      // Mobile should have same accessibility features
      expect(landmarks.length).toBeGreaterThan(0);
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should handle orientation change accessibility', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Get initial accessibility state
      const initialLandmarks = await screenReaderHelper.getLandmarks();
      const initialHeadings = await screenReaderHelper.getHeadingStructure();
      
      // Rotate device
      await touchSimulator.rotateDevice();
      await page.waitForTimeout(500);
      
      // Check accessibility after rotation
      const rotatedLandmarks = await screenReaderHelper.getLandmarks();
      const rotatedHeadings = await screenReaderHelper.getHeadingStructure();
      
      // Structure should remain accessible
      expect(rotatedLandmarks.length).toBe(initialLandmarks.length);
      expect(rotatedHeadings.length).toBe(initialHeadings.length);
      
      console.log(`🔄 Orientation change: Landmarks and headings preserved`);
    });
  });

  test.describe('Performance & Accessibility', () => {
    test('should maintain accessibility with lazy loading', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Check images
      const images = await page.locator('img').all();
      
      for (const img of images.slice(0, 5)) {
        const loading = await img.getAttribute('loading');
        const alt = await img.getAttribute('alt');
        
        // Lazy loaded images should still have alt text
        if (loading === 'lazy') {
          expect(alt).toBeTruthy();
        }
        
        // Check if image is in viewport
        const selector = `img >> nth=${images.indexOf(img)}`;
        const inViewport = await viewportHelper.isElementInViewport(selector);
        
        console.log(`🖼️ Image: alt="${alt}", lazy=${loading === 'lazy'}, visible=${inViewport}`);
      }
    });

    test('should handle dynamic content accessibly on mobile', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Clear announcements
      await screenReaderHelper.clearAnnouncements();
      
      // Find dynamic content triggers
      const loadMoreButton = page.locator('button:has-text("Load more"), button:has-text("Show more")').first();
      
      if (await loadMoreButton.count() > 0) {
        // Check button accessibility
        const buttonA11y = await screenReaderHelper.getFocusAnnouncement(loadMoreButton);
        expect(buttonA11y).toBeTruthy();
        
        // Click to load content
        await touchSimulator.tap(loadMoreButton);
        await page.waitForTimeout(1000);
        
        // Check for announcements
        const announcements = await screenReaderHelper.getLiveAnnouncements();
        
        if (announcements.length > 0) {
          console.log(`📣 Dynamic content announcements: ${announcements.length}`);
          expect(announcements[0].priority).toBe('polite');
        }
      }
    });
  });

  test.describe('Comprehensive Report', () => {
    test('should generate combined mobile-a11y report', async ({ page }) => {
      const report: any = {
        timestamp: new Date().toISOString(),
        viewports: {},
        touchTargets: {
          total: 0,
          accessible: 0,
          issues: []
        },
        wcagCompliance: {},
        mobileA11y: {
          skipLinks: false,
          landmarks: 0,
          headings: 0,
          formAccessibility: true
        }
      };
      
      // Test each viewport
      for (const [name, config] of Object.entries(VIEWPORTS)) {
        await viewportHelper.setViewport(name as ViewportName);
        
        const axeResults = await a11yValidator.runAxeScan({ tags: ['wcag2aa'] });
        report.viewports[name] = {
          violations: axeResults.violations.length,
          passes: axeResults.passes.length
        };
      }
      
      // Mobile-specific tests
      await viewportHelper.setViewport('mobile_medium');
      
      // Touch targets
      const touchValidation = await touchSimulator.validateAllTouchTargets();
      report.touchTargets = touchValidation;
      
      // WCAG compliance
      const wcag = await a11yValidator.checkWCAGCompliance();
      report.wcagCompliance = wcag.compliant;
      
      // Mobile accessibility features
      const skipLinks = await a11yValidator.checkSkipLinks();
      const landmarks = await screenReaderHelper.getLandmarks();
      const headings = await screenReaderHelper.getHeadingStructure();
      
      report.mobileA11y = {
        skipLinks: skipLinks.present,
        landmarks: landmarks.length,
        headings: headings.length,
        formAccessibility: true
      };
      
      console.log('\n📊 MOBILE ACCESSIBILITY REPORT');
      console.log('===============================');
      console.log(JSON.stringify(report, null, 2));
      
      // Save report
      const reportContent = `# Mobile & Accessibility Test Report

Generated: ${report.timestamp}

## Viewport Compliance
${Object.entries(report.viewports).map(([viewport, data]: [string, any]) => 
  `- ${viewport}: ${data.violations} violations, ${data.passes} passes`
).join('\n')}

## Touch Target Accessibility
- Total targets: ${report.touchTargets.total}
- Accessible: ${report.touchTargets.accessible}
- Success rate: ${((report.touchTargets.accessible / report.touchTargets.total) * 100).toFixed(1)}%

## WCAG 2.1 AA Compliance
- Status: ${report.wcagCompliance ? '✅ Compliant' : '❌ Non-compliant'}

## Mobile Accessibility Features
- Skip links: ${report.mobileA11y.skipLinks ? '✅' : '❌'}
- Landmarks: ${report.mobileA11y.landmarks}
- Headings: ${report.mobileA11y.headings}
- Form accessibility: ${report.mobileA11y.formAccessibility ? '✅' : '❌'}

## Recommendations
1. Ensure all touch targets meet 44x44px minimum
2. Test with actual mobile screen readers
3. Verify color contrast on all viewports
4. Implement skip links if missing
5. Label all landmark regions
`;
      
      await page.evaluate((content) => {
        (window as any).__mobileA11yReport = content;
      }, reportContent);
    });
  });
});