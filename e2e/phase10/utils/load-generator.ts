import { APIRequestContext } from '@playwright/test';

export interface LoadPattern {
  type: 'constant' | 'ramp' | 'spike' | 'wave' | 'random';
  duration: number;
  startRPS?: number;
  endRPS?: number;
  peakRPS?: number;
  minRPS?: number;
  maxRPS?: number;
  wavePeriod?: number;
}

export interface LoadGeneratorOptions {
  endpoint: string;
  headers?: Record<string, string>;
  payloadGenerator?: (index: number) => any;
  patterns: LoadPattern[];
  warmupDuration?: number;
  cooldownDuration?: number;
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  duration: number;
  avgRPS: number;
  peakRPS: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  statusCodeDistribution: Map<number, number>;
  errorDistribution: Map<string, number>;
  timeSeriesData: Array<{
    timestamp: number;
    rps: number;
    avgResponseTime: number;
    successRate: number;
  }>;
}

export class LoadGenerator {
  private context: APIRequestContext;
  private baseURL: string;
  private requestCounter = 0;
  private responseTimes: number[] = [];
  private timeSeriesData: any[] = [];
  private statusCodes = new Map<number, number>();
  private errors = new Map<string, number>();

  constructor(context: APIRequestContext, baseURL: string) {
    this.context = context;
    this.baseURL = baseURL;
  }

