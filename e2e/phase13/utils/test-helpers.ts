import { Page, Locator } from '@playwright/test';

/**
 * Common test helper utilities for Phase 13 journey tests
 */

/**
 * Smart wait utilities to replace hard waits
 */
export class WaitHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(options?: { timeout?: number }) {
    await this.page.waitForLoadState('networkidle', options);
  }

  /**
   * Wait for specific number of elements to appear
   */
  async waitForElementCount(
    selector: string,
    count: number,
    options?: { timeout?: number }
  ): Promise<void> {
    await this.page.waitForFunction(
      ({ selector, count }) => {
        const elements = document.querySelectorAll(selector);
        return elements.length === count;
      },
      { selector, count },
      options
    );
  }

  /**
   * Wait for element to be stable (no position changes)
   */
  async waitForElementStability(
    locator: Locator,
    options?: { timeout?: number; checkInterval?: number }
  ): Promise<void> {
    const timeout = options?.timeout || 10000;
    const checkInterval = options?.checkInterval || 100;
    const startTime = Date.now();
    
    let lastPosition = await locator.boundingBox();
    
    while (Date.now() - startTime < timeout) {
      await this.page.waitForTimeout(checkInterval);
      const currentPosition = await locator.boundingBox();
      
      if (
        lastPosition &&
        currentPosition &&
        lastPosition.x === currentPosition.x &&
        lastPosition.y === currentPosition.y &&
        lastPosition.width === currentPosition.width &&
        lastPosition.height === currentPosition.height
      ) {
        return;
      }
      
      lastPosition = currentPosition;
    }
    
    throw new Error(`Element did not stabilize within ${timeout}ms`);
  }

  /**
   * Wait for animation to complete
   */
  async waitForAnimation(locator: Locator): Promise<void> {
    await locator.evaluate((element) => {
      return new Promise<void>((resolve) => {
        const checkAnimation = () => {
          const animations = element.getAnimations();
          if (animations.length === 0) {
            resolve();
          } else {
            Promise.all(animations.map(a => a.finished)).then(() => resolve());
          }
        };
        checkAnimation();
      });
    });
  }

  /**
   * Wait for value to change
   */
  async waitForValueChange(
    locator: Locator,
    options?: { timeout?: number }
  ): Promise<string> {
    const initialValue = await locator.inputValue();
    
    await this.page.waitForFunction(
      ({ selector, initialValue }) => {
        const element = document.querySelector(selector) as HTMLInputElement;
        return element && element.value !== initialValue;
      },
      { 
        selector: await locator.evaluate(el => {
          // Generate a unique selector for the element
          if (el.id) return `#${el.id}`;
          if (el.className) return `.${el.className.split(' ')[0]}`;
          return el.tagName.toLowerCase();
        }),
        initialValue 
      },
      options
    );
    
    return await locator.inputValue();
  }

  /**
   * Smart wait replacement for waitForTimeout
   * Waits for a condition or timeout, whichever comes first
   */
  async smartWait(
    condition: () => Promise<boolean>,
    options?: { timeout?: number; checkInterval?: number }
  ): Promise<void> {
    const timeout = options?.timeout || 5000;
    const checkInterval = options?.checkInterval || 100;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) return;
      } catch {
        // Ignore errors and continue checking
      }
      
      await this.page.waitForTimeout(checkInterval);
    }
    
    // If we get here, the condition was never met but we don't throw
    // This makes it a "best effort" wait
  }
}

/**
 * Retry utilities for flaky operations
 */
export class RetryHelpers {
  /**
   * Retry an operation with exponential backoff
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options?: {
      maxAttempts?: number;
      initialDelay?: number;
      maxDelay?: number;
      factor?: number;
    }
  ): Promise<T> {
    const maxAttempts = options?.maxAttempts || 3;
    const initialDelay = options?.initialDelay || 1000;
    const maxDelay = options?.maxDelay || 10000;
    const factor = options?.factor || 2;
    
    let lastError: Error | null = null;
    let delay = initialDelay;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * factor, maxDelay);
        }
      }
    }
    
    throw new Error(`Operation failed after ${maxAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Retry until condition is met
   */
  static async retryUntil(
    condition: () => Promise<boolean>,
    options?: {
      timeout?: number;
      checkInterval?: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    const timeout = options?.timeout || 30000;
    const checkInterval = options?.checkInterval || 500;
    const errorMessage = options?.errorMessage || 'Condition not met within timeout';
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) return;
      } catch {
        // Ignore errors and continue
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error(`${errorMessage} (timeout: ${timeout}ms)`);
  }
}

/**
 * Test data generation utilities
 */
export class TestDataHelpers {
  /**
   * Generate unique email
   */
  static generateEmail(prefix: string = 'test'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}_${timestamp}_${random}@example.com`;
  }

  /**
   * Generate unique identifier
   */
  static generateId(prefix: string = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate test prompt
   */
  static generatePrompt(index: number): string {
    const topics = [
      'artificial intelligence',
      'climate change',
      'quantum computing',
      'renewable energy',
      'space exploration',
      'biotechnology',
      'cybersecurity',
      'blockchain',
      'machine learning',
      'robotics'
    ];
    
    const topic = topics[index % topics.length];
    return `Generate a detailed analysis for topic ${index}: ${topic}`;
  }

  /**
   * Generate batch CSV content
   */
  static generateBatchCsv(count: number, options?: { includeErrors?: boolean }): string {
    const rows = ['prompt,technique'];
    const techniques = ['chain_of_thought', 'tree_of_thoughts', 'few_shot', 'role_play', 'socratic'];
    
    for (let i = 1; i <= count; i++) {
      const technique = techniques[i % techniques.length];
      
      // Add some intentionally problematic prompts if requested
      const prompt = options?.includeErrors && i % 20 === 0
        ? `[INVALID] Test prompt ${i} with bad characters @#$%`
        : this.generatePrompt(i);
      
      rows.push(`"${prompt}","${technique}"`);
    }
    
    return rows.join('\n');
  }
}

/**
 * Screenshot utilities
 */
export class ScreenshotHelpers {
  constructor(private page: Page) {}

  /**
   * Take screenshot with context
   */
  async takeContextScreenshot(name: string, options?: { fullPage?: boolean }): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `e2e/phase13/screenshots/${name}_${timestamp}.png`;
    
    await this.page.screenshot({
      path,
      fullPage: options?.fullPage || false
    });
    
    console.log(`📸 Screenshot saved: ${path}`);
  }

  /**
   * Take screenshot on error
   */
  async screenshotOnError<T>(
    operation: () => Promise<T>,
    screenshotName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      await this.takeContextScreenshot(`error_${screenshotName}`, { fullPage: true });
      throw error;
    }
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceHelpers {
  private marks: Map<string, number> = new Map();

  /**
   * Start timing
   */
  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  /**
   * Measure duration
   */
  measure(name: string): number {
    const start = this.marks.get(name);
    if (!start) {
      throw new Error(`No mark found for ${name}`);
    }
    
    const duration = Date.now() - start;
    this.marks.delete(name);
    return duration;
  }

  /**
   * Measure async operation
   */
  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    this.mark(name);
    const result = await operation();
    const duration = this.measure(name);
    
    console.log(`⏱️ ${name}: ${duration}ms`);
    return { result, duration };
  }
}