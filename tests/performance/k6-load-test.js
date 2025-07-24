"""
Load and performance testing scripts for BetterPrompts using K6.
Tests API performance, ML pipeline latency, and concurrent user scenarios.
"""

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const apiErrorRate = new Rate('api_errors');
const enhancementDuration = new Trend('enhancement_duration');
const mlPipelineDuration = new Trend('ml_pipeline_duration');
const authDuration = new Trend('auth_duration');

// Test data
const testPrompts = new SharedArray('prompts', function () {
  return [
    // Simple prompts
    'What is the capital of France?',
    'How do I sort a list in Python?',
    'Explain photosynthesis',
    
    // Moderate complexity prompts
    'Write a function to implement binary search in JavaScript',
    'Design a REST API for a todo application',
    'Explain the differences between TCP and UDP',
    
    // Complex prompts
    'Design a microservices architecture for an e-commerce platform with high availability',
    'Implement a distributed caching system with cache invalidation and TTL support',
    'Create a machine learning pipeline for real-time fraud detection with explanations'
  ];
});

const testUsers = new SharedArray('users', function () {
  return [
    { email: 'loadtest1@example.com', password: 'Test123!@#' },
    { email: 'loadtest2@example.com', password: 'Test123!@#' },
    { email: 'loadtest3@example.com', password: 'Test123!@#' },
    { email: 'loadtest4@example.com', password: 'Test123!@#' },
    { email: 'loadtest5@example.com', password: 'Test123!@#' }
  ];
});

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const API_BASE = `${BASE_URL}/api/v1`;

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Steady state load (100 concurrent users for 30 minutes)
    steady_state: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30m',
      startTime: '0s',
      tags: { scenario: 'steady_state' }
    },
    
    // Scenario 2: Spike test (0 to 500 users in 2 minutes)
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 }
      ],
      startTime: '31m',
      tags: { scenario: 'spike_test' }
    },
    
    // Scenario 3: Soak test (200 users for 2 hours)
    soak_test: {
      executor: 'constant-vus',
      vus: 200,
      duration: '2h',
      startTime: '41m',
      tags: { scenario: 'soak_test' }
    },
    
    // Scenario 4: Stress test (increase until breaking point)
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 2000,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '5m', target: 400 },
        { duration: '5m', target: 800 },
        { duration: '5m', target: 1600 }
      ],
      startTime: '2h42m',
      tags: { scenario: 'stress_test' }
    }
  },
  
  thresholds: {
    // API performance thresholds
    http_req_duration: [
      'p(95)<300', // 95% of requests must complete within 300ms
      'p(99)<500'  // 99% of requests must complete within 500ms
    ],
    
    // ML pipeline thresholds
    'enhancement_duration': [
      'p(95)<3000', // 95% of enhancements must complete within 3s
      'p(99)<5000'  // 99% of enhancements must complete within 5s
    ],
    
    // Error rate thresholds
    'api_errors': ['rate<0.01'], // Error rate must be below 1%
    http_req_failed: ['rate<0.01'],
    
    // Throughput thresholds
    http_reqs: ['rate>1000'] // Must handle at least 1000 RPS
  }
};

