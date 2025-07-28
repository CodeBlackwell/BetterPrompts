import { Page, Locator, expect, Download } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as AdmZip from 'adm-zip';

export interface DownloadedResult {
  originalPrompt: string;
  enhancedPrompt: string;
  technique: string;
  confidence: number;
  processingTime?: number;
  error?: string;
}

export class ResultsDownloader {
  private readonly page: Page;
  
  // Locators
  private readonly downloadButton: Locator;
  private readonly formatSelector: Locator;
  private readonly downloadProgress: Locator;
  private readonly resultsSummary: Locator;
  private readonly successCount: Locator;
  private readonly errorCount: Locator;
  private readonly downloadHistory: Locator;
  private readonly previewTable: Locator;
  private readonly filterOptions: Locator;
  private readonly retryFailedButton: Locator;
  private readonly emailResultsButton: Locator;
  private readonly compressionToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.downloadButton = page.getByRole('button', { name: /download results/i });
    this.formatSelector = page.getByRole('combobox', { name: /format/i });
    this.downloadProgress = page.getByTestId('download-progress');
    this.resultsSummary = page.getByTestId('results-summary');
    this.successCount = page.getByTestId('success-count');
    this.errorCount = page.getByTestId('error-count');
    this.downloadHistory = page.getByTestId('download-history');
    this.previewTable = page.getByTestId('results-preview');
    this.filterOptions = page.getByTestId('filter-options');
    this.retryFailedButton = page.getByRole('button', { name: /retry failed/i });
    this.emailResultsButton = page.getByRole('button', { name: /email results/i });
    this.compressionToggle = page.getByRole('switch', { name: /compress/i });
  }

  /**
   * Navigate to results page for a batch
   */
  async goto(batchId: string) {
    await this.page.goto(`/batch/${batchId}/results`);
    await expect(this.resultsSummary).toBeVisible();
  }

  /**
   * Select download format
   */
  async selectFormat(format: 'CSV' | 'JSON' | 'ZIP') {
    await this.formatSelector.selectOption(format);
  }

  /**
   * Download results
   */
  async downloadResults(format: 'CSV' | 'JSON' | 'ZIP' = 'CSV'): Promise<Download> {
    await this.selectFormat(format);
    
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    
    const download = await downloadPromise;
    return download;
  }

  /**
   * Download and parse CSV results
   */
  async downloadAndParseCSV(): Promise<DownloadedResult[]> {
    const download = await this.downloadResults('CSV');
    const downloadPath = await download.path();
    
    if (!downloadPath) {
      throw new Error('Download path not available');
    }

    const content = fs.readFileSync(downloadPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    return records.map((record: any) => ({
      originalPrompt: record.original_prompt || record.prompt,
      enhancedPrompt: record.enhanced_prompt || record.result,
      technique: record.technique || record.method,
      confidence: parseFloat(record.confidence || '0'),
      processingTime: record.processing_time ? parseFloat(record.processing_time) : undefined,
      error: record.error || undefined
    }));
  }

  /**
   * Download and parse JSON results
   */
  async downloadAndParseJSON(): Promise<DownloadedResult[]> {
    const download = await this.downloadResults('JSON');
    const downloadPath = await download.path();
    
    if (!downloadPath) {
      throw new Error('Download path not available');
    }

    const content = fs.readFileSync(downloadPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Download and extract ZIP results
   */
  async downloadAndExtractZIP(): Promise<{
    summary: any;
    results: DownloadedResult[];
    metadata: any;
  }> {
    const download = await this.downloadResults('ZIP');
    const downloadPath = await download.path();
    
    if (!downloadPath) {
      throw new Error('Download path not available');
    }

    const zip = new AdmZip(downloadPath);
    const entries = zip.getEntries();
    
    let summary: any = {};
    let results: DownloadedResult[] = [];
    let metadata: any = {};

    entries.forEach(entry => {
      const content = entry.getData().toString('utf-8');
      
      if (entry.entryName === 'summary.json') {
        summary = JSON.parse(content);
      } else if (entry.entryName === 'results.csv') {
        results = parse(content, {
          columns: true,
          skip_empty_lines: true
        }).map((record: any) => ({
          originalPrompt: record.original_prompt,
          enhancedPrompt: record.enhanced_prompt,
          technique: record.technique,
          confidence: parseFloat(record.confidence),
          processingTime: record.processing_time ? parseFloat(record.processing_time) : undefined,
          error: record.error || undefined
        }));
      } else if (entry.entryName === 'metadata.json') {
        metadata = JSON.parse(content);
      }
    });

    return { summary, results, metadata };
  }

  /**
   * Get success count
   */
  async getSuccessCount(): Promise<number> {
    const text = await this.successCount.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  /**
   * Get error count
   */
  async getErrorCount(): Promise<number> {
    const text = await this.errorCount.textContent();
    const match = text?.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  /**
   * Get results preview
   */
  async getPreviewResults(limit: number = 10): Promise<DownloadedResult[]> {
    const rows = this.previewTable.locator('tbody tr');
    const count = Math.min(await rows.count(), limit);
    const results: DownloadedResult[] = [];

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const cells = row.locator('td');
      
      results.push({
        originalPrompt: await cells.nth(0).textContent() || '',
        enhancedPrompt: await cells.nth(1).textContent() || '',
        technique: await cells.nth(2).textContent() || '',
        confidence: parseFloat(await cells.nth(3).textContent() || '0'),
        processingTime: parseFloat(await cells.nth(4).textContent() || '0'),
        error: await cells.nth(5).textContent() || undefined
      });
    }

    return results;
  }

  /**
   * Filter results
   */
  async filterResults(filter: 'all' | 'success' | 'errors') {
    const filterButton = this.filterOptions.getByRole('button', { name: new RegExp(filter, 'i') });
    await filterButton.click();
    
    // Wait for table to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Retry failed prompts
   */
  async retryFailed(): Promise<string> {
    await this.retryFailedButton.click();
    
    // Wait for new batch to be created
    await this.page.waitForURL(/\/batch\/[a-zA-Z0-9-]+/);
    
    // Extract new batch ID from URL
    const url = this.page.url();
    const match = url.match(/batch\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : '';
  }

  /**
   * Email results
   */
  async emailResults(email?: string) {
    await this.emailResultsButton.click();
    
    // Fill email if dialog appears
    const emailDialog = this.page.getByRole('dialog');
    if (await emailDialog.isVisible()) {
      if (email) {
        const emailInput = emailDialog.getByRole('textbox', { name: /email/i });
        await emailInput.fill(email);
      }
      
      await emailDialog.getByRole('button', { name: /send/i }).click();
    }
    
    // Wait for confirmation
    await expect(this.page.getByText(/email sent|results will be sent/i)).toBeVisible();
  }

  /**
   * Enable compression
   */
  async enableCompression() {
    const isChecked = await this.compressionToggle.isChecked();
    if (!isChecked) {
      await this.compressionToggle.click();
    }
  }

  /**
   * Verify download integrity
   */
  async verifyDownloadIntegrity(download: Download, expectedCount: number): Promise<boolean> {
    const downloadPath = await download.path();
    if (!downloadPath) return false;

    const filename = download.suggestedFilename();
    
    if (filename.endsWith('.csv')) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const records = parse(content, { columns: true });
      return records.length === expectedCount;
    } else if (filename.endsWith('.json')) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) && data.length === expectedCount;
    } else if (filename.endsWith('.zip')) {
      const zip = new AdmZip(downloadPath);
      const resultsEntry = zip.getEntry('results.csv');
      if (!resultsEntry) return false;
      
      const content = resultsEntry.getData().toString('utf-8');
      const records = parse(content, { columns: true });
      return records.length === expectedCount;
    }

    return false;
  }

  /**
   * Get download history
   */
  async getDownloadHistory(): Promise<Array<{
    timestamp: string;
    format: string;
    size: string;
  }>> {
    const items = this.downloadHistory.locator('li');
    const count = await items.count();
    const history: Array<{ timestamp: string; format: string; size: string }> = [];

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const text = await item.textContent() || '';
      
      // Parse history item text
      const timestampMatch = text.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      const formatMatch = text.match(/(CSV|JSON|ZIP)/i);
      const sizeMatch = text.match(/(\d+(?:\.\d+)?\s*[KMG]B)/i);
      
      history.push({
        timestamp: timestampMatch ? timestampMatch[1] : '',
        format: formatMatch ? formatMatch[1] : '',
        size: sizeMatch ? sizeMatch[1] : ''
      });
    }

    return history;
  }

  /**
   * Wait for results to be ready
   */
  async waitForResultsReady(timeout: number = 30000) {
    await expect(this.downloadButton).toBeEnabled({ timeout });
  }

  /**
   * Get processing summary
   */
  async getProcessingSummary(): Promise<{
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
    techniques: Record<string, number>;
  }> {
    const summaryText = await this.resultsSummary.textContent() || '';
    
    // Parse summary information
    const totalMatch = summaryText.match(/total:\s*(\d+)/i);
    const successMatch = summaryText.match(/success:\s*(\d+)/i);
    const failedMatch = summaryText.match(/failed:\s*(\d+)/i);
    const avgTimeMatch = summaryText.match(/average time:\s*(\d+(?:\.\d+)?)\s*ms/i);

    // Get technique breakdown if available
    const techniqueBreakdown = this.page.getByTestId('technique-breakdown');
    const techniques: Record<string, number> = {};
    
    if (await techniqueBreakdown.isVisible()) {
      const items = techniqueBreakdown.locator('li');
      const count = await items.count();
      
      for (let i = 0; i < count; i++) {
        const text = await items.nth(i).textContent() || '';
        const match = text.match(/(.+?):\s*(\d+)/);
        if (match) {
          techniques[match[1].trim()] = parseInt(match[2]);
        }
      }
    }

    return {
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      successful: successMatch ? parseInt(successMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      averageTime: avgTimeMatch ? parseFloat(avgTimeMatch[1]) : 0,
      techniques
    };
  }
}