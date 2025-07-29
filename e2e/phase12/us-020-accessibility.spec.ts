import { test, expect } from '@playwright/test';
import { 
  AccessibilityValidator,
  createAccessibilityValidator,
  COLOR_CONTRAST_REQUIREMENTS
} from './utils/accessibility-validator';
import {
  ScreenReaderHelper,
  createScreenReaderHelper
} from './utils/screen-reader-helper';

/**
 * US-020: Accessibility Tests
 * 
 * Story: "As a user with disabilities, I want full access to all features"
 * 
 * Acceptance Criteria:
 * - WCAG 2.1 AA compliance
 * - Full keyboard navigation support
 * - Screen reader compatibility
 * - Proper color contrast ratios
 * - Clear focus indicators
 * - Accessible forms and error messages
 * - Proper heading hierarchy
 * - ARIA landmarks and labels
 */

test.describe('US-020: Accessibility', () => {
  let a11yValidator: AccessibilityValidator;
  let screenReaderHelper: ScreenReaderHelper;

  test.beforeEach(async ({ page }) => {
    a11yValidator = createAccessibilityValidator(page);
    screenReaderHelper = createScreenReaderHelper(page);
    await page.goto('/');
  });

  test.describe('WCAG 2.1 AA Compliance', () => {
    test('should pass automated accessibility scan', async ({ page }) => {
      // Run comprehensive axe scan
      const results = await a11yValidator.runAxeScan();
      
      console.log(`🔍 Accessibility Scan Results:
        - Violations: ${results.violations.length}
        - Passes: ${results.passes.length}
        - Incomplete: ${results.incomplete.length}`);
      
      // Log violations for debugging
      if (results.violations.length > 0) {
        console.log('\n❌ Violations found:');
        results.violations.forEach(violation => {
          console.log(`  - ${violation.id}: ${violation.description}`);
          console.log(`    Impact: ${violation.impact}`);
          console.log(`    Affected: ${violation.nodes.length} element(s)`);
        });
      }
      
      // No critical violations should exist
      const criticalViolations = results.violations.filter(v => v.impact === 'critical');
      expect(criticalViolations.length).toBe(0);
      
      // Minimal serious violations
      const seriousViolations = results.violations.filter(v => v.impact === 'serious');
      expect(seriousViolations.length).toBeLessThanOrEqual(2);
    });

    test('should meet WCAG 2.1 AA standards', async ({ page }) => {
      const compliance = await a11yValidator.checkWCAGCompliance();
      
      console.log(`📋 WCAG 2.1 AA Compliance: ${compliance.compliant ? '✅' : '❌'}`);
      
      // Check each principle
      expect(compliance.results.perceivable.altText).toBe(true);
      expect(compliance.results.perceivable.colorContrast).toBe(true);
      
      expect(compliance.results.operable.keyboardAccess).toBe(true);
      expect(compliance.results.operable.focusOrder).toBe(true);
      
      expect(compliance.results.understandable.labels).toBe(true);
      expect(compliance.results.understandable.errors).toBe(true);
      
      expect(compliance.results.robust.validHTML).toBe(true);
      expect(compliance.results.robust.ariaUsage).toBe(true);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async ({ page }) => {
      const keyboardNav = await a11yValidator.checkKeyboardNavigation();
      
      expect(keyboardNav.allInteractiveFocusable).toBe(true);
      expect(keyboardNav.visibleFocus).toBe(true);
      expect(keyboardNav.keyboardTraps.length).toBe(0);
    });

    test('should have logical tab order', async ({ page }) => {
      // Tab through interactive elements
      const interactiveElements: string[] = [];
      
      // Start from body
      await page.keyboard.press('Tab');
      
      // Tab through first 10 elements
      for (let i = 0; i < 10; i++) {
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return null;
          
          return {
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.substring(0, 30),
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label')
          };
        });
        
        if (focusedElement) {
          const label = focusedElement.ariaLabel || focusedElement.text || focusedElement.tag;
          interactiveElements.push(label);
        }
        
        await page.keyboard.press('Tab');
      }
      
      console.log('📍 Tab order:', interactiveElements);
      
      // Should have found interactive elements
      expect(interactiveElements.length).toBeGreaterThan(0);
    });

    test('should handle keyboard shortcuts', async ({ page }) => {
      // Test Escape key closes modals/menus
      const menuButton = page.locator('[aria-haspopup="true"]').first();
      
      if (await menuButton.count() > 0) {
        // Open menu
        await menuButton.focus();
        await page.keyboard.press('Enter');
        
        // Menu should be open
        const menu = page.locator('[role="menu"]').first();
        await expect(menu).toBeVisible();
        
        // Press Escape
        await page.keyboard.press('Escape');
        
        // Menu should close
        await expect(menu).not.toBeVisible();
      }
    });

    test('should support skip links', async ({ page }) => {
      const skipLinks = await a11yValidator.checkSkipLinks();
      
      if (skipLinks.present) {
        expect(skipLinks.functional).toBe(true);
        
        // Focus skip link
        await page.keyboard.press('Tab');
        const skipLink = page.locator('a[href^="#"]:has-text("skip")').first();
        
        if (await skipLink.isVisible()) {
          // Activate skip link
          await page.keyboard.press('Enter');
          
          // Focus should move to main content
          const activeElement = await page.evaluate(() => document.activeElement?.tagName);
          expect(['MAIN', 'H1'].includes(activeElement || '')).toBe(true);
        }
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = await a11yValidator.checkHeadingHierarchy();
      
      expect(headings.valid).toBe(true);
      
      if (!headings.valid) {
        console.log('❌ Heading issues:', headings.issues);
      }
      
      // Get heading structure for screen reader
      const structure = await screenReaderHelper.getHeadingStructure();
      console.log('\n📚 Heading Structure:');
      structure.forEach(h => {
        console.log(`${'  '.repeat(h.level - 1)}H${h.level}: ${h.text}`);
      });
      
      // Should have at least one h1
      const h1Count = structure.filter(h => h.level === 1).length;
      expect(h1Count).toBe(1);
    });

    test('should have proper landmark regions', async ({ page }) => {
      const landmarks = await a11yValidator.checkLandmarkRegions();
      
      expect(landmarks.hasMain).toBe(true);
      expect(landmarks.hasNav).toBe(true);
      
      // Get landmarks for screen reader
      const landmarkList = await screenReaderHelper.getLandmarks();
      console.log('\n🗺️ Landmarks:');
      landmarkList.forEach(l => {
        console.log(`  - ${l.role}: ${l.label || 'Unlabeled'}`);
      });
      
      // All regions should be labeled
      const unlabeledRegions = landmarkList.filter(
        l => l.role === 'region' && !l.label
      );
      expect(unlabeledRegions.length).toBe(0);
    });

    test('should announce form fields correctly', async ({ page }) => {
      const form = page.locator('form').first();
      
      if (await form.count() > 0) {
        const inputs = await form.locator('input[type="text"], input[type="email"]').all();
        
        for (const input of inputs.slice(0, 3)) {
          const announcement = await screenReaderHelper.getFormFieldAnnouncement(
            `input >> nth=${inputs.indexOf(input)}`
          );
          
          // Should have label
          expect(announcement.label).toBeTruthy();
          
          // Required fields should be announced
          if (announcement.required) {
            expect(
              announcement.label.includes('required') ||
              announcement.description?.includes('required')
            ).toBe(true);
          }
          
          console.log(`📢 Field announcement: "${announcement.label}" (${announcement.type})`);
        }
      }
    });

    test('should handle live region announcements', async ({ page }) => {
      // Clear previous announcements
      await screenReaderHelper.clearAnnouncements();
      
      // Trigger an action that might cause announcements
      const submitButton = page.locator('button[type="submit"]').first();
      
      if (await submitButton.count() > 0) {
        await submitButton.click();
        
        // Wait for potential announcements
        await page.waitForTimeout(1000);
        
        // Check for live announcements
        const announcements = await screenReaderHelper.getLiveAnnouncements();
        
        if (announcements.length > 0) {
          console.log('\n📣 Live announcements:');
          announcements.forEach(a => {
            console.log(`  [${a.priority}] ${a.text}`);
          });
        }
      }
    });
  });

  test.describe('Color and Contrast', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      // Test contrast on key elements
      const elements = [
        { selector: 'h1', type: 'heading' },
        { selector: 'p', type: 'body text' },
        { selector: 'button', type: 'button' },
        { selector: 'a', type: 'link' }
      ];
      
      for (const element of elements) {
        const el = page.locator(element.selector).first();
        
        if (await el.count() > 0) {
          const contrast = await a11yValidator.checkColorContrast(element.selector);
          
          console.log(`🎨 ${element.type} contrast: ${contrast.ratio}:1 (requires ${contrast.requirement}:1)`);
          
          expect(contrast.passes).toBe(true);
        }
      }
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Check focus styles exist
      const hasFocusStyles = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules || []);
            for (const rule of rules) {
              if (rule.cssText && rule.cssText.includes(':focus')) {
                return true;
              }
            }
          } catch (e) {
            // Cross-origin stylesheets
            continue;
          }
        }
        
        return false;
      });
      
      expect(hasFocusStyles).toBe(true);
      
      // Test actual focus visibility
      const button = page.locator('button').first();
      if (await button.count() > 0) {
        await button.focus();
        
        // Check if focus is visually indicated
        const focusStyle = await button.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            outline: styles.outline,
            boxShadow: styles.boxShadow,
            border: styles.border
          };
        });
        
        // Should have some visual indication
        const hasVisualFocus = 
          focusStyle.outline !== 'none' ||
          focusStyle.boxShadow !== 'none' ||
          focusStyle.border !== 'none';
        
        expect(hasVisualFocus).toBe(true);
      }
    });
  });

  test.describe('Form Accessibility', () => {
    test('should have accessible forms', async ({ page }) => {
      const form = page.locator('form').first();
      
      if (await form.count() > 0) {
        const formA11y = await a11yValidator.checkFormAccessibility('form');
        
        expect(formA11y.allInputsLabeled).toBe(true);
        expect(formA11y.requiredFieldsMarked).toBe(true);
        expect(formA11y.errorMessagesAccessible).toBe(true);
        
        if (formA11y.issues.length > 0) {
          console.log('❌ Form accessibility issues:', formA11y.issues);
        }
      }
    });

    test('should handle form validation accessibly', async ({ page }) => {
      const form = page.locator('form').first();
      
      if (await form.count() > 0) {
        // Submit empty form to trigger validation
        const submitButton = form.locator('button[type="submit"]');
        
        if (await submitButton.count() > 0) {
          await submitButton.click();
          
          // Wait for validation
          await page.waitForTimeout(500);
          
          // Check for accessible error messages
          const errorMessages = await form.locator('[role="alert"], .error-message').all();
          
          for (const error of errorMessages) {
            // Error should be visible
            await expect(error).toBeVisible();
            
            // Should have appropriate ARIA attributes
            const role = await error.getAttribute('role');
            const ariaLive = await error.getAttribute('aria-live');
            
            expect(role === 'alert' || ariaLive === 'polite').toBe(true);
            
            // Should be associated with form field
            const id = await error.getAttribute('id');
            if (id) {
              const associatedField = await page.locator(`[aria-describedby="${id}"]`).count();
              expect(associatedField).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  test.describe('ARIA Implementation', () => {
    test('should use ARIA attributes correctly', async ({ page }) => {
      const ariaCheck = await a11yValidator.checkAriaUsage();
      
      expect(ariaCheck.valid).toBe(true);
      
      if (!ariaCheck.valid) {
        console.log('❌ ARIA issues:', ariaCheck.issues);
      }
    });

    test('should have accessible names for interactive elements', async ({ page }) => {
      const interactiveSelectors = ['button', 'a', 'input', '[role="button"]'];
      
      for (const selector of interactiveSelectors) {
        const elements = await page.locator(selector).all();
        
        for (const element of elements.slice(0, 3)) {
          const name = await screenReaderHelper.getAccessibleName(element);
          const role = await screenReaderHelper.getRole(element);
          
          // Should have accessible name
          expect(name).toBeTruthy();
          
          console.log(`✅ ${role}: "${name}"`);
        }
      }
    });
  });

  test.describe('Accessibility Report', () => {
    test('should generate comprehensive accessibility report', async ({ page }) => {
      // Generate reports
      const a11yReport = await a11yValidator.generateAccessibilityReport();
      const screenReaderReport = await screenReaderHelper.generateScreenReaderReport();
      
      console.log('\n📊 ACCESSIBILITY REPORT');
      console.log('======================');
      console.log(a11yReport);
      console.log(screenReaderReport);
      
      // Save report to file
      const fs = require('fs');
      const reportPath = './e2e/phase12/accessibility-audit.md';
      const fullReport = `# Accessibility Audit Report

Generated: ${new Date().toISOString()}

${a11yReport}

${screenReaderReport}

## Recommendations

1. Fix all critical and serious violations
2. Ensure all interactive elements have accessible names
3. Verify color contrast meets WCAG standards
4. Test with actual screen readers
5. Conduct manual keyboard navigation testing
`;
      
      await page.evaluate((report) => {
        // Store report for later retrieval
        (window as any).__accessibilityReport = report;
      }, fullReport);
    });
  });
});