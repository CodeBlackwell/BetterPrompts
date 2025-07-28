import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import exec from 'k6/execution';
import ws from 'k6/ws';

// Custom metrics for comprehensive monitoring
const metrics = {
  // Application metrics
  apiErrors: new Rate('api_errors'),
  enhancementDuration: new Trend('enhancement_duration'),
  mlPipelineDuration: new Trend('ml_pipeline_duration'),
  techniqueAccuracy: new Rate('technique_accuracy'),
  
  // Infrastructure metrics
  dbConnections: new Gauge('db_connections'),
  cacheHitRate: new Rate('cache_hit_rate'),
  
  // Business metrics
  userSatisfaction: new Rate('user_satisfaction'),
  slaCompliance: new Rate('sla_compliance'),
  costPerRequest: new Trend('cost_per_request'),
  
  // Detailed endpoint metrics
  enhanceLatency: new Trend('endpoint_enhance_latency'),
  batchLatency: new Trend('endpoint_batch_latency'),
  historyLatency: new Trend('endpoint_history_latency'),
  dashboardLatency: new Trend('endpoint_dashboard_latency'),
  
  // Failure tracking
  dbErrors: new Counter('database_errors'),
  cacheErrors: new Counter('cache_errors'),
  networkErrors: new Counter('network_errors'),
  
  // Recovery metrics
  recoveryTime: new Trend('recovery_time'),
  circuitBreakerTrips: new Counter('circuit_breaker_trips')
};

// Test data
const testPrompts = new SharedArray('prompts', function () {
  return JSON.parse(open('../utils/test-prompts.json'));
});

const testUsers = new SharedArray('users', function () {
  return JSON.parse(open('../utils/test-users.json'));
});

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const API_BASE = `${BASE_URL}/api/v1`;
const WS_BASE = BASE_URL.replace('http', 'ws') + '/ws';
const K6_CLOUD_PROJECT_ID = __ENV.K6_CLOUD_PROJECT_ID;
const ENABLE_WEBSOCKET = __ENV.ENABLE_WEBSOCKET !== 'false';

// Test scenarios configuration
export const options = {
  // Scenario 1: Ramp-up test
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // 0→100 users in 2 minutes
        { duration: '3m', target: 500 },   // 100→500 users in 3 minutes
        { duration: '3m', target: 1000 },  // 500→1000 users in 3 minutes
        { duration: '5m', target: 1000 },  // Hold at 1000 for 5 minutes
        { duration: '2m', target: 0 }      // 1000→0 users in 2 minutes
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'ramp_up' }
    },
    
    // Scenario 2: Sustained load test
    sustained_load: {
      executor: 'constant-vus',
      vus: 500,
      duration: '30m',
      startTime: '16m',
      tags: { scenario: 'sustained_load' }
    },
    
    // Scenario 3: Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '30s', target: 100 },   // Baseline
        { duration: '30s', target: 1000 },  // Spike up
        { duration: '2m', target: 1000 },   // Hold spike
        { duration: '30s', target: 100 },   // Return to baseline
        { duration: '1m', target: 100 },    // Recovery period
        // Repeat 2 more times
        { duration: '30s', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '30s', target: 100 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '30s', target: 100 }
      ],
      startTime: '47m',
      tags: { scenario: 'spike_test' }
    },
    
    // Scenario 4: Geographic distribution test
    geo_distributed: {
      executor: 'constant-vus',
      vus: 300,
      duration: '15m',
      startTime: '60m',
      env: { REGION: 'multi' },
      tags: { scenario: 'geo_distributed' },
      // This requires k6 cloud with multi-region support
      cloud: {
        distribution: {
          'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 33 },
          'amazon:ie:dublin': { loadZone: 'amazon:ie:dublin', percent: 34 },
          'amazon:jp:tokyo': { loadZone: 'amazon:jp:tokyo', percent: 33 }
        }
      }
    },
    
    // Scenario 5: API mix test (realistic usage)
    api_mix: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '20m',
      preAllocatedVUs: 1200,
      maxVUs: 1500,
      startTime: '76m',
      tags: { scenario: 'api_mix' }
    },
    
    // Scenario 6: Stress test (find breaking point)
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 2000,
      maxVUs: 3000,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '2m', target: 400 },
        { duration: '2m', target: 800 },
        { duration: '2m', target: 1600 },
        { duration: '2m', target: 2000 }
      ],
      startTime: '97m',
      tags: { scenario: 'stress_test' }
    }
  },
  
  // SLA thresholds
  thresholds: {
    // Latency requirements
    http_req_duration: [
      'p(50)<100',   // p50 < 100ms
      'p(95)<200',   // p95 < 200ms
      'p(99)<500'    // p99 < 500ms
    ],
    
    // Endpoint-specific latency
    'endpoint_enhance_latency': ['p(95)<3000'],
    'endpoint_batch_latency': ['p(95)<15000'],
    'endpoint_history_latency': ['p(95)<200'],
    'endpoint_dashboard_latency': ['p(95)<500'],
    
    // Error rates
    'api_errors': ['rate<0.001'],        // < 0.1% error rate
    http_req_failed: ['rate<0.001'],
    
    // Throughput
    http_reqs: ['rate>=1000'],           // >= 1000 RPS
    
    // Business metrics
    'sla_compliance': ['rate>0.999'],    // > 99.9% SLA compliance
    'user_satisfaction': ['rate>0.87'],  // > 87% satisfaction
    
    // Infrastructure
    'cache_hit_rate': ['rate>0.9'],      // > 90% cache hit rate
    
    // Recovery
    'recovery_time': ['p(95)<300000']    // < 5 minutes recovery
  },
  
  // k6 Cloud configuration
  cloud: {
    projectID: K6_CLOUD_PROJECT_ID,
    name: 'BetterPrompts Performance Test Suite'
  },
  
  // Network configuration
  noConnectionReuse: false,
  userAgent: 'BetterPromptsLoadTest/1.0'
};

