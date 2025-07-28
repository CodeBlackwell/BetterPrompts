import { Page, Locator, expect } from '@playwright/test';

export class ProgressTracker {
  private readonly page: Page;
  
  // Locators
  private readonly progressBar: Locator;
  private readonly progressText: Locator;
  private readonly statusIndicator: Locator;
  private readonly etaDisplay: Locator;
  private readonly processedCount: Locator;
  private readonly totalCount: Locator;
  private readonly currentPrompt: Locator;
  private readonly startTime: Locator;
  private readonly elapsedTime: Locator;
  private readonly throughput: Locator;
  private readonly pauseButton: Locator;
  private readonly resumeButton: Locator;
  private readonly cancelButton: Locator;
  private readonly errorList: Locator;
  private readonly warningList: Locator;
  private readonly milestoneNotifications: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.progressBar = page.getByTestId('progress-bar');
    this.progressText = page.getByTestId('progress-text');
    this.statusIndicator = page.getByTestId('status-indicator');
    this.etaDisplay = page.getByTestId('eta-display');
    this.processedCount = page.getByTestId('processed-count');
    this.totalCount = page.getByTestId('total-count');
    this.currentPrompt = page.getByTestId('current-prompt');
    this.startTime = page.getByTestId('start-time');
    this.elapsedTime = page.getByTestId('elapsed-time');
    this.throughput = page.getByTestId('throughput');
    this.pauseButton = page.getByRole('button', { name: /pause/i });
    this.resumeButton = page.getByRole('button', { name: /resume/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.errorList = page.getByTestId('error-list');
    this.warningList = page.getByTestId('warning-list');
    this.milestoneNotifications = page.getByTestId('milestone-notifications');
  }

  /**
   * Navigate to progress page for a batch
   */
  async goto(batchId: string) {
    await this.page.goto(`/batch/${batchId}/progress`);
    await expect(this.progressBar).toBeVisible();
  }

  /**
   * Get current progress percentage
   */
  async getProgress(): Promise<number> {
    // Try from progress bar aria-valuenow
    const ariaValue = await this.progressBar.getAttribute('aria-valuenow');
    if (ariaValue) {
      return parseFloat(ariaValue);
    }

    // Try from progress text
    const text = await this.progressText.textContent();
    const match = text?.match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<string> {
    const status = await this.statusIndicator.textContent();
    return status?.toLowerCase() || 'unknown';
  }

  /**
   * Get ETA
   */
  async getETA(): Promise<string | null> {
    const eta = await this.etaDisplay.textContent();
    return eta?.trim() || null;
  }

  /**
   * Get processed count
   */
  async getProcessedCount(): Promise<number> {
    const text = await this.processedCount.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  /**
   * Get total count
   */
  async getTotalCount(): Promise<number> {
    const text = await this.totalCount.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  /**
   * Get current prompt being processed
   */
  async getCurrentPrompt(): Promise<string | null> {
    if (!await this.currentPrompt.isVisible()) {
      return null;
    }
    return await this.currentPrompt.textContent();
  }

  /**
   * Get elapsed time
   */
  async getElapsedTime(): Promise<string> {
    return await this.elapsedTime.textContent() || '00:00';
  }

  /**
   * Get throughput (prompts per minute)
   */
  async getThroughput(): Promise<number> {
    const text = await this.throughput.textContent();
    const match = text?.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Wait for specific progress
   */
  async waitForProgress(targetProgress: number, timeout: number = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const currentProgress = await this.getProgress();
      if (currentProgress >= targetProgress) {
        return;
      }
      await this.page.waitForTimeout(500);
    }
    
    throw new Error(`Timeout waiting for progress ${targetProgress}%`);
  }

  /**
   * Wait for completion
   */
  async waitForCompletion(timeout: number = 300000) {
    await expect(this.statusIndicator).toHaveText(/completed|finished/i, { timeout });
  }

  /**
   * Pause processing
   */
  async pause() {
    await this.pauseButton.click();
    await expect(this.resumeButton).toBeVisible();
    await expect(this.statusIndicator).toHaveText(/paused/i);
  }

  /**
   * Resume processing
   */
  async resume() {
    await this.resumeButton.click();
    await expect(this.pauseButton).toBeVisible();
    await expect(this.statusIndicator).toHaveText(/processing/i);
  }

  /**
   * Cancel processing
   */
  async cancel() {
    await this.cancelButton.click();
    
    // Confirm cancellation if dialog appears
    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await dialog.getByRole('button', { name: /confirm|yes/i }).click();
    }
    
    await expect(this.statusIndicator).toHaveText(/cancelled/i);
  }

  /**
   * Get errors
   */
  async getErrors(): Promise<string[]> {
    if (!await this.errorList.isVisible()) {
      return [];
    }

    const errors = this.errorList.locator('li');
    const count = await errors.count();
    const errorList: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await errors.nth(i).textContent();
      if (text) errorList.push(text);
    }

    return errorList;
  }

  /**
   * Get warnings
   */
  async getWarnings(): Promise<string[]> {
    if (!await this.warningList.isVisible()) {
      return [];
    }

    const warnings = this.warningList.locator('li');
    const count = await warnings.count();
    const warningList: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await warnings.nth(i).textContent();
      if (text) warningList.push(text);
    }

    return warningList;
  }

  /**
   * Check if pause is available
   */
  async canPause(): Promise<boolean> {
    return await this.pauseButton.isVisible() && await this.pauseButton.isEnabled();
  }

  /**
   * Check if resume is available
   */
  async canResume(): Promise<boolean> {
    return await this.resumeButton.isVisible() && await this.resumeButton.isEnabled();
  }

  /**
   * Check if cancel is available
   */
  async canCancel(): Promise<boolean> {
    return await this.cancelButton.isVisible() && await this.cancelButton.isEnabled();
  }

  /**
   * Get milestone notifications
   */
  async getMilestoneNotifications(): Promise<string[]> {
    if (!await this.milestoneNotifications.isVisible()) {
      return [];
    }

    const notifications = this.milestoneNotifications.locator('[role="alert"]');
    const count = await notifications.count();
    const notificationList: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await notifications.nth(i).textContent();
      if (text) notificationList.push(text);
    }

    return notificationList;
  }

