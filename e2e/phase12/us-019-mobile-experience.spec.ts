import { test, expect } from '@playwright/test';
import { 
  ViewportHelper, 
  createViewportHelper,
  VIEWPORTS,
  testAllViewports
} from './utils/viewport-helper';
import { 
  TouchGestureSimulator,
  createTouchGestureSimulator,
  TOUCH_TARGET_REQUIREMENTS
} from './utils/touch-gesture-simulator';

/**
 * US-019: Mobile Experience Tests
 * 
 * Story: "As a mobile user, I want a seamless experience on my device"
 * 
 * Acceptance Criteria:
 * - All features work on mobile viewports
 * - Touch targets meet minimum size requirements (44x44px)
 * - Responsive design adapts to all screen sizes
 * - Touch gestures work correctly
 * - No horizontal scrolling on mobile
 * - Forms are mobile-optimized
 */

test.describe('US-019: Mobile Experience', () => {
  let viewportHelper: ViewportHelper;
  let touchSimulator: TouchGestureSimulator;

  test.beforeEach(async ({ page }) => {
    viewportHelper = createViewportHelper(page);
    touchSimulator = createTouchGestureSimulator(page);
    await page.goto('/');
  });

  test.describe('Viewport Responsiveness', () => {
    test('should display correctly on all mobile viewports', async ({ page }) => {
      await testAllViewports(page, async (viewport) => {
        // Check viewport meta tag
        const hasViewportMeta = await viewportHelper.hasProperViewportMetaTag();
        expect(hasViewportMeta).toBe(true);

        // Check no horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll).toBe(false);

        // Check main content is visible
        await expect(page.locator('main')).toBeVisible();
        
        // Check navigation adapts
        const isMobile = await viewportHelper.isMobileViewport();
        if (isMobile) {
          // Mobile menu should be present
          await expect(page.locator('[aria-label="Mobile menu"]')).toBeVisible();
        } else {
          // Desktop nav should be visible
          await expect(page.locator('nav')).toBeVisible();
        }

        console.log(`✅ Viewport ${viewport} displays correctly`);
      });
    });

    test('should handle orientation changes', async ({ page }) => {
      // Set to mobile viewport
      await viewportHelper.setViewport('mobile_medium');
      
      // Get initial layout
      const initialWidth = await page.evaluate(() => window.innerWidth);
      
      // Rotate viewport
      await viewportHelper.rotateViewport();
      
      // Check layout adapted
      const rotatedWidth = await page.evaluate(() => window.innerWidth);
      expect(rotatedWidth).toBeGreaterThan(initialWidth);
      
      // Verify no layout breaking
      await expect(page.locator('main')).toBeVisible();
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    test('should prevent zoom on input focus', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Check input zoom prevention
      const zoomPrevented = await viewportHelper.testInputZoomPrevention();
      expect(zoomPrevented).toBe(true);
      
      // Navigate to form if exists
      const hasForm = await page.locator('form').count() > 0;
      if (hasForm) {
        const inputs = await page.locator('input[type="text"], input[type="email"], textarea').all();
        for (const input of inputs) {
          const fontSize = await input.evaluate(el => 
            window.getComputedStyle(el).fontSize
          );
          expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16);
        }
      }
    });
  });

  test.describe('Touch Interactions', () => {
    test('should have properly sized touch targets', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Validate all touch targets
      const validation = await touchSimulator.validateAllTouchTargets();
      
      console.log(`📊 Touch target validation:
        - Total: ${validation.total}
        - Valid: ${validation.valid}
        - Invalid: ${validation.invalid.length}`);
      
      // All touch targets should meet minimum size
      expect(validation.invalid.length).toBe(0);
      
      if (validation.invalid.length > 0) {
        console.log('❌ Invalid touch targets:', validation.invalid);
      }
    });

    test('should respond to tap gestures', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Find all tappable elements
      const buttons = await page.locator('button:visible').all();
      const links = await page.locator('a:visible').all();
      
      // Test tap on buttons
      if (buttons.length > 0) {
        const button = buttons[0];
        const text = await button.textContent();
        await touchSimulator.tap(button);
        console.log(`✅ Tapped button: ${text}`);
      }
      
      // Test tap on links
      if (links.length > 0) {
        const link = links[0];
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('#')) {
          const responsiveness = await touchSimulator.testTouchResponsiveness('a');
          expect(responsiveness.respondsToTap).toBe(true);
        }
      }
    });

    test('should support swipe gestures', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Test vertical scroll with swipe
      await page.evaluate(() => window.scrollTo(0, 0));
      const initialScroll = await page.evaluate(() => window.scrollY);
      
      await touchSimulator.testTouchScroll('vertical');
      await page.waitForTimeout(500);
      
      const finalScroll = await page.evaluate(() => window.scrollY);
      // Scroll position should change after swipe
      expect(Math.abs(finalScroll - initialScroll)).toBeGreaterThan(0);
    });

    test('should handle long press interactions', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Find elements that might have long press functionality
      const interactiveElements = await page.locator('button, a, [role="button"]').all();
      
      if (interactiveElements.length > 0) {
        const element = interactiveElements[0];
        
        // Test long press doesn't trigger unwanted behavior
        await touchSimulator.longPress(element, 1000);
        
        // Verify no context menu or unwanted navigation
        const contextMenu = await page.locator('[role="menu"]').count();
        expect(contextMenu).toBe(0);
      }
    });
  });

  test.describe('Mobile Navigation', () => {
    test('should have accessible mobile menu', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Look for mobile menu button
      const menuButton = page.locator('[aria-label*="menu" i], button:has-text("Menu")').first();
      
      if (await menuButton.count() > 0) {
        // Check touch target size
        const sizeCheck = await touchSimulator.checkTouchTargetSize(menuButton);
        expect(sizeCheck.meetsMinimum).toBe(true);
        
        // Test menu interaction
        await touchSimulator.tap(menuButton);
        
        // Menu should open
        const mobileNav = page.locator('nav[aria-expanded="true"], .mobile-menu');
        await expect(mobileNav).toBeVisible({ timeout: 2000 });
        
        // Check menu items are properly sized
        const menuItems = await mobileNav.locator('a, button').all();
        for (const item of menuItems.slice(0, 3)) {
          const itemSize = await touchSimulator.checkTouchTargetSize(item);
          expect(itemSize.meetsMinimum).toBe(true);
        }
      }
    });

    test('should handle mobile-specific UI patterns', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Check for mobile-specific patterns
      const patterns = {
        'hamburger_menu': '[aria-label*="menu" i]',
        'bottom_nav': 'nav[class*="bottom"], .bottom-navigation',
        'tab_bar': '[role="tablist"]',
        'floating_action': 'button[class*="fab"], .floating-action-button'
      };
      
      for (const [pattern, selector] of Object.entries(patterns)) {
        const element = page.locator(selector).first();
        if (await element.count() > 0) {
          console.log(`📱 Found mobile pattern: ${pattern}`);
          
          // Verify touch target size
          const sizeCheck = await touchSimulator.checkTouchTargetSize(element);
          expect(sizeCheck.meetsMinimum).toBe(true);
        }
      }
    });
  });

  test.describe('Mobile Forms', () => {
    test('should optimize forms for mobile input', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Navigate to a form page
      const hasForm = await page.locator('form').count() > 0;
      
      if (hasForm) {
        const form = page.locator('form').first();
        
        // Check input types are appropriate
        const inputs = await form.locator('input').all();
        
        for (const input of inputs) {
          const type = await input.getAttribute('type');
          const inputMode = await input.getAttribute('inputmode');
          const autoComplete = await input.getAttribute('autocomplete');
          
          // Verify mobile-optimized input types
          switch (type) {
            case 'email':
              expect(['email', 'text'].includes(inputMode || '')).toBe(true);
              break;
            case 'tel':
              expect(inputMode).toBe('tel');
              break;
            case 'number':
              expect(['numeric', 'decimal'].includes(inputMode || '')).toBe(true);
              break;
          }
          
          // Check touch target size
          const sizeCheck = await touchSimulator.checkTouchTargetSize(input);
          expect(sizeCheck.meetsMinimum).toBe(true);
        }
        
        // Check submit button
        const submitButton = form.locator('button[type="submit"], input[type="submit"]').first();
        if (await submitButton.count() > 0) {
          const buttonSize = await touchSimulator.checkTouchTargetSize(submitButton);
          expect(buttonSize.meetsRecommended).toBe(true);
        }
      }
    });

    test('should handle mobile keyboard interactions', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      const input = page.locator('input[type="text"], input[type="email"]').first();
      
      if (await input.count() > 0) {
        // Focus input
        await touchSimulator.tap(input);
        
        // Input should be focused
        await expect(input).toBeFocused();
        
        // Type some text
        await input.type('Mobile test input');
        
        // Check value was entered
        const value = await input.inputValue();
        expect(value).toBe('Mobile test input');
        
        // Dismiss keyboard (tap outside)
        await page.locator('body').click({ position: { x: 10, y: 10 } });
        
        // Input should no longer be focused
        await expect(input).not.toBeFocused();
      }
    });
  });

  test.describe('Mobile Performance', () => {
    test('should have optimized images for mobile', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Check images have proper attributes
      const images = await page.locator('img').all();
      
      for (const img of images.slice(0, 5)) {
        // Check for responsive images
        const srcset = await img.getAttribute('srcset');
        const sizes = await img.getAttribute('sizes');
        const loading = await img.getAttribute('loading');
        
        // Images should have responsive attributes or lazy loading
        const hasResponsiveAttrs = srcset !== null || sizes !== null;
        const hasLazyLoading = loading === 'lazy';
        
        expect(hasResponsiveAttrs || hasLazyLoading).toBe(true);
      }
    });

    test('should handle touch target spacing', async ({ page }) => {
      await viewportHelper.setViewport('mobile_medium');
      
      // Check spacing between interactive elements
      const buttons = await page.locator('button:visible').all();
      
      if (buttons.length >= 2) {
        // Check spacing between first two buttons
        const spacing = await touchSimulator.checkTouchTargetSpacing(
          'button:visible >> nth=0',
          'button:visible >> nth=1'
        );
        
        expect(spacing.meetsRequirement).toBe(true);
        console.log(`✅ Touch target spacing: ${spacing.distance}px`);
      }
    });
  });

  test.describe('Cross-Device Validation', () => {
    test('should maintain functionality across all devices', async ({ page }) => {
      const criticalFeatures = [
        { name: 'Main content', selector: 'main' },
        { name: 'Navigation', selector: 'nav, [role="navigation"]' },
        { name: 'Primary action', selector: 'button[type="submit"], .primary-button, .cta-button' }
      ];
      
      // Test each viewport
      for (const [viewportName, config] of Object.entries(VIEWPORTS)) {
        await viewportHelper.setViewport(viewportName as keyof typeof VIEWPORTS);
        console.log(`\n📱 Testing ${config.name}`);
        
        // Verify critical features are accessible
        for (const feature of criticalFeatures) {
          const element = page.locator(feature.selector).first();
          if (await element.count() > 0) {
            await expect(element).toBeVisible();
            console.log(`  ✅ ${feature.name} visible`);
            
            // For interactive elements, check touch target
            if (feature.name !== 'Main content') {
              const sizeCheck = await touchSimulator.checkTouchTargetSize(element);
              if (config.hasTouch) {
                expect(sizeCheck.meetsMinimum).toBe(true);
              }
            }
          }
        }
      }
    });
  });
});