import { Page, Request, Response } from '@playwright/test';

/**
 * Metric types
 */
export enum MetricType {
  TIMING = 'timing',
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  ERROR = 'error'
}

/**
 * Individual metric data point
 */
export interface MetricPoint {
  type: MetricType;
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

/**
 * Performance timing metrics
 */
export interface PerformanceTimings {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
  cumulativeLayoutShift?: number;
}

/**
 * API performance metrics
 */
export interface ApiMetrics {
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  timestamp: number;
  success: boolean;
}

/**
 * Resource loading metrics
 */
export interface ResourceMetrics {
  url: string;
  type: string;
  duration: number;
  size: number;
  cached: boolean;
  timestamp: number;
}

/**
 * User interaction metrics
 */
export interface InteractionMetrics {
  type: string;
  target: string;
  duration: number;
  timestamp: number;
  successful: boolean;
}

/**
 * Journey-specific metrics
 */
export interface JourneySpecificMetrics {
  journeyName: string;
  stepName: string;
  customMetrics: Map<string, number>;
  businessMetrics: Map<string, any>;
}

/**
 * Aggregated metrics summary
 */
export interface MetricsSummary {
  timings: {
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    avg: number;
    count: number;
  };
  api: {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    errorsByEndpoint: Map<string, number>;
    slowestEndpoints: ApiMetrics[];
  };
  resources: {
    totalLoaded: number;
    totalSize: number;
    avgLoadTime: number;
    cachedRatio: number;
    byType: Map<string, { count: number; size: number; avgDuration: number }>;
  };
  errors: {
    total: number;
    byType: Map<string, number>;
    byStep: Map<string, number>;
  };
  business: {
    conversionRate?: number;
    customMetrics: Map<string, any>;
  };
}

/**
 * Metrics collector for comprehensive performance tracking
 */
export class MetricsCollector {
  private metrics: MetricPoint[] = [];
  private apiMetrics: ApiMetrics[] = [];
  private resourceMetrics: ResourceMetrics[] = [];
  private interactionMetrics: InteractionMetrics[] = [];
  private journeyMetrics: Map<string, JourneySpecificMetrics> = new Map();
  private startTime: number;
  private page?: Page;
  private requestInterceptor?: (request: Request) => void;
  private responseInterceptor?: (response: Response) => void;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Initialize metrics collection for a page
   */
  async initialize(page: Page): Promise<void> {
    this.page = page;
    
    // Setup network monitoring
    this.setupNetworkMonitoring();
    
    // Setup performance monitoring
    await this.setupPerformanceMonitoring();
    
    // Setup error monitoring
    this.setupErrorMonitoring();
    
    console.log('📊 Metrics collector initialized');
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    if (!this.page) return;

    const requestTimings = new Map<string, number>();

    // Monitor requests
    this.page.on('request', (request: Request) => {
      const requestId = request.url() + request.method() + Date.now();
      requestTimings.set(requestId, Date.now());
    });

    // Monitor responses
    this.page.on('response', async (response: Response) => {
      const request = response.request();
      const requestId = request.url() + request.method() + Date.now();
      const startTime = requestTimings.get(requestId) || Date.now();
      const duration = Date.now() - startTime;

      // Track API metrics
      if (request.url().includes('/api/')) {
        const size = response.headers()['content-length'] ? 
          parseInt(response.headers()['content-length']) : 0;

        this.apiMetrics.push({
          endpoint: new URL(request.url()).pathname,
          method: request.method(),
          status: response.status(),
          duration,
          size,
          timestamp: Date.now(),
          success: response.status() >= 200 && response.status() < 300
        });

        // Record metric
        this.record(MetricType.TIMING, 'api.response_time', duration, {
          endpoint: new URL(request.url()).pathname,
          method: request.method(),
          status: response.status().toString()
        });
      }

      // Track resource metrics
      const resourceType = response.request().resourceType();
      this.resourceMetrics.push({
        url: request.url(),
        type: resourceType,
        duration,
        size: 0, // Would need to parse from response
        cached: response.fromCache(),
        timestamp: Date.now()
      });

      requestTimings.delete(requestId);
    });
  }

