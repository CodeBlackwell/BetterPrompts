import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { 
  enhancePrompt, authenticate, testBatchEnhancement,
  testPrompts, testUsers, metrics, API_BASE, generateSummaryReport,
  injectFailure, trackRecovery 
} from './shared-utils.js';

// Spike test - validate system resilience to sudden traffic spikes
export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        // Spike cycle 1
        { duration: '30s', target: 100 },   // Baseline
        { duration: '30s', target: 1000 },  // Spike up (10x)
        { duration: '2m', target: 1000 },   // Hold spike
        { duration: '30s', target: 100 },   // Return to baseline
        { duration: '1m', target: 100 },    // Recovery period
        
        // Spike cycle 2
        { duration: '30s', target: 1000 },  // Spike up again
        { duration: '2m', target: 1000 },   // Hold spike
        { duration: '30s', target: 100 },   // Return to baseline
        { duration: '1m', target: 100 },    // Recovery period
        
        // Spike cycle 3 (more extreme)
        { duration: '20s', target: 1500 },  // Extreme spike (15x)
        { duration: '1m', target: 1500 },   // Hold extreme spike
        { duration: '40s', target: 100 },   // Return to baseline
        { duration: '1m', target: 100 }     // Final recovery
      ],
      gracefulRampDown: '10s'
    }
  },
  
  thresholds: {
    // System should handle spikes gracefully
    http_req_duration: [
      'p(95)<500',      // p95 under 500ms even during spikes
      'p(99)<1000'      // p99 under 1s during spikes
    ],
    
    // Quick recovery after spikes
    'recovery_time': [
      'p(95)<300000',   // 95% recover within 5 minutes
      'avg<180000'      // Average recovery under 3 minutes
    ],
    
    // Limited errors during spikes
    'api_errors': ['rate<0.02'],          // Allow up to 2% errors during spikes
    http_req_failed: ['rate<0.02'],
    
    // Circuit breakers should activate appropriately
    'circuit_breaker_trips': ['count<20'], // Some trips expected
    
    // No data loss
    checks: ['rate>0.95']                  // 95% of checks should pass
  },
  
  tags: {
    test_type: 'spike_test',
    test_name: 'Traffic Spike Resilience Test'
  }
};

// Track spike behavior
const spikeMetrics = {
  spikes: [],
  currentSpike: null,
  recoveryTimes: []
};

export default function () {
  const user = randomItem(testUsers);
  const currentVUs = __VU;
  const iteration = __ITER;
  
  // Detect spike start/end
  if (currentVUs > 500 && !spikeMetrics.currentSpike) {
    // Spike started
    spikeMetrics.currentSpike = {
      startTime: Date.now(),
      peakVUs: currentVUs,
      errors: 0,
      successfulRequests: 0,
      failedRequests: 0
    };
  } else if (currentVUs < 200 && spikeMetrics.currentSpike) {
    // Spike ended, track recovery
    const recoveryTime = trackRecovery(spikeMetrics.currentSpike.startTime);
    spikeMetrics.recoveryTimes.push(recoveryTime);
    spikeMetrics.spikes.push(spikeMetrics.currentSpike);
    spikeMetrics.currentSpike = null;
  }
  
  // Update peak VUs during spike
  if (spikeMetrics.currentSpike && currentVUs > spikeMetrics.currentSpike.peakVUs) {
    spikeMetrics.currentSpike.peakVUs = currentVUs;
  }
  
  // Authenticate less frequently during spikes to reduce load
  let token = null;
  const authFrequency = currentVUs > 500 ? 100 : 20;
  if (iteration % authFrequency === 0) {
    const auth = authenticate(user);
    token = auth ? auth.token : null;
  }
  
  // Simulate more aggressive behavior during spikes
  const isSpike = currentVUs > 500;
  const requestCount = isSpike ? randomIntBetween(2, 5) : 1;
  
  for (let i = 0; i < requestCount; i++) {
    const prompt = randomItem(testPrompts);
    const startTime = Date.now();
    
    // Inject failures during extreme spikes
    if (currentVUs > 1200) {
      injectFailure('network', 0.05);  // 5% network failures
      injectFailure('database', 0.02); // 2% database failures
    }
    
    const success = enhancePrompt(token, prompt);
    const latency = Date.now() - startTime;
    
    if (spikeMetrics.currentSpike) {
      if (success) {
        spikeMetrics.currentSpike.successfulRequests++;
      } else {
        spikeMetrics.currentSpike.failedRequests++;
        spikeMetrics.currentSpike.errors++;
      }
    }
    
    // Validate spike behavior
    check({ success, latency }, {
      'request handled during spike': (r) => r.success || currentVUs < 1200,
      'latency acceptable during spike': (r) => r.latency < 2000 || currentVUs < 1000,
      'system responsive': (r) => r.latency < 5000
    });
    
    // Shorter think time during spikes
    if (isSpike && i < requestCount - 1) {
      sleep(Math.random() * 0.5);
    }
  }
  
  // Think time based on load
  const thinkTime = isSpike ? randomIntBetween(0.5, 1) : randomIntBetween(1, 3);
  sleep(thinkTime);
}

export function teardown(data) {
  console.log('\n=== Spike Test Analysis ===');
  console.log(`Total spikes: ${spikeMetrics.spikes.length}`);
  
  spikeMetrics.spikes.forEach((spike, index) => {
    const errorRate = spike.failedRequests / 
                     (spike.successfulRequests + spike.failedRequests) * 100;
    console.log(`\nSpike ${index + 1}:`);
    console.log(`  Peak VUs: ${spike.peakVUs}`);
    console.log(`  Successful requests: ${spike.successfulRequests}`);
    console.log(`  Failed requests: ${spike.failedRequests}`);
    console.log(`  Error rate: ${errorRate.toFixed(2)}%`);
  });
  
  if (spikeMetrics.recoveryTimes.length > 0) {
    const avgRecovery = spikeMetrics.recoveryTimes.reduce((a, b) => a + b, 0) / 
                       spikeMetrics.recoveryTimes.length;
    console.log(`\nAverage recovery time: ${(avgRecovery / 1000).toFixed(2)} seconds`);
  }
}

export function handleSummary(data) {
  const summary = generateSummaryReport(data, 'spike_test');
  
  // Add spike-specific metrics
  summary.spike_analysis = {
    total_spikes: spikeMetrics.spikes.length,
    spikes: spikeMetrics.spikes.map((spike, index) => ({
      spike_number: index + 1,
      peak_vus: spike.peakVUs,
      successful_requests: spike.successfulRequests,
      failed_requests: spike.failedRequests,
      error_rate: spike.failedRequests / 
                  (spike.successfulRequests + spike.failedRequests),
      duration_ms: spike.endTime ? spike.endTime - spike.startTime : 'ongoing'
    })),
    recovery_times: spikeMetrics.recoveryTimes,
    avg_recovery_time: spikeMetrics.recoveryTimes.length > 0 ?
      spikeMetrics.recoveryTimes.reduce((a, b) => a + b, 0) / 
      spikeMetrics.recoveryTimes.length : 0,
    circuit_breaker_effectiveness: data.metrics.circuit_breaker_trips.values.count > 0
  };
  
  // Resilience score calculation
  const resilienceFactors = {
    error_rate_during_spikes: summary.metrics.requests.error_rate < 0.02 ? 1 : 0,
    recovery_time: summary.spike_analysis.avg_recovery_time < 300000 ? 1 : 0,
    circuit_breakers_active: summary.spike_analysis.circuit_breaker_effectiveness ? 1 : 0,
    no_cascading_failures: summary.metrics.infrastructure.database_errors < 100 ? 1 : 0,
    maintained_sla: summary.metrics.business.sla_compliance > 0.95 ? 1 : 0
  };
  
  summary.resilience_score = Object.values(resilienceFactors).reduce((a, b) => a + b, 0) / 
                             Object.keys(resilienceFactors).length;
  
  return {
    '../reports/spike-test-summary.json': JSON.stringify(summary, null, 2),
    'stdout': generateSpikeReport(summary)
  };
}

function generateSpikeReport(summary) {
  let report = '\n' + '='.repeat(60) + '\n';
  report += '           Spike Test Report\n';
  report += '='.repeat(60) + '\n\n';
  
  report += `Test Configuration:\n`;
  report += `  Baseline: 100 VUs\n`;
  report += `  Normal Spike: 1000 VUs (10x)\n`;
  report += `  Extreme Spike: 1500 VUs (15x)\n`;
  report += `  Total Spikes: ${summary.spike_analysis.total_spikes}\n\n`;
  
  report += 'Spike Performance:\n';
  report += '-'.repeat(30) + '\n';
  
  summary.spike_analysis.spikes.forEach((spike) => {
    report += `Spike ${spike.spike_number}:\n`;
    report += `  Peak load: ${spike.peak_vus} VUs\n`;
    report += `  Success rate: ${((1 - spike.error_rate) * 100).toFixed(2)}%\n`;
    report += `  Error rate: ${(spike.error_rate * 100).toFixed(2)}%\n`;
  });
  
  report += `\nRecovery Metrics:\n`;
  report += '-'.repeat(30) + '\n';
  report += `Average recovery time: ${(summary.spike_analysis.avg_recovery_time / 1000).toFixed(2)}s\n`;
  report += `Circuit breakers activated: ${summary.spike_analysis.circuit_breaker_effectiveness ? 'YES' : 'NO'}\n`;
  report += `Circuit breaker trips: ${summary.metrics.infrastructure.circuit_breaker_trips}\n\n`;
  
  report += 'System Resilience:\n';
  report += '-'.repeat(30) + '\n';
  report += `Overall error rate: ${(summary.metrics.requests.error_rate * 100).toFixed(3)}%\n`;
  report += `Database errors: ${summary.metrics.infrastructure.database_errors}\n`;
  report += `Network errors: ${summary.metrics.infrastructure.network_errors}\n`;
  report += `SLA maintained: ${summary.metrics.business.sla_compliance > 0.95 ? 'YES' : 'NO'}\n\n`;
  
  report += `Resilience Score: ${(summary.resilience_score * 100).toFixed(0)}%\n`;
  report += `Overall Result: ${summary.overall_passed ? '✅ PASSED' : '❌ FAILED'}\n`;
  report += '='.repeat(60) + '\n';
  
  return report;
}