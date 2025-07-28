import { Page, expect } from '@playwright/test';

export interface ProgressUpdate {
  batchId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  processedCount: number;
  totalCount: number;
  currentPrompt?: string;
  eta?: number; // seconds
  errors?: string[];
  startedAt?: string;
  completedAt?: string;
  message?: string;
}

export interface WebSocketMessage {
  type: 'progress' | 'complete' | 'error' | 'heartbeat';
  data: ProgressUpdate;
  timestamp: string;
}

export class WebSocketHelper {
  private page: Page;
  private wsUrl: string;
  private messages: WebSocketMessage[] = [];
  private connectionPromise?: Promise<void>;

  constructor(page: Page, wsUrl: string = 'ws://localhost/ws') {
    this.page = page;
    this.wsUrl = wsUrl;
  }

  /**
   * Initialize WebSocket connection and start listening
   */
  async connect(batchId: string): Promise<void> {
    this.connectionPromise = this.page.evaluate(({ wsUrl, batchId }) => {
      return new Promise<void>((resolve, reject) => {
        // Create WebSocket connection
        const ws = new WebSocket(`${wsUrl}/batch/${batchId}`);
        
        // Store on window for access
        (window as any).__testWebSocket = ws;
        (window as any).__testWebSocketMessages = [];

        ws.onopen = () => {
          console.log('WebSocket connected');
          resolve();
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          (window as any).__testWebSocketMessages.push(message);
          
          // Dispatch custom event for easier testing
          window.dispatchEvent(new CustomEvent('ws-message', { 
            detail: message 
          }));
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
        };

        // Heartbeat to keep connection alive
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          } else {
            clearInterval(heartbeat);
          }
        }, 30000);
      });
    }, { wsUrl: this.wsUrl, batchId });

    await this.connectionPromise;
  }

  /**
   * Wait for specific progress milestone
   */
  async waitForProgress(targetProgress: number, timeout: number = 60000): Promise<ProgressUpdate> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const latestProgress = await this.getLatestProgress();
      
      if (latestProgress && latestProgress.progress >= targetProgress) {
        return latestProgress;
      }

      // Wait a bit before checking again
      await this.page.waitForTimeout(500);
    }

    throw new Error(`Timeout waiting for progress ${targetProgress}%`);
  }

  /**
   * Wait for completion
   */
  async waitForCompletion(timeout: number = 300000): Promise<ProgressUpdate> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          const status = await this.getLatestProgress();
          
          if (status?.status === 'completed') {
            clearInterval(checkInterval);
            resolve(status);
          } else if (status?.status === 'failed' || status?.status === 'cancelled') {
            clearInterval(checkInterval);
            reject(new Error(`Batch processing ${status.status}: ${status.message}`));
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 1000);

      // Timeout
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for completion after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Get latest progress update
   */
  async getLatestProgress(): Promise<ProgressUpdate | null> {
    const messages = await this.page.evaluate(() => {
      return (window as any).__testWebSocketMessages || [];
    });

    const progressMessages = messages
      .filter((m: WebSocketMessage) => m.type === 'progress' || m.type === 'complete')
      .map((m: WebSocketMessage) => m.data);

    return progressMessages.length > 0 ? progressMessages[progressMessages.length - 1] : null;
  }

  /**
   * Get all messages
   */
  async getAllMessages(): Promise<WebSocketMessage[]> {
    return await this.page.evaluate(() => {
      return (window as any).__testWebSocketMessages || [];
    });
  }

  /**
   * Disconnect WebSocket
   */
  async disconnect() {
    await this.page.evaluate(() => {
      const ws = (window as any).__testWebSocket;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  }

  /**
   * Simulate connection failure
   */
  async simulateDisconnect() {
    await this.page.evaluate(() => {
      const ws = (window as any).__testWebSocket;
      if (ws) {
        ws.close();
      }
    });
  }

  /**
   * Check if connected
   */
  async isConnected(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const ws = (window as any).__testWebSocket;
      return ws && ws.readyState === WebSocket.OPEN;
    });
  }
}

export class PollingHelper {
  private page: Page;
  private apiBase: string;

  constructor(page: Page, apiBase: string = '/api/v1') {
    this.page = page;
    this.apiBase = apiBase;
  }

  /**
   * Poll for batch status
   */
  async pollStatus(batchId: string, interval: number = 2000): Promise<ProgressUpdate> {
    const response = await this.page.request.get(`${this.apiBase}/batch/status/${batchId}`);
    
    if (!response.ok()) {
      throw new Error(`Failed to get batch status: ${response.status()}`);
    }

    return await response.json();
  }