  /**
   * Verify progress is updating
   */
  async verifyProgressUpdates(checkInterval: number = 2000, checks: number = 3): Promise<boolean> {
    const progressValues: number[] = [];
    
    for (let i = 0; i < checks; i++) {
      progressValues.push(await this.getProgress());
      if (i < checks - 1) {
        await this.page.waitForTimeout(checkInterval);
      }
    }

    // Check if progress is increasing
    for (let i = 1; i < progressValues.length; i++) {
      if (progressValues[i] <= progressValues[i - 1]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get progress bar style (for visual testing)
   */
  async getProgressBarStyle(): Promise<{
    width: string;
    backgroundColor: string;
  }> {
    const progressFill = this.progressBar.locator('.progress-fill, [role="progressbar"] > div').first();
    
    const width = await progressFill.evaluate(el => 
      window.getComputedStyle(el).width
    );
    
    const backgroundColor = await progressFill.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );

    return { width, backgroundColor };
  }

  /**
   * Take screenshot of progress tracker
   */
  async takeScreenshot(name: string) {
    const container = this.page.getByTestId('progress-container');
    await container.screenshot({ 
      path: `screenshots/progress-${name}.png`,
      animations: 'disabled'
    });
  }

  /**
   * Check if processing is complete
   */
  async isComplete(): Promise<boolean> {
    const status = await this.getStatus();
    return status === 'completed' || status === 'finished';
  }

  /**
   * Check if processing failed
   */
  async isFailed(): Promise<boolean> {
    const status = await this.getStatus();
    return status === 'failed' || status === 'error';
  }

  /**
   * Get completion time
   */
  async getCompletionTime(): Promise<string | null> {
    const completionTime = this.page.getByTestId('completion-time');
    if (!await completionTime.isVisible()) {
      return null;
    }
    return await completionTime.textContent();
  }
}