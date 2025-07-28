# Phase 8 Test Readiness Checklist

## Prerequisites for Running Tests

### System Requirements
- [ ] **k6 installed**: `brew install k6` or download from https://k6.io
- [ ] **Docker running**: All services up and healthy
- [ ] **Node.js 18+**: For running Playwright tests
- [ ] **4GB+ free RAM**: For load testing scenarios

### Application Features Required

#### Frontend Implementation
- [ ] Performance Dashboard Route (`/admin/analytics`)
  - [ ] Real-time metrics display components
  - [ ] Response time graph
  - [ ] Throughput chart
  - [ ] Error rate visualization
  - [ ] Technique performance grid
  
- [ ] WebSocket Integration
  - [ ] Connect to `ws://localhost:3000/ws`
  - [ ] Subscribe to channels: `performance`, `usage`, `technique_stats`
  - [ ] Handle 5-second update intervals
  - [ ] Reconnect on disconnect

- [ ] Dashboard Features
  - [ ] Date range picker
  - [ ] Technique filter dropdown
  - [ ] User segment filter
  - [ ] Export buttons (CSV, JSON, PDF)
  - [ ] Heat map visualization
  - [ ] Alert notifications display

#### Backend Implementation
- [ ] Authentication
  - [ ] `/api/v1/auth/login` accepting `email_or_username` and `password`
  - [ ] Test users seeded:
    - `admin@betterprompts.ai` / `admin123`
    - `user1@example.com` through `user10@example.com` / `password123`

- [ ] Metrics Endpoints
  - [ ] `GET /api/v1/metrics/performance`
    ```json
    {
      "response_time": { "p50": 45, "p95": 120, "p99": 250 },
      "throughput": 850,
      "error_rate": 0.0005,
      "timestamp": "2025-07-28T15:30:00Z"
    }
    ```
  
  - [ ] `GET /api/v1/metrics/infrastructure`
    ```json
    {
      "cpu_usage": 45.2,
      "memory_usage": 62.8,
      "db_connections": { "active": 25, "max": 100 },
      "cache_hit_rate": 0.92
    }
    ```
  
  - [ ] `GET /api/v1/metrics/business`
    ```json
    {
      "user_satisfaction": 0.89,
      "sla_compliance": 0.999,
      "cost_per_request": 0.0015,
      "feature_adoption": { "chain_of_thought": 0.45, "few_shot": 0.32 }
    }
    ```
  
  - [ ] `GET /api/v1/metrics/sla`
    ```json
    {
      "availability": 0.9995,
      "latency": { "compliant": true, "current": { "p50": 45, "p95": 120, "p99": 250 } },
      "throughput": { "compliant": true, "current": 850, "target": 1000 },
      "error_rate": { "compliant": true, "current": 0.0005, "target": 0.001 }
    }
    ```

- [ ] WebSocket Server
  - [ ] Emit updates every 5 seconds
  - [ ] Support multiple concurrent connections
  - [ ] Handle subscription management

### Database Setup
- [ ] Test data seeded
  - [ ] User accounts created
  - [ ] Historical metrics populated (last 24 hours)
  - [ ] Technique usage statistics

### Monitoring Setup
- [ ] Prometheus Configuration
  - [ ] Application metrics exposed at `/metrics`
  - [ ] Custom metrics registered
  - [ ] Scrape interval: 15s

- [ ] Grafana Dashboard
  - [ ] Import `dashboards/betterprompts-performance.json`
  - [ ] Data source connected to Prometheus
  - [ ] Alerts configured

## Quick Setup Commands

```bash
# 1. Install k6 (macOS)
brew install k6

# 2. Seed test data
cd ../..
docker compose exec postgres psql -U betterprompts -d betterprompts -f /docker-entrypoint-initdb.d/test-data.sql

# 3. Import Grafana dashboard
curl -X POST http://admin:admin@localhost:3001/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @e2e/phase8/dashboards/betterprompts-performance.json

# 4. Load Prometheus alerts
docker compose exec prometheus promtool check rules /etc/prometheus/alerts.yml
```

## Verification Steps

1. **Check API Health**
   ```bash
   curl http://localhost/api/v1/health
   # Expected: {"service":"api-gateway","status":"healthy"}
   ```

2. **Test Authentication**
   ```bash
   curl -X POST http://localhost/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email_or_username":"admin@betterprompts.ai","password":"admin123"}'
   # Expected: {"access_token":"...","token_type":"bearer"}
   ```

3. **Verify Metrics Endpoint**
   ```bash
   curl http://localhost/api/v1/metrics/performance \
     -H "Authorization: Bearer YOUR_TOKEN"
   # Expected: Performance metrics JSON
   ```

4. **Test WebSocket**
   ```bash
   wscat -c ws://localhost:3000/ws
   # Then: {"type":"subscribe","channels":["performance"]}
   # Expected: Regular metric updates
   ```

## Ready to Test?

Once all items above are checked:

```bash
cd e2e/phase8
./validate-tests.sh
```

This will run a comprehensive validation and provide a detailed report of what's working and what needs attention.