  /**
   * Poll until completion
   */
  async pollUntilComplete(
    batchId: string, 
    options: {
      interval?: number;
      timeout?: number;
      onProgress?: (update: ProgressUpdate) => void;
    } = {}
  ): Promise<ProgressUpdate> {
    const { interval = 2000, timeout = 300000, onProgress } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.pollStatus(batchId);
      
      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        throw new Error(`Batch processing ${status.status}: ${status.message}`);
      }

      await this.page.waitForTimeout(interval);
    }

    throw new Error(`Timeout polling for completion after ${timeout}ms`);
  }

  /**
   * Get batch history
   */
  async getBatchHistory(limit: number = 10): Promise<ProgressUpdate[]> {
    const response = await this.page.request.get(`${this.apiBase}/batch/history?limit=${limit}`);
    
    if (!response.ok()) {
      throw new Error(`Failed to get batch history: ${response.status()}`);
    }

    return await response.json();
  }

  /**
   * Cancel batch processing
   */
  async cancelBatch(batchId: string): Promise<void> {
    const response = await this.page.request.post(`${this.apiBase}/batch/${batchId}/cancel`);
    
    if (!response.ok()) {
      throw new Error(`Failed to cancel batch: ${response.status()}`);
    }
  }

  /**
   * Retry failed batch
   */
  async retryBatch(batchId: string): Promise<string> {
    const response = await this.page.request.post(`${this.apiBase}/batch/${batchId}/retry`);
    
    if (!response.ok()) {
      throw new Error(`Failed to retry batch: ${response.status()}`);
    }

    const data = await response.json();
    return data.batchId;
  }
}

/**
 * Helper to validate progress updates
 */
export class ProgressValidator {
  /**
   * Validate progress sequence
   */
  static validateProgressSequence(updates: ProgressUpdate[]): void {
    let lastProgress = -1;
    let lastProcessedCount = -1;

    for (const update of updates) {
      // Progress should never decrease
      expect(update.progress).toBeGreaterThanOrEqual(lastProgress);
      lastProgress = update.progress;

      // Processed count should never decrease
      expect(update.processedCount).toBeGreaterThanOrEqual(lastProcessedCount);
      lastProcessedCount = update.processedCount;

      // Progress should match processed/total ratio
      const expectedProgress = Math.floor((update.processedCount / update.totalCount) * 100);
      expect(Math.abs(update.progress - expectedProgress)).toBeLessThanOrEqual(1);
    }
  }

  /**
   * Validate update frequency
   */
  static validateUpdateFrequency(messages: WebSocketMessage[], expectedIntervalMs: number = 2000): void {
    const timestamps = messages.map(m => new Date(m.timestamp).getTime());
    
    for (let i = 1; i < timestamps.length; i++) {
      const interval = timestamps[i] - timestamps[i - 1];
      // Allow 20% variance
      expect(interval).toBeLessThanOrEqual(expectedIntervalMs * 1.2);
      expect(interval).toBeGreaterThanOrEqual(expectedIntervalMs * 0.8);
    }
  }

  /**
   * Validate ETA accuracy
   */
  static validateETA(update: ProgressUpdate, startTime: number): void {
    if (!update.eta || update.progress === 0) return;

    const elapsedMs = Date.now() - startTime;
    const progressRate = update.progress / (elapsedMs / 1000); // % per second
    const remainingProgress = 100 - update.progress;
    const calculatedETA = remainingProgress / progressRate;

    // Allow 30% variance in ETA
    expect(Math.abs(update.eta - calculatedETA)).toBeLessThanOrEqual(calculatedETA * 0.3);
  }
}

/**
 * Mock WebSocket for testing connection issues
 */
export class MockWebSocket {
  static setupMockWebSocket(page: Page) {
    return page.evaluate(() => {
      class MockWebSocket {
        url: string;
        readyState: number = 0;
        onopen: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;

        constructor(url: string) {
          this.url = url;
          setTimeout(() => {
            this.readyState = 1;
            if (this.onopen) {
              this.onopen(new Event('open'));
            }
          }, 100);
        }

        send(data: string) {
          console.log('MockWebSocket send:', data);
        }

        close() {
          this.readyState = 3;
          if (this.onclose) {
            this.onclose(new CloseEvent('close'));
          }
        }

        simulateMessage(data: any) {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
          }
        }

        simulateError() {
          if (this.onerror) {
            this.onerror(new Event('error'));
          }
        }
      }

      (window as any).WebSocket = MockWebSocket as any;
      (window as any).__mockWebSocket = MockWebSocket;
    });
  }
}