  /**
   * Setup performance monitoring
   */
  private async setupPerformanceMonitoring(): Promise<void> {
    if (!this.page) return;

    // Inject performance observer
    await this.page.evaluateOnNewDocument(() => {
      // Track Core Web Vitals
      if ('PerformanceObserver' in window) {
        // LCP
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          (window as any).__lcp = lastEntry.renderTime || lastEntry.loadTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // FID
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          (window as any).__fid = entries[0].processingStart - entries[0].startTime;
        }).observe({ entryTypes: ['first-input'] });

        // CLS
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
              (window as any).__cls = clsValue;
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });
      }
    });
  }

  /**
   * Setup error monitoring
   */
  private setupErrorMonitoring(): void {
    if (!this.page) return;

    // Console errors
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.record(MetricType.ERROR, 'console.error', 1, {
          message: msg.text(),
          location: msg.location().url
        });
      }
    });

    // Page errors
    this.page.on('pageerror', (error) => {
      this.record(MetricType.ERROR, 'page.error', 1, {
        message: error.message,
        stack: error.stack
      });
    });

    // Request failures
    this.page.on('requestfailed', (request) => {
      this.record(MetricType.ERROR, 'request.failed', 1, {
        url: request.url(),
        method: request.method(),
        errorText: request.failure()?.errorText
      });
    });
  }

  /**
   * Record a metric
   */
  record(
    type: MetricType,
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, any>
  ): void {
    const metric: MetricPoint = {
      type,
      name,
      value,
      timestamp: Date.now(),
      tags,
      metadata
    };

    this.metrics.push(metric);

    // Log significant metrics
    if (type === MetricType.ERROR || (type === MetricType.TIMING && value > 1000)) {
      console.log(`📊 ${name}: ${value}${type === MetricType.TIMING ? 'ms' : ''}`);
    }
  }

  /**
   * Record timing metric
   */
  timing(name: string, duration: number, tags?: Record<string, string>): void {
    this.record(MetricType.TIMING, name, duration, tags);
  }

  /**
   * Record counter metric
   */
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.record(MetricType.COUNTER, name, value, tags);
  }

  /**
   * Record gauge metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record(MetricType.GAUGE, name, value, tags);
  }

  /**
   * Record error metric
   */
  error(name: string, error: Error, tags?: Record<string, string>): void {
    this.record(MetricType.ERROR, name, 1, tags, {
      message: error.message,
      stack: error.stack
    });
  }

  /**
   * Start timing measurement
   */
  startTiming(name: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.timing(name, duration);
      return duration;
    };
  }

  /**
   * Measure page load performance
   */
  async measurePageLoad(url: string): Promise<PerformanceTimings> {
    if (!this.page) throw new Error('Page not initialized');

    const navigationStart = Date.now();
    await this.page.goto(url, { waitUntil: 'networkidle' });

    const timings = await this.page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
        loadComplete: nav.loadEventEnd - nav.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
        largestContentfulPaint: (window as any).__lcp,
        firstInputDelay: (window as any).__fid,
        cumulativeLayoutShift: (window as any).__cls
      };
    });

    const performanceTimings: PerformanceTimings = {
      navigationStart,
      domContentLoaded: timings.domContentLoaded,
      loadComplete: timings.loadComplete,
      firstPaint: timings.firstPaint,
      firstContentfulPaint: timings.firstContentfulPaint,
      largestContentfulPaint: timings.largestContentfulPaint,
      cumulativeLayoutShift: timings.cumulativeLayoutShift
    };

    // Record metrics
    this.timing('page.load', Date.now() - navigationStart, { url });
    if (timings.firstContentfulPaint) {
      this.timing('page.fcp', timings.firstContentfulPaint, { url });
    }
    if (timings.largestContentfulPaint) {
      this.timing('page.lcp', timings.largestContentfulPaint, { url });
    }

    return performanceTimings;
  }

  /**
   * Track user interaction
   */
  async trackInteraction(
    type: string,
    target: string,
    action: () => Promise<void>
  ): Promise<InteractionMetrics> {
    const startTime = Date.now();
    let successful = true;

    try {
      await action();
    } catch (error) {
      successful = false;
      this.error('interaction.error', error as Error, { type, target });
    }

    const duration = Date.now() - startTime;
    const interaction: InteractionMetrics = {
      type,
      target,
      duration,
      timestamp: startTime,
      successful
    };

    this.interactionMetrics.push(interaction);
    this.timing(`interaction.${type}`, duration, { target, success: successful.toString() });

    return interaction;
  }

  /**
   * Record journey-specific metric
   */
  recordJourneyMetric(
    journeyName: string,
    stepName: string,
    metricName: string,
    value: number | any,
    isBusinessMetric: boolean = false
  ): void {
    const key = `${journeyName}:${stepName}`;
    
    if (!this.journeyMetrics.has(key)) {
      this.journeyMetrics.set(key, {
        journeyName,
        stepName,
        customMetrics: new Map(),
        businessMetrics: new Map()
      });
    }

    const metrics = this.journeyMetrics.get(key)!;
    if (isBusinessMetric) {
      metrics.businessMetrics.set(metricName, value);
    } else {
      metrics.customMetrics.set(metricName, value);
    }
  }

  /**
   * Calculate percentiles
   */
  private calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
    if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };

    const sorted = values.sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || sorted[sorted.length - 1],
      p99: sorted[p99Index] || sorted[sorted.length - 1]
    };
  }

  /**
   * Generate metrics summary
   */
  generateSummary(): MetricsSummary {
    // Timing metrics
    const timingValues = this.metrics
      .filter(m => m.type === MetricType.TIMING)
      .map(m => m.value);

    const percentiles = this.calculatePercentiles(timingValues);

    // API metrics
    const successfulApiCalls = this.apiMetrics.filter(m => m.success).length;
    const errorsByEndpoint = new Map<string, number>();
    const endpointDurations = new Map<string, number[]>();

    this.apiMetrics.forEach(metric => {
      if (!metric.success) {
        const count = errorsByEndpoint.get(metric.endpoint) || 0;
        errorsByEndpoint.set(metric.endpoint, count + 1);
      }
      
      if (!endpointDurations.has(metric.endpoint)) {
        endpointDurations.set(metric.endpoint, []);
      }
      endpointDurations.get(metric.endpoint)!.push(metric.duration);
    });

    const slowestEndpoints = [...this.apiMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Resource metrics
    const resourcesByType = new Map<string, { count: number; size: number; totalDuration: number }>();
    
    this.resourceMetrics.forEach(metric => {
      if (!resourcesByType.has(metric.type)) {
        resourcesByType.set(metric.type, { count: 0, size: 0, totalDuration: 0 });
      }
      const typeMetrics = resourcesByType.get(metric.type)!;
      typeMetrics.count++;
      typeMetrics.size += metric.size;
      typeMetrics.totalDuration += metric.duration;
    });

    const resourceTypesSummary = new Map<string, { count: number; size: number; avgDuration: number }>();
    resourcesByType.forEach((value, key) => {
      resourceTypesSummary.set(key, {
        count: value.count,
        size: value.size,
        avgDuration: value.count > 0 ? value.totalDuration / value.count : 0
      });
    });

    // Error metrics
    const errorsByType = new Map<string, number>();
    const errorsByStep = new Map<string, number>();
    
    this.metrics
      .filter(m => m.type === MetricType.ERROR)
      .forEach(m => {
        const errorType = m.tags?.type || 'unknown';
        errorsByType.set(errorType, (errorsByType.get(errorType) || 0) + 1);
        
        const step = m.tags?.step || 'unknown';
        errorsByStep.set(step, (errorsByStep.get(step) || 0) + 1);
      });

    return {
      timings: {
        p50: percentiles.p50,
        p95: percentiles.p95,
        p99: percentiles.p99,
        min: Math.min(...timingValues),
        max: Math.max(...timingValues),
        avg: timingValues.reduce((sum, v) => sum + v, 0) / timingValues.length,
        count: timingValues.length
      },
      api: {
        totalCalls: this.apiMetrics.length,
        successRate: this.apiMetrics.length > 0 ? (successfulApiCalls / this.apiMetrics.length) * 100 : 0,
        avgDuration: this.apiMetrics.reduce((sum, m) => sum + m.duration, 0) / (this.apiMetrics.length || 1),
        errorsByEndpoint,
        slowestEndpoints
      },
      resources: {
        totalLoaded: this.resourceMetrics.length,
        totalSize: this.resourceMetrics.reduce((sum, m) => sum + m.size, 0),
        avgLoadTime: this.resourceMetrics.reduce((sum, m) => sum + m.duration, 0) / (this.resourceMetrics.length || 1),
        cachedRatio: this.resourceMetrics.filter(m => m.cached).length / (this.resourceMetrics.length || 1),
        byType: resourceTypesSummary
      },
      errors: {
        total: this.metrics.filter(m => m.type === MetricType.ERROR).length,
        byType: errorsByType,
        byStep: errorsByStep
      },
      business: {
        customMetrics: new Map()
      }
    };
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    const summary = this.generateSummary();
    
    return JSON.stringify({
      summary,
      metrics: this.metrics,
      apiMetrics: this.apiMetrics,
      resourceMetrics: this.resourceMetrics,
      interactionMetrics: this.interactionMetrics,
      journeyMetrics: Array.from(this.journeyMetrics.entries())
    }, null, 2);
  }

  /**
   * Generate metrics dashboard HTML
   */
  generateDashboard(): string {
    const summary = this.generateSummary();
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Journey Metrics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .metric-card { 
      background: #f5f5f5; 
      padding: 20px; 
      margin: 10px 0; 
      border-radius: 8px; 
    }
    .chart-container { 
      width: 100%; 
      max-width: 600px; 
      margin: 20px 0; 
    }
    h1, h2, h3 { color: #333; }
    .metric-value { 
      font-size: 2em; 
      font-weight: bold; 
      color: #2196F3; 
    }
    .metric-label { 
      color: #666; 
      font-size: 0.9em; 
    }
    .grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 15px; 
    }
  </style>
</head>
<body>
  <h1>Journey Metrics Dashboard</h1>
  
  <div class="grid">
    <div class="metric-card">
      <div class="metric-label">Total API Calls</div>
      <div class="metric-value">${summary.api.totalCalls}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">API Success Rate</div>
      <div class="metric-value">${summary.api.successRate.toFixed(1)}%</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">P95 Response Time</div>
      <div class="metric-value">${summary.timings.p95}ms</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Errors</div>
      <div class="metric-value">${summary.errors.total}</div>
    </div>
  </div>

  <h2>Response Time Distribution</h2>
  <div class="chart-container">
    <canvas id="timingChart"></canvas>
  </div>

  <h2>API Performance</h2>
  <div class="chart-container">
    <canvas id="apiChart"></canvas>
  </div>

  <h2>Resource Loading</h2>
  <div class="chart-container">
    <canvas id="resourceChart"></canvas>
  </div>

  <script>
    // Timing chart
    new Chart(document.getElementById('timingChart'), {
      type: 'bar',
      data: {
        labels: ['P50', 'P95', 'P99', 'Max'],
        datasets: [{
          label: 'Response Time (ms)',
          data: [${summary.timings.p50}, ${summary.timings.p95}, ${summary.timings.p99}, ${summary.timings.max}],
          backgroundColor: '#2196F3'
        }]
      }
    });

    // API chart
    new Chart(document.getElementById('apiChart'), {
      type: 'doughnut',
      data: {
        labels: ['Successful', 'Failed'],
        datasets: [{
          data: [${summary.api.totalCalls - summary.errors.total}, ${summary.errors.total}],
          backgroundColor: ['#4CAF50', '#F44336']
        }]
      }
    });

    // Resource chart
    const resourceData = ${JSON.stringify(Array.from(summary.resources.byType.entries()))};
    new Chart(document.getElementById('resourceChart'), {
      type: 'bar',
      data: {
        labels: resourceData.map(([type]) => type),
        datasets: [{
          label: 'Count',
          data: resourceData.map(([, data]) => data.count),
          backgroundColor: '#FF9800'
        }]
      }
    });
  </script>
</body>
</html>
`;
  }
}

/**
 * Create metrics collector instance
 */
export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector();
}