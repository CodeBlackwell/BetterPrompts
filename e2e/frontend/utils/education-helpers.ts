import { Page, Locator } from '@playwright/test';

/**
 * Helper functions for testing educational UI components
 * Tooltips, modals, and interactive educational elements
 */

export class EducationHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for tooltip to appear and verify positioning
   */
  async waitForTooltipWithPosition(trigger: Locator) {
    await trigger.hover();
    const tooltip = this.page.locator('[data-testid="technique-tooltip"]');
    await tooltip.waitFor({ state: 'visible', timeout: 5000 });
    
    // Verify tooltip is positioned correctly
    const triggerBox = await trigger.boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    
    if (!triggerBox || !tooltipBox) {
      throw new Error('Could not get bounding boxes for tooltip positioning');
    }
    
    return {
      tooltip,
      position: {
        isAbove: tooltipBox.y < triggerBox.y,
        isBelow: tooltipBox.y > triggerBox.y + triggerBox.height,
        isLeft: tooltipBox.x < triggerBox.x,
        isRight: tooltipBox.x > triggerBox.x + triggerBox.width,
      },
      inViewport: await this.isElementInViewport(tooltip),
    };
  }

  /**
   * Check if element is within viewport bounds
   */
  async isElementInViewport(element: Locator): Promise<boolean> {
    const viewport = this.page.viewportSize();
    const box = await element.boundingBox();
    
    if (!viewport || !box) return false;
    
    return (
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width &&
      box.y + box.height <= viewport.height
    );
  }

  /**
   * Test tooltip auto-repositioning near viewport edges
   */
  async testTooltipRepositioning() {
    const results = {
      topEdge: false,
      bottomEdge: false,
      leftEdge: false,
      rightEdge: false,
    };
    
    // Test top edge
    await this.page.evaluate(() => window.scrollTo(0, 0));
    const topTrigger = this.page.locator('[data-testid="tooltip-trigger"]').first();
    const topTooltip = await this.waitForTooltipWithPosition(topTrigger);
    results.topEdge = topTooltip.position.isBelow && topTooltip.inViewport;
    
    // Test bottom edge
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bottomTrigger = this.page.locator('[data-testid="tooltip-trigger"]').last();
    const bottomTooltip = await this.waitForTooltipWithPosition(bottomTrigger);
    results.bottomEdge = bottomTooltip.position.isAbove && bottomTooltip.inViewport;
    
    return results;
  }

  /**
   * Verify modal accessibility attributes
   */
  async verifyModalAccessibility(modal: Locator) {
    const attributes = {
      role: await modal.getAttribute('role'),
      ariaModal: await modal.getAttribute('aria-modal'),
      ariaLabelledBy: await modal.getAttribute('aria-labelledby'),
      ariaDescribedBy: await modal.getAttribute('aria-describedby'),
    };
    
    // Check focus trap
    const focusableElements = await modal.locator('button, a, input, [tabindex="0"]').all();
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    // Test tab cycling
    await firstFocusable.focus();
    await this.page.keyboard.press('Tab');
    
    // Should cycle back to first element after last
    await lastFocusable.focus();
    await this.page.keyboard.press('Tab');
    const activeElement = await this.page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    
    return {
      attributes,
      focusTrap: {
        elementsCount: focusableElements.length,
        cyclesCorrectly: activeElement === await firstFocusable.getAttribute('data-testid'),
      },
    };
  }

  /**
   * Test smooth animations
   */
  async testAnimationPerformance(action: () => Promise<void>) {
    // Start performance measurement
    await this.page.evaluate(() => {
      (window as any).animationFrames = [];
      let lastTime = performance.now();
      
      function measureFrame(time: number) {
        const delta = time - lastTime;
        (window as any).animationFrames.push(delta);
        lastTime = time;
        
        if ((window as any).animationFrames.length < 60) {
          requestAnimationFrame(measureFrame);
        }
      }
      
      requestAnimationFrame(measureFrame);
    });
    
    // Perform action that triggers animation
    await action();
    
    // Wait for animation to complete
    await this.page.waitForTimeout(1000);
    
    // Calculate FPS
    const frameTimes: number[] = await this.page.evaluate(() => (window as any).animationFrames);
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = 1000 / avgFrameTime;
    
    return {
      averageFPS: Math.round(fps),
      droppedFrames: frameTimes.filter(t => t > 16.67).length, // 60fps = 16.67ms per frame
      smoothAnimation: fps >= 55, // Allow small margin
    };
  }

  /**
   * Test gesture support for mobile
   */
  async testMobileGestures(element: Locator) {
    // Set mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });
    
    const results = {
      tap: false,
      swipe: false,
      pinch: false,
    };
    
    // Test tap
    await element.tap();
    results.tap = await element.isVisible();
    
    // Test swipe to dismiss
    const box = await element.boundingBox();
    if (box) {
      await this.page.touchscreen.swipe({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        xDistance: -box.width / 2,
        yDistance: 0,
        speed: 500,
      });
      
      results.swipe = !(await element.isVisible());
    }
    
    return results;
  }

  /**
   * Verify educational content structure
   */
  async verifyEducationalContent(container: Locator) {
    const sections = {
      title: await container.locator('[data-testid="technique-name"]').textContent(),
      description: await container.locator('[data-testid="technique-description"]').textContent(),
      examples: await container.locator('[data-testid="technique-examples"] li').allTextContents(),
      benefits: await container.locator('[data-testid="technique-benefits"] li').allTextContents(),
      useCases: await container.locator('[data-testid="technique-use-cases"] li').allTextContents(),
      alternatives: await container.locator('[data-testid="alternative-card"]').count(),
    };
    
    const quality = {
      hasTitle: !!sections.title && sections.title.length > 0,
      hasDescription: !!sections.description && sections.description.length > 50,
      hasExamples: sections.examples.length > 0,
      hasBenefits: sections.benefits.length > 0,
      hasUseCases: sections.useCases.length > 0,
      hasAlternatives: sections.alternatives > 0,
    };
    
    const completeness = Object.values(quality).filter(v => v).length / Object.keys(quality).length;
    
    return {
      sections,
      quality,
      completenessScore: completeness,
      isComplete: completeness >= 0.8,
    };
  }

  /**
   * Test comparison feature
   */
  async testComparisonFeature(technique1: string, technique2: string) {
    // Open comparison
    const compareButton = this.page.locator(`[data-testid="compare-button"]`);
    await compareButton.click();
    
    const comparisonModal = this.page.locator('[data-testid="comparison-modal"]');
    await comparisonModal.waitFor({ state: 'visible' });
    
    // Check comparison table
    const table = comparisonModal.locator('[data-testid="comparison-table"]');
    const headers = await table.locator('th').allTextContents();
    const rows = await table.locator('tbody tr').count();
    
    // Check difference highlighting
    const highlights = await table.locator('[data-testid="difference-highlight"]').count();
    
    return {
      hasHeaders: headers.includes(technique1) && headers.includes(technique2),
      comparisonRows: rows,
      differencesHighlighted: highlights > 0,
      isAccessible: await this.verifyModalAccessibility(comparisonModal),
    };
  }

  /**
   * Measure education UI performance
   */
  async measureEducationPerformance() {
    const metrics = {
      tooltipDisplay: 0,
      modalLoad: 0,
      contentRender: 0,
      animationFPS: 0,
    };
    
    // Measure tooltip display time
    const tooltipTrigger = this.page.locator('[data-testid="tooltip-trigger"]').first();
    const tooltipStart = Date.now();
    await tooltipTrigger.hover();
    await this.page.locator('[data-testid="technique-tooltip"]').waitFor({ state: 'visible' });
    metrics.tooltipDisplay = Date.now() - tooltipStart;
    
    // Measure modal load time
    const modalButton = this.page.locator('button:has-text("Learn more")').first();
    const modalStart = Date.now();
    await modalButton.click();
    await this.page.locator('[data-testid="education-modal"]').waitFor({ state: 'visible' });
    await this.page.locator('[data-testid="technique-description"]').waitFor({ state: 'visible' });
    metrics.modalLoad = Date.now() - modalStart;
    
    // Test animation performance
    const animationTest = await this.testAnimationPerformance(async () => {
      await this.page.locator('[data-testid="modal-close"]').click();
    });
    metrics.animationFPS = animationTest.averageFPS;
    
    return {
      metrics,
      meetsTargets: {
        tooltip: metrics.tooltipDisplay < 100,
        modal: metrics.modalLoad < 300,
        animation: metrics.animationFPS >= 55,
      },
    };
  }
}

/**
 * Touch screen helper for mobile gesture testing
 */
interface TouchScreen {
  swipe(options: {
    x: number;
    y: number;
    xDistance: number;
    yDistance: number;
    speed: number;
  }): Promise<void>;
}

// Extend Page interface for touch gestures
declare module '@playwright/test' {
  interface Page {
    touchscreen: TouchScreen;
  }
}