import { APIRequestContext, APIResponse } from '@playwright/test';

export interface RateLimitHeaders {
  limit: number;
  remaining: number;
  reset: number;
  resetAfter?: number;
  bucket?: string;
}

export interface RateLimitTestResult {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  errors: number;
  timeTaken: number;
  requestsPerSecond: number;
  headers: RateLimitHeaders[];
  retryAfterValues: number[];
  resetTimestamp?: number;
  testType: string;
}

export interface RateLimitTestOptions {
  concurrency?: number;
  stopOnRateLimit?: boolean;
  respectRetryAfter?: boolean;
  maxDuration?: number;
  apiKey?: string;
  ipAddress?: string;
  userId?: string;
}

export class RateLimitTester {
  private baseURL: string;
  private context: APIRequestContext;

  constructor(context: APIRequestContext, baseURL: string) {
    this.context = context;
    this.baseURL = baseURL;
  }

  /**
   * Test per-user rate limits
   */
  async testPerUserRateLimit(
    apiKey: string,
    targetRequests: number,
    options: RateLimitTestOptions = {}
  ): Promise<RateLimitTestResult> {
    const startTime = Date.now();
    const result: RateLimitTestResult = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      errors: 0,
      timeTaken: 0,
      requestsPerSecond: 0,
      headers: [],
      retryAfterValues: [],
      testType: 'per-user',
    };

    console.log(`[RateLimitTester] Testing per-user limits with ${targetRequests} requests`);
    
    let consecutiveErrors = 0;
    let currentDelay = 20; // Start with 20ms delay

    for (let i = 0; i < targetRequests; i++) {
      try {
        const response = await this.context.post(`${this.baseURL}/enhance`, {
          headers: { 'X-API-Key': apiKey },
          data: {
            text: `Test prompt ${i} for rate limiting`,
            metadata: { testId: `per-user-${i}` },
          },
        });
        
        // Add adaptive delay between requests
        if (i < targetRequests - 1) {
          await this.delay(currentDelay);
        }

        result.totalRequests++;

        if (response.status() === 429) {
          result.rateLimitedRequests++;
          const retryAfter = response.headers()['retry-after'];
          if (retryAfter) {
            result.retryAfterValues.push(parseInt(retryAfter));
          }
          
          if (options.stopOnRateLimit) {
            break;
          }
          
          if (options.respectRetryAfter && retryAfter) {
            await this.delay(parseInt(retryAfter) * 1000);
          }
        } else if (response.ok()) {
          result.successfulRequests++;
          consecutiveErrors = 0; // Reset error counter on success
          currentDelay = Math.max(20, currentDelay * 0.9); // Gradually reduce delay
          
          const headers = this.extractRateLimitHeaders(response);
          if (headers) {
            result.headers.push(headers);
            if (headers.reset) {
              result.resetTimestamp = headers.reset;
            }
          }
        } else {
          result.errors++;
          consecutiveErrors++;
          
          // Exponential backoff on errors
          if (response.status() === 503 && consecutiveErrors > 2) {
            currentDelay = Math.min(500, currentDelay * 2);
            console.log(`[RateLimitTester] Increasing delay to ${currentDelay}ms due to 503 errors`);
          }
          
          console.error(`[RateLimitTester] Non-2xx response: ${response.status()} ${response.statusText()}`);
          try {
            const body = await response.text();
            console.error(`[RateLimitTester] Response body:`, body.substring(0, 200));
          } catch (e) {
            // Ignore body read errors
          }
        }
      } catch (error) {
        result.errors++;
        consecutiveErrors++;
        console.error(`[RateLimitTester] Request error:`, error);
      }

      // Check max duration
      if (options.maxDuration && Date.now() - startTime > options.maxDuration) {
        console.log('[RateLimitTester] Max duration exceeded');
        break;
      }
    }

    result.timeTaken = Date.now() - startTime;
    result.requestsPerSecond = (result.totalRequests / result.timeTaken) * 1000;

    return result;
  }

  /**
   * Test per-IP rate limits
   */
  async testPerIPRateLimit(
    targetRequests: number,
    options: RateLimitTestOptions = {}
  ): Promise<RateLimitTestResult> {
    const startTime = Date.now();
    const result: RateLimitTestResult = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      errors: 0,
      timeTaken: 0,
      requestsPerSecond: 0,
      headers: [],
      retryAfterValues: [],
      testType: 'per-ip',
    };

    console.log(`[RateLimitTester] Testing per-IP limits with ${targetRequests} requests`);

    // Set custom headers to simulate different IPs if needed
    const headers: Record<string, string> = {};
    if (options.ipAddress) {
      headers['X-Forwarded-For'] = options.ipAddress;
    }
    
    let consecutiveErrors = 0;
    let currentDelay = 20; // Start with 20ms delay

    for (let i = 0; i < targetRequests; i++) {
      try {
        const response = await this.context.post(`${this.baseURL}/enhance`, {
          headers,
          data: {
            text: `Test prompt ${i} for IP rate limiting`,
            metadata: { testId: `per-ip-${i}` },
          },
        });
        
        // Add adaptive delay between requests
        if (i < targetRequests - 1) {
          await this.delay(currentDelay);
        }

        result.totalRequests++;

        if (response.status() === 429) {
          result.rateLimitedRequests++;
          const retryAfter = response.headers()['retry-after'];
          if (retryAfter) {
            result.retryAfterValues.push(parseInt(retryAfter));
          }
          
          if (options.stopOnRateLimit) {
            break;
          }
        } else if (response.ok()) {
          result.successfulRequests++;
          consecutiveErrors = 0;
          currentDelay = Math.max(20, currentDelay * 0.9);
          
          const headers = this.extractRateLimitHeaders(response);
          if (headers) {
            result.headers.push(headers);
          }
        } else {
          result.errors++;
          consecutiveErrors++;
          
          if (response.status() === 503 && consecutiveErrors > 2) {
            currentDelay = Math.min(500, currentDelay * 2);
            console.log(`[RateLimitTester] Increasing delay to ${currentDelay}ms due to 503 errors`);
          }
          
          console.error(`[RateLimitTester] Per-IP Non-2xx response: ${response.status()} ${response.statusText()}`);
          try {
            const body = await response.text();
            console.error(`[RateLimitTester] Response body:`, body.substring(0, 200));
          } catch (e) {
            // Ignore body read errors
          }
        }
      } catch (error) {
        result.errors++;
        consecutiveErrors++;
        console.error(`[RateLimitTester] Request error:`, error);
      }
    }

    result.timeTaken = Date.now() - startTime;
    result.requestsPerSecond = (result.totalRequests / result.timeTaken) * 1000;

    return result;
  }

  /**
   * Test rate limit accuracy
   */
  async testRateLimitAccuracy(
    apiKey: string,
    expectedLimit: number,
    window: number = 60000
  ): Promise<{
    actualLimit: number;
    accuracy: number;
    withinMargin: boolean;
    margin: number;
  }> {
    console.log(`[RateLimitTester] Testing accuracy for ${expectedLimit} requests in ${window}ms`);

    const result = await this.testPerUserRateLimit(apiKey, expectedLimit + 10, {
      stopOnRateLimit: true,
      maxDuration: window,
    });

    const actualLimit = result.successfulRequests;
    const accuracy = (actualLimit / expectedLimit) * 100;
    const margin = Math.abs(actualLimit - expectedLimit) / expectedLimit;
    const withinMargin = margin <= 0.01; // 1% margin

    return {
      actualLimit,
      accuracy,
      withinMargin,
      margin,
    };
  }

  /**
   * Test rate limit reset behavior
   */
  async testRateLimitReset(
    apiKey: string,
    limit: number
  ): Promise<{
    beforeReset: number;
    afterReset: number;
    resetWorked: boolean;
    resetTime: number;
  }> {
    // Exhaust rate limit
    const beforeResult = await this.testPerUserRateLimit(apiKey, limit + 10, {
      stopOnRateLimit: true,
    });

    const resetTimestamp = beforeResult.resetTimestamp;
    if (!resetTimestamp) {
      throw new Error('No reset timestamp found');
    }

    // Wait for reset
    const now = Date.now() / 1000;
    const waitTime = Math.max(0, (resetTimestamp - now + 1) * 1000);
    console.log(`[RateLimitTester] Waiting ${waitTime}ms for reset`);
    await this.delay(waitTime);

    // Test after reset
    const afterResult = await this.testPerUserRateLimit(apiKey, 10, {
      maxDuration: 5000,
    });

    return {
      beforeReset: beforeResult.successfulRequests,
      afterReset: afterResult.successfulRequests,
      resetWorked: afterResult.successfulRequests > 0,
      resetTime: waitTime,
    };
  }

  /**
   * Test multiple API keys for same user
   */
  async testMultipleAPIKeys(
    apiKeys: string[],
    requestsPerKey: number
  ): Promise<{
    results: Map<string, RateLimitTestResult>;
    sharedLimit: boolean;
    totalSuccessful: number;
  }> {
    const results = new Map<string, RateLimitTestResult>();
    let totalSuccessful = 0;

    for (const apiKey of apiKeys) {
      const result = await this.testPerUserRateLimit(apiKey, requestsPerKey, {
        stopOnRateLimit: true,
      });
      results.set(apiKey, result);
      totalSuccessful += result.successfulRequests;
    }

    // Check if limits are shared across API keys
    const firstResult = results.values().next().value;
    const sharedLimit = totalSuccessful <= firstResult.successfulRequests * 1.1;

    return {
      results,
      sharedLimit,
      totalSuccessful,
    };
  }

  /**
   * Extract rate limit headers from response
   */
  private extractRateLimitHeaders(response: APIResponse): RateLimitHeaders | null {
    const headers = response.headers();
    
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];
    const resetAfter = headers['x-ratelimit-reset-after'];
    const bucket = headers['x-ratelimit-bucket'];

    if (!limit || !remaining || !reset) {
      return null;
    }

    return {
      limit: parseInt(limit),
      remaining: parseInt(remaining),
      reset: parseInt(reset),
      resetAfter: resetAfter ? parseInt(resetAfter) : undefined,
      bucket: bucket || undefined,
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}