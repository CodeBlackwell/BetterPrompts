import { Page, BrowserContext, Browser } from '@playwright/test';

/**
 * Journey step definition
 */
export interface JourneyStep {
  name: string;
  action: (context: JourneyContext) => Promise<void>;
  validation?: (context: JourneyContext) => Promise<void>;
  timing?: {
    start?: number;
    end?: number;
    duration?: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Journey context for passing data between steps
 */
export interface JourneyContext {
  page: Page;
  browser: Browser;
  browserContext: BrowserContext;
  userData: Record<string, any>;
  sessionData: Record<string, any>;
  metrics: JourneyMetrics;
  storage: Map<string, any>;
}

/**
 * Journey metrics collection
 */
export interface JourneyMetrics {
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  stepDurations: Map<string, number>;
  errors: Array<{
    step: string;
    error: Error;
    timestamp: number;
  }>;
  performance: {
    apiCalls: number;
    avgResponseTime: number;
    slowestEndpoint: { url: string; duration: number };
  };
  validationResults: Map<string, boolean>;
}

/**
 * Journey configuration
 */
export interface JourneyConfig {
  name: string;
  description: string;
  steps: JourneyStep[];
  beforeJourney?: (context: JourneyContext) => Promise<void>;
  afterJourney?: (context: JourneyContext) => Promise<void>;
  onError?: (error: Error, step: string, context: JourneyContext) => Promise<void>;
  timingTargets?: {
    total?: number;
    perStep?: number;
  };
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
}

/**
 * Main journey orchestrator class
 */
export class JourneyOrchestrator {
  private config: JourneyConfig;
  private context: JourneyContext;
  private currentStep: number = 0;
  private stepHistory: string[] = [];

  constructor(config: JourneyConfig, browser: Browser, browserContext: BrowserContext, page: Page) {
    this.config = config;
    this.context = {
      page,
      browser,
      browserContext,
      userData: {},
      sessionData: {},
      metrics: {
        startTime: Date.now(),
        stepDurations: new Map(),
        errors: [],
        performance: {
          apiCalls: 0,
          avgResponseTime: 0,
          slowestEndpoint: { url: '', duration: 0 }
        },
        validationResults: new Map()
      },
      storage: new Map()
    };
  }

  /**
   * Execute the complete journey
   */
  async executeJourney(): Promise<JourneyMetrics> {
    console.log(`🚀 Starting journey: ${this.config.name}`);
    console.log(`📝 ${this.config.description}`);
    
    try {
      // Setup phase
      if (this.config.beforeJourney) {
        await this.config.beforeJourney(this.context);
      }

      // Execute each step
      for (let i = 0; i < this.config.steps.length; i++) {
        const step = this.config.steps[i];
        this.currentStep = i;
        
        const success = await this.executeStep(step);
        if (!success && !this.config.retryPolicy) {
          throw new Error(`Step "${step.name}" failed without retry policy`);
        }
      }

      // Cleanup phase
      if (this.config.afterJourney) {
        await this.config.afterJourney(this.context);
      }

      // Finalize metrics
      this.context.metrics.endTime = Date.now();
      this.context.metrics.totalDuration = this.context.metrics.endTime - this.context.metrics.startTime;

      // Validate timing targets
      this.validateTimingTargets();

      console.log(`✅ Journey completed: ${this.config.name}`);
      return this.context.metrics;

    } catch (error) {
      console.error(`❌ Journey failed: ${this.config.name}`, error);
      throw error;
    }
  }

  /**
   * Execute a single journey step with retry logic
   */
  private async executeStep(step: JourneyStep, retryCount: number = 0): Promise<boolean> {
    const stepStartTime = Date.now();
    console.log(`\n📍 Step ${this.currentStep + 1}/${this.config.steps.length}: ${step.name}`);

    try {
      // Update step timing
      step.timing = { start: stepStartTime };

      // Execute the step action
      await step.action(this.context);

      // Run validation if provided
      if (step.validation) {
        await step.validation(this.context);
        this.context.metrics.validationResults.set(step.name, true);
      }

      // Update metrics
      const stepEndTime = Date.now();
      const duration = stepEndTime - stepStartTime;
      step.timing.end = stepEndTime;
      step.timing.duration = duration;
      this.context.metrics.stepDurations.set(step.name, duration);
      this.stepHistory.push(step.name);

      console.log(`✅ Step completed in ${duration}ms: ${step.name}`);
      return true;

    } catch (error) {
      console.error(`❌ Step failed: ${step.name}`, error);
      
      // Record error
      this.context.metrics.errors.push({
        step: step.name,
        error: error as Error,
        timestamp: Date.now()
      });
      this.context.metrics.validationResults.set(step.name, false);

      // Handle retry logic
      if (this.config.retryPolicy && retryCount < this.config.retryPolicy.maxRetries) {
        console.log(`🔄 Retrying step (${retryCount + 1}/${this.config.retryPolicy.maxRetries}): ${step.name}`);
        await this.delay(this.config.retryPolicy.retryDelay);
        return this.executeStep(step, retryCount + 1);
      }

      // Call error handler if provided
      if (this.config.onError) {
        await this.config.onError(error as Error, step.name, this.context);
      }

      return false;
    }
  }

  /**
   * Validate timing targets
   */
  private validateTimingTargets(): void {
    if (!this.config.timingTargets) return;

    // Check total journey time
    if (this.config.timingTargets.total && this.context.metrics.totalDuration) {
      const targetMs = this.parseTimeToMs(this.config.timingTargets.total);
      if (this.context.metrics.totalDuration > targetMs) {
        console.warn(`⚠️ Journey exceeded timing target: ${this.context.metrics.totalDuration}ms > ${targetMs}ms`);
      }
    }

    // Check per-step timing
    if (this.config.timingTargets.perStep) {
      const targetMs = this.parseTimeToMs(this.config.timingTargets.perStep);
      this.context.metrics.stepDurations.forEach((duration, stepName) => {
        if (duration > targetMs) {
          console.warn(`⚠️ Step "${stepName}" exceeded timing target: ${duration}ms > ${targetMs}ms`);
        }
      });
    }
  }

  /**
   * Parse time string to milliseconds
   */
  private parseTimeToMs(timeStr: string | number): number {
    if (typeof timeStr === 'number') return timeStr;
    
    const match = timeStr.match(/(\d+)(s|ms|min)/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'min': return value * 60 * 1000;
      default: return 0;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current journey state
   */
  getState(): {
    currentStep: number;
    totalSteps: number;
    stepHistory: string[];
    context: JourneyContext;
  } {
    return {
      currentStep: this.currentStep,
      totalSteps: this.config.steps.length,
      stepHistory: this.stepHistory,
      context: this.context
    };
  }

  /**
   * Store data for use in later steps
   */
  storeData(key: string, value: any): void {
    this.context.storage.set(key, value);
  }

  /**
   * Retrieve stored data
   */
  getData(key: string): any {
    return this.context.storage.get(key);
  }

  /**
   * Update user data
   */
  updateUserData(data: Partial<Record<string, any>>): void {
    this.context.userData = { ...this.context.userData, ...data };
  }

  /**
   * Update session data
   */
  updateSessionData(data: Partial<Record<string, any>>): void {
    this.context.sessionData = { ...this.context.sessionData, ...data };
  }

  /**
   * Track API performance
   */
  trackApiCall(url: string, duration: number): void {
    const metrics = this.context.metrics.performance;
    metrics.apiCalls++;
    
    // Update average response time
    metrics.avgResponseTime = ((metrics.avgResponseTime * (metrics.apiCalls - 1)) + duration) / metrics.apiCalls;
    
    // Track slowest endpoint
    if (duration > metrics.slowestEndpoint.duration) {
      metrics.slowestEndpoint = { url, duration };
    }
  }

  /**
   * Generate journey report
   */
  generateReport(): string {
    const metrics = this.context.metrics;
    const successRate = (metrics.validationResults.size - metrics.errors.length) / metrics.validationResults.size * 100;

    return `
# Journey Report: ${this.config.name}

## Summary
- **Status**: ${metrics.errors.length === 0 ? '✅ Success' : '❌ Failed'}
- **Duration**: ${metrics.totalDuration}ms
- **Steps**: ${this.stepHistory.length}/${this.config.steps.length}
- **Success Rate**: ${successRate.toFixed(1)}%

## Step Timings
${Array.from(metrics.stepDurations.entries())
  .map(([step, duration]) => `- ${step}: ${duration}ms`)
  .join('\n')}

## Performance Metrics
- **API Calls**: ${metrics.performance.apiCalls}
- **Avg Response Time**: ${metrics.performance.avgResponseTime.toFixed(0)}ms
- **Slowest Endpoint**: ${metrics.performance.slowestEndpoint.url} (${metrics.performance.slowestEndpoint.duration}ms)

## Validation Results
${Array.from(metrics.validationResults.entries())
  .map(([step, result]) => `- ${step}: ${result ? '✅ Passed' : '❌ Failed'}`)
  .join('\n')}

## Errors
${metrics.errors.length === 0 ? 'No errors' : metrics.errors
  .map(e => `- ${e.step}: ${e.error.message}`)
  .join('\n')}
`;
  }
}

/**
 * Journey builder for fluent API
 */
export class JourneyBuilder {
  private config: Partial<JourneyConfig> = {
    steps: []
  };

  name(name: string): JourneyBuilder {
    this.config.name = name;
    return this;
  }

  description(description: string): JourneyBuilder {
    this.config.description = description;
    return this;
  }

  addStep(name: string, action: (context: JourneyContext) => Promise<void>, validation?: (context: JourneyContext) => Promise<void>): JourneyBuilder {
    this.config.steps!.push({ name, action, validation });
    return this;
  }

  beforeJourney(hook: (context: JourneyContext) => Promise<void>): JourneyBuilder {
    this.config.beforeJourney = hook;
    return this;
  }

  afterJourney(hook: (context: JourneyContext) => Promise<void>): JourneyBuilder {
    this.config.afterJourney = hook;
    return this;
  }

  onError(handler: (error: Error, step: string, context: JourneyContext) => Promise<void>): JourneyBuilder {
    this.config.onError = handler;
    return this;
  }

  withTimingTargets(total?: string | number, perStep?: string | number): JourneyBuilder {
    this.config.timingTargets = { total, perStep };
    return this;
  }

  withRetryPolicy(maxRetries: number, retryDelay: number): JourneyBuilder {
    this.config.retryPolicy = { maxRetries, retryDelay };
    return this;
  }

  build(): JourneyConfig {
    if (!this.config.name || !this.config.description || this.config.steps!.length === 0) {
      throw new Error('Journey must have name, description, and at least one step');
    }
    return this.config as JourneyConfig;
  }
}

/**
 * Create a new journey builder
 */
export function createJourney(): JourneyBuilder {
  return new JourneyBuilder();
}