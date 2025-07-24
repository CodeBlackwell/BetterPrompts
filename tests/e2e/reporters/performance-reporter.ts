import {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  Suite,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceMetrics {
  testName: string;
  duration: number;
  steps: Array<{
    name: string;
    duration: number;
  }>;
  memory?: {
    start: number;
    end: number;
    peak: number;
  };
  enhancementTimes?: number[];
  apiResponseTimes?: number[];
  errors: string[];
}

export default class PerformanceReporter implements Reporter {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'test-results', 'performance');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  onTestBegin(test: TestCase) {
    this.metrics.set(test.id, {
      testName: test.title,
      duration: 0,
      steps: [],
      errors: [],
    });
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const metrics = this.metrics.get(test.id);
    if (!metrics) return;

    metrics.duration = result.duration;

    // Extract performance data from test annotations
    const performanceData = result.attachments.find(
      (a) => a.name === 'performance-data'
    );

    if (performanceData && performanceData.body) {
      try {
        const data = JSON.parse(performanceData.body.toString());
        Object.assign(metrics, data);
      } catch (error) {
        console.error('Failed to parse performance data:', error);
      }
    }

    // Extract step durations
    if (result.steps) {
      metrics.steps = result.steps.map((step) => ({
        name: step.title,
        duration: step.duration || 0,
      }));
    }

    // Extract errors
    if (result.errors.length > 0) {
      metrics.errors = result.errors.map((e) => e.message || e.toString());
    }

    // Save individual test metrics
    this.saveMetrics(test.id, metrics);
  }

  onEnd(result: FullResult) {
    // Generate aggregate report
    const allMetrics = Array.from(this.metrics.values());
    
    const report = {
      summary: {
        totalTests: allMetrics.length,
        averageDuration: this.calculateAverage(allMetrics.map((m) => m.duration)),
        totalDuration: allMetrics.reduce((sum, m) => sum + m.duration, 0),
        timestamp: new Date().toISOString(),
      },
      enhancementPerformance: this.calculateEnhancementMetrics(allMetrics),
      apiPerformance: this.calculateApiMetrics(allMetrics),
      memoryUsage: this.calculateMemoryMetrics(allMetrics),
      slowestTests: this.getSlowTests(allMetrics, 5),
      testsByDuration: this.groupTestsByDuration(allMetrics),
    };

    // Save aggregate report
    fs.writeFileSync(
      path.join(this.outputDir, 'performance-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate markdown report
    this.generateMarkdownReport(report);

    // Print summary to console
    console.log('\n📊 Performance Report Summary:');
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   Average Duration: ${report.summary.averageDuration.toFixed(0)}ms`);
    console.log(`   Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
    
    if (report.enhancementPerformance.count > 0) {
      console.log('\n   Enhancement Performance:');
      console.log(`     Average: ${report.enhancementPerformance.average.toFixed(0)}ms`);
      console.log(`     P95: ${report.enhancementPerformance.p95.toFixed(0)}ms`);
    }
  }

  private saveMetrics(testId: string, metrics: PerformanceMetrics) {
    const filename = `${testId.replace(/[^a-z0-9]/gi, '-')}.json`;
    fs.writeFileSync(
      path.join(this.outputDir, filename),
      JSON.stringify(metrics, null, 2)
    );
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private calculateEnhancementMetrics(allMetrics: PerformanceMetrics[]) {
    const allTimes: number[] = [];
    
    for (const metric of allMetrics) {
      if (metric.enhancementTimes) {
        allTimes.push(...metric.enhancementTimes);
      }
    }

    if (allTimes.length === 0) {
      return { count: 0, average: 0, p95: 0, min: 0, max: 0 };
    }

    allTimes.sort((a, b) => a - b);

    return {
      count: allTimes.length,
      average: this.calculateAverage(allTimes),
      p95: allTimes[Math.floor(allTimes.length * 0.95)],
      min: allTimes[0],
      max: allTimes[allTimes.length - 1],
    };
  }

  private calculateApiMetrics(allMetrics: PerformanceMetrics[]) {
    const allTimes: number[] = [];
    
    for (const metric of allMetrics) {
      if (metric.apiResponseTimes) {
        allTimes.push(...metric.apiResponseTimes);
      }
    }

    if (allTimes.length === 0) {
      return { count: 0, average: 0, p95: 0, min: 0, max: 0 };
    }

    allTimes.sort((a, b) => a - b);

    return {
      count: allTimes.length,
      average: this.calculateAverage(allTimes),
      p95: allTimes[Math.floor(allTimes.length * 0.95)],
      min: allTimes[0],
      max: allTimes[allTimes.length - 1],
    };
  }

  private calculateMemoryMetrics(allMetrics: PerformanceMetrics[]) {
    const memoryData = allMetrics
      .filter((m) => m.memory)
      .map((m) => m.memory!);

    if (memoryData.length === 0) {
      return null;
    }

    return {
      averageStart: this.calculateAverage(memoryData.map((m) => m.start)),
      averageEnd: this.calculateAverage(memoryData.map((m) => m.end)),
      averagePeak: this.calculateAverage(memoryData.map((m) => m.peak)),
      maxPeak: Math.max(...memoryData.map((m) => m.peak)),
    };
  }

  private getSlowTests(allMetrics: PerformanceMetrics[], count: number) {
    return allMetrics
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count)
      .map((m) => ({
        name: m.testName,
        duration: m.duration,
        steps: m.steps.length,
      }));
  }

  private groupTestsByDuration(allMetrics: PerformanceMetrics[]) {
    const groups = {
      fast: 0, // < 1s
      medium: 0, // 1s - 5s
      slow: 0, // 5s - 15s
      verySlow: 0, // > 15s
    };

    for (const metric of allMetrics) {
      if (metric.duration < 1000) {
        groups.fast++;
      } else if (metric.duration < 5000) {
        groups.medium++;
      } else if (metric.duration < 15000) {
        groups.slow++;
      } else {
        groups.verySlow++;
      }
    }

    return groups;
  }

  private generateMarkdownReport(report: any) {
    const markdown = `# Performance Test Report

Generated: ${report.summary.timestamp}

## Summary

- **Total Tests**: ${report.summary.totalTests}
- **Average Duration**: ${report.summary.averageDuration.toFixed(0)}ms
- **Total Duration**: ${(report.summary.totalDuration / 1000).toFixed(2)}s

## Enhancement Performance

${report.enhancementPerformance.count > 0 ? `
- **Total Enhancements**: ${report.enhancementPerformance.count}
- **Average Time**: ${report.enhancementPerformance.average.toFixed(0)}ms
- **P95**: ${report.enhancementPerformance.p95.toFixed(0)}ms
- **Min**: ${report.enhancementPerformance.min.toFixed(0)}ms
- **Max**: ${report.enhancementPerformance.max.toFixed(0)}ms
` : 'No enhancement data collected'}

## API Performance

${report.apiPerformance.count > 0 ? `
- **Total API Calls**: ${report.apiPerformance.count}
- **Average Response Time**: ${report.apiPerformance.average.toFixed(0)}ms
- **P95**: ${report.apiPerformance.p95.toFixed(0)}ms
- **Min**: ${report.apiPerformance.min.toFixed(0)}ms
- **Max**: ${report.apiPerformance.max.toFixed(0)}ms
` : 'No API performance data collected'}

## Test Duration Distribution

- **Fast (<1s)**: ${report.testsByDuration.fast}
- **Medium (1-5s)**: ${report.testsByDuration.medium}
- **Slow (5-15s)**: ${report.testsByDuration.slow}
- **Very Slow (>15s)**: ${report.testsByDuration.verySlow}

## Slowest Tests

| Test Name | Duration | Steps |
|-----------|----------|-------|
${report.slowestTests
  .map((t: any) => `| ${t.name} | ${(t.duration / 1000).toFixed(2)}s | ${t.steps} |`)
  .join('\n')}

${report.memoryUsage ? `
## Memory Usage

- **Average Start**: ${(report.memoryUsage.averageStart / 1024 / 1024).toFixed(2)} MB
- **Average End**: ${(report.memoryUsage.averageEnd / 1024 / 1024).toFixed(2)} MB
- **Average Peak**: ${(report.memoryUsage.averagePeak / 1024 / 1024).toFixed(2)} MB
- **Max Peak**: ${(report.memoryUsage.maxPeak / 1024 / 1024).toFixed(2)} MB
` : ''}
`;

    fs.writeFileSync(
      path.join(this.outputDir, 'performance-report.md'),
      markdown
    );
  }
}