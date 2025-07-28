import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { 
  enhancePrompt, authenticate, testBatchEnhancement, testHistory,
  testPrompts, testUsers, metrics, API_BASE, generateSummaryReport 
} from './shared-utils.js';

// Sustained load test - validate system stability over extended period
export const options = {
  scenarios: {
    sustained_load: {
      executor: 'constant-vus',
      vus: 500,
      duration: '30m',
      preAllocatedVUs: 500,
      maxVUs: 600  // Allow some buffer
    }
  },
  
  thresholds: {
    // Performance should remain stable
    http_req_duration: [
      'p(95)<300',      // p95 consistently under 300ms
      'p(99)<500',      // p99 consistently under 500ms
      'avg<200',        // Average under 200ms
      'med<150'         // Median under 150ms
    ],
    
    // No performance degradation over time
    'enhancement_duration': [
      'p(95)<3000',     // Enhancement p95 under 3s
      'avg<2000'        // Average enhancement under 2s
    ],
    
    // Error rate should stay low
    'api_errors': ['rate<0.001'],
    http_req_failed: ['rate<0.001'],
    
    // System resources should be stable
    'database_errors': ['count<50'],     // Less than 50 DB errors total
    'cache_errors': ['count<20'],        // Less than 20 cache errors
    'circuit_breaker_trips': ['count<5'], // Less than 5 circuit breaker trips
    
    // Business metrics
    'sla_compliance': ['rate>0.999'],
    'user_satisfaction': ['rate>0.87'],
    'cache_hit_rate': ['rate>0.9']
  },
  
  tags: {
    test_type: 'sustained_load',
    test_name: '30-Minute Stability Test'
  }
};

// Track performance over time
const performanceWindows = {
  first5min: { latencies: [], errors: 0 },
  middle20min: { latencies: [], errors: 0 },
  last5min: { latencies: [], errors: 0 }
};

export default function () {
  const user = randomItem(testUsers);
  const timeElapsed = __VU * __ITER / 1000; // Rough time estimate
  
  // Determine which time window we're in
  let currentWindow;
  if (timeElapsed < 5 * 60) {
    currentWindow = performanceWindows.first5min;
  } else if (timeElapsed < 25 * 60) {
    currentWindow = performanceWindows.middle20min;
  } else {
    currentWindow = performanceWindows.last5min;
  }
  
  // Authenticate every 50 iterations
  let token = null;
  if (__ITER % 50 === 0) {
    const auth = authenticate(user);
    token = auth ? auth.token : null;
  }
  
  // Mixed workload to simulate real usage
  const workloadType = Math.random();
  let success = false;
  let latency = 0;
  
  if (workloadType < 0.7) {
    // 70% - Single prompt enhancement
    const prompt = randomItem(testPrompts);
    const startTime = Date.now();
    success = enhancePrompt(token, prompt);
    latency = Date.now() - startTime;
    currentWindow.latencies.push(latency);
    
    check(success, {
      'single enhancement successful': (s) => s === true,
      'single enhancement fast': () => latency < 3000
    });
    
  } else if (workloadType < 0.85 && token) {
    // 15% - Batch enhancement (authenticated only)
    const batchSize = randomIntBetween(3, 7);
    const prompts = [];
    for (let i = 0; i < batchSize; i++) {
      prompts.push(randomItem(testPrompts));
    }
    
    const startTime = Date.now();
    success = testBatchEnhancement(token, prompts);
    latency = Date.now() - startTime;
    
    check(success, {
      'batch enhancement successful': (s) => s === true,
      'batch enhancement reasonable': () => latency < (3000 * batchSize)
    });
    
  } else if (workloadType < 0.95 && token) {
    // 10% - History retrieval (authenticated only)
    const startTime = Date.now();
    success = testHistory(token);
    latency = Date.now() - startTime;
    
    check(success, {
      'history retrieval successful': (s) => s === true,
      'history retrieval fast': () => latency < 200
    });
    
  } else {
    // 5% - Anonymous enhancement
    const prompt = randomItem(testPrompts);
    const startTime = Date.now();
    success = enhancePrompt(null, prompt);
    latency = Date.now() - startTime;
    
    check(success, {
      'anonymous enhancement allowed': (s) => s === true
    });
  }
  
  if (!success) {
    currentWindow.errors++;
  }
  
  // Check for memory leaks or performance degradation
  if (__ITER % 1000 === 0) {
    const avgLatency = currentWindow.latencies.reduce((a, b) => a + b, 0) / 
                       currentWindow.latencies.length;
    
    check(avgLatency, {
      'no performance degradation': (avg) => avg < 300,
      'stable performance': (avg) => avg < 500
    });
  }
  
  // Realistic think time
  sleep(randomIntBetween(1, 3) + Math.random());
}