  /**
   * Execute load test with specified patterns
   */
  async executeLoadTest(options: LoadGeneratorOptions): Promise<LoadTestResult> {
    console.log('[LoadGenerator] Starting load test');
    
    const startTime = Date.now();
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    // Reset counters
    this.requestCounter = 0;
    this.responseTimes = [];
    this.timeSeriesData = [];
    this.statusCodes.clear();
    this.errors.clear();

    // Warmup phase
    if (options.warmupDuration) {
      await this.executeWarmup(options);
    }

    // Execute each pattern sequentially
    for (const pattern of options.patterns) {
      const patternResult = await this.executePattern(pattern, options);
      totalRequests += patternResult.totalRequests;
      successfulRequests += patternResult.successfulRequests;
      failedRequests += patternResult.failedRequests;
    }

    // Cooldown phase
    if (options.cooldownDuration) {
      await this.executeCooldown(options);
    }

    const duration = Date.now() - startTime;

    // Calculate metrics
    const result: LoadTestResult = {
      totalRequests,
      successfulRequests,
      failedRequests,
      duration,
      avgRPS: (totalRequests / duration) * 1000,
      peakRPS: this.calculatePeakRPS(),
      avgResponseTime: this.calculateAverage(this.responseTimes),
      p50ResponseTime: this.calculatePercentile(this.responseTimes, 50),
      p90ResponseTime: this.calculatePercentile(this.responseTimes, 90),
      p95ResponseTime: this.calculatePercentile(this.responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(this.responseTimes, 99),
      statusCodeDistribution: new Map(this.statusCodes),
      errorDistribution: new Map(this.errors),
      timeSeriesData: this.timeSeriesData,
    };

    return result;
  }

  /**
   * Execute a specific load pattern
   */
  private async executePattern(
    pattern: LoadPattern,
    options: LoadGeneratorOptions
  ): Promise<{ totalRequests: number; successfulRequests: number; failedRequests: number }> {
    console.log(`[LoadGenerator] Executing ${pattern.type} pattern for ${pattern.duration}ms`);

    const startTime = Date.now();
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const intervalMs = 100; // Check every 100ms
    let lastSecond = Math.floor(Date.now() / 1000);
    let requestsInCurrentSecond = 0;
    let responseTimesInSecond: number[] = [];
    let successInSecond = 0;

    while (Date.now() - startTime < pattern.duration) {
      const elapsed = Date.now() - startTime;
      const targetRPS = this.calculateTargetRPS(pattern, elapsed);
      
      // Calculate requests to send in this interval
      let requestsToSend = Math.ceil((targetRPS * intervalMs) / 1000);
      
      // Adaptive rate limiting based on recent errors
      const recentErrorRate = failedRequests / Math.max(totalRequests, 1);
      if (recentErrorRate > 0.1) { // If more than 10% errors
        requestsToSend = Math.max(1, Math.floor(requestsToSend * 0.7)); // Reduce by 30%
      }

      // Send requests with small delays to prevent overwhelming
      const promises = [];
      for (let i = 0; i < requestsToSend; i++) {
        promises.push(this.sendRequest(options));
        totalRequests++;
        requestsInCurrentSecond++;
        
        // Add micro-delay between requests within the same interval
        if (i < requestsToSend - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs / requestsToSend));
        }
      }

      // Process results
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { success, responseTime, status, error } = result.value;
          
          if (success) {
            successfulRequests++;
            successInSecond++;
          } else {
            failedRequests++;
          }

          if (responseTime) {
            this.responseTimes.push(responseTime);
            responseTimesInSecond.push(responseTime);
          }

          if (status) {
            const count = this.statusCodes.get(status) || 0;
            this.statusCodes.set(status, count + 1);
          }

          if (error) {
            const count = this.errors.get(error) || 0;
            this.errors.set(error, count + 1);
          }
        } else {
          failedRequests++;
        }
      }

      // Check if we've moved to a new second
      const currentSecond = Math.floor(Date.now() / 1000);
      if (currentSecond > lastSecond) {
        // Record time series data for the completed second
        this.timeSeriesData.push({
          timestamp: lastSecond * 1000,
          rps: requestsInCurrentSecond,
          avgResponseTime: this.calculateAverage(responseTimesInSecond),
          successRate: requestsInCurrentSecond > 0 ? successInSecond / requestsInCurrentSecond : 0,
        });

        // Reset counters
        requestsInCurrentSecond = 0;
        responseTimesInSecond = [];
        successInSecond = 0;
        lastSecond = currentSecond;
      }

      // Wait for next interval
      const nextInterval = startTime + Math.ceil((Date.now() - startTime) / intervalMs) * intervalMs;
      const waitTime = nextInterval - Date.now();
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }

    return { totalRequests, successfulRequests, failedRequests };
  }

  /**
   * Calculate target RPS based on pattern
   */
  private calculateTargetRPS(pattern: LoadPattern, elapsed: number): number {
    const progress = elapsed / pattern.duration;

    switch (pattern.type) {
      case 'constant':
        return pattern.startRPS || 10;

      case 'ramp':
        const start = pattern.startRPS || 0;
        const end = pattern.endRPS || 100;
        return start + (end - start) * progress;

      case 'spike':
        const base = pattern.startRPS || 10;
        const peak = pattern.peakRPS || 100;
        // Spike at 50% of duration
        if (progress > 0.4 && progress < 0.6) {
          return peak;
        }
        return base;

      case 'wave':
        const min = pattern.minRPS || 10;
        const max = pattern.maxRPS || 100;
        const period = pattern.wavePeriod || 10000; // 10s default
        const waveProgress = (elapsed % period) / period;
        return min + (max - min) * (Math.sin(waveProgress * Math.PI * 2) + 1) / 2;

      case 'random':
        const minRand = pattern.minRPS || 10;
        const maxRand = pattern.maxRPS || 100;
        return minRand + Math.random() * (maxRand - minRand);

      default:
        return 10;
    }
  }

  /**
   * Send a single request
   */
  private async sendRequest(options: LoadGeneratorOptions): Promise<{
    success: boolean;
    responseTime: number;
    status?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const index = this.requestCounter++;

    try {
      const payload = options.payloadGenerator
        ? options.payloadGenerator(index)
        : { text: `Load test request ${index}`, testId: `load-${index}` };

      const response = await this.context.post(`${this.baseURL}${options.endpoint}`, {
        headers: options.headers,
        data: payload,
      });

      const responseTime = Date.now() - startTime;
      const status = response.status();
      const success = status >= 200 && status < 300;

      return { success, responseTime, status };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Execute warmup phase
   */
  private async executeWarmup(options: LoadGeneratorOptions): Promise<void> {
    console.log(`[LoadGenerator] Warming up for ${options.warmupDuration}ms`);
    
    await this.executePattern(
      {
        type: 'ramp',
        duration: options.warmupDuration!,
        startRPS: 1,
        endRPS: 10,
      },
      options
    );
  }

  /**
   * Execute cooldown phase
   */
  private async executeCooldown(options: LoadGeneratorOptions): Promise<void> {
    console.log(`[LoadGenerator] Cooling down for ${options.cooldownDuration}ms`);
    
    await this.executePattern(
      {
        type: 'ramp',
        duration: options.cooldownDuration!,
        startRPS: 10,
        endRPS: 1,
      },
      options
    );
  }

  /**
   * Calculate peak RPS from time series data
   */
  private calculatePeakRPS(): number {
    if (this.timeSeriesData.length === 0) return 0;
    return Math.max(...this.timeSeriesData.map(d => d.rps));
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
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
  generateReport(result: LoadTestResult): string {
    const report = `
# Load Test Report

## Summary
- Total Requests: ${result.totalRequests}
- Successful: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%)
- Failed: ${result.failedRequests} (${((result.failedRequests / result.totalRequests) * 100).toFixed(2)}%)
- Duration: ${(result.duration / 1000).toFixed(2)}s
- Average RPS: ${result.avgRPS.toFixed(2)}
- Peak RPS: ${result.peakRPS}

## Response Times
- Average: ${result.avgResponseTime.toFixed(2)}ms
- P50: ${result.p50ResponseTime}ms
- P90: ${result.p90ResponseTime}ms
- P95: ${result.p95ResponseTime}ms
- P99: ${result.p99ResponseTime}ms

## Status Code Distribution
${Array.from(result.statusCodeDistribution.entries())
  .map(([code, count]) => `- ${code}: ${count} (${((count / result.totalRequests) * 100).toFixed(2)}%)`)
  .join('\n')}

## Error Distribution
${Array.from(result.errorDistribution.entries())
  .map(([error, count]) => `- ${error}: ${count}`)
  .join('\n') || '- No errors'}
`;

    return report;
  }
}