// Helper functions
function authenticate(user) {
  const startTime = Date.now();
  
  const loginRes = http.post(`${API_BASE}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'login' }
  });
  
  const duration = Date.now() - startTime;
  
  const success = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'access token received': (r) => r.json('access_token') !== undefined
  });
  
  if (!success) {
    metrics.apiErrors.add(1);
    return null;
  }
  
  metrics.apiErrors.add(0);
  return {
    token: loginRes.json('access_token'),
    userId: loginRes.json('user_id')
  };
}

function enhancePrompt(token, prompt, technique = 'auto') {
  const startTime = Date.now();
  
  const payload = {
    prompt: prompt.text,
    intent: prompt.intent,
    techniques: [technique],
    options: {
      stream: false,
      include_metadata: true
    }
  };
  
  const enhanceRes = http.post(`${API_BASE}/enhance`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : undefined
    },
    timeout: '10s',
    tags: { endpoint: 'enhance', technique: technique }
  });
  
  const duration = Date.now() - startTime;
  metrics.enhancementDuration.add(duration);
  metrics.enhanceLatency.add(duration);
  
  // Check SLA compliance
  const slaMet = duration < 3000 && enhanceRes.status === 200;
  metrics.slaCompliance.add(slaMet ? 1 : 0);
  
  if (enhanceRes.status === 200) {
    const body = enhanceRes.json();
    
    // Track ML pipeline performance
    if (body.metadata && body.metadata.ml_pipeline_ms) {
      metrics.mlPipelineDuration.add(body.metadata.ml_pipeline_ms);
    }
    
    // Track technique accuracy (simulated based on technique)
    const accuracyScore = simulateTechniqueAccuracy(technique, prompt.complexity);
    metrics.techniqueAccuracy.add(accuracyScore > 0.8 ? 1 : 0);
    
    // Track user satisfaction (simulated)
    const satisfactionScore = simulateUserSatisfaction(duration, accuracyScore);
    metrics.userSatisfaction.add(satisfactionScore > 0.7 ? 1 : 0);
    
    // Track cost (simulated)
    const cost = calculateRequestCost(body.metadata);
    metrics.costPerRequest.add(cost);
    
    metrics.apiErrors.add(0);
    return true;
  }
  
  // Track error types
  if (enhanceRes.status >= 500) {
    metrics.dbErrors.add(1);
  } else if (enhanceRes.status === 503) {
    metrics.circuitBreakerTrips.add(1);
  }
  
  metrics.apiErrors.add(1);
  return false;
}

function testBatchEnhancement(token) {
  const batchSize = randomIntBetween(5, 10);
  const prompts = [];
  
  for (let i = 0; i < batchSize; i++) {
    prompts.push(randomItem(testPrompts));
  }
  
  const startTime = Date.now();
  
  const batchRes = http.post(`${API_BASE}/enhance/batch`, JSON.stringify({
    prompts: prompts.map(p => ({
      id: `batch-${Date.now()}-${i}`,
      prompt: p.text,
      intent: p.intent,
      techniques: ['auto']
    }))
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    timeout: '30s',
    tags: { endpoint: 'batch', batch_size: batchSize }
  });
  
  const duration = Date.now() - startTime;
  metrics.batchLatency.add(duration);
  
  const success = check(batchRes, {
    'batch successful': (r) => r.status === 200,
    'all prompts processed': (r) => r.json('results') && r.json('results').length === batchSize
  });
  
  metrics.apiErrors.add(success ? 0 : 1);
  metrics.slaCompliance.add(duration < (3000 * batchSize) ? 1 : 0);
  
  return success;
}

function testHistory(token) {
  const startTime = Date.now();
  
  const historyRes = http.get(`${API_BASE}/history`, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    params: {
      limit: 20,
      include_metadata: true
    },
    tags: { endpoint: 'history' }
  });
  
  const duration = Date.now() - startTime;
  metrics.historyLatency.add(duration);
  
  const success = check(historyRes, {
    'history retrieved': (r) => r.status === 200,
    'has items': (r) => r.json('items') && r.json('items').length > 0
  });
  
  metrics.apiErrors.add(success ? 0 : 1);
  metrics.slaCompliance.add(duration < 200 ? 1 : 0);
  
  // Simulate cache behavior
  if (success && historyRes.headers['X-Cache-Status']) {
    const cacheHit = historyRes.headers['X-Cache-Status'] === 'HIT';
    metrics.cacheHitRate.add(cacheHit ? 1 : 0);
  }
  
  return success;
}

function testDashboardMetrics(token) {
  const startTime = Date.now();
  
  // Test multiple dashboard endpoints
  const endpoints = [
    '/metrics/overview',
    '/metrics/techniques',
    '/metrics/performance',
    '/metrics/usage'
  ];
  
  let allSuccess = true;
  
  endpoints.forEach(endpoint => {
    const res = http.get(`${API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      tags: { endpoint: 'dashboard', metric_type: endpoint }
    });
    
    const success = res.status === 200;
    allSuccess = allSuccess && success;
    
    if (!success) {
      metrics.apiErrors.add(1);
    }
  });
  
  const duration = Date.now() - startTime;
  metrics.dashboardLatency.add(duration);
  metrics.slaCompliance.add(duration < 500 ? 1 : 0);
  
  return allSuccess;
}

