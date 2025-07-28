import { BetterPromptsAPIClient, EnhanceRequest, RateLimitHeaders } from './api-client';

export interface RateLimitTestResult {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  errors: number;
  timeTaken: number;
  requestsPerSecond: number;
  rateLimitHeaders: RateLimitHeaders[];
  retryAfterHeaders: string[];
  resetTime?: Date;
}

export interface RateLimitTestOptions {
  requestsPerBatch: number;
  batchDelay?: number;
  stopOnRateLimit?: boolean;
  respectRetryAfter?: boolean;
  maxDuration?: number;
}

export class RateLimiterTester {
  private client: BetterPromptsAPIClient;
  private results: RateLimitTestResult;

  constructor(client: BetterPromptsAPIClient) {
    this.client = client;
    this.results = this.initializeResults();
  }

  private initializeResults(): RateLimitTestResult {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      errors: 0,
      timeTaken: 0,
      requestsPerSecond: 0,
      rateLimitHeaders: [],
      retryAfterHeaders: [],
    };
  }

  /**
   * Test rate limiting with precise timing control
   */
  async testRateLimit(
    request: EnhanceRequest,
    targetRequests: number,
    options: RateLimitTestOptions = { requestsPerBatch: 10 }
  ): Promise<RateLimitTestResult> {
    this.results = this.initializeResults();
    const startTime = Date.now();
    const maxDuration = options.maxDuration || 120000; // 2 minutes default

    console.log(`[RateLimiter] Starting test with ${targetRequests} requests`);

    let completedRequests = 0;
    let hitRateLimit = false;

    while (completedRequests < targetRequests && !hitRateLimit) {
      // Check if we've exceeded max duration
      if (Date.now() - startTime > maxDuration) {
        console.log('[RateLimiter] Max duration exceeded, stopping test');
        break;
      }

      // Send batch of requests
      const batchSize = Math.min(
        options.requestsPerBatch,
        targetRequests - completedRequests
      );

      const batchResults = await this.sendBatch(request, batchSize);

      // Update results
      this.results.totalRequests += batchResults.length;
      completedRequests += batchResults.length;

      // Process batch results
      for (const result of batchResults) {
        if (result.status === 'success') {
          this.results.successfulRequests++;
          if (result.rateLimitHeaders) {
            this.results.rateLimitHeaders.push(result.rateLimitHeaders);
          }
        } else if (result.status === 'rate_limited') {
          this.results.rateLimitedRequests++;
          hitRateLimit = true;

          if (result.retryAfter) {
            this.results.retryAfterHeaders.push(result.retryAfter);
          }

          if (result.resetTime) {
            this.results.resetTime = result.resetTime;
          }

          if (options.stopOnRateLimit) {
            console.log('[RateLimiter] Rate limit hit, stopping test');
            break;
          }

          if (options.respectRetryAfter && result.retryAfter) {
            const waitTime = this.parseRetryAfter(result.retryAfter);
            console.log(`[RateLimiter] Waiting ${waitTime}ms before continuing`);
            await this.delay(waitTime);
            hitRateLimit = false;
          }
        } else {
          this.results.errors++;
        }
      }

      // Delay between batches if specified
      if (options.batchDelay && completedRequests < targetRequests) {
        await this.delay(options.batchDelay);
      }
    }

    // Calculate final metrics
    this.results.timeTaken = Date.now() - startTime;
    this.results.requestsPerSecond = 
      (this.results.totalRequests / this.results.timeTaken) * 1000;

    console.log('[RateLimiter] Test completed', this.results);
    return this.results;
  }

  /**
   * Send a batch of requests concurrently
   */
  private async sendBatch(
    request: EnhanceRequest,
    batchSize: number
  ): Promise<BatchResult[]> {
    const promises = Array(batchSize).fill(null).map(() => this.sendRequest(request));
    return Promise.all(promises);
  }

  /**
   * Send a single request and capture rate limit information
   */
  private async sendRequest(request: EnhanceRequest): Promise<BatchResult> {
    try {
      const response = await this.client['client'].post('/enhance', request);
      
      const rateLimitHeaders = this.client.getRateLimitHeaders(response);
      
      return {
        status: 'success',
        rateLimitHeaders: rateLimitHeaders || undefined,
      };
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const rateLimitReset = error.response.headers['x-ratelimit-reset'];
        
        return {
          status: 'rate_limited',
          retryAfter,
          resetTime: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : undefined,
        };
      }
      
      console.error('[RateLimiter] Request error:', error.message);
      return { status: 'error' };
    }
  }

  /**
   * Test rate limit boundary with precise timing
   */
  async testRateLimitBoundary(
    request: EnhanceRequest,
    expectedLimit: number,
    window: number = 60000 // 1 minute default
  ): Promise<{
    actualLimit: number;
    lastSuccessfulRequest: number;
    firstRateLimitedRequest: number;
    accuracy: number;
  }> {
    console.log(`[RateLimiter] Testing boundary for ${expectedLimit} requests in ${window}ms`);

    // Send requests one by one until we hit rate limit
    let successCount = 0;
    let hitRateLimit = false;
    const startTime = Date.now();

    while (!hitRateLimit && Date.now() - startTime < window) {
      const result = await this.sendRequest(request);
      
      if (result.status === 'success') {
        successCount++;
      } else if (result.status === 'rate_limited') {
        hitRateLimit = true;
      } else {
        throw new Error('Unexpected error during boundary test');
      }
    }

    const accuracy = (successCount / expectedLimit) * 100;

    return {
      actualLimit: successCount,
      lastSuccessfulRequest: successCount,
      firstRateLimitedRequest: successCount + 1,
      accuracy,
    };
  }

  /**
   * Test rate limit reset behavior
   */
  async testRateLimitReset(
    request: EnhanceRequest,
    limit: number
  ): Promise<{
    initialBurst: number;
    resetWaitTime: number;
    afterResetBurst: number;
    resetWorked: boolean;
  }> {
    console.log('[RateLimiter] Testing rate limit reset behavior');

    // First, exhaust the rate limit
    const initialResult = await this.testRateLimit(request, limit + 10, {
      requestsPerBatch: limit + 10,
      stopOnRateLimit: true,
    });

    const initialBurst = initialResult.successfulRequests;

    if (!this.results.resetTime) {
      throw new Error('No reset time provided by server');
    }

    // Wait for reset
    const resetWaitTime = Math.max(0, this.results.resetTime.getTime() - Date.now() + 1000);
    console.log(`[RateLimiter] Waiting ${resetWaitTime}ms for reset`);
    await this.delay(resetWaitTime);

    // Test after reset
    const afterResetResult = await this.testRateLimit(request, 10, {
      requestsPerBatch: 10,
    });

    return {
      initialBurst,
      resetWaitTime,
      afterResetBurst: afterResetResult.successfulRequests,
      resetWorked: afterResetResult.successfulRequests > 0,
    };
  }

  /**
   * Test burst behavior
   */
  async testBurstBehavior(
    request: EnhanceRequest,
    burstSize: number,
    delayBetweenBursts: number = 1000
  ): Promise<{
    bursts: BurstResult[];
    totalSuccessful: number;
    averageSuccessPerBurst: number;
  }> {
    console.log(`[RateLimiter] Testing burst behavior with ${burstSize} requests per burst`);

    const bursts: BurstResult[] = [];
    const testDuration = 60000; // 1 minute
    const startTime = Date.now();

    while (Date.now() - startTime < testDuration) {
      const burstStart = Date.now();
      const result = await this.testRateLimit(request, burstSize, {
        requestsPerBatch: burstSize,
        stopOnRateLimit: true,
      });

      bursts.push({
        timestamp: new Date(burstStart),
        successful: result.successfulRequests,
        rateLimited: result.rateLimitedRequests,
        duration: result.timeTaken,
      });

      if (result.rateLimitedRequests > 0) {
        // Wait longer if we hit rate limit
        await this.delay(delayBetweenBursts * 2);
      } else {
        await this.delay(delayBetweenBursts);
      }
    }

    const totalSuccessful = bursts.reduce((sum, burst) => sum + burst.successful, 0);
    const averageSuccessPerBurst = totalSuccessful / bursts.length;

    return {
      bursts,
      totalSuccessful,
      averageSuccessPerBurst,
    };
  }

  /**
   * Parse Retry-After header (can be seconds or HTTP date)
   */
  private parseRetryAfter(retryAfter: string): number {
    const seconds = parseInt(retryAfter);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    // Default to 60 seconds
    return 60000;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get test results
   */
  getResults(): RateLimitTestResult {
    return this.results;
  }
}

interface BatchResult {
  status: 'success' | 'rate_limited' | 'error';
  rateLimitHeaders?: RateLimitHeaders;
  retryAfter?: string;
  resetTime?: Date;
}

interface BurstResult {
  timestamp: Date;
  successful: number;
  rateLimited: number;
  duration: number;
}