import { Page, Locator } from '@playwright/test';

export interface ApplicationMetrics {
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  techniqueAccuracy: number;
}

export interface InfrastructureMetrics {
  cpuUsage: number;
  memoryUsage: number;
  dbConnections: {
    active: number;
    idle: number;
    total: number;
  };
  cacheHitRate: number;
}

export interface BusinessMetrics {
  userSatisfaction: number;
  slaCompliance: number;
  costPerRequest: number;
  featureAdoption: Record<string, number>;
}

export class PerformanceDashboardPage {
  private readonly url = '/admin/analytics';

  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(this.url);
    await this.waitForMetricsLoad();
  }

  async waitForMetricsLoad() {
    // Wait for metrics container to be visible
    await this.page.waitForSelector('[data-testid="metrics-container"]', { 
      state: 'visible',
      timeout: 10000 
    });
    
    // Wait for loading indicators to disappear
    await this.page.waitForSelector('.metric-skeleton', { 
      state: 'hidden',
      timeout: 10000 
    }).catch(() => {}); // Ignore if no skeletons
    
    // Wait for at least one metric value to be populated
    await this.page.waitForFunction(() => {
      const metrics = document.querySelectorAll('[data-metric-value]');
      return metrics.length > 0 && 
             Array.from(metrics).some(m => m.textContent && m.textContent !== '-');
    }, { timeout: 10000 });
  }

  async captureMetrics() {
    return {
      totalRequests: await this.getMetricValue('total-requests'),
      avgResponseTime: await this.getMetricValue('avg-response-time'),
      errorRate: await this.getMetricValue('error-rate'),
      activeUsers: await this.getMetricValue('active-users'),
      throughput: await this.getMetricValue('throughput')
    };
  }

  async getMetricValue(metricId: string): Promise<number> {
    const element = await this.page.locator(`[data-metric-id="${metricId}"]`);
    const text = await element.textContent();
    if (!text) return 0;
    
    // Remove units and parse number
    const numStr = text.replace(/[^0-9.-]/g, '');
    return parseFloat(numStr) || 0;
  }

  async getChart(chartId: string): Promise<Locator> {
    return this.page.locator(`[data-chart-id="${chartId}"]`);
  }

  async getTechniqueStatsSection(): Promise<Locator> {
    return this.page.locator('[data-testid="technique-stats-section"]');
  }

  async getApplicationMetrics(): Promise<ApplicationMetrics> {
    const section = await this.page.locator('[data-section="application-metrics"]');
    
    return {
      responseTime: {
        p50: await this.extractNumberFromSection(section, 'response-time-p50'),
        p95: await this.extractNumberFromSection(section, 'response-time-p95'),
        p99: await this.extractNumberFromSection(section, 'response-time-p99')
      },
      throughput: await this.extractNumberFromSection(section, 'throughput'),
      errorRate: await this.extractNumberFromSection(section, 'error-rate') / 100,
      techniqueAccuracy: await this.extractNumberFromSection(section, 'technique-accuracy') / 100
    };
  }

  async getInfrastructureMetrics(): Promise<InfrastructureMetrics> {
    const section = await this.page.locator('[data-section="infrastructure-metrics"]');
    
    return {
      cpuUsage: await this.extractNumberFromSection(section, 'cpu-usage'),
      memoryUsage: await this.extractNumberFromSection(section, 'memory-usage'),
      dbConnections: {
        active: await this.extractNumberFromSection(section, 'db-connections-active'),
        idle: await this.extractNumberFromSection(section, 'db-connections-idle'),
        total: await this.extractNumberFromSection(section, 'db-connections-total')
      },
      cacheHitRate: await this.extractNumberFromSection(section, 'cache-hit-rate') / 100
    };
  }

  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const section = await this.page.locator('[data-section="business-metrics"]');
    
    // Extract feature adoption data
    const adoptionElements = await section.locator('[data-feature-adoption]').all();
    const featureAdoption: Record<string, number> = {};
    
    for (const element of adoptionElements) {
      const feature = await element.getAttribute('data-feature-adoption');
      const value = await element.textContent();
      if (feature && value) {
        featureAdoption[feature] = parseFloat(value.replace(/[^0-9.-]/g, '')) / 100;
      }
    }
    
    return {
      userSatisfaction: await this.extractNumberFromSection(section, 'user-satisfaction') / 100,
      slaCompliance: await this.extractNumberFromSection(section, 'sla-compliance') / 100,
      costPerRequest: await this.extractNumberFromSection(section, 'cost-per-request'),
      featureAdoption
    };
  }

  async selectDateRange(range: '24h' | '7d' | '30d' | '90d' | 'custom') {
    await this.page.click('[data-testid="date-range-selector"]');
    await this.page.click(`[data-date-range="${range}"]`);
    
    if (range === 'custom') {
      // Handle custom date range selection
      await this.page.fill('[data-testid="date-from"]', '2024-01-01');
      await this.page.fill('[data-testid="date-to"]', '2024-01-31');
      await this.page.click('[data-testid="apply-date-range"]');
    }
    
    // Wait for metrics to reload
    await this.waitForMetricsLoad();
  }

  async openFilterPanel() {
    const filterButton = await this.page.locator('[data-testid="filter-button"]');
    await filterButton.click();
    await this.page.waitForSelector('[data-testid="filter-panel"]', { state: 'visible' });
  }

  async filterByTechnique(technique: string) {
    await this.page.click(`[data-technique-filter="${technique}"]`);
    await this.page.click('[data-testid="apply-filters"]');
    await this.waitForMetricsLoad();
  }

  async filterByUserSegment(segment: 'all' | 'anonymous' | 'free' | 'premium' | 'enterprise') {
    await this.page.click('[data-testid="user-segment-dropdown"]');
    await this.page.click(`[data-segment="${segment}"]`);
    await this.waitForMetricsLoad();
  }

  async switchToHeatMapView() {
    await this.page.click('[data-testid="view-selector"]');
    await this.page.click('[data-view="heatmap"]');
    await this.page.waitForSelector('.usage-heatmap', { state: 'visible' });
  }

  async switchToTrendsView() {
    await this.page.click('[data-testid="view-selector"]');
    await this.page.click('[data-view="trends"]');
    await this.page.waitForSelector('[data-testid="trends-container"]', { state: 'visible' });
  }

  async exportData(format: 'csv' | 'json' | 'pdf') {
    await this.page.click('[data-testid="export-button"]');
    await this.page.click(`[data-export-format="${format}"]`);
    
    // For PDF, wait for generation
    if (format === 'pdf') {
      await this.page.waitForSelector('.pdf-generation-progress', { state: 'hidden', timeout: 30000 });
    }
  }

  async openScheduleDialog() {
    await this.page.click('[data-testid="schedule-report-button"]');
    await this.page.waitForSelector('[data-testid="schedule-dialog"]', { state: 'visible' });
  }

  private async extractNumberFromSection(section: Locator, metricId: string): Promise<number> {
    const element = await section.locator(`[data-metric="${metricId}"]`);
    const text = await element.textContent();
    if (!text) return 0;
    
    // Extract number from text (handles various formats like "95%", "$0.001", "1,234")
    const numStr = text.replace(/[$,%]/g, '').replace(/,/g, '');
    return parseFloat(numStr) || 0;
  }
}