function testWebSocketMetrics(token, userId) {
  if (!ENABLE_WEBSOCKET) return;
  
  const url = `${WS_BASE}/metrics?token=${token}`;
  
  const res = ws.connect(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, function (socket) {
    socket.on('open', () => {
      // Subscribe to metrics
      socket.send(JSON.stringify({
        type: 'subscribe',
        channels: ['performance', 'usage', 'technique_stats']
      }));
    });
    
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      
      // Validate real-time updates
      if (message.type === 'metric_update') {
        check(message, {
          'has timestamp': (m) => m.timestamp !== undefined,
          'has metric data': (m) => m.data !== undefined,
          'update interval < 6s': (m) => {
            const now = Date.now();
            const msgTime = new Date(m.timestamp).getTime();
            return (now - msgTime) < 6000;
          }
        });
      }
    });
    
    // Keep connection open for 30 seconds
    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });
  
  check(res, {
    'websocket connected': (r) => r && r.status === 101
  });
}

// Utility functions
function simulateTechniqueAccuracy(technique, complexity) {
  // Simulate accuracy based on technique and prompt complexity
  const baseAccuracy = {
    'chain_of_thought': 0.92,
    'few_shot': 0.89,
    'role_playing': 0.87,
    'structured_output': 0.91,
    'tree_of_thoughts': 0.85,
    'self_consistency': 0.88,
    'emotional_appeal': 0.82,
    'analogical_reasoning': 0.84,
    'auto': 0.87
  };
  
  const accuracy = baseAccuracy[technique] || 0.85;
  const complexityPenalty = complexity === 'high' ? 0.05 : complexity === 'medium' ? 0.02 : 0;
  
  return Math.max(0, accuracy - complexityPenalty + (Math.random() * 0.1 - 0.05));
}

