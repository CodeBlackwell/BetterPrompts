import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { 
  enhancePrompt, authenticate, testHistory, testDashboardMetrics,
  testPrompts, testUsers, metrics, API_BASE, generateSummaryReport 
} from './shared-utils.js';

// Geographic distribution test - validate global performance consistency
export const options = {
  scenarios: {
    geo_distributed: {
      executor: 'constant-vus',
      vus: 300,
      duration: '15m',
      env: { 
        REGION: __ENV.K6_CLOUD ? 'multi' : 'local' 
      },
      tags: { 
        scenario: 'geo_distributed',
        distributed: 'true'
      }
    }
  },
  
  // k6 Cloud configuration for multi-region testing
  cloud: {
    distribution: {
      'amazon:us:ashburn': { 
        loadZone: 'amazon:us:ashburn', 
        percent: 33 
      },
      'amazon:ie:dublin': { 
        loadZone: 'amazon:ie:dublin', 
        percent: 34 
      },
      'amazon:jp:tokyo': { 
        loadZone: 'amazon:jp:tokyo', 
        percent: 33 
      }
    }
  },
  
  thresholds: {
    // Global latency requirements
    http_req_duration: {
      'p(95)': ['<400'],    // p95 under 400ms globally
      'p(99)': ['<800'],    // p99 under 800ms globally
      'avg': ['<250']       // Average under 250ms
    },
    
    // Regional consistency (using tags)
    'http_req_duration{region:us-east}': ['p(95)<300'],
    'http_req_duration{region:eu-west}': ['p(95)<350'],
    'http_req_duration{region:ap-south}': ['p(95)<400'],
    
    // Variance between regions should be low
    checks: ['rate>0.95'],
    
    // Error rates consistent across regions
    'api_errors': ['rate<0.001'],
    http_req_failed: ['rate<0.001'],
    
    // Cache effectiveness globally
    'cache_hit_rate': ['rate>0.85']
  },
  
  tags: {
    test_type: 'geo_distributed',
    test_name: 'Global Performance Consistency Test'
  }
};

// Track regional performance
const regionalMetrics = {
  'us-east': { latencies: [], errors: 0, requests: 0 },
  'eu-west': { latencies: [], errors: 0, requests: 0 },
  'ap-south': { latencies: [], errors: 0, requests: 0 },
  'local': { latencies: [], errors: 0, requests: 0 }
};

// Simulate regional characteristics
function getRegionalCharacteristics() {
  const region = __ENV.K6_CLOUD_REGION || 'local';
  
  const characteristics = {
    'amazon:us:ashburn': {
      name: 'us-east',
      baseLatency: 20,
      jitter: 10,
      packetLoss: 0.001
    },
    'amazon:ie:dublin': {
      name: 'eu-west',
      baseLatency: 35,
      jitter: 15,
      packetLoss: 0.002
    },
    'amazon:jp:tokyo': {
      name: 'ap-south',
      baseLatency: 50,
      jitter: 20,
      packetLoss: 0.003
    },
    'local': {
      name: 'local',
      baseLatency: 10,
      jitter: 5,
      packetLoss: 0
    }
  };
  
  return characteristics[region] || characteristics['local'];
}

export default function () {
  const user = randomItem(testUsers);
  const regional = getRegionalCharacteristics();
  const regionName = regional.name;
  
  // Add simulated network latency
  const networkDelay = regional.baseLatency + (Math.random() * regional.jitter);
  
  // Simulate packet loss
  if (Math.random() < regional.packetLoss) {
    metrics.networkErrors.add(1);
    sleep(1);
    return;
  }
  
  // Authenticate periodically
  let token = null;
  if (__ITER % 30 === 0) {
    const auth = authenticate(user);
    token = auth ? auth.token : null;
  }
  
  // Regional workload distribution
  const workloadType = Math.random();
  let success = false;
  let actualLatency = 0;
  
  if (workloadType < 0.7) {
    // 70% - Enhancement requests
    const prompt = randomItem(testPrompts);
    const startTime = Date.now();
    
    // Add regional tag to request
    const response = http.post(`${API_BASE}/enhance`, JSON.stringify({
      prompt: prompt.text,
      intent: prompt.intent,
      techniques: ['auto'],
      options: {
        stream: false,
        include_metadata: true,
        region: regionName
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined,
        'X-Region': regionName
      },
      timeout: '10s',
      tags: { 
        endpoint: 'enhance', 
        region: regionName 
      }
    });
    
    actualLatency = Date.now() - startTime;
    const totalLatency = actualLatency + networkDelay;
    
    success = response.status === 200;
    regionalMetrics[regionName].latencies.push(totalLatency);
    regionalMetrics[regionName].requests++;
    
    if (!success) {
      regionalMetrics[regionName].errors++;
      metrics.apiErrors.add(1);
    } else {
      metrics.apiErrors.add(0);
    }
    
    // Check regional performance
    check({ success, totalLatency }, {
      'request successful': (r) => r.success,
      'regional latency acceptable': (r) => {
        const threshold = regionName === 'us-east' ? 300 :
                         regionName === 'eu-west' ? 350 :
                         regionName === 'ap-south' ? 400 : 250;
        return r.totalLatency < threshold;
      }
    });
    
  } else if (workloadType < 0.85 && token) {
    // 15% - History requests (test CDN effectiveness)
    const startTime = Date.now();
    success = testHistory(token);
    actualLatency = Date.now() - startTime;
    const totalLatency = actualLatency + networkDelay;
    
    regionalMetrics[regionName].latencies.push(totalLatency);
    regionalMetrics[regionName].requests++;
    
    check({ success, totalLatency }, {
      'history cached regionally': (r) => r.success && r.totalLatency < 100
    });
    
  } else if (token) {
    // 15% - Dashboard metrics (test real-time data)
    const startTime = Date.now();
    success = testDashboardMetrics(token);
    actualLatency = Date.now() - startTime;
    const totalLatency = actualLatency + networkDelay;
    
    regionalMetrics[regionName].latencies.push(totalLatency);
    regionalMetrics[regionName].requests++;
    
    check({ success, totalLatency }, {
      'dashboard responsive globally': (r) => r.success && r.totalLatency < 500
    });
  }
  
  // Regional think time patterns
  const thinkTime = regionName === 'ap-south' ? randomIntBetween(2, 4) :
                   regionName === 'eu-west' ? randomIntBetween(1.5, 3) :
                   randomIntBetween(1, 2.5);
  sleep(thinkTime);
}

export function teardown(data) {
  console.log('\n=== Geographic Distribution Analysis ===');
  
  // Calculate regional statistics
  const regionalStats = {};
  let totalLatency = 0;
  let totalRequests = 0;
  
  Object.entries(regionalMetrics).forEach(([region, metrics]) => {
    if (metrics.requests > 0) {
      const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / 
                        metrics.latencies.length;
      const errorRate = metrics.errors / metrics.requests;
      
      regionalStats[region] = {
        avgLatency,
        errorRate,
        requests: metrics.requests
      };
      
      totalLatency += avgLatency * metrics.requests;
      totalRequests += metrics.requests;
      
      console.log(`\n${region.toUpperCase()} Region:`);
      console.log(`  Avg latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  Error rate: ${(errorRate * 100).toFixed(3)}%`);
      console.log(`  Requests: ${metrics.requests}`);
    }
  });
  
  // Calculate variance
  if (totalRequests > 0) {
    const globalAvg = totalLatency / totalRequests;
    const latencies = Object.values(regionalStats).map(s => s.avgLatency);
    const variance = calculateVariance(latencies, globalAvg);
    
    console.log(`\nGlobal Metrics:`);
    console.log(`  Average latency: ${globalAvg.toFixed(2)}ms`);
    console.log(`  Latency variance: ${variance.toFixed(2)}%`);
    console.log(`  Consistency: ${variance < 20 ? 'GOOD' : 'POOR'}`);
  }
}

function calculateVariance(values, mean) {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  return (stdDev / mean) * 100; // Coefficient of variation as percentage
}

export function handleSummary(data) {
  const summary = generateSummaryReport(data, 'geo_distributed');
  
  // Add geographic-specific metrics
  const geoStats = {};
  let totalLatency = 0;
  let totalRequests = 0;
  
  Object.entries(regionalMetrics).forEach(([region, metrics]) => {
    if (metrics.requests > 0) {
      const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / 
                        metrics.latencies.length;
      const p95Latency = metrics.latencies.sort((a, b) => a - b)[
        Math.floor(metrics.latencies.length * 0.95)
      ];
      
      geoStats[region] = {
        avg_latency: avgLatency,
        p95_latency: p95Latency,
        error_rate: metrics.errors / metrics.requests,
        requests: metrics.requests
      };
      
      totalLatency += avgLatency * metrics.requests;
      totalRequests += metrics.requests;
    }
  });
  
  const globalAvg = totalRequests > 0 ? totalLatency / totalRequests : 0;
  const variance = calculateVariance(
    Object.values(geoStats).map(s => s.avg_latency),
    globalAvg
  );
  
  summary.geographic_analysis = {
    regions: geoStats,
    global_metrics: {
      avg_latency: globalAvg,
      latency_variance: variance,
      consistency_rating: variance < 10 ? 'excellent' :
                         variance < 20 ? 'good' :
                         variance < 30 ? 'acceptable' : 'poor',
      total_requests: totalRequests
    },
    cdn_effectiveness: summary.metrics.infrastructure.cache_hit_rate > 0.85,
    regional_sla_compliance: Object.entries(geoStats).every(
      ([region, stats]) => {
        const threshold = region === 'us-east' ? 300 :
                         region === 'eu-west' ? 350 :
                         region === 'ap-south' ? 400 : 250;
        return stats.p95_latency < threshold;
      }
    )
  };
  
  return {
    '../reports/geo-distributed-summary.json': JSON.stringify(summary, null, 2),
    'stdout': generateGeoReport(summary)
  };
}

function generateGeoReport(summary) {
  let report = '\n' + '='.repeat(60) + '\n';
  report += '      Geographic Distribution Test Report\n';
  report += '='.repeat(60) + '\n\n';
  
  report += 'Regional Performance:\n';
  report += '-'.repeat(30) + '\n';
  
  Object.entries(summary.geographic_analysis.regions).forEach(([region, stats]) => {
    report += `\n${region.toUpperCase()}:\n`;
    report += `  Average latency: ${stats.avg_latency.toFixed(2)}ms\n`;
    report += `  P95 latency: ${stats.p95_latency.toFixed(2)}ms\n`;
    report += `  Error rate: ${(stats.error_rate * 100).toFixed(3)}%\n`;
    report += `  Requests: ${stats.requests}\n`;
  });
  
  report += '\nGlobal Consistency:\n';
  report += '-'.repeat(30) + '\n';
  report += `Global average latency: ${summary.geographic_analysis.global_metrics.avg_latency.toFixed(2)}ms\n`;
  report += `Latency variance: ${summary.geographic_analysis.global_metrics.latency_variance.toFixed(2)}%\n`;
  report += `Consistency rating: ${summary.geographic_analysis.global_metrics.consistency_rating.toUpperCase()}\n`;
  report += `CDN effectiveness: ${summary.geographic_analysis.cdn_effectiveness ? 'YES' : 'NO'}\n`;
  report += `Cache hit rate: ${(summary.metrics.infrastructure.cache_hit_rate * 100).toFixed(1)}%\n\n`;
  
  report += 'SLA Compliance:\n';
  report += '-'.repeat(30) + '\n';
  report += `Regional SLAs met: ${summary.geographic_analysis.regional_sla_compliance ? 'YES' : 'NO'}\n`;
  report += `Global SLA compliance: ${(summary.metrics.business.sla_compliance * 100).toFixed(2)}%\n`;
  report += `Error rate: ${(summary.metrics.requests.error_rate * 100).toFixed(3)}%\n\n`;
  
  report += `Overall Result: ${summary.overall_passed ? '✅ PASSED' : '❌ FAILED'}\n`;
  report += '='.repeat(60) + '\n';
  
  return report;
}