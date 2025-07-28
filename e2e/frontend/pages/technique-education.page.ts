import { Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Technique Education Page Object Model
 * Handles tooltips, modals, and educational content for prompt engineering techniques
 */
export class TechniqueEducationPage extends BasePage {
  // Tooltip locators
  private readonly tooltip = '[data-testid="technique-tooltip"]';
  private readonly tooltipTrigger = '[data-testid="tooltip-trigger"]';
  private readonly tooltipContent = '[data-testid="tooltip-content"]';
  private readonly tooltipClose = '[data-testid="tooltip-close"]';
  
  // Modal locators
  private readonly educationModal = '[data-testid="education-modal"]';
  private readonly modalTitle = '[data-testid="modal-title"]';
  private readonly modalContent = '[data-testid="modal-content"]';
  private readonly modalClose = '[data-testid="modal-close"]';
  private readonly modalOverlay = '[data-testid="modal-overlay"]';
  
  // Educational content locators
  private readonly techniqueName = '[data-testid="technique-name"]';
  private readonly techniqueDescription = '[data-testid="technique-description"]';
  private readonly techniqueExamples = '[data-testid="technique-examples"]';
  private readonly techniqueBenefits = '[data-testid="technique-benefits"]';
  private readonly techniqueUseCases = '[data-testid="technique-use-cases"]';
  
  // Navigation locators
  private readonly learnMoreLink = 'a[data-testid="learn-more-link"]';
  private readonly docsLink = 'a[data-testid="docs-link"]';
  private readonly backButton = 'button[data-testid="back-button"]';
  private readonly breadcrumb = '[data-testid="breadcrumb"]';
  
  // Alternative suggestions locators
  private readonly alternativesSection = '[data-testid="alternatives-section"]';
  private readonly alternativeCard = '[data-testid="alternative-card"]';
  private readonly compareButton = 'button[data-testid="compare-button"]';
  private readonly switchButton = 'button[data-testid="switch-technique"]';
  
  // Comparison locators
  private readonly comparisonModal = '[data-testid="comparison-modal"]';
  private readonly comparisonTable = '[data-testid="comparison-table"]';
  private readonly differenceHighlight = '[data-testid="difference-highlight"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Hover over tooltip trigger to show tooltip (desktop)
   */
  async hoverTooltipTrigger(triggerText?: string) {
    const trigger = triggerText 
      ? this.page.locator(this.tooltipTrigger).filter({ hasText: triggerText })
      : this.page.locator(this.tooltipTrigger).first();
    
    await trigger.hover();
    await this.waitForElement(this.tooltip);
  }

  /**
   * Click tooltip trigger to show tooltip (mobile/accessibility)
   */
  async clickTooltipTrigger(triggerText?: string) {
    const trigger = triggerText 
      ? this.page.locator(this.tooltipTrigger).filter({ hasText: triggerText })
      : this.page.locator(this.tooltipTrigger).first();
    
    await this.clickWithRetry(trigger);
    await this.waitForElement(this.tooltip);
  }

  /**
   * Get tooltip content
   */
  async getTooltipContent(): Promise<string> {
    return await this.getText(this.tooltipContent);
  }

  /**
   * Check if tooltip is visible
   */
  async isTooltipVisible(): Promise<boolean> {
    return await this.isVisible(this.tooltip);
  }

  /**
   * Dismiss tooltip by clicking outside
   */
  async dismissTooltipByClickOutside() {
    await this.page.click('body', { position: { x: 0, y: 0 } });
    await this.page.waitForSelector(this.tooltip, { state: 'hidden' });
  }

  /**
   * Dismiss tooltip with ESC key
   */
  async dismissTooltipWithEsc() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForSelector(this.tooltip, { state: 'hidden' });
  }

  /**
   * Open education modal for a technique
   */
  async openEducationModal(techniqueName: string) {
    const learnMoreButton = this.page.locator(`button:has-text("Learn more about ${techniqueName}")`);
    await this.clickWithRetry(learnMoreButton);
    await this.waitForElement(this.educationModal);
  }

  /**
   * Get modal content sections
   */
  async getModalContent() {
    return {
      title: await this.getText(this.modalTitle),
      description: await this.getText(this.techniqueDescription),
      examples: await this.page.locator(this.techniqueExamples).allTextContents(),
      benefits: await this.page.locator(this.techniqueBenefits).allTextContents(),
      useCases: await this.page.locator(this.techniqueUseCases).allTextContents(),
    };
  }

  /**
   * Close modal using close button
   */
  async closeModalWithButton() {
    await this.clickWithRetry(this.modalClose);
    await this.page.waitForSelector(this.educationModal, { state: 'hidden' });
  }

  /**
   * Close modal with ESC key
   */
  async closeModalWithEsc() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForSelector(this.educationModal, { state: 'hidden' });
  }

  /**
   * Close modal by clicking overlay
   */
  async closeModalByOverlay() {
    await this.clickWithRetry(this.modalOverlay);
    await this.page.waitForSelector(this.educationModal, { state: 'hidden' });
  }

  /**
   * Check if body scroll is locked when modal is open
   */
  async isBodyScrollLocked(): Promise<boolean> {
    const overflow = await this.page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    return overflow === 'hidden';
  }

  /**
   * Navigate to documentation
   */
  async clickLearnMoreLink() {
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.clickWithRetry(this.learnMoreLink),
    ]);
    return newPage;
  }

  /**
   * Get alternative techniques
   */
  async getAlternativeTechniques(): Promise<string[]> {
    const alternatives = await this.page.locator(this.alternativeCard).allTextContents();
    return alternatives;
  }

  /**
   * Compare techniques
   */
  async compareTechniques(technique1: string, technique2: string) {
    await this.clickWithRetry(this.compareButton);
    await this.waitForElement(this.comparisonModal);
  }

  /**
   * Get comparison table data
   */
  async getComparisonData() {
    const rows = await this.page.locator(`${this.comparisonTable} tr`).allTextContents();
    return rows;
  }

  /**
   * Switch to alternative technique
   */
  async switchToAlternative(techniqueName: string) {
    const alternativeCard = this.page.locator(this.alternativeCard).filter({ hasText: techniqueName });
    const switchBtn = alternativeCard.locator(this.switchButton);
    await this.clickWithRetry(switchBtn);
  }

  /**
   * Check tooltip positioning
   */
  async getTooltipPosition() {
    const tooltip = this.page.locator(this.tooltip);
    const box = await tooltip.boundingBox();
    return box;
  }

  /**
   * Verify tooltip doesn't overflow viewport
   */
  async verifyTooltipInViewport(): Promise<boolean> {
    const viewport = this.page.viewportSize();
    const tooltipBox = await this.getTooltipPosition();
    
    if (!viewport || !tooltipBox) return false;
    
    return (
      tooltipBox.x >= 0 &&
      tooltipBox.y >= 0 &&
      tooltipBox.x + tooltipBox.width <= viewport.width &&
      tooltipBox.y + tooltipBox.height <= viewport.height
    );
  }

  /**
   * Test keyboard navigation
   */
  async navigateWithKeyboard() {
    // Tab to first tooltip trigger
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Enter'); // Activate tooltip
    await this.waitForElement(this.tooltip);
    
    // Tab through content
    await this.page.keyboard.press('Tab');
    await this.page.keyboard.press('Tab');
    
    // Close with ESC
    await this.page.keyboard.press('Escape');
  }

  /**
   * Get ARIA attributes for accessibility testing
   */
  async getAriaAttributes(selector: string) {
    const element = this.page.locator(selector);
    return {
      role: await element.getAttribute('role'),
      ariaLabel: await element.getAttribute('aria-label'),
      ariaDescribedBy: await element.getAttribute('aria-describedby'),
      ariaExpanded: await element.getAttribute('aria-expanded'),
    };
  }

  /**
   * Test mobile touch interactions
   */
  async testMobileTouchInteractions() {
    // Set mobile viewport
    await this.page.setViewportSize({ width: 375, height: 667 });
    
    // Touch tooltip trigger
    const trigger = this.page.locator(this.tooltipTrigger).first();
    await trigger.tap();
    await this.waitForElement(this.tooltip);
    
    // Verify touch target size
    const box = await trigger.boundingBox();
    return box && box.width >= 44 && box.height >= 44;
  }

  /**
   * Measure tooltip display performance
   */
  async measureTooltipPerformance() {
    const startTime = Date.now();
    await this.hoverTooltipTrigger();
    const endTime = Date.now();
    
    return {
      displayTime: endTime - startTime,
      isVisible: await this.isTooltipVisible(),
    };
  }

  /**
   * Measure modal load performance
   */
  async measureModalPerformance(techniqueName: string) {
    const startTime = Date.now();
    await this.openEducationModal(techniqueName);
    const endTime = Date.now();
    
    const content = await this.getModalContent();
    
    return {
      loadTime: endTime - startTime,
      hasContent: !!content.description,
    };
  }
}