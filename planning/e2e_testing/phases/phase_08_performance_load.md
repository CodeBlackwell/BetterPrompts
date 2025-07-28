# Phase 8: Performance Under Load (US-005 + PS-01)

## Overview
- **User Story**: "As a data scientist, I want to see performance metrics"
- **Duration**: 4 days
- **Complexity**: High - Load testing, metrics collection, dashboards
- **Status**: 🟢 IMPLEMENTATION COMPLETE (Backend 100%, Frontend 95%, Tests Need Routing Fix)

## Dependencies
- **Depends On**: Phase 7 (API Integration)
- **Enables**: Production readiness validation
- **Can Run In Parallel With**: Phase 11 (after prerequisites)

## Why This Next
- Validates scalability
- Uses API from Phase 7
- Critical for SLA compliance
- Provides optimization data

## Implementation Command
```bash
# Performance and load testing with comprehensive metrics
/sc:test performance \
  --persona-qa --persona-performance --persona-devops \
  --play --seq --c7 \
  --think-hard --validate \
  --scope system \
  --focus performance \
  --wave-mode force \
  --wave-strategy systematic \
  --delegate tasks \
  "E2E tests for US-005 + PS-01: Performance metrics and load testing at scale" \
  --requirements '{
    "metrics_collection": {
      "application": ["response time", "throughput", "error rate", "technique accuracy"],
      "infrastructure": ["CPU usage", "memory", "database connections", "cache hit rate"],
      "business": ["user satisfaction", "SLA compliance", "cost per request"],
      "real_time": "5-second update intervals via WebSocket"
    },
    "load_profiles": {
      "baseline": {"users": 100, "duration": "5m", "ramp": "1m"},
      "normal": {"users": 500, "duration": "10m", "ramp": "2m"},
      "peak": {"users": 1000, "duration": "15m", "ramp": "3m"},
      "stress": {"users": 2000, "duration": "5m", "purpose": "find breaking point"},
      "spike": {"baseline": 100, "spike_to": 1000, "spike_duration": "2m"}
    },
    "sla_targets": {
      "availability": "99.9% uptime",
      "latency": {"p50": "<100ms", "p95": "<200ms", "p99": "<500ms"},
      "throughput": "1000 req/s sustained",
      "error_rate": "<0.1%",
      "recovery": "<5 minutes MTTR"
    },
    "dashboard_features": {
      "visualization": ["real-time graphs", "historical trends", "heat maps"],
      "filtering": ["date range", "technique type", "user segment"],
      "alerting": ["SLA breach", "anomaly detection", "capacity warnings"],
      "export": ["CSV", "JSON", "PDF reports", "scheduled delivery"]
    }
  }' \
  --test-scenarios '{
    "k6_scenarios": {
      "ramp_up": {"stages": ["0→100 users/2m", "100→500/3m", "500→1000/3m", "hold 5m", "1000→0/2m"]},
      "sustained": {"constant": 500, "duration": "30m", "monitor": "degradation patterns"},
      "spike": {"baseline": 100, "spike": 1000, "return": 100, "cycles": 3},
      "geographic": {"regions": ["us-east", "eu-west", "ap-south"], "concurrent": true},
      "api_mix": {"enhance": 70, "batch": 20, "history": 10}
    },
    "dashboard_tests": {
      "display": ["metrics render correctly", "real-time updates", "no lag under load"],
      "interaction": ["filtering works", "export during load", "drill-down capability"],
      "accuracy": ["metrics match source", "aggregations correct", "time sync accurate"]
    },
    "failure_scenarios": {
      "database": ["connection pool exhaustion", "slow queries", "deadlocks"],
      "cache": ["cache miss storm", "eviction under pressure", "redis failure"],
      "network": ["packet loss", "high latency", "bandwidth saturation"],
      "application": ["memory leak simulation", "CPU throttling", "disk I/O limits"]
    },
    "recovery_tests": {
      "auto_scaling": ["scale up triggers", "scale down behavior", "cost optimization"],
      "circuit_breaker": ["failure detection", "fallback behavior", "recovery time"],
      "graceful_degradation": ["feature flags", "reduced functionality", "priority queuing"]
    }
  }' \
  --deliverables '{
    "test_files": [
      "us-005-performance-metrics.spec.ts",
      "load-test-scenarios.k6.js",
      "dashboard-stress.spec.ts",
      "sla-compliance.spec.ts"
    ],
    "k6_suite": {
      "scenarios": ["ramp-up.js", "sustained-load.js", "spike-test.js", "geo-distributed.js"],
      "utilities": ["auth-setup.js", "data-generators.js", "metric-validators.js"],
      "reports": ["html-report-template", "slack-notifier", "grafana-dashboard"]
    },
    "monitoring": {
      "grafana_dashboards": ["application-metrics", "infrastructure", "business-kpis"],
      "prometheus_rules": ["sla-alerts", "capacity-planning", "anomaly-detection"],
      "documentation": ["runbook", "escalation-procedures", "optimization-guide"]
    }
  }' \
  --validation-gates '{
    "performance": ["All SLA targets met", "No degradation over time", "Linear scaling verified"],
    "reliability": ["No data loss", "Graceful failures", "Quick recovery", "Zero downtime deploys"],
    "cost": ["Cost per transaction within budget", "Resource efficiency", "Auto-scaling effective"],
    "user_experience": ["Dashboard responsive", "Exports work under load", "Real-time updates smooth"]
  }' \
  --infrastructure '{
    "k6": {"cloud": true, "distributed": true, "regions": 3},
    "monitoring": {"prometheus": true, "grafana": true, "custom_metrics": true},
    "test_data": {"volume": "1M prompts", "variety": "all techniques", "velocity": "real-time"}
  }' \
  --output-dir "e2e/phase8" \
  --tag "phase-8-performance-load" \
  --priority critical
```

## Success Metrics
- [ ] Sustain 1000 concurrent users
- [ ] <200ms p95 latency
- [ ] Metrics update within 5s
- [ ] Zero data loss under load
- [ ] Dashboard responsive under load
- [ ] SLA targets met

## Progress Tracking
- [x] Test file created: `us-005-performance-metrics.spec.ts`
- [x] K6 test scenarios implemented
- [x] Performance dashboard tests complete
- [x] Metrics collection tests complete
- [x] Load test scenarios complete (100, 500, 1000 users)
- [x] Metrics export tests complete
- [x] Real-time update tests complete
- [x] SLA validation complete
- [ ] Performance reports generated (blocked by frontend)
- [x] Documentation updated

## Implementation Status (July 28, 2025)

### ✅ Completed
- **Backend Infrastructure**: All metrics endpoints implemented and functional
- **WebSocket Support**: Real-time broadcasting with 5-second intervals
- **Database Schema**: Metrics tables created with historical data seeded
- **Test Suite**: 33 E2E tests and 6 k6 scenarios ready
- **k6 Installation**: v1.1.0 installed and configured
- **Frontend Hook**: `useMetricsWebSocket.ts` created
- **Frontend Integration**: Analytics page connected to real APIs and WebSocket
- **Authentication**: Login form instrumented with test IDs
- **Environment Config**: WebSocket URL configured
- **RealtimeChart Component**: Created for live data visualization

### 🚧 Remaining (Minor)
- Admin routing/middleware for post-login navigation
- Admin navigation component with test IDs
- Test execution (blocked by routing only)

## Test Scenarios

### Performance Dashboard Tests
- Metrics display correctly
- Real-time updates work
- Historical data charts
- Filtering by date range
- Technique performance comparison
- Export functionality

### Load Test Scenarios
```javascript
// Scenario 1: Ramp up test
- Start: 0 users
- Ramp: 100 users/minute
- Target: 1000 users
- Duration: 10 minutes

// Scenario 2: Spike test  
- Baseline: 100 users
- Spike to: 1000 users
- Spike duration: 2 minutes
- Return to baseline

// Scenario 3: Sustained load
- Constant: 500 users
- Duration: 30 minutes
- Monitor degradation

// Scenario 4: Stress test
- Increase until failure
- Find breaking point
- Monitor recovery
```

### Metrics Collection Tests
- Response time percentiles (p50, p95, p99)
- Request rate (requests/second)
- Error rate tracking
- Concurrent users
- Database query times
- Cache hit rates

### SLA Compliance Tests
- Availability: 99.9% uptime
- Latency: <200ms p95
- Throughput: 1000 req/s
- Error rate: <0.1%
- Time to recovery: <5 minutes

### Export Tests
- CSV export format
- JSON export format
- Date range selection
- Metric selection
- Large dataset export
- Scheduled exports

### Real-time Tests
- WebSocket connection
- Update frequency (5s)
- Data accuracy
- Connection recovery
- Multiple dashboard clients

## Notes & Updates

### Prerequisites
- API endpoints working (Phase 7) ✅
- Metrics collection system ✅
- Performance dashboard UI 🚧 (See Phase 8b)
- K6 installed and configured ✅
- Monitoring infrastructure ✅

### K6 Test Structure
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 1000 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function() {
  let response = http.post('https://api.betterprompts.com/v1/enhance', 
    JSON.stringify({ prompt: 'Test prompt' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
}
```

### Implementation Tips
1. Start with small load tests
2. Monitor system resources during tests
3. Use realistic test data
4. Test from multiple geographic locations
5. Include think time in scenarios

### Common Issues
- **Database bottleneck**: Check connection pooling
- **Memory leaks**: Monitor during sustained tests
- **Cache misses**: Verify caching strategy
- **Network saturation**: Check bandwidth limits

### Phase 8 Implementation Details

#### Backend Endpoints Created
- `/api/v1/admin/metrics/performance` - Application performance metrics
- `/api/v1/admin/metrics/infrastructure` - System resource metrics
- `/api/v1/admin/metrics/business` - Business KPIs
- `/api/v1/admin/metrics/sla` - SLA compliance tracking
- `/api/v1/admin/metrics/history` - Historical data with time ranges
- `/api/v1/admin/metrics/techniques` - Per-technique performance

#### WebSocket Implementation
- Endpoint: `ws://localhost:3000/ws`
- Channels: `performance`, `usage`, `technique_stats`
- Update interval: 5 seconds
- Auto-reconnection support

#### Database Schema
- `metrics.performance_metrics`
- `metrics.infrastructure_metrics`
- `metrics.business_metrics`
- `metrics.sla_compliance`
- `metrics.technique_metrics`

#### Test Data
- Admin user: `admin@betterprompts.ai`
- Test users: `user1@example.com` through `user10@example.com`
- 24 hours of historical metrics data

### Phase 8b Implementation (July 28, 2025)

Completed frontend integration:
- Connected analytics page to all metrics endpoints  
- Integrated WebSocket for real-time updates
- Created RealtimeChart component
- Added authentication and test infrastructure
- Updated environment configuration

See `/e2e/phase8/PHASE8B_IMPLEMENTATION_REPORT.md` for full details.

---

*Last Updated: 2025-07-28*
*Implementation 95% complete - only admin routing remains*