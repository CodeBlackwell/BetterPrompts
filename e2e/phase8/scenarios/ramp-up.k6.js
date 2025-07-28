import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { enhancePrompt, authenticate, testPrompts, testUsers, metrics, API_BASE } from './shared-utils.js';

// Ramp-up test scenario configuration
export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // Warm-up: 0→100 users
        { duration: '3m', target: 500 },   // Ramp-up: 100→500 users
        { duration: '3m', target: 1000 },  // Peak: 500→1000 users
        { duration: '5m', target: 1000 },  // Sustain peak load
        { duration: '2m', target: 0 }      // Cool-down: 1000→0 users
      ],
      gracefulRampDown: '30s'
    }
  },
  
  thresholds: {
    // Response time should degrade linearly with load
    http_req_duration: [
      'p(50)<150',   // Median should stay under 150ms
      'p(95)<300',   // p95 should stay under 300ms even at peak
      'p(99)<600'    // p99 should stay under 600ms
    ],
    
    // Error rate should remain low throughout
    http_req_failed: ['rate<0.01'],
    
    // System should handle the load
    http_reqs: ['count>50000'],  // Should process at least 50k requests
    
    // Check for linear degradation
    checks: ['rate>0.95']  // 95% of checks should pass
  },
  
  tags: {
    test_type: 'ramp_up',
    test_name: 'Linear Load Increase Test'
  }
};

// Track performance degradation
let baselineLatency = null;
let peakLatency = null;

export default function () {
  const user = randomItem(testUsers);
  const currentVUs = __VU;
  
  // Authenticate periodically (every 10th iteration)
  let token = null;
  if (__ITER % 10 === 0) {
    const auth = authenticate(user);
    token = auth ? auth.token : null;
  }
  
  // Main test flow
  const prompt = randomItem(testPrompts);
  const startTime = Date.now();
  
  const result = enhancePrompt(token, prompt);
  const latency = Date.now() - startTime;
  
  // Track baseline and peak latencies
  if (currentVUs < 10 && !baselineLatency) {
    baselineLatency = latency;
  }
  if (currentVUs > 900) {
    peakLatency = latency;
  }
  
  // Check for linear degradation
  const degradationFactor = currentVUs / 100; // Expected degradation
  const expectedLatency = baselineLatency ? baselineLatency * (1 + degradationFactor * 0.1) : 200;
  
  check(result, {
    'response successful': (r) => r === true,
    'latency acceptable': () => latency < expectedLatency * 1.5,
    'no catastrophic degradation': () => latency < 1000
  });
  
  // Gradually increase think time as load increases
  const thinkTime = 1 + (currentVUs / 1000) * 2; // 1-3 seconds
  sleep(thinkTime + Math.random());
}

export function teardown(data) {
  if (baselineLatency && peakLatency) {
    const degradation = ((peakLatency - baselineLatency) / baselineLatency) * 100;
    console.log(`Performance degradation from baseline to peak: ${degradation.toFixed(2)}%`);
    
    if (degradation > 200) {
      console.error('WARNING: Non-linear performance degradation detected!');
    }
  }
}

export function handleSummary(data) {
  const summary = {
    scenario: 'ramp_up',
    timestamp: new Date().toISOString(),
    results: {
      total_requests: data.metrics.http_reqs.values.count,
      error_rate: data.metrics.http_req_failed.values.rate,
      median_latency: data.metrics.http_req_duration.values['p(50)'],
      p95_latency: data.metrics.http_req_duration.values['p(95)'],
      p99_latency: data.metrics.http_req_duration.values['p(99)'],
      baseline_latency: baselineLatency,
      peak_latency: peakLatency,
      degradation_percentage: baselineLatency && peakLatency ? 
        ((peakLatency - baselineLatency) / baselineLatency) * 100 : null
    },
    thresholds_passed: Object.values(data.metrics)
      .filter(m => m.thresholds)
      .every(m => Object.values(m.thresholds).every(t => t.ok))
  };
  
  return {
    '../reports/ramp-up-summary.json': JSON.stringify(summary, null, 2)
  };
}