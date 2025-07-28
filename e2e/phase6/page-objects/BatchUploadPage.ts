import { Page, Locator, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export class BatchUploadPage {
  private readonly page: Page;
  
  // Locators
  private readonly uploadDropZone: Locator;
  private readonly fileInput: Locator;
  private readonly pasteArea: Locator;
  private readonly uploadButton: Locator;
  private readonly formatSelector: Locator;
  private readonly clearButton: Locator;
  private readonly filePreview: Locator;
  private readonly errorMessage: Locator;
  private readonly successMessage: Locator;
  private readonly progressIndicator: Locator;
  private readonly promptCount: Locator;
  private readonly fileSizeDisplay: Locator;
  private readonly validationErrors: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.uploadDropZone = page.getByTestId('batch-upload-dropzone');
    this.fileInput = page.locator('input[type="file"]');
    this.pasteArea = page.getByTestId('paste-area');
    this.uploadButton = page.getByRole('button', { name: /upload|process/i });
    this.formatSelector = page.getByRole('combobox', { name: /format/i });
    this.clearButton = page.getByRole('button', { name: /clear|reset/i });
    this.filePreview = page.getByTestId('file-preview');
    this.errorMessage = page.getByTestId('error-message');
    this.successMessage = page.getByTestId('success-message');
    this.progressIndicator = page.getByTestId('upload-progress');
    this.promptCount = page.getByTestId('prompt-count');
    this.fileSizeDisplay = page.getByTestId('file-size');
    this.validationErrors = page.getByTestId('validation-errors');
  }

  /**
   * Navigate to batch upload page
   */
  async goto() {
    await this.page.goto('/batch-upload');
    await expect(this.uploadDropZone).toBeVisible();
  }

  /**
   * Upload file using file picker
   */
  async uploadViaFilePicker(filepath: string) {
    // Make sure file exists
    if (!fs.existsSync(filepath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    // Set file on input
    await this.fileInput.setInputFiles(filepath);
    
    // Wait for file to be processed
    await this.waitForFileProcessing();
  }

  /**
   * Upload file using drag and drop
   */
  async uploadViaDragDrop(filepath: string) {
    // Read file content
    const buffer = fs.readFileSync(filepath);
    const filename = path.basename(filepath);

    // Create DataTransfer and File
    await this.page.evaluate(async ({ buffer, filename, dropZoneSelector }) => {
      const dataTransfer = new DataTransfer();
      const file = new File([new Uint8Array(buffer)], filename, {
        type: filename.endsWith('.csv') ? 'text/csv' : 'text/plain'
      });
      dataTransfer.items.add(file);

      // Dispatch drag events
      const dropZone = document.querySelector(dropZoneSelector);
      const dragEnterEvent = new DragEvent('dragenter', {
        dataTransfer,
        bubbles: true
      });
      const dragOverEvent = new DragEvent('dragover', {
        dataTransfer,
        bubbles: true
      });
      const dropEvent = new DragEvent('drop', {
        dataTransfer,
        bubbles: true
      });

      dropZone?.dispatchEvent(dragEnterEvent);
      dropZone?.dispatchEvent(dragOverEvent);
      dropZone?.dispatchEvent(dropEvent);
    }, {
      buffer: [...buffer],
      filename,
      dropZoneSelector: '[data-testid="batch-upload-dropzone"]'
    });

    await this.waitForFileProcessing();
  }

  /**
   * Upload content via paste
   */
  async uploadViaPaste(content: string) {
    // Click on paste area to focus
    await this.pasteArea.click();
    
    // Clear existing content
    await this.pasteArea.clear();
    
    // Paste content
    await this.pasteArea.fill(content);
    
    // Trigger paste event
    await this.pasteArea.press('Control+v');
    
    await this.waitForFileProcessing();
  }

  /**
   * Select file format
   */
  async selectFormat(format: 'CSV' | 'XLSX' | 'TXT') {
    await this.formatSelector.selectOption(format);
  }

  /**
   * Click upload/process button
   */
  async clickUpload() {
    await this.uploadButton.click();
  }

  /**
   * Clear current upload
   */
  async clearUpload() {
    await this.clearButton.click();
    await expect(this.filePreview).not.toBeVisible();
  }

  /**
   * Wait for file processing to complete
   */
  private async waitForFileProcessing() {
    // Wait for either preview or error
    await this.page.waitForSelector('[data-testid="file-preview"], [data-testid="error-message"]', {
      timeout: 5000
    });
  }

  /**
   * Get preview content
   */
  async getPreviewContent(): Promise<string[]> {
    await expect(this.filePreview).toBeVisible();
    const rows = this.filePreview.locator('tr');
    const count = await rows.count();
    const content: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text) content.push(text);
    }

    return content;
  }

  /**
   * Get prompt count
   */
  async getPromptCount(): Promise<number> {
    const text = await this.promptCount.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  /**
   * Get file size
   */
  async getFileSize(): Promise<string> {
    return await this.fileSizeDisplay.textContent() || '';
  }

  /**
   * Check if error is displayed
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Get validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    if (!await this.validationErrors.isVisible()) {
      return [];
    }

    const errors = this.validationErrors.locator('li');
    const count = await errors.count();
    const errorList: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await errors.nth(i).textContent();
      if (text) errorList.push(text);
    }

    return errorList;
  }

  /**
   * Check if upload button is enabled
   */
  async isUploadEnabled(): Promise<boolean> {
    return await this.uploadButton.isEnabled();
  }

  /**
   * Wait for upload to start processing
   */
  async waitForUploadStart() {
    await expect(this.progressIndicator).toBeVisible();
  }

  /**
   * Get batch ID from success message or URL
   */
  async getBatchId(): Promise<string> {
    // Try to get from success message first
    if (await this.successMessage.isVisible()) {
      const text = await this.successMessage.textContent();
      const match = text?.match(/batch[- ]?id:?\s*([a-zA-Z0-9-]+)/i);
      if (match) return match[1];
    }

    // Try URL
    const url = this.page.url();
    const urlMatch = url.match(/batch\/([a-zA-Z0-9-]+)/);
    if (urlMatch) return urlMatch[1];

    throw new Error('Could not find batch ID');
  }

  /**
   * Validate file size limits
   */
  async validateFileSizeLimit(filepath: string): Promise<boolean> {
    const stats = fs.statSync(filepath);
    const sizeMB = stats.size / (1024 * 1024);
    return sizeMB <= 10;
  }

  /**
   * Upload multiple files (for testing multiple batch handling)
   */
  async uploadMultipleFiles(filepaths: string[]) {
    await this.fileInput.setInputFiles(filepaths);
    await this.waitForFileProcessing();
  }

  /**
   * Test drag hover effects
   */
  async testDragHover() {
    const dropZone = this.uploadDropZone;
    
    // Simulate drag enter
    await dropZone.dispatchEvent('dragenter');
    await expect(dropZone).toHaveClass(/drag-over|hover/);
    
    // Simulate drag leave
    await dropZone.dispatchEvent('dragleave');
    await expect(dropZone).not.toHaveClass(/drag-over|hover/);
  }

  /**
   * Get supported formats display
   */
  async getSupportedFormats(): Promise<string[]> {
    const formatsText = await this.page.getByText(/supported formats/i).textContent();
    const formats = formatsText?.match(/CSV|XLSX|TXT/g) || [];
    return [...new Set(formats)];
  }

  /**
   * Cancel ongoing upload
   */
  async cancelUpload() {
    const cancelButton = this.page.getByRole('button', { name: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    }
  }
}