function simulateUserSatisfaction(responseTime, accuracy) {
  let satisfaction = 1.0;
  
  // Penalize for slow response
  if (responseTime > 3000) satisfaction -= 0.3;
  else if (responseTime > 2000) satisfaction -= 0.15;
  else if (responseTime > 1000) satisfaction -= 0.05;
  
  // Penalize for low accuracy
  if (accuracy < 0.8) satisfaction -= 0.2;
  else if (accuracy < 0.85) satisfaction -= 0.1;
  
  // Add some randomness
  satisfaction += (Math.random() * 0.1 - 0.05);
  
  return Math.max(0, Math.min(1, satisfaction));
}

function calculateRequestCost(metadata) {
  // Simulate cost calculation
  const baseCost = 0.001; // $0.001 per request
  const mlCost = metadata && metadata.ml_pipeline_ms ? metadata.ml_pipeline_ms * 0.000001 : 0;
  const cacheSavings = metadata && metadata.cache_hit ? 0.0005 : 0;
  
  return baseCost + mlCost - cacheSavings;
}

function simulateFailureScenario() {
  const scenario = __EXEC.scenario.name;
  const vu = __VU;
  const iter = __ITER;
  
  // Simulate different failure scenarios based on test progress
  if (scenario === 'stress_test' && iter > 100) {
    // Simulate database connection pool exhaustion
    if (Math.random() < 0.1) {
      metrics.dbErrors.add(1);
      sleep(randomIntBetween(1, 5));
    }
    
    // Simulate cache failures
    if (Math.random() < 0.05) {
      metrics.cacheErrors.add(1);
    }
  }
  
  // Simulate network issues in geo-distributed tests
  if (scenario === 'geo_distributed' && Math.random() < 0.02) {
    metrics.networkErrors.add(1);
    sleep(randomIntBetween(0.5, 2));
  }
}

// Main test function
export default function () {
  const scenario = __EXEC.scenario.name;
  const user = randomItem(testUsers);
  
  // Authenticate
  const auth = authenticate(user);
  if (!auth && scenario !== 'stress_test') {
    console.error(`Auth failed for user ${user.email}`);
    return;
  }
  
  const token = auth ? auth.token : null;
  const userId = auth ? auth.userId : null;
  
  // Simulate failure scenarios
  simulateFailureScenario();
  
  // API Mix based on scenario
  if (scenario === 'api_mix') {
    // Realistic usage pattern: 70% enhance, 20% batch, 10% history
    const rand = Math.random();
    
    if (rand < 0.7) {
      // Single enhancement
      const prompt = randomItem(testPrompts);
      const technique = Math.random() < 0.8 ? 'auto' : randomItem([
        'chain_of_thought', 'few_shot', 'role_playing', 'structured_output'
      ]);
      enhancePrompt(token, prompt, technique);
    } else if (rand < 0.9) {
      // Batch enhancement
      if (token) {
        testBatchEnhancement(token);
      }
    } else {
      // History retrieval
      if (token) {
        testHistory(token);
      }
    }
    
    // Dashboard metrics (5% of requests)
    if (token && Math.random() < 0.05) {
      testDashboardMetrics(token);
    }
    
    // WebSocket metrics (2% of requests)
    if (token && Math.random() < 0.02) {
      testWebSocketMetrics(token, userId);
    }
  } else {
    // Standard test flow for other scenarios
    group('Enhancement Tests', () => {
      for (let i = 0; i < 3; i++) {
        const prompt = randomItem(testPrompts);
        enhancePrompt(token, prompt);
        sleep(randomIntBetween(1, 3));
      }
    });
    
    if (token) {
      group('Authenticated Features', () => {
        // Batch processing
        if (Math.random() < 0.3) {
          testBatchEnhancement(token);
          sleep(randomIntBetween(2, 5));
        }
        
        // History
        if (Math.random() < 0.2) {
          testHistory(token);
          sleep(1);
        }
        
        // Dashboard
        if (Math.random() < 0.1) {
          testDashboardMetrics(token);
          sleep(2);
        }
      });
    }
  }
  
  // Think time between iterations
  sleep(randomIntBetween(0.5, 2));
}