// Helper functions
function authenticate(user) {
  const startTime = Date.now();
  
  const loginRes = http.post(`${API_BASE}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  authDuration.add(Date.now() - startTime);
  
  const success = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'access token received': (r) => r.json('access_token') !== undefined
  });
  
  if (!success) {
    apiErrorRate.add(1);
    return null;
  }
  
  apiErrorRate.add(0);
  return loginRes.json('access_token');
}

function enhancePrompt(token, prompt) {
  const startTime = Date.now();
  
  const payload = {
    prompt: prompt,
    techniques: ['auto'], // Let the system choose techniques
    options: {
      stream: false
    }
  };
  
  const enhanceRes = http.post(`${API_BASE}/enhance`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : undefined
    },
    timeout: '10s'
  });
  
  const duration = Date.now() - startTime;
  enhancementDuration.add(duration);
  
  if (enhanceRes.json('metadata') && enhanceRes.json('metadata').ml_pipeline_ms) {
    mlPipelineDuration.add(enhanceRes.json('metadata').ml_pipeline_ms);
  }
  
  const success = check(enhanceRes, {
    'enhancement successful': (r) => r.status === 200,
    'enhanced prompt received': (r) => r.json('enhanced_prompt') !== undefined,
    'techniques applied': (r) => r.json('techniques_applied') && r.json('techniques_applied').length > 0,
    'performance target met': (r) => duration < 3000
  });
  
  apiErrorRate.add(success ? 0 : 1);
  return success;
}

function testBatchEnhancement(token) {
  const batchSize = 5;
  const prompts = [];
  
  for (let i = 0; i < batchSize; i++) {
    prompts.push(randomItem(testPrompts));
  }
  
  const startTime = Date.now();
  
  const batchRes = http.post(`${API_BASE}/enhance/batch`, JSON.stringify({
    prompts: prompts,
    techniques: ['auto']
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    timeout: '30s'
  });
  
  const duration = Date.now() - startTime;
  
  const success = check(batchRes, {
    'batch enhancement successful': (r) => r.status === 200,
    'all prompts enhanced': (r) => r.json('results') && r.json('results').length === batchSize,
    'batch performance target met': (r) => duration < (3000 * batchSize)
  });
  
  apiErrorRate.add(success ? 0 : 1);
  return success;
}

function testHistory(token) {
  const historyRes = http.get(`${API_BASE}/history?limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const success = check(historyRes, {
    'history retrieved': (r) => r.status === 200,
    'history is array': (r) => Array.isArray(r.json('items'))
  });
  
  apiErrorRate.add(success ? 0 : 1);
  return success;
}

// Virtual User scenario
export default function () {
  const scenario = __EXEC.scenario.name;
  
  // Select a random user and authenticate
  const user = randomItem(testUsers);
  const token = authenticate(user);
  
  if (!token && scenario !== 'stress_test') {
    // If auth fails in non-stress scenarios, something is wrong
    console.error('Authentication failed');
    return;
  }
  
  // Main test loop
  for (let i = 0; i < 5; i++) {
    // Test single prompt enhancement
    const prompt = randomItem(testPrompts);
    enhancePrompt(token, prompt);
    
    sleep(randomIntBetween(1, 3));
    
    // Test batch enhancement (authenticated users only)
    if (token && Math.random() < 0.3) {
      testBatchEnhancement(token);
      sleep(randomIntBetween(2, 5));
    }
    
    // Test history retrieval (authenticated users only)
    if (token && Math.random() < 0.2) {
      testHistory(token);
      sleep(1);
    }
  }
}

// Utility function
function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Setup function - runs once per VU
export function setup() {
  // Verify API is accessible
  const healthCheck = http.get(`${API_BASE}/health`);
  
  if (healthCheck.status !== 200) {
    throw new Error('API health check failed');
  }
  
  // Create test users if they don't exist
  testUsers.forEach(user => {
    http.post(`${API_BASE}/auth/register`, JSON.stringify({
      email: user.email,
      password: user.password,
      name: 'Load Test User'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  });
  
  return { startTime: Date.now() };
}

// Teardown function - runs once after all tests
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Total test duration: ${duration}s`);
}

// Custom summary handler
export function handleSummary(data) {
  return {
    'performance-report.json': JSON.stringify(data, null, 2),
    'performance-summary.txt': textSummary(data),
    stdout: textSummary(data)
  };
}

function textSummary(data) {
  let summary = '\n=== BetterPrompts Performance Test Summary ===\n\n';
  
  // API Performance
  summary += 'API Performance:\n';
  summary += `  P95 Response Time: ${data.metrics.http_req_duration.values['p(95)']}ms\n`;
  summary += `  P99 Response Time: ${data.metrics.http_req_duration.values['p(99)']}ms\n`;
  summary += `  Error Rate: ${(data.metrics.api_errors.values.rate * 100).toFixed(2)}%\n`;
  summary += `  Throughput: ${data.metrics.http_reqs.values.rate} RPS\n\n`;
  
  // ML Pipeline Performance
  summary += 'ML Pipeline Performance:\n';
  summary += `  P95 Enhancement Time: ${data.metrics.enhancement_duration.values['p(95)']}ms\n`;
  summary += `  P99 Enhancement Time: ${data.metrics.enhancement_duration.values['p(99)']}ms\n`;
  summary += `  Avg ML Processing Time: ${data.metrics.ml_pipeline_duration.values.avg}ms\n\n`;
  
  // Thresholds
  summary += 'Threshold Results:\n';
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.thresholds) {
      const passed = Object.values(metric.thresholds).every(t => t.ok);
      summary += `  ${name}: ${passed ? '✓ PASSED' : '✗ FAILED'}\n`;
    }
  });
  
  return summary;
}