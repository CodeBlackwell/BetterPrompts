import { test, expect } from '@playwright/test';
import { EnhancePage } from '../../pages/enhance.page';
import { TechniqueEducationPage } from '../../pages/technique-education.page';
import { EducationHelpers } from '../../utils/education-helpers';
import { 
  techniqueEducationalContent, 
  getEducationalContent,
  accessibilityContent,
  wcagChecklist 
} from '../../fixtures/educational-content';

/**
 * US-006: Technique Education & Tooltips
 * As a technical beginner, I want to understand why techniques were chosen
 * 
 * Test Coverage:
 * - Tooltip interactions (hover, click, touch)
 * - Modal functionality and content
 * - Educational content accuracy
 * - Navigation and links
 * - Alternative suggestions
 * - Mobile interactions
 * - Accessibility compliance
 * - Performance requirements
 */

test.describe('US-006: Technique Education & Tooltips', () => {
  let enhancePage: EnhancePage;
  let educationPage: TechniqueEducationPage;
  let educationHelpers: EducationHelpers;

  test.beforeEach(async ({ page }) => {
    enhancePage = new EnhancePage(page);
    educationPage = new TechniqueEducationPage(page);
    educationHelpers = new EducationHelpers(page);
    
    await enhancePage.goto();
    await enhancePage.verifyPageLoaded();
  });

  test.describe('Tooltip Behavior', () => {
    test('should show tooltip on hover (desktop)', async ({ page }) => {
      // Skip on mobile devices
      const isMobile = page.viewportSize()?.width ? page.viewportSize()!.width < 768 : false;
      test.skip(isMobile, 'Desktop-only test');

      // Enhance a prompt to show results with tooltips
      await enhancePage.enhancePrompt('Help me write a blog post', 'Chain of Thought');
      
      // Hover over technique name tooltip trigger
      await educationPage.hoverTooltipTrigger('Chain of Thought');
      
      // Verify tooltip appears
      expect(await educationPage.isTooltipVisible()).toBe(true);
      
      // Verify tooltip content
      const content = await educationPage.getTooltipContent();
      expect(content).toContain('step-by-step reasoning');
      
      // Verify tooltip positioning
      const isInViewport = await educationPage.verifyTooltipInViewport();
      expect(isInViewport).toBe(true);
    });

    test('should show tooltip on click/tap (mobile)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Enhance a prompt
      await enhancePage.enhancePrompt('Explain quantum physics', 'Few-Shot Learning');
      
      // Click tooltip trigger
      await educationPage.clickTooltipTrigger('Few-Shot Learning');
      
      // Verify tooltip appears
      expect(await educationPage.isTooltipVisible()).toBe(true);
      
      // Test touch interactions
      const touchResult = await educationPage.testMobileTouchInteractions();
      expect(touchResult).toBe(true); // Touch targets meet 44x44px minimum
    });

    test('should dismiss tooltip correctly', async () => {
      await enhancePage.enhancePrompt('Write a story', 'Tree of Thoughts');
      
      // Show tooltip
      await educationPage.hoverTooltipTrigger('Tree of Thoughts');
      expect(await educationPage.isTooltipVisible()).toBe(true);
      
      // Test dismiss by clicking outside
      await educationPage.dismissTooltipByClickOutside();
      expect(await educationPage.isTooltipVisible()).toBe(false);
      
      // Show again and test ESC key dismiss
      await educationPage.hoverTooltipTrigger('Tree of Thoughts');
      await educationPage.dismissTooltipWithEsc();
      expect(await educationPage.isTooltipVisible()).toBe(false);
    });

    test('should reposition tooltip near viewport edges', async () => {
      await enhancePage.enhancePrompt('Analyze data', 'Self-Consistency');
      
      // Test tooltip repositioning at viewport edges
      const repositionResults = await educationHelpers.testTooltipRepositioning();
      
      expect(repositionResults.topEdge).toBe(true);
      expect(repositionResults.bottomEdge).toBe(true);
    });

    test('should display tooltips within performance targets', async () => {
      await enhancePage.enhancePrompt('Create a plan', 'Chain of Thought');
      
      // Measure tooltip performance
      const performance = await educationPage.measureTooltipPerformance();
      
      // Should display within 100ms
      expect(performance.displayTime).toBeLessThan(100);
      expect(performance.isVisible).toBe(true);
    });
  });

  test.describe('Modal Functionality', () => {
    test('should open education modal with complete content', async () => {
      await enhancePage.enhancePrompt('Solve this problem', 'Chain of Thought');
      
      // Open education modal
      await educationPage.openEducationModal('Chain of Thought');
      
      // Get modal content
      const content = await educationPage.getModalContent();
      
      // Verify all sections are present
      expect(content.title).toBe('Chain of Thought');
      expect(content.description).toContain('step-by-step reasoning');
      expect(content.examples.length).toBeGreaterThan(0);
      expect(content.benefits.length).toBeGreaterThan(0);
      expect(content.useCases.length).toBeGreaterThan(0);
    });

    test('should close modal using multiple methods', async ({ page }) => {
      await enhancePage.enhancePrompt('Research topic', 'ReAct');
      await educationPage.openEducationModal('ReAct');
      
      // Test close button
      await educationPage.closeModalWithButton();
      await expect(page.locator('[data-testid="education-modal"]')).not.toBeVisible();
      
      // Test ESC key
      await educationPage.openEducationModal('ReAct');
      await educationPage.closeModalWithEsc();
      await expect(page.locator('[data-testid="education-modal"]')).not.toBeVisible();
      
      // Test overlay click
      await educationPage.openEducationModal('ReAct');
      await educationPage.closeModalByOverlay();
      await expect(page.locator('[data-testid="education-modal"]')).not.toBeVisible();
    });

    test('should lock body scroll when modal is open', async () => {
      await enhancePage.enhancePrompt('Write code', 'Few-Shot Learning');
      
      // Check scroll is not locked initially
      expect(await educationPage.isBodyScrollLocked()).toBe(false);
      
      // Open modal
      await educationPage.openEducationModal('Few-Shot Learning');
      
      // Check scroll is locked
      expect(await educationPage.isBodyScrollLocked()).toBe(true);
      
      // Close modal
      await educationPage.closeModalWithButton();
      
      // Check scroll is unlocked
      expect(await educationPage.isBodyScrollLocked()).toBe(false);
    });

    test('should load modal content within performance targets', async () => {
      await enhancePage.enhancePrompt('Optimize performance', 'Self-Consistency');
      
      // Measure modal performance
      const performance = await educationPage.measureModalPerformance('Self-Consistency');
      
      // Should load within 300ms with content
      expect(performance.loadTime).toBeLessThan(300);
      expect(performance.hasContent).toBe(true);
    });
  });

  test.describe('Educational Content', () => {
    test('should display accurate technique information', async () => {
      // Test each technique's educational content
      for (const technique of techniqueEducationalContent.slice(0, 3)) { // Test first 3
        await enhancePage.enhancePrompt(`Test prompt for ${technique.name}`, technique.name);
        await educationPage.openEducationModal(technique.name);
        
        const content = await educationPage.getModalContent();
        const expectedContent = getEducationalContent(technique.id);
        
        expect(content.title).toBe(expectedContent?.name);
        expect(content.description).toBe(expectedContent?.description);
        expect(content.examples).toEqual(expectedContent?.examples);
        expect(content.benefits).toEqual(expectedContent?.benefits);
        expect(content.useCases).toEqual(expectedContent?.useCases);
        
        await educationPage.closeModalWithButton();
      }
    });

    test('should verify educational content completeness', async ({ page }) => {
      await enhancePage.enhancePrompt('Complex task', 'Tree of Thoughts');
      await educationPage.openEducationModal('Tree of Thoughts');
      
      const modal = page.locator('[data-testid="education-modal"]');
      const contentVerification = await educationHelpers.verifyEducationalContent(modal);
      
      // Check content quality
      expect(contentVerification.quality.hasTitle).toBe(true);
      expect(contentVerification.quality.hasDescription).toBe(true);
      expect(contentVerification.quality.hasExamples).toBe(true);
      expect(contentVerification.quality.hasBenefits).toBe(true);
      expect(contentVerification.quality.hasUseCases).toBe(true);
      
      // Overall completeness should be at least 80%
      expect(contentVerification.completenessScore).toBeGreaterThanOrEqual(0.8);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to documentation links', async ({ context }) => {
      await enhancePage.enhancePrompt('Learn more', 'Role Prompting');
      await educationPage.openEducationModal('Role Prompting');
      
      // Click learn more link
      const newPage = await educationPage.clickLearnMoreLink();
      
      // Verify new tab opened with correct URL
      expect(newPage.url()).toContain('/docs/techniques/role-prompting');
      
      // Cleanup
      await newPage.close();
    });

    test('should have working breadcrumb navigation', async ({ page }) => {
      await enhancePage.enhancePrompt('Navigate test', 'Prompt Chaining');
      await educationPage.openEducationModal('Prompt Chaining');
      
      // Check breadcrumb exists
      const breadcrumb = page.locator('[data-testid="breadcrumb"]');
      await expect(breadcrumb).toBeVisible();
      
      // Verify breadcrumb structure
      const breadcrumbText = await breadcrumb.textContent();
      expect(breadcrumbText).toContain('Home');
      expect(breadcrumbText).toContain('Techniques');
      expect(breadcrumbText).toContain('Prompt Chaining');
    });
  });

  test.describe('Alternative Suggestions', () => {
    test('should display alternative techniques', async () => {
      await enhancePage.enhancePrompt('Reasoning task', 'Chain of Thought');
      await educationPage.openEducationModal('Chain of Thought');
      
      // Get alternatives
      const alternatives = await educationPage.getAlternativeTechniques();
      
      // Chain of Thought should suggest Tree of Thoughts as alternative
      expect(alternatives).toContain('Tree of Thoughts');
      expect(alternatives).toContain('Zero-Shot CoT');
      expect(alternatives.length).toBeGreaterThan(0);
    });

    test('should compare techniques', async ({ page }) => {
      await enhancePage.enhancePrompt('Compare methods', 'Few-Shot Learning');
      await educationPage.openEducationModal('Few-Shot Learning');
      
      // Compare with Zero-Shot
      await educationPage.compareTechniques('Few-Shot Learning', 'Zero-Shot');
      
      // Verify comparison modal
      const comparisonResult = await educationHelpers.testComparisonFeature(
        'Few-Shot Learning', 
        'Zero-Shot'
      );
      
      expect(comparisonResult.hasHeaders).toBe(true);
      expect(comparisonResult.comparisonRows).toBeGreaterThan(3);
      expect(comparisonResult.differencesHighlighted).toBe(true);
    });

    test('should switch to alternative technique', async ({ page }) => {
      await enhancePage.enhancePrompt('Try different approach', 'Self-Consistency');
      await educationPage.openEducationModal('Self-Consistency');
      
      // Switch to Chain of Thought
      await educationPage.switchToAlternative('Chain of Thought');
      
      // Verify technique was switched
      const selectedTechniques = await enhancePage.getSelectedTechniques();
      expect(selectedTechniques).toContain('Chain of Thought');
      
      // Verify UI updated
      await expect(page.locator('[data-testid="technique-switched-notification"]')).toBeVisible();
    });
  });

  test.describe('Mobile Interactions', () => {
    test('should support mobile gestures', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await enhancePage.enhancePrompt('Mobile test', 'Maieutic Prompting');
      await educationPage.openEducationModal('Maieutic Prompting');
      
      const modal = page.locator('[data-testid="education-modal"]');
      const gestureResults = await educationHelpers.testMobileGestures(modal);
      
      expect(gestureResults.tap).toBe(true);
      expect(gestureResults.swipe).toBe(true);
    });

    test('should have appropriate touch targets', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await enhancePage.enhancePrompt('Touch test', 'Constrained Generation');
      
      // Verify all interactive elements meet 44x44px minimum
      const interactiveElements = await page.$$('[data-testid*="button"], [data-testid*="trigger"], a');
      
      for (const element of interactiveElements) {
        const box = await element.boundingBox();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async () => {
      await enhancePage.enhancePrompt('Accessibility test', 'ReAct');
      
      // Check tooltip ARIA
      await educationPage.hoverTooltipTrigger('ReAct');
      const tooltipAria = await educationPage.getAriaAttributes('[data-testid="technique-tooltip"]');
      
      expect(tooltipAria.role).toBe('tooltip');
      expect(tooltipAria.ariaDescribedBy).toBeTruthy();
      
      // Check modal ARIA
      await educationPage.openEducationModal('ReAct');
      const modalAria = await educationPage.getAriaAttributes('[data-testid="education-modal"]');
      
      expect(modalAria.role).toBe('dialog');
      expect(modalAria.ariaLabelledBy).toBeTruthy();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await enhancePage.enhancePrompt('Keyboard test', 'Zero-Shot CoT');
      
      // Test keyboard navigation
      await educationPage.navigateWithKeyboard();
      
      // Verify focus management
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      expect(focusedElement).toBeTruthy();
    });

    test('should work with screen readers', async ({ page }) => {
      await enhancePage.enhancePrompt('Screen reader test', 'Tree of Thoughts');
      await educationPage.openEducationModal('Tree of Thoughts');
      
      // Check for screen reader instructions
      const modalContent = await page.locator('[data-testid="education-modal"]').textContent();
      expect(modalContent).toContain(accessibilityContent.modalInstructions);
      
      // Verify modal accessibility
      const modal = page.locator('[data-testid="education-modal"]');
      const accessibility = await educationHelpers.verifyModalAccessibility(modal);
      
      expect(accessibility.attributes.role).toBe('dialog');
      expect(accessibility.attributes.ariaModal).toBe('true');
      expect(accessibility.focusTrap.cyclesCorrectly).toBe(true);
    });

    test('should meet WCAG compliance', async ({ page }) => {
      await enhancePage.enhancePrompt('WCAG test', 'Prompt Chaining');
      await educationPage.openEducationModal('Prompt Chaining');
      
      // Test perceivable criteria
      const contrastRatio = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="education-modal"]');
        const styles = window.getComputedStyle(modal!);
        // Simplified contrast check - in real tests use proper contrast calculation
        return styles.color !== styles.backgroundColor;
      });
      expect(contrastRatio).toBe(true);
      
      // Test operable criteria - keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(activeElement).toBeTruthy();
      
      // Test robust criteria - valid HTML
      const htmlErrors = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="education-modal"]');
        // Check for basic HTML validity
        return modal?.querySelectorAll('[id]').length === 
               new Set(Array.from(modal?.querySelectorAll('[id]') || [])
                 .map(el => el.id)).size;
      });
      expect(htmlErrors).toBe(true); // No duplicate IDs
    });
  });

  test.describe('Performance', () => {
    test('should meet all performance targets', async () => {
      await enhancePage.enhancePrompt('Performance test', 'Self-Consistency');
      
      // Comprehensive performance test
      const performance = await educationHelpers.measureEducationPerformance();
      
      // Verify all targets are met
      expect(performance.meetsTargets.tooltip).toBe(true); // <100ms
      expect(performance.meetsTargets.modal).toBe(true); // <300ms
      expect(performance.meetsTargets.animation).toBe(true); // >=55fps
      
      // Log actual metrics for monitoring
      console.log('Education UI Performance Metrics:', performance.metrics);
    });

    test('should have smooth animations at 60fps', async ({ page }) => {
      await enhancePage.enhancePrompt('Animation test', 'Role Prompting');
      await educationPage.openEducationModal('Role Prompting');
      
      // Test modal close animation
      const animationPerf = await educationHelpers.testAnimationPerformance(async () => {
        await educationPage.closeModalWithButton();
      });
      
      expect(animationPerf.smoothAnimation).toBe(true);
      expect(animationPerf.averageFPS).toBeGreaterThanOrEqual(55);
      expect(animationPerf.droppedFrames).toBeLessThan(5);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle missing educational content gracefully', async ({ page }) => {
      // Simulate a technique without educational content
      await page.route('**/api/techniques/*/education', async route => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Content not found' })
        });
      });
      
      await enhancePage.enhancePrompt('Error test', 'Chain of Thought');
      await educationPage.openEducationModal('Chain of Thought');
      
      // Should show fallback content
      const errorMessage = page.locator('[data-testid="education-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Educational content is temporarily unavailable');
    });

    test('should handle broken documentation links', async ({ page }) => {
      await page.route('**/docs/**', async route => {
        await route.fulfill({
          status: 404,
          body: 'Page not found'
        });
      });
      
      await enhancePage.enhancePrompt('Link test', 'Few-Shot Learning');
      await educationPage.openEducationModal('Few-Shot Learning');
      
      // Click broken link
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/docs/')),
        educationPage.clickLearnMoreLink()
      ]);
      
      expect(response.status()).toBe(404);
      
      // Should show user-friendly error
      await expect(page.locator('[data-testid="link-error-notification"]')).toBeVisible();
    });
  });

  test.describe('Integration', () => {
    test('should integrate with enhancement flow', async ({ page }) => {
      // Complete enhancement with education interaction
      await enhancePage.enterPrompt('Help me understand complex topics');
      await enhancePage.selectTechnique('Maieutic Prompting');
      
      // Check technique has education tooltip
      const tooltipTrigger = page.locator('[data-testid="tooltip-trigger"]')
        .filter({ hasText: 'Maieutic Prompting' });
      await expect(tooltipTrigger).toBeVisible();
      
      // Enhance and verify education remains accessible
      await enhancePage.clickEnhance();
      await enhancePage.waitForEnhancement();
      
      // Education should still be available in results
      await educationPage.hoverTooltipTrigger('Maieutic Prompting');
      expect(await educationPage.isTooltipVisible()).toBe(true);
    });

    test('should preserve education state during navigation', async ({ page }) => {
      await enhancePage.enhancePrompt('Navigation test', 'Prompt Chaining');
      await educationPage.openEducationModal('Prompt Chaining');
      
      // Navigate within modal
      const alternatives = await educationPage.getAlternativeTechniques();
      expect(alternatives.length).toBeGreaterThan(0);
      
      // Close modal
      await educationPage.closeModalWithButton();
      
      // Re-open should maintain state
      await educationPage.openEducationModal('Prompt Chaining');
      const alternativesAgain = await educationPage.getAlternativeTechniques();
      expect(alternativesAgain).toEqual(alternatives);
    });
  });
});