// Setup function
export function setup() {
  console.log('Setting up performance test suite...');
  
  // Verify API health
  const healthCheck = http.get(`${API_BASE}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('API health check failed');
  }
  
  // Initialize monitoring
  if (ENABLE_WEBSOCKET) {
    console.log('WebSocket monitoring enabled');
  }
  
  return {
    startTime: Date.now(),
    testConfig: {
      baseUrl: BASE_URL,
      enableWebSocket: ENABLE_WEBSOCKET,
      scenarios: Object.keys(options.scenarios)
    }
  };
}

// Teardown function
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`Test suite completed in ${duration.toFixed(2)} minutes`);
  console.log(`Scenarios executed: ${data.testConfig.scenarios.join(', ')}`);
}

// Custom summary handler
export function handleSummary(data) {
  const timestamp = new Date().toISOString();
  const summaryData = {
    timestamp,
    duration: data.state.testRunDurationMs,
    scenarios: data.root_group.groups,
    metrics: data.metrics,
    thresholds: {},
    slaCompliance: {}
  };
  
  // Calculate SLA compliance
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.thresholds) {
      summaryData.thresholds[name] = metric.thresholds;
      const passed = Object.values(metric.thresholds).every(t => t.ok);
      summaryData.slaCompliance[name] = passed;
    }
  });
  
  // Generate reports
  return {
    '../reports/performance-summary.json': JSON.stringify(summaryData, null, 2),
    '../reports/performance-report.html': htmlReport(summaryData),
    'stdout': textSummary(data)
  };
}

function textSummary(data) {
  let summary = '\n' + '='.repeat(80) + '\n';
  summary += '                    BetterPrompts Performance Test Results\n';
  summary += '='.repeat(80) + '\n\n';
  
  // Overall results
  const overallPassed = Object.values(data.metrics)
    .filter(m => m.thresholds)
    .every(m => Object.values(m.thresholds).every(t => t.ok));
  
  summary += `Overall Result: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
  
  // Key metrics
  summary += 'Key Performance Indicators:\n';
  summary += '-'.repeat(40) + '\n';
  
  if (data.metrics.http_req_duration) {
    const p50 = data.metrics.http_req_duration.values['p(50)'];
    const p95 = data.metrics.http_req_duration.values['p(95)'];
    const p99 = data.metrics.http_req_duration.values['p(99)'];
    summary += `Response Time:  p50=${p50}ms, p95=${p95}ms, p99=${p99}ms\n`;
  }
  
  if (data.metrics.http_reqs) {
    summary += `Throughput:     ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s\n`;
  }
  
  if (data.metrics.api_errors) {
    summary += `Error Rate:     ${(data.metrics.api_errors.values.rate * 100).toFixed(3)}%\n`;
  }
  
  if (data.metrics.sla_compliance) {
    summary += `SLA Compliance: ${(data.metrics.sla_compliance.values.rate * 100).toFixed(2)}%\n`;
  }
  
  summary += '\n';
  
  // Endpoint performance
  summary += 'Endpoint Performance:\n';
  summary += '-'.repeat(40) + '\n';
  
  ['enhance', 'batch', 'history', 'dashboard'].forEach(endpoint => {
    const metric = data.metrics[`endpoint_${endpoint}_latency`];
    if (metric) {
      const p95 = metric.values['p(95)'];
      summary += `${endpoint.padEnd(12)} p95: ${p95}ms\n`;
    }
  });
  
  summary += '\n';
  
  // Business metrics
  summary += 'Business Metrics:\n';
  summary += '-'.repeat(40) + '\n';
  
  if (data.metrics.user_satisfaction) {
    summary += `User Satisfaction: ${(data.metrics.user_satisfaction.values.rate * 100).toFixed(1)}%\n`;
  }
  
  if (data.metrics.technique_accuracy) {
    summary += `Technique Accuracy: ${(data.metrics.technique_accuracy.values.rate * 100).toFixed(1)}%\n`;
  }
  
  if (data.metrics.cost_per_request) {
    summary += `Avg Cost/Request: $${data.metrics.cost_per_request.values.avg.toFixed(6)}\n`;
  }
  
  summary += '\n';
  
  // Infrastructure health
  summary += 'Infrastructure Health:\n';
  summary += '-'.repeat(40) + '\n';
  
  if (data.metrics.cache_hit_rate) {
    summary += `Cache Hit Rate: ${(data.metrics.cache_hit_rate.values.rate * 100).toFixed(1)}%\n`;
  }
  
  if (data.metrics.database_errors) {
    summary += `Database Errors: ${data.metrics.database_errors.values.count}\n`;
  }
  
  if (data.metrics.circuit_breaker_trips) {
    summary += `Circuit Breaker Trips: ${data.metrics.circuit_breaker_trips.values.count}\n`;
  }
  
  summary += '\n';
  
  // Threshold results
  summary += 'SLA Threshold Results:\n';
  summary += '-'.repeat(40) + '\n';
  
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.thresholds) {
      const passed = Object.values(metric.thresholds).every(t => t.ok);
      summary += `${name.padEnd(30)} ${passed ? '✅ PASS' : '❌ FAIL'}\n`;
      
      if (!passed) {
        Object.entries(metric.thresholds).forEach(([threshold, result]) => {
          if (!result.ok) {
            summary += `  └─ ${threshold}: ${result.gotValue} (expected: ${threshold})\n`;
          }
        });
      }
    }
  });
  
  summary += '\n' + '='.repeat(80) + '\n';
  
  return summary;
}

