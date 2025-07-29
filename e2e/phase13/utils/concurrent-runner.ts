import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { JourneyOrchestrator, JourneyConfig, JourneyMetrics } from './journey-orchestrator';

/**
 * Concurrent journey execution configuration
 */
export interface ConcurrentConfig {
  journeys: Array<{
    config: JourneyConfig;
    instances: number;
    staggerDelay?: number;
  }>;
  maxConcurrent?: number;
  browserPoolSize?: number;
  rampUpTime?: number;
  sustainDuration?: number;
  monitoringInterval?: number;
}

/**
 * Concurrent execution metrics
 */
export interface ConcurrentMetrics {
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  journeyResults: Map<string, JourneyResult[]>;
  systemMetrics: SystemMetrics[];
  errors: Array<{
    journey: string;
    instance: number;
    error: Error;
    timestamp: number;
  }>;
  summary: {
    totalJourneys: number;
    successfulJourneys: number;
    failedJourneys: number;
    avgResponseTime: number;
    peakConcurrent: number;
    errorRate: number;
  };
}

/**
 * Individual journey result
 */
export interface JourneyResult {
  journeyName: string;
  instanceId: number;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metrics: JourneyMetrics;
  error?: Error;
}

/**
 * System metrics snapshot
 */
export interface SystemMetrics {
  timestamp: number;
  activeJourneys: number;
  completedJourneys: number;
  failedJourneys: number;
  avgResponseTime: number;
  errorRate: number;
  queueLength: number;
}

/**
 * Browser pool for managing browser instances
 */
