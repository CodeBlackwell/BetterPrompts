import { APIRequestContext } from '@playwright/test';

export interface ConcurrentTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  concurrentLevel: number;
  duration: number;
  throughput: number;
  errors: Array<{ message: string; count: number }>;
  statusCodes: Map<number, number>;
  raceConditionsDetected: boolean;
}

export interface ConcurrentRequestOptions {
  endpoint: string;
  headers?: Record<string, string>;
  data?: any;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export class ConcurrentRequestHelper {
  private context: APIRequestContext;
  private baseURL: string;

  constructor(context: APIRequestContext, baseURL: string) {
    this.context = context;
    this.baseURL = baseURL;
  }

  /**
   * Send concurrent burst requests
   */
  async sendBurstRequests(
    count: number,
    options: ConcurrentRequestOptions
  ): Promise<ConcurrentTestResult> {
    const startTime = Date.now();
    const responseTimes: number[] = [];
    const statusCodes = new Map<number, number>();
    const errors = new Map<string, number>();
    let raceConditionsDetected = false;

    console.log(`[ConcurrentHelper] Sending ${count} concurrent requests`);

    // For large bursts, batch them to avoid overwhelming the server
    const batchSize = Math.min(count, 50); // Max 50 concurrent requests
    const batches = Math.ceil(count / batchSize);
    const allResults: any[] = [];

    for (let batch = 0; batch < batches; batch++) {
      const start = batch * batchSize;
      const end = Math.min(start + batchSize, count);
      const batchPromises = [];

      for (let i = start; i < end; i++) {
        batchPromises.push(this.sendSingleRequest(i, options));
      }

      // Execute batch concurrently
      const batchResults = await Promise.allSettled(batchPromises);
      allResults.push(...batchResults);

      // Add small delay between batches to prevent overload
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Process results
    const results = allResults;

    // Process results
    let successfulRequests = 0;
    let failedRequests = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { status, responseTime, error, raceCondition } = result.value;
        
        if (raceCondition) {
          raceConditionsDetected = true;
        }

        if (error) {
          failedRequests++;
          const errorCount = errors.get(error) || 0;
          errors.set(error, errorCount + 1);
        } else {
          if (status >= 200 && status < 300) {
            successfulRequests++;
          } else {
            failedRequests++;
          }
          
          responseTimes.push(responseTime);
          const statusCount = statusCodes.get(status) || 0;
          statusCodes.set(status, statusCount + 1);
        }
      } else {
        failedRequests++;
        const error = result.reason?.message || 'Unknown error';
        const errorCount = errors.get(error) || 0;
        errors.set(error, errorCount + 1);
      }
    }

    const duration = Date.now() - startTime;

    return {
      totalRequests: count,
      successfulRequests,
      failedRequests,
      avgResponseTime: this.calculateAverage(responseTimes),
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      concurrentLevel: count,
      duration,
      throughput: (successfulRequests / duration) * 1000,
      errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
      statusCodes,
      raceConditionsDetected,
    };
  }

  /**
   * Send sustained load
   */
  async sendSustainedLoad(
    requestsPerSecond: number,
    durationSeconds: number,
    options: ConcurrentRequestOptions
  ): Promise<ConcurrentTestResult> {
    const startTime = Date.now();
    const intervalMs = 1000 / requestsPerSecond;
    const totalRequests = requestsPerSecond * durationSeconds;
    
    console.log(`[ConcurrentHelper] Sending ${requestsPerSecond} RPS for ${durationSeconds}s`);

    const results: ConcurrentTestResult = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      concurrentLevel: requestsPerSecond,
      duration: 0,
      throughput: 0,
      errors: [],
      statusCodes: new Map(),
      raceConditionsDetected: false,
    };

    const responseTimes: number[] = [];
    const errors = new Map<string, number>();

    // Send requests at specified rate
    for (let i = 0; i < totalRequests; i++) {
      const requestStart = Date.now();
      
      // Send request without waiting
      this.sendSingleRequest(i, options).then(result => {
        results.totalRequests++;
        
        if (result.error) {
          results.failedRequests++;
          const errorCount = errors.get(result.error) || 0;
          errors.set(result.error, errorCount + 1);
        } else {
          if (result.status >= 200 && result.status < 300) {
            results.successfulRequests++;
          } else {
            results.failedRequests++;
          }
          
          responseTimes.push(result.responseTime);
          results.minResponseTime = Math.min(results.minResponseTime, result.responseTime);
          results.maxResponseTime = Math.max(results.maxResponseTime, result.responseTime);
          
          const statusCount = results.statusCodes.get(result.status) || 0;
          results.statusCodes.set(result.status, statusCount + 1);
        }
        
        if (result.raceCondition) {
          results.raceConditionsDetected = true;
        }
      });

      // Wait for next interval
      const elapsed = Date.now() - requestStart;
      const waitTime = Math.max(0, intervalMs - elapsed);
      
      if (i < totalRequests - 1) {
        await this.delay(waitTime);
      }

      // Check if duration exceeded
      if (Date.now() - startTime > durationSeconds * 1000) {
        break;
      }
    }

    // Wait for all pending requests to complete
    await this.delay(5000);

    results.duration = Date.now() - startTime;
    results.avgResponseTime = this.calculateAverage(responseTimes);
    results.throughput = (results.successfulRequests / results.duration) * 1000;
    results.errors = Array.from(errors.entries()).map(([message, count]) => ({ message, count }));

    return results;
  }

  /**
   * Test queue fairness
   */
  async testQueueFairness(
    users: Array<{ id: string; apiKey?: string }>,
    requestsPerUser: number,
    options: ConcurrentRequestOptions
  ): Promise<{
    fairnessScore: number;
    userResults: Map<string, number>;
    orderPreserved: boolean;
    maxDeviation: number;
  }> {
    console.log(`[ConcurrentHelper] Testing queue fairness for ${users.length} users`);

    const userResults = new Map<string, number>();
    const requestOrder: string[] = [];
    const responseOrder: string[] = [];

    // Create requests for each user
    const promises: Promise<void>[] = [];
    
    for (const user of users) {
      for (let i = 0; i < requestsPerUser; i++) {
        const requestId = `${user.id}-${i}`;
        requestOrder.push(requestId);
        
        const promise = this.sendSingleRequest(i, {
          ...options,
          headers: {
            ...options.headers,
            ...(user.apiKey ? { 'X-API-Key': user.apiKey } : {}),
            'X-Request-ID': requestId,
          },
        }).then(result => {
          if (!result.error && result.status >= 200 && result.status < 300) {
            const count = userResults.get(user.id) || 0;
            userResults.set(user.id, count + 1);
            responseOrder.push(requestId);
          }
        });
        
        promises.push(promise);
      }
    }

    await Promise.all(promises);

    // Calculate fairness metrics
    const totalSuccessful = Array.from(userResults.values()).reduce((a, b) => a + b, 0);
    const expectedPerUser = totalSuccessful / users.length;
    
    let maxDeviation = 0;
    let totalDeviation = 0;
    
    for (const [userId, count] of userResults) {
      const deviation = Math.abs(count - expectedPerUser);
      totalDeviation += deviation;
      maxDeviation = Math.max(maxDeviation, deviation);
    }

    const fairnessScore = 1 - (totalDeviation / totalSuccessful);
    
    // Check if order is generally preserved (allowing some reordering)
    let orderMatches = 0;
    for (let i = 0; i < Math.min(requestOrder.length, responseOrder.length); i++) {
      if (requestOrder[i] === responseOrder[i]) {
        orderMatches++;
      }
    }
    const orderPreserved = orderMatches / requestOrder.length > 0.7;

    return {
      fairnessScore,
      userResults,
      orderPreserved,
      maxDeviation,
    };
  }

  /**
   * Test alternating burst patterns
   */
  async testAlternatingBursts(
    burstSize: number,
    quietPeriodMs: number,
    cycles: number,
    options: ConcurrentRequestOptions
  ): Promise<{
    bursts: Array<{
      cycle: number;
      successful: number;
      failed: number;
      avgResponseTime: number;
    }>;
    overallSuccess: number;
    avgBurstSuccess: number;
  }> {
    console.log(`[ConcurrentHelper] Testing ${cycles} alternating bursts of ${burstSize} requests`);

    const bursts: Array<any> = [];
    let overallSuccess = 0;

    for (let cycle = 0; cycle < cycles; cycle++) {
      // Send burst
      const burstResult = await this.sendBurstRequests(burstSize, options);
      
      bursts.push({
        cycle,
        successful: burstResult.successfulRequests,
        failed: burstResult.failedRequests,
        avgResponseTime: burstResult.avgResponseTime,
      });

      overallSuccess += burstResult.successfulRequests;

      // Quiet period
      if (cycle < cycles - 1) {
        await this.delay(quietPeriodMs);
      }
    }

    const avgBurstSuccess = overallSuccess / cycles;

    return {
      bursts,
      overallSuccess,
      avgBurstSuccess,
    };
  }

  /**
   * Send single request and measure response time
   */
  private async sendSingleRequest(
    index: number,
    options: ConcurrentRequestOptions
  ): Promise<{
    status: number;
    responseTime: number;
    error?: string;
    raceCondition?: boolean;
  }> {
    const startTime = Date.now();
    
    try {
      const method = options.method || 'POST';
      const url = `${this.baseURL}${options.endpoint}`;
      
      const response = await this.context[method.toLowerCase()](url, {
        headers: options.headers,
        data: options.data,
      });

      const responseTime = Date.now() - startTime;
      
      // Check for race condition indicators
      let raceCondition = false;
      if (response.ok()) {
        try {
          const body = await response.json();
          // Look for signs of race conditions (e.g., duplicate IDs, inconsistent counters)
          if (body.id && body.counter !== undefined) {
            // This is a simple check - customize based on your API
            raceCondition = false; // Would need more context to detect
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      return {
        status: response.status(),
        responseTime,
        raceCondition,
      };
    } catch (error: any) {
      return {
        status: 0,
        responseTime: Date.now() - startTime,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Calculate average from array of numbers
   */
  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}