function htmlReport(data) {
  // Generate HTML report with charts and detailed metrics
  // This is a simplified version - in production, use a proper templating engine
  return `
<!DOCTYPE html>
<html>
<head>
  <title>BetterPrompts Performance Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
    .metric { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .pass { color: green; }
    .fail { color: red; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <div class="header">
    <h1>BetterPrompts Performance Test Report</h1>
    <p>Generated: ${data.timestamp}</p>
    <p>Duration: ${(data.duration / 1000 / 60).toFixed(2)} minutes</p>
  </div>
  
  <div class="metric">
    <h2>Overall Result: <span class="${data.slaCompliance.http_req_duration ? 'pass' : 'fail'}">
      ${data.slaCompliance.http_req_duration ? 'PASSED' : 'FAILED'}
    </span></h2>
  </div>
  
  <div class="metric">
    <h2>Key Performance Indicators</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Value</th>
        <th>Target</th>
        <th>Status</th>
      </tr>
      ${generateMetricRows(data)}
    </table>
  </div>
  
  <div class="metric">
    <h2>Scenario Results</h2>
    ${generateScenarioResults(data)}
  </div>
  
  <script>
    // Add interactive charts here using Chart.js or similar
  </script>
</body>
</html>
  `;
}

function generateMetricRows(data) {
  // Helper function to generate table rows for metrics
  let rows = '';
  
  // Add rows for each key metric
  if (data.metrics.http_req_duration) {
    rows += `
      <tr>
        <td>Response Time (p95)</td>
        <td>${data.metrics.http_req_duration.values['p(95)']}ms</td>
        <td>&lt; 200ms</td>
        <td class="${data.slaCompliance.http_req_duration ? 'pass' : 'fail'}">
          ${data.slaCompliance.http_req_duration ? 'PASS' : 'FAIL'}
        </td>
      </tr>
    `;
  }
  
  return rows;
}

function generateScenarioResults(data) {
  // Helper function to generate scenario results
  let html = '<ul>';
  
  Object.entries(data.scenarios).forEach(([name, scenario]) => {
    html += `<li><strong>${name}</strong>: ${scenario.passes} passed, ${scenario.fails} failed</li>`;
  });
  
  html += '</ul>';
  return html;
}