import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// Configuration
export const BASE_URL = __ENV.BASE_URL || 'http://localhost';
export const API_BASE = `${BASE_URL}/api/v1`;
export const WS_BASE = BASE_URL.replace('http', 'ws') + '/ws';

// Shared metrics
export const metrics = {
  apiErrors: new Rate('api_errors'),
  enhancementDuration: new Trend('enhancement_duration'),
  mlPipelineDuration: new Trend('ml_pipeline_duration'),
  techniqueAccuracy: new Rate('technique_accuracy'),
  dbConnections: new Gauge('db_connections'),
  cacheHitRate: new Rate('cache_hit_rate'),
  userSatisfaction: new Rate('user_satisfaction'),
  slaCompliance: new Rate('sla_compliance'),
  costPerRequest: new Trend('cost_per_request'),
  dbErrors: new Counter('database_errors'),
  cacheErrors: new Counter('cache_errors'),
  networkErrors: new Counter('network_errors'),
  recoveryTime: new Trend('recovery_time'),
  circuitBreakerTrips: new Counter('circuit_breaker_trips')
};

// Test data
export const testPrompts = new SharedArray('prompts', function () {
  return JSON.parse(open('../utils/test-prompts.json'));
});

export const testUsers = new SharedArray('users', function () {
  return JSON.parse(open('../utils/test-users.json'));
});

// Authentication helper
export function authenticate(user) {
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

// Enhancement helper
export function enhancePrompt(token, prompt, technique = 'auto') {
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
  
  // Check SLA compliance
  const slaMet = duration < 3000 && enhanceRes.status === 200;
  metrics.slaCompliance.add(slaMet ? 1 : 0);
  
  if (enhanceRes.status === 200) {
    const body = enhanceRes.json();
    
    // Track ML pipeline performance
    if (body.metadata && body.metadata.ml_pipeline_ms) {
      metrics.mlPipelineDuration.add(body.metadata.ml_pipeline_ms);
    }
    
    // Track technique accuracy (simulated)
    const accuracyScore = Math.random() * 0.2 + 0.8; // 80-100%
    metrics.techniqueAccuracy.add(accuracyScore > 0.85 ? 1 : 0);
    
    // Track user satisfaction (simulated)
    const satisfaction = duration < 2000 ? 0.9 : duration < 3000 ? 0.7 : 0.5;
    metrics.userSatisfaction.add(satisfaction > 0.7 ? 1 : 0);
    
    // Track cost (simulated)
    const cost = 0.001 + (body.metadata && body.metadata.ml_pipeline_ms ? 
      body.metadata.ml_pipeline_ms * 0.000001 : 0);
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

// Batch enhancement helper
export function testBatchEnhancement(token, prompts) {
  const startTime = Date.now();
  
  const batchRes = http.post(`${API_BASE}/enhance/batch`, JSON.stringify({
    prompts: prompts.map((p, i) => ({
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
    tags: { endpoint: 'batch', batch_size: prompts.length }
  });
  
  const duration = Date.now() - startTime;
  
  const success = check(batchRes, {
    'batch successful': (r) => r.status === 200,
    'all prompts processed': (r) => r.json('results') && 
      r.json('results').length === prompts.length
  });
  
  metrics.apiErrors.add(success ? 0 : 1);
  metrics.slaCompliance.add(duration < (3000 * prompts.length) ? 1 : 0);
  
  return success;
}

// History retrieval helper
export function testHistory(token) {
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

// Dashboard metrics helper
export function testDashboardMetrics(token) {
  const startTime = Date.now();
  
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
  metrics.slaCompliance.add(duration < 500 ? 1 : 0);
  
  return allSuccess;
}

// Failure injection helper
export function injectFailure(type, probability = 0.01) {
  if (Math.random() < probability) {
    switch (type) {
      case 'database':
        metrics.dbErrors.add(1);
        return true;
      case 'cache':
        metrics.cacheErrors.add(1);
        return true;
      case 'network':
        metrics.networkErrors.add(1);
        return true;
      default:
        return false;
    }
  }
  return false;
}

// Recovery time tracking
export function trackRecovery(startTime) {
  const recoveryDuration = Date.now() - startTime;
  metrics.recoveryTime.add(recoveryDuration);
  return recoveryDuration;
}

// Generate summary report
export function generateSummaryReport(data, scenarioName) {
  const timestamp = new Date().toISOString();
  const summary = {
    scenario: scenarioName,
    timestamp,
    duration: data.state.testRunDurationMs,
    metrics: {
      requests: {
        total: data.metrics.http_reqs.values.count,
        rate: data.metrics.http_reqs.values.rate,
        error_rate: data.metrics.http_req_failed.values.rate
      },
      latency: {
        median: data.metrics.http_req_duration.values['p(50)'],
        p95: data.metrics.http_req_duration.values['p(95)'],
        p99: data.metrics.http_req_duration.values['p(99)']
      },
      business: {
        sla_compliance: data.metrics.sla_compliance.values.rate,
        user_satisfaction: data.metrics.user_satisfaction.values.rate,
        technique_accuracy: data.metrics.technique_accuracy.values.rate,
        avg_cost_per_request: data.metrics.cost_per_request.values.avg
      },
      infrastructure: {
        cache_hit_rate: data.metrics.cache_hit_rate.values.rate,
        database_errors: data.metrics.database_errors.values.count,
        cache_errors: data.metrics.cache_errors.values.count,
        network_errors: data.metrics.network_errors.values.count,
        circuit_breaker_trips: data.metrics.circuit_breaker_trips.values.count
      }
    },
    thresholds: {}
  };
  
  // Check thresholds
  Object.entries(data.metrics).forEach(([name, metric]) => {
    if (metric.thresholds) {
      summary.thresholds[name] = {
        passed: Object.values(metric.thresholds).every(t => t.ok),
        details: metric.thresholds
      };
    }
  });
  
  summary.overall_passed = Object.values(summary.thresholds).every(t => t.passed);
  
  return summary;
}