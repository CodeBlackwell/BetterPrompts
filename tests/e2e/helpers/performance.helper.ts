import { Page, test } from '@playwright/test';

export interface PerformanceMetrics {
  navigationTiming?: PerformanceNavigationTiming;
  resourceTimings?: PerformanceResourceTiming[];
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  customMetrics?: Record<string, number>;
}

export class PerformanceHelper {
  private metrics: PerformanceMetrics = {};
  private startTimes: Map<string, number> = new Map();

  constructor(private page: Page) {}

  /**
   * Start tracking a custom metric
   */
  startMeasure(name: string): void {
    this.startTimes.set(name, Date.now());
  }

  /**
   * End tracking a custom metric and store the duration
   */
  endMeasure(name: string): number {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      throw new Error(`No start time found for measure: ${name}`);
    }

    const duration = Date.now() - startTime;
    
    if (!this.metrics.customMetrics) {
      this.metrics.customMetrics = {};
    }
    
    this.metrics.customMetrics[name] = duration;
    this.startTimes.delete(name);
    
    return duration;
  }

  /**
   * Measure the time it takes for an action to complete
   */
  async measureAction<T>(name: string, action: () => Promise<T>): Promise<T> {
    this.startMeasure(name);
    try {
      const result = await action();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  /**
   * Capture navigation performance metrics
   */
  async captureNavigationMetrics(): Promise<void> {
    const navTiming = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (!navigation) return null;

      return {
        // Network timings
        fetchStart: navigation.fetchStart,
        domainLookupStart: navigation.domainLookupStart,
        domainLookupEnd: navigation.domainLookupEnd,
        connectStart: navigation.connectStart,
        connectEnd: navigation.connectEnd,
        requestStart: navigation.requestStart,
        responseStart: navigation.responseStart,
        responseEnd: navigation.responseEnd,
        
        // DOM processing
        domInteractive: navigation.domInteractive,
        domContentLoadedEventStart: navigation.domContentLoadedEventStart,
        domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
        domComplete: navigation.domComplete,
        loadEventStart: navigation.loadEventStart,
        loadEventEnd: navigation.loadEventEnd,
        
        // Calculated metrics
        dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpTime: navigation.connectEnd - navigation.connectStart,
        requestTime: navigation.responseStart - navigation.requestStart,
        responseTime: navigation.responseEnd - navigation.responseStart,
        domProcessingTime: navigation.domComplete - navigation.domInteractive,
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
      };
    });

    if (navTiming) {
      this.metrics.navigationTiming = navTiming as any;
    }
  }

  /**
   * Capture resource loading metrics
   */
  async captureResourceMetrics(): Promise<void> {
    const resources = await this.page.evaluate(() => {
      return performance.getEntriesByType('resource').map((entry) => {
        const resource = entry as PerformanceResourceTiming;
        return {
          name: resource.name,
          initiatorType: resource.initiatorType,
          startTime: resource.startTime,
          duration: resource.duration,
          transferSize: resource.transferSize,
          encodedBodySize: resource.encodedBodySize,
          decodedBodySize: resource.decodedBodySize,
        };
      });
    });

    this.metrics.resourceTimings = resources as any;
  }

  /**
   * Capture memory usage (Chrome only)
   */
  async captureMemoryMetrics(): Promise<void> {
    const memory = await this.page.evaluate(() => {
      // @ts-ignore - performance.memory is Chrome-specific
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (memory) {
      this.metrics.memory = memory;
    }
  }

  /**
   * Wait for the page to be idle (no network activity)
   */
  async waitForPageIdle(timeout = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Measure First Contentful Paint (FCP)
   */
  async measureFCP(): Promise<number | null> {
    return await this.page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return fcp ? fcp.startTime : null;
    });
  }

  /**
   * Measure Largest Contentful Paint (LCP)
   */
  async measureLCP(): Promise<number | null> {
    return await this.page.evaluate(() => {
      return new Promise<number | null>((resolve) => {
        let lcp: number | null = null;
        
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcp = lastEntry.startTime;
        });
        
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Wait for LCP to stabilize
        setTimeout(() => {
          observer.disconnect();
          resolve(lcp);
        }, 3000);
      });
    });
  }

  /**
   * Measure Cumulative Layout Shift (CLS)
   */
  async measureCLS(): Promise<number> {
    return await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cls = 0;
        
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            cls += (entry as any).value;
          }
        });
        
        observer.observe({ entryTypes: ['layout-shift'] });
        
        // Measure CLS over a period
        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 5000);
      });
    });
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Attach metrics to test for reporter
   */
  async attachToTest(): Promise<void> {
    const metrics = this.getMetrics();
    
    await test.info().attach('performance-data', {
      body: JSON.stringify(metrics),
      contentType: 'application/json',
    });
  }

  /**
   * Assert performance thresholds
   */
  assertPerformance(thresholds: {
    loadTime?: number;
    fcp?: number;
    lcp?: number;
    cls?: number;
    enhancementTime?: number;
    apiResponseTime?: number;
  }): void {
    const metrics = this.getMetrics();
    
    if (thresholds.loadTime && metrics.navigationTiming) {
      const loadTime = metrics.navigationTiming.loadEventEnd - metrics.navigationTiming.fetchStart;
      if (loadTime > thresholds.loadTime) {
        throw new Error(`Load time ${loadTime}ms exceeds threshold ${thresholds.loadTime}ms`);
      }
    }
    
    if (thresholds.enhancementTime && metrics.customMetrics?.enhancementTime) {
      if (metrics.customMetrics.enhancementTime > thresholds.enhancementTime) {
        throw new Error(
          `Enhancement time ${metrics.customMetrics.enhancementTime}ms exceeds threshold ${thresholds.enhancementTime}ms`
        );
      }
    }
    
    if (thresholds.apiResponseTime && metrics.customMetrics?.apiResponseTime) {
      if (metrics.customMetrics.apiResponseTime > thresholds.apiResponseTime) {
        throw new Error(
          `API response time ${metrics.customMetrics.apiResponseTime}ms exceeds threshold ${thresholds.apiResponseTime}ms`
        );
      }
    }
  }

  /**
   * Log performance summary
   */
  logSummary(): void {
    const metrics = this.getMetrics();
    
    console.log('\n📊 Performance Summary:');
    
    if (metrics.navigationTiming) {
      console.log(`   Page Load Time: ${metrics.navigationTiming.loadTime}ms`);
      console.log(`   DOM Processing: ${metrics.navigationTiming.domProcessingTime}ms`);
    }
    
    if (metrics.customMetrics) {
      console.log('   Custom Metrics:');
      for (const [name, value] of Object.entries(metrics.customMetrics)) {
        console.log(`     ${name}: ${value}ms`);
      }
    }
    
    if (metrics.memory) {
      console.log(`   Memory Usage: ${(metrics.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    }
  }
}