export function teardown(data) {
  // Calculate performance degradation
  const firstAvg = performanceWindows.first5min.latencies.length > 0 ?
    performanceWindows.first5min.latencies.reduce((a, b) => a + b, 0) / 
    performanceWindows.first5min.latencies.length : 0;
    
  const lastAvg = performanceWindows.last5min.latencies.length > 0 ?
    performanceWindows.last5min.latencies.reduce((a, b) => a + b, 0) / 
    performanceWindows.last5min.latencies.length : 0;
  
  const degradation = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;
  
  console.log('\n=== Sustained Load Test Results ===');
  console.log(`First 5 min avg latency: ${firstAvg.toFixed(2)}ms`);
  console.log(`Last 5 min avg latency: ${lastAvg.toFixed(2)}ms`);
  console.log(`Performance degradation: ${degradation.toFixed(2)}%`);
  
  if (Math.abs(degradation) > 10) {
    console.error('WARNING: Significant performance change detected!');
  }
  
  // Check error trends
  const totalErrors = Object.values(performanceWindows)
    .reduce((sum, window) => sum + window.errors, 0);
  console.log(`Total errors across test: ${totalErrors}`);
}

export function handleSummary(data) {
  const summary = generateSummaryReport(data, 'sustained_load');
  
  // Add sustained load specific metrics
  summary.stability_metrics = {
    first_5min: {
      avg_latency: performanceWindows.first5min.latencies.length > 0 ?
        performanceWindows.first5min.latencies.reduce((a, b) => a + b, 0) / 
        performanceWindows.first5min.latencies.length : 0,
      errors: performanceWindows.first5min.errors
    },
    middle_20min: {
      avg_latency: performanceWindows.middle20min.latencies.length > 0 ?
        performanceWindows.middle20min.latencies.reduce((a, b) => a + b, 0) / 
        performanceWindows.middle20min.latencies.length : 0,
      errors: performanceWindows.middle20min.errors
    },
    last_5min: {
      avg_latency: performanceWindows.last5min.latencies.length > 0 ?
        performanceWindows.last5min.latencies.reduce((a, b) => a + b, 0) / 
        performanceWindows.last5min.latencies.length : 0,
      errors: performanceWindows.last5min.errors
    }
  };
  
  // Calculate degradation
  const firstAvg = summary.stability_metrics.first_5min.avg_latency;
  const lastAvg = summary.stability_metrics.last_5min.avg_latency;
  summary.stability_metrics.performance_degradation = 
    firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;
  
  // Memory leak detection (simulated based on degradation)
  summary.stability_metrics.memory_leak_suspected = 
    Math.abs(summary.stability_metrics.performance_degradation) > 10;
  
  return {
    '../reports/sustained-load-summary.json': JSON.stringify(summary, null, 2),
    'stdout': generateTextReport(summary)
  };
}

function generateTextReport(summary) {
  let report = '\n' + '='.repeat(60) + '\n';
  report += '         Sustained Load Test Report\n';
  report += '='.repeat(60) + '\n\n';
  
  report += `Duration: 30 minutes\n`;
  report += `Virtual Users: 500 constant\n`;
  report += `Total Requests: ${summary.metrics.requests.total}\n`;
  report += `Request Rate: ${summary.metrics.requests.rate.toFixed(2)} req/s\n\n`;
  
  report += 'Performance Stability:\n';
  report += '-'.repeat(30) + '\n';
  report += `First 5 min avg: ${summary.stability_metrics.first_5min.avg_latency.toFixed(2)}ms\n`;
  report += `Middle 20 min avg: ${summary.stability_metrics.middle_20min.avg_latency.toFixed(2)}ms\n`;
  report += `Last 5 min avg: ${summary.stability_metrics.last_5min.avg_latency.toFixed(2)}ms\n`;
  report += `Degradation: ${summary.stability_metrics.performance_degradation.toFixed(2)}%\n`;
  report += `Memory leak suspected: ${summary.stability_metrics.memory_leak_suspected ? 'YES' : 'NO'}\n\n`;
  
  report += 'Error Analysis:\n';
  report += '-'.repeat(30) + '\n';
  report += `Error rate: ${(summary.metrics.requests.error_rate * 100).toFixed(3)}%\n`;
  report += `Database errors: ${summary.metrics.infrastructure.database_errors}\n`;
  report += `Cache errors: ${summary.metrics.infrastructure.cache_errors}\n`;
  report += `Circuit breaker trips: ${summary.metrics.infrastructure.circuit_breaker_trips}\n\n`;
  
  report += 'SLA Compliance:\n';
  report += '-'.repeat(30) + '\n';
  report += `Overall SLA: ${(summary.metrics.business.sla_compliance * 100).toFixed(2)}%\n`;
  report += `User satisfaction: ${(summary.metrics.business.user_satisfaction * 100).toFixed(1)}%\n`;
  report += `Cache hit rate: ${(summary.metrics.infrastructure.cache_hit_rate * 100).toFixed(1)}%\n\n`;
  
  report += `Overall Result: ${summary.overall_passed ? '✅ PASSED' : '❌ FAILED'}\n`;
  report += '='.repeat(60) + '\n';
  
  return report;
}