class BrowserPool {
  private browsers: Browser[] = [];
  private availableBrowsers: Browser[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  async initialize(): Promise<void> {
    console.log(`🌐 Initializing browser pool with ${this.maxSize} instances...`);
    
    for (let i = 0; i < this.maxSize; i++) {
      const browser = await chromium.launch({
        headless: true,
        args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox']
      });
      this.browsers.push(browser);
      this.availableBrowsers.push(browser);
    }
    
    console.log(`✅ Browser pool initialized with ${this.browsers.length} instances`);
  }

  async getBrowser(): Promise<Browser> {
    // Wait for available browser
    while (this.availableBrowsers.length === 0) {
      await this.delay(100);
    }
    
    return this.availableBrowsers.shift()!;
  }

  releaseBrowser(browser: Browser): void {
    if (!this.availableBrowsers.includes(browser)) {
      this.availableBrowsers.push(browser);
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up browser pool...');
    await Promise.all(this.browsers.map(browser => browser.close()));
    this.browsers = [];
    this.availableBrowsers = [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Concurrent runner for executing multiple journeys in parallel
 */
export class ConcurrentRunner {
  private config: ConcurrentConfig;
  private browserPool: BrowserPool;
  private metrics: ConcurrentMetrics;
  private activeJourneys: Set<Promise<JourneyResult>> = new Set();
  private monitoringInterval?: NodeJS.Timeout;
  private journeyQueue: Array<() => Promise<JourneyResult>> = [];

  constructor(config: ConcurrentConfig) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 50,
      browserPoolSize: config.browserPoolSize || 10,
      monitoringInterval: config.monitoringInterval || 1000,
      ...config
    };
    
    this.browserPool = new BrowserPool(this.config.browserPoolSize!);
    this.metrics = {
      startTime: Date.now(),
      journeyResults: new Map(),
      systemMetrics: [],
      errors: [],
      summary: {
        totalJourneys: 0,
        successfulJourneys: 0,
        failedJourneys: 0,
        avgResponseTime: 0,
        peakConcurrent: 0,
        errorRate: 0
      }
    };
  }

  /**
   * Execute all journeys concurrently
   */
  async execute(): Promise<ConcurrentMetrics> {
    console.log('🚀 Starting concurrent journey execution...');
    console.log(`📊 Configuration:
      - Max concurrent: ${this.config.maxConcurrent}
      - Browser pool size: ${this.config.browserPoolSize}
      - Total journeys: ${this.calculateTotalJourneys()}`);

    try {
      // Initialize browser pool
      await this.browserPool.initialize();

      // Start monitoring
      this.startMonitoring();

      // Prepare journey queue
      this.prepareJourneyQueue();

      // Execute with ramp-up if specified
      if (this.config.rampUpTime) {
        await this.executeWithRampUp();
      } else {
        await this.executeImmediate();
      }

      // Sustain load if specified
      if (this.config.sustainDuration) {
        await this.sustainLoad();
      }

      // Wait for all journeys to complete
      await this.waitForCompletion();

      // Finalize metrics
      this.finalizeMetrics();

      console.log('✅ Concurrent execution completed');
      return this.metrics;

    } finally {
      // Cleanup
      this.stopMonitoring();
      await this.browserPool.cleanup();
    }
  }

  /**
   * Prepare journey queue
   */
  private prepareJourneyQueue(): void {
    for (const journey of this.config.journeys) {
      for (let i = 0; i < journey.instances; i++) {
        const instanceId = i;
        const journeyConfig = journey.config;
        const staggerDelay = journey.staggerDelay || 0;
        
        this.journeyQueue.push(async () => {
          if (staggerDelay > 0 && instanceId > 0) {
            await this.delay(staggerDelay * instanceId);
          }
          return this.executeJourney(journeyConfig, instanceId);
        });
      }
    }
    
    this.metrics.summary.totalJourneys = this.journeyQueue.length;
  }

  /**
   * Execute journeys immediately
   */
  private async executeImmediate(): Promise<void> {
    console.log('⚡ Executing all journeys immediately...');
    
    while (this.journeyQueue.length > 0 || this.activeJourneys.size > 0) {
      // Start new journeys up to max concurrent
      while (this.activeJourneys.size < this.config.maxConcurrent! && this.journeyQueue.length > 0) {
        const journeyFn = this.journeyQueue.shift()!;
        const promise = journeyFn();
        this.activeJourneys.add(promise);
        
        // Remove from active set when complete
        promise.finally(() => {
          this.activeJourneys.delete(promise);
        });
      }
      
      await this.delay(100);
    }
  }

  /**
   * Execute journeys with ramp-up
   */
  private async executeWithRampUp(): Promise<void> {
    console.log(`📈 Ramping up over ${this.config.rampUpTime}ms...`);
    
    const totalJourneys = this.journeyQueue.length;
    const rampUpInterval = this.config.rampUpTime! / totalJourneys;
    
    for (let i = 0; i < totalJourneys; i++) {
      if (this.activeJourneys.size >= this.config.maxConcurrent!) {
        await this.waitForSlot();
      }
      
      const journeyFn = this.journeyQueue.shift()!;
      const promise = journeyFn();
      this.activeJourneys.add(promise);
      
      promise.finally(() => {
        this.activeJourneys.delete(promise);
      });
      
      await this.delay(rampUpInterval);
    }
  }

  /**
   * Sustain load for specified duration
   */
  private async sustainLoad(): Promise<void> {
    console.log(`🔄 Sustaining load for ${this.config.sustainDuration}ms...`);
    
    const sustainEndTime = Date.now() + this.config.sustainDuration!;
    const originalJourneys = [...this.config.journeys];
    
    while (Date.now() < sustainEndTime) {
      // Refill queue with journeys
      if (this.journeyQueue.length < this.config.maxConcurrent!) {
        for (const journey of originalJourneys) {
          for (let i = 0; i < Math.min(journey.instances, 5); i++) {
            this.journeyQueue.push(async () => {
              return this.executeJourney(journey.config, Date.now());
            });
          }
        }
      }
      
      // Continue executing
      await this.executeImmediate();
      await this.delay(1000);
    }
  }

  /**
   * Execute a single journey
   */
  private async executeJourney(config: JourneyConfig, instanceId: number): Promise<JourneyResult> {
    const result: JourneyResult = {
      journeyName: config.name,
      instanceId,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      metrics: {} as JourneyMetrics
    };

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // Get browser from pool
      browser = await this.browserPool.getBrowser();
      
      // Create new context with session isolation
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: `ConcurrentRunner-${instanceId}`
      });
      
      // Create page
      page = await context.newPage();
      
      // Create and execute journey
      const orchestrator = new JourneyOrchestrator(config, browser, context, page);
      result.metrics = await orchestrator.executeJourney();
      
      result.success = true;
      this.metrics.summary.successfulJourneys++;
      
    } catch (error) {
      result.error = error as Error;
      result.success = false;
      this.metrics.summary.failedJourneys++;
      
      this.metrics.errors.push({
        journey: config.name,
        instance: instanceId,
        error: error as Error,
        timestamp: Date.now()
      });
      
      console.error(`❌ Journey failed: ${config.name} (instance ${instanceId})`, error);
      
    } finally {
      // Cleanup
      if (page) await page.close();
      if (context) await context.close();
      if (browser) this.browserPool.releaseBrowser(browser);
      
      // Update result
      result.endTime = Date.now();
      result.duration = result.endTime - result.startTime;
      
      // Store result
      if (!this.metrics.journeyResults.has(config.name)) {
        this.metrics.journeyResults.set(config.name, []);
      }
      this.metrics.journeyResults.get(config.name)!.push(result);
    }

    return result;
  }

  /**
   * Wait for an available slot
   */
  private async waitForSlot(): Promise<void> {
    while (this.activeJourneys.size >= this.config.maxConcurrent!) {
      await this.delay(100);
    }
  }

  /**
   * Wait for all journeys to complete
   */
  private async waitForCompletion(): Promise<void> {
    console.log('⏳ Waiting for all journeys to complete...');
    
    while (this.activeJourneys.size > 0) {
      await this.delay(500);
      console.log(`   Active journeys: ${this.activeJourneys.size}`);
    }
  }

  /**
   * Start system monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const snapshot: SystemMetrics = {
        timestamp: Date.now(),
        activeJourneys: this.activeJourneys.size,
        completedJourneys: this.metrics.summary.successfulJourneys + this.metrics.summary.failedJourneys,
        failedJourneys: this.metrics.summary.failedJourneys,
        avgResponseTime: this.calculateAvgResponseTime(),
        errorRate: this.calculateErrorRate(),
        queueLength: this.journeyQueue.length
      };
      
      this.metrics.systemMetrics.push(snapshot);
      
      // Update peak concurrent
      if (snapshot.activeJourneys > this.metrics.summary.peakConcurrent) {
        this.metrics.summary.peakConcurrent = snapshot.activeJourneys;
      }
      
    }, this.config.monitoringInterval);
  }

  /**
   * Stop system monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  /**
   * Calculate total journeys
   */
  private calculateTotalJourneys(): number {
    return this.config.journeys.reduce((total, journey) => total + journey.instances, 0);
  }

  /**
   * Calculate average response time
   */
  private calculateAvgResponseTime(): number {
    let totalDuration = 0;
    let count = 0;
    
    this.metrics.journeyResults.forEach(results => {
      results.forEach(result => {
        if (result.duration) {
          totalDuration += result.duration;
          count++;
        }
      });
    });
    
    return count > 0 ? totalDuration / count : 0;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const total = this.metrics.summary.successfulJourneys + this.metrics.summary.failedJourneys;
    return total > 0 ? (this.metrics.summary.failedJourneys / total) * 100 : 0;
  }

  /**
   * Finalize metrics
   */
  private finalizeMetrics(): void {
    this.metrics.endTime = Date.now();
    this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;
    this.metrics.summary.avgResponseTime = this.calculateAvgResponseTime();
    this.metrics.summary.errorRate = this.calculateErrorRate();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate load test report
   */
  generateReport(): string {
    const summary = this.metrics.summary;
    const duration = (this.metrics.totalDuration || 0) / 1000;

    return `
# Concurrent Journey Execution Report

## Summary
- **Duration**: ${duration.toFixed(1)}s
- **Total Journeys**: ${summary.totalJourneys}
- **Successful**: ${summary.successfulJourneys} (${((summary.successfulJourneys / summary.totalJourneys) * 100).toFixed(1)}%)
- **Failed**: ${summary.failedJourneys} (${summary.errorRate.toFixed(1)}%)
- **Peak Concurrent**: ${summary.peakConcurrent}
- **Avg Response Time**: ${summary.avgResponseTime.toFixed(0)}ms

## Journey Breakdown
${Array.from(this.metrics.journeyResults.entries()).map(([name, results]) => {
  const successful = results.filter(r => r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  return `
### ${name}
- Instances: ${results.length}
- Success Rate: ${(successful / results.length * 100).toFixed(1)}%
- Avg Duration: ${avgDuration.toFixed(0)}ms`;
}).join('\n')}

## System Metrics
- **Peak Active Journeys**: ${summary.peakConcurrent}
- **Error Rate**: ${summary.errorRate.toFixed(2)}%
- **Throughput**: ${(summary.totalJourneys / duration).toFixed(1)} journeys/second

## Errors (Top 5)
${this.metrics.errors.slice(0, 5).map(e => 
  `- ${e.journey} (instance ${e.instance}): ${e.error.message}`
).join('\n') || 'No errors'}
`;
  }
}

/**
 * Create concurrent runner instance
 */
export function createConcurrentRunner(config: ConcurrentConfig): ConcurrentRunner {
  return new ConcurrentRunner(config);
}