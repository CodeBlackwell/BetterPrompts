# BetterPrompts Performance Testing Guide

## Overview

This guide covers the performance and load testing suite for BetterPrompts, designed to ensure the system meets its performance requirements:
- P95 API latency < 300ms
- P99 API latency < 500ms  
- ML pipeline < 3s for enhancement
- 1000+ RPS sustained throughput
- <1% error rate under load

## Testing Tools

### 1. K6 (Primary Load Testing)
K6 is our primary tool for load testing, providing:
- JavaScript-based scripting
- Built-in metrics and thresholds
- Multiple scenario support
- Cloud and local execution

### 2. Artillery (Stress Testing)
Artillery is used for complex user flow testing:
- YAML-based configuration
- Scenario-driven testing
- WebSocket support
- Plugin ecosystem

### 3. Locust (Python-based Testing)
Locust provides Python-based testing for ML pipeline focus:
- Python scripting
- Real-time web UI
- Distributed testing
- Custom metrics

## Test Scenarios

### 1. Steady State Load Test
- **Duration**: 30 minutes
- **Users**: 100 concurrent
- **Purpose**: Validate normal operation performance
- **Success Criteria**: All requests < 300ms P95

### 2. Spike Test
- **Pattern**: 0 → 500 users in 2 minutes
- **Duration**: 10 minutes total
- **Purpose**: Test sudden traffic increases
- **Success Criteria**: System recovers within 30s

### 3. Soak Test
- **Duration**: 2 hours
- **Users**: 200 concurrent
- **Purpose**: Identify memory leaks and degradation
- **Success Criteria**: No performance degradation

### 4. Stress Test
- **Pattern**: Gradual increase until failure
- **Purpose**: Find breaking point
- **Success Criteria**: Graceful degradation

### 5. ML Pipeline Test
- **Focus**: Intent classification and prompt generation
- **Metrics**: Inference time, GPU utilization
- **Success Criteria**: <3s end-to-end

## Running Performance Tests

### Local Testing

```bash
# K6 Load Test
cd tests/performance
k6 run k6-load-test.js

# With custom configuration
k6 run --vus 50 --duration 10m k6-load-test.js

# Specific scenario
k6 run --env SCENARIO=spike_test k6-load-test.js

# Artillery Stress Test
artillery run artillery-stress-test.yml

# With environment variables
BASE_URL=https://staging.betterprompts.ai artillery run artillery-stress-test.yml

# Locust ML Pipeline Test
locust -f locust-ml-pipeline.py --host http://localhost
```

### Docker-based Testing

```bash
# Run K6 in Docker
docker run -i grafana/k6 run - <k6-load-test.js

# Run with volume mount for reports
docker run -v $(pwd):/scripts \
  -v $(pwd)/reports:/reports \
  grafana/k6 run /scripts/k6-load-test.js

# Run Artillery in Docker
docker run -v $(pwd):/scripts \
  artilleryio/artillery:latest \
  run /scripts/artillery-stress-test.yml
```

### CI/CD Integration

```yaml
# GitHub Actions example
performance-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    
    - name: Run K6 tests
      uses: grafana/k6-action@v0.3.1
      with:
        filename: tests/performance/k6-load-test.js
        flags: --out json=results.json
    
    - name: Upload results
      uses: actions/upload-artifact@v3
      with:
        name: k6-results
        path: results.json
```

## Performance Metrics

### API Metrics
- **Response Time**: P50, P95, P99, Max
- **Throughput**: Requests per second
- **Error Rate**: 4xx and 5xx responses
- **Concurrent Users**: Active connections

### ML Pipeline Metrics
- **Inference Time**: Model prediction latency
- **Queue Time**: Time waiting for GPU
- **Batch Efficiency**: Throughput improvement
- **GPU Utilization**: % GPU usage

### System Metrics
- **CPU Usage**: Per service
- **Memory Usage**: Heap and RSS
- **Network I/O**: Bandwidth utilization
- **Database Connections**: Pool usage

## Monitoring During Tests

### Real-time Monitoring

```bash
# K6 real-time output
k6 run --out influxdb=http://localhost:8086/k6 k6-load-test.js

# Grafana dashboards
# Access at http://localhost:3001
# Default login: admin/admin

# Prometheus metrics
# Access at http://localhost:9090
```

### Key Dashboards
1. **API Performance**: Response times, error rates
2. **Service Health**: CPU, memory, connections
3. **ML Pipeline**: Inference times, GPU usage
4. **Business Metrics**: Enhancements/minute

## Analyzing Results

### K6 Results Analysis

```javascript
// Check summary output
{
  "metrics": {
    "http_req_duration": {
      "p(95)": 285.4,  // ✓ Under 300ms target
      "p(99)": 486.2   // ✓ Under 500ms target
    },
    "enhancement_duration": {
      "p(95)": 2847.3, // ✓ Under 3000ms target
      "p(99)": 4523.1  // ✓ Under 5000ms target
    }
  }
}
```

### Artillery Report Generation

```bash
# Generate HTML report
artillery report performance-report.json

# Open in browser
open performance-report.html
```

### Identifying Bottlenecks

1. **High API Latency**
   - Check database query times
   - Review service communication
   - Analyze serialization overhead

2. **ML Pipeline Slowness**
   - Monitor GPU utilization
   - Check batch sizes
   - Review model optimization

3. **High Error Rates**
   - Check rate limiting
   - Review circuit breakers
   - Analyze timeout settings

## Performance Optimization Tips

### API Gateway
- Enable response compression
- Implement request batching
- Use connection pooling
- Cache frequent requests

### ML Services
- Optimize batch sizes
- Use GPU efficiently
- Implement request queuing
- Cache model predictions

### Database
- Add appropriate indexes
- Use read replicas
- Implement query caching
- Optimize connection pools

### Frontend
- Enable CDN caching
- Implement lazy loading
- Optimize bundle sizes
- Use service workers

## Continuous Performance Testing

### Automated Testing Schedule
- **Every PR**: Quick smoke test (5 min)
- **Daily**: Standard load test (30 min)
- **Weekly**: Full test suite (3 hours)
- **Monthly**: Chaos testing

### Performance Budgets
```yaml
performance_budgets:
  api_response_time:
    p95: 300ms
    p99: 500ms
    degradation_threshold: 10%
  
  ml_pipeline:
    p95: 3000ms
    p99: 5000ms
    degradation_threshold: 15%
  
  error_rate:
    max: 1%
    alert_threshold: 0.5%
```

### Alerting Rules
```yaml
alerts:
  - name: APIHighLatency
    condition: p95(api_response_time) > 350ms for 5m
    severity: warning
  
  - name: MLPipelineSlow
    condition: p95(ml_pipeline_time) > 3500ms for 10m
    severity: warning
  
  - name: HighErrorRate
    condition: error_rate > 2% for 2m
    severity: critical
```

## Troubleshooting

### Common Issues

1. **Rate Limiting During Tests**
   ```bash
   # Increase rate limits for test IPs
   export TEST_IP_WHITELIST="10.0.0.0/8"
   ```

2. **Database Connection Exhaustion**
   ```bash
   # Increase connection pool
   export DB_MAX_CONNECTIONS=200
   ```

3. **Memory Leaks**
   ```bash
   # Enable heap profiling
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

### Debug Commands

```bash
# Check service health during tests
curl http://localhost/api/v1/health

# Monitor real-time metrics
watch -n 1 'curl -s http://localhost:9090/metrics | grep http_'

# Check service logs
docker compose logs -f api-gateway

# Database connection status
docker exec postgres-db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
```

## Best Practices

1. **Test in Production-like Environment**
   - Use same hardware specs
   - Include all services
   - Use real data volumes

2. **Gradual Load Increase**
   - Start with low load
   - Increase gradually
   - Monitor for issues

3. **Clean Test Data**
   - Reset databases between runs
   - Clear caches
   - Remove test users

4. **Document Findings**
   - Record baseline metrics
   - Track improvements
   - Share learnings

5. **Automate Everything**
   - Test execution
   - Result analysis
   - Report generation