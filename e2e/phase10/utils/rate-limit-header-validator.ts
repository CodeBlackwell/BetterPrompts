import { APIResponse } from '@playwright/test';

export interface HeaderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  headers: {
    limit?: string;
    remaining?: string;
    reset?: string;
    resetAfter?: string;
    bucket?: string;
    retryAfter?: string;
  };
  parsedValues: {
    limit?: number;
    remaining?: number;
    reset?: Date;
    resetAfter?: number;
    bucket?: string;
    retryAfter?: number;
  };
}

export interface HeaderValidationOptions {
  requireOptional?: boolean;
  checkConsistency?: boolean;
  expectedLimit?: number;
  expectedBucket?: string;
}

export class RateLimitHeaderValidator {
  private requiredHeaders = [
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
  ];

  private optionalHeaders = [
    'x-ratelimit-reset-after',
    'x-ratelimit-bucket',
  ];

  private errorHeaders = ['retry-after'];

  /**
   * Validate rate limit headers on successful response
   */
  validateSuccessHeaders(
    response: APIResponse,
    options: HeaderValidationOptions = {}
  ): HeaderValidationResult {
    const result: HeaderValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      headers: {},
      parsedValues: {},
    };

    if (response.status() >= 300) {
      result.valid = false;
      result.errors.push(`Expected success response, got ${response.status()}`);
      return result;
    }

    const headers = response.headers();

    // Check required headers
    for (const header of this.requiredHeaders) {
      const value = headers[header];
      if (!value) {
        result.valid = false;
        result.errors.push(`Missing required header: ${header}`);
      } else {
        const key = header.replace('x-ratelimit-', '') as keyof HeaderValidationResult['headers'];
        result.headers[key] = value;
      }
    }

    // Check optional headers
    for (const header of this.optionalHeaders) {
      const value = headers[header];
      if (value) {
        const key = header.replace('x-ratelimit-', '') as keyof HeaderValidationResult['headers'];
        result.headers[key] = value;
      } else if (options.requireOptional) {
        result.warnings.push(`Missing optional header: ${header}`);
      }
    }

    // Parse and validate values
    this.parseHeaders(result);

    // Additional validations
    if (options.checkConsistency) {
      this.checkConsistency(result);
    }

    if (options.expectedLimit !== undefined && result.parsedValues.limit !== options.expectedLimit) {
      result.errors.push(`Expected limit ${options.expectedLimit}, got ${result.parsedValues.limit}`);
      result.valid = false;
    }

    if (options.expectedBucket && result.parsedValues.bucket !== options.expectedBucket) {
      result.errors.push(`Expected bucket ${options.expectedBucket}, got ${result.parsedValues.bucket}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Validate rate limit headers on 429 response
   */
  validate429Headers(
    response: APIResponse,
    options: HeaderValidationOptions = {}
  ): HeaderValidationResult {
    const result: HeaderValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      headers: {},
      parsedValues: {},
    };

    if (response.status() !== 429) {
      result.valid = false;
      result.errors.push(`Expected 429 response, got ${response.status()}`);
      return result;
    }

    const headers = response.headers();

    // Check for Retry-After header
    const retryAfter = headers['retry-after'];
    if (!retryAfter) {
      result.valid = false;
      result.errors.push('Missing required Retry-After header on 429 response');
    } else {
      result.headers.retryAfter = retryAfter;
    }

    // Rate limit headers should still be present on 429
    for (const header of this.requiredHeaders) {
      const value = headers[header];
      if (!value) {
        result.warnings.push(`Missing rate limit header on 429: ${header}`);
      } else {
        const key = header.replace('x-ratelimit-', '') as keyof HeaderValidationResult['headers'];
        result.headers[key] = value;
      }
    }

    // Parse headers
    this.parseHeaders(result);

    // Validate retry-after
    if (retryAfter) {
      const retryAfterValue = this.parseRetryAfter(retryAfter);
      if (retryAfterValue === null) {
        result.errors.push(`Invalid Retry-After format: ${retryAfter}`);
        result.valid = false;
      } else {
        result.parsedValues.retryAfter = retryAfterValue;
      }
    }

    return result;
  }

  /**
   * Validate header values across multiple responses
   */
  validateHeaderProgression(
    responses: APIResponse[]
  ): {
    consistent: boolean;
    errors: string[];
    progression: Array<{
      index: number;
      limit: number;
      remaining: number;
      reset: number;
    }>;
  } {
    const errors: string[] = [];
    const progression: any[] = [];
    let lastRemaining: number | null = null;
    let lastReset: number | null = null;
    let limit: number | null = null;

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const validation = this.validateSuccessHeaders(response);

      if (!validation.valid) {
        errors.push(`Response ${i}: ${validation.errors.join(', ')}`);
        continue;
      }

      const { limit: currLimit, remaining, reset } = validation.parsedValues;

      progression.push({
        index: i,
        limit: currLimit!,
        remaining: remaining!,
        reset: reset!.getTime(),
      });

      // Check limit consistency
      if (limit === null) {
        limit = currLimit!;
      } else if (currLimit !== limit) {
        errors.push(`Inconsistent limit: expected ${limit}, got ${currLimit} at response ${i}`);
      }

      // Check remaining decreases or resets
      if (lastRemaining !== null && lastReset !== null) {
        if (reset!.getTime() === lastReset) {
          // Same window - remaining should decrease or stay same
          if (remaining! > lastRemaining) {
            errors.push(`Remaining increased within same window at response ${i}`);
          }
        } else if (reset!.getTime() > lastReset) {
          // New window - remaining should reset to near limit
          if (remaining! < limit! - 10) {
            errors.push(`Remaining didn't reset properly at new window, response ${i}`);
          }
        }
      }

      lastRemaining = remaining!;
      lastReset = reset!.getTime();
    }

    return {
      consistent: errors.length === 0,
      errors,
      progression,
    };
  }

  /**
   * Check reset timing accuracy
   */
  async checkResetTimingAccuracy(
    response: APIResponse,
    windowDuration: number = 60000
  ): Promise<{
    accurate: boolean;
    resetTime: Date;
    expectedWindow: { start: Date; end: Date };
    deviation: number;
  }> {
    const validation = this.validateSuccessHeaders(response);
    
    if (!validation.valid || !validation.parsedValues.reset) {
      throw new Error('Invalid headers for reset timing check');
    }

    const resetTime = validation.parsedValues.reset;
    const now = new Date();
    
    // Calculate expected window boundaries
    const windowStart = new Date(Math.floor(now.getTime() / windowDuration) * windowDuration);
    const windowEnd = new Date(windowStart.getTime() + windowDuration);

    // Check if reset time aligns with window boundary
    const deviation = Math.abs(resetTime.getTime() - windowEnd.getTime());
    const accurate = deviation < 1000; // Within 1 second

    return {
      accurate,
      resetTime,
      expectedWindow: { start: windowStart, end: windowEnd },
      deviation,
    };
  }

  /**
   * Parse headers into typed values
   */
  private parseHeaders(result: HeaderValidationResult): void {
    if (result.headers.limit) {
      const limit = parseInt(result.headers.limit);
      if (isNaN(limit) || limit <= 0) {
        result.errors.push(`Invalid limit value: ${result.headers.limit}`);
        result.valid = false;
      } else {
        result.parsedValues.limit = limit;
      }
    }

    if (result.headers.remaining) {
      const remaining = parseInt(result.headers.remaining);
      if (isNaN(remaining) || remaining < 0) {
        result.errors.push(`Invalid remaining value: ${result.headers.remaining}`);
        result.valid = false;
      } else {
        result.parsedValues.remaining = remaining;
      }
    }

    if (result.headers.reset) {
      const reset = parseInt(result.headers.reset);
      if (isNaN(reset) || reset <= 0) {
        result.errors.push(`Invalid reset value: ${result.headers.reset}`);
        result.valid = false;
      } else {
        result.parsedValues.reset = new Date(reset * 1000);
      }
    }

    if (result.headers.resetAfter) {
      const resetAfter = parseInt(result.headers.resetAfter);
      if (isNaN(resetAfter) || resetAfter < 0) {
        result.errors.push(`Invalid reset-after value: ${result.headers.resetAfter}`);
        result.valid = false;
      } else {
        result.parsedValues.resetAfter = resetAfter;
      }
    }

    if (result.headers.bucket) {
      result.parsedValues.bucket = result.headers.bucket;
    }
  }

  /**
   * Check internal consistency of headers
   */
  private checkConsistency(result: HeaderValidationResult): void {
    const { limit, remaining, reset, resetAfter } = result.parsedValues;

    if (limit !== undefined && remaining !== undefined) {
      if (remaining > limit) {
        result.errors.push(`Remaining (${remaining}) exceeds limit (${limit})`);
        result.valid = false;
      }
    }

    if (reset && resetAfter !== undefined) {
      const now = Date.now();
      const expectedReset = now + resetAfter * 1000;
      const actualReset = reset.getTime();
      const deviation = Math.abs(expectedReset - actualReset);

      if (deviation > 5000) { // 5 second tolerance
        result.warnings.push(
          `Reset time and reset-after are inconsistent (deviation: ${deviation}ms)`
        );
      }
    }
  }

  /**
   * Parse Retry-After header
   */
  private parseRetryAfter(value: string): number | null {
    // Try parsing as seconds
    const seconds = parseInt(value);
    if (!isNaN(seconds)) {
      return seconds;
    }

    // Try parsing as HTTP date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const seconds = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
      return seconds;
    }

    return null;
  }
}