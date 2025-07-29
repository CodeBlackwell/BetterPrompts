# Phase 10: Rate Limiting & Concurrent Access Tests

## Overview

This test suite implements comprehensive E2E tests for rate limiting and concurrent access control in the BetterPrompts API. The tests verify that:

- Rate limits are accurately enforced per user and per IP
- Headers provide correct rate limit information
- The system handles concurrent requests gracefully
- Distributed rate limiting works across multiple servers

## User Stories Covered

- **US-015**: "As a system admin, I want to prevent API abuse through rate limiting"
- **EC-06**: "Handle concurrent access and ensure fair queuing"

## Test Structure

```
phase10/
├── us-015-rate-limiting.spec.ts      # Core rate limiting tests
├── ec-06-concurrent-access.spec.ts   # Concurrent request handling
├── rate-limit-headers.spec.ts        # Header validation tests
├── distributed-limiting.spec.ts      # Multi-server coordination
├── utils/
│   ├── rate-limit-tester.ts         # Rate limit testing utilities
│   ├── concurrent-request-helper.ts  # Concurrent request generation
│   ├── rate-limit-header-validator.ts # Header validation logic
│   └── load-generator.ts            # Load pattern generation
├── rate-limit-test-guide.md         # Comprehensive testing guide
├── performance-baseline.md          # Performance benchmarks
├── package.json                     # Dependencies
├── playwright.config.ts             # Test configuration
├── global-setup.ts                  # Test preparation
├── global-teardown.ts              # Test cleanup
└── README.md                       # This file
```

## Prerequisites

1. **API Server Running**
   - BetterPrompts API available at `http://localhost/api/v1`
   - Rate limiting middleware enabled
   - Redis or similar storage for rate limit counters

2. **Database Access**
   - PostgreSQL database for creating test API keys
   - Redis for rate limit counters
   - Database credentials configured

3. **Environment Variables**
   ```bash
   # API Configuration
   API_BASE_URL=http://localhost/api/v1
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=betterprompts
   DB_USER=betterprompts
   DB_PASSWORD=betterprompts
   
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Optional Test Configuration
   DISTRIBUTED_ENDPOINTS=http://server1/api/v1,http://server2/api/v1
   CLEANUP_TEST_DATA=true
   DELETE_TEST_USERS=false
   ```

## Installation

```bash
cd e2e/phase10
npm install
```

## Setup Test Data

The tests require specific API keys to exist in the database. You have two options:

### Option 1: Automatic Setup (Recommended)
```bash
# Run the setup script
./setup-test-data.sh

# Or manually:
npm run setup:db
```

### Option 2: Manual Database Setup
If the automatic setup fails, you can manually create the test data:

```bash
# Setup test API keys
node test-data-setup.js setup

# Reset rate limit counters only
node test-data-setup.js reset

# Remove all test data
node test-data-setup.js teardown
```

## Running Tests

### All Tests
```bash
npm test
```

### Individual Test Suites
```bash
# Core rate limiting
npm run test:rate-limits

# Concurrent access
npm run test:concurrent

# Header validation
npm run test:headers

# Distributed limiting (requires multiple endpoints)
npm run test:distributed
```

### With UI Mode
```bash
npm run test:ui
```

### Debug Mode
```bash
npm run test:debug
```

### Performance Testing
```bash
# Generate performance metrics
npm run test:perf > perf-results.json

# Run all tests sequentially
npm run test:all
```

## Test Configuration

### Rate Limits
- **Per-User Limit**: 1000 requests per minute
- **Per-IP Limit**: 5000 requests per minute
- **Window Duration**: 60 seconds (fixed window)

### Test Timeouts
- **Default Timeout**: 120 seconds
- **Action Timeout**: 30 seconds (60s for load tests)
- **Global Timeout**: 10 minutes

## Test Scenarios

### US-015: Rate Limiting
1. **Under Limit** - 999 requests succeed
2. **At Limit** - Exactly 1000 requests succeed
3. **Over Limit** - 1001st request returns 429
4. **Multiple API Keys** - Limits shared for same user
5. **User Isolation** - Different users have separate limits
6. **Reset Behavior** - Limits reset after window expires

### EC-06: Concurrent Access
1. **Burst Handling** - 100/1000 simultaneous requests
2. **Sustained Load** - Consistent 100 RPS for 30 seconds
3. **Alternating Patterns** - Burst/quiet cycles
4. **Queue Fairness** - Multiple users get fair access
5. **No Starvation** - Light users not blocked by heavy users
6. **Race Conditions** - No counting errors under load

### Header Validation
1. **Required Headers** - X-RateLimit-Limit/Remaining/Reset
2. **Optional Headers** - Reset-After, Bucket
3. **429 Headers** - Retry-After required
4. **Consistency** - Headers accurate across requests
5. **Reset Timing** - Window boundaries accurate

### Distributed Limiting
1. **Cross-Server** - Limits shared across instances
2. **Synchronization** - Consistent state
3. **Failure Handling** - Graceful degradation
4. **Performance** - Low sync overhead

## Performance Baselines

Current performance targets:
- **Rate limit overhead**: < 5ms average
- **Success rate**: > 99% under normal load
- **Header accuracy**: 100%
- **Reset timing**: ± 1 second
- **Concurrent handling**: No race conditions

See [performance-baseline.md](./performance-baseline.md) for detailed metrics.

## Troubleshooting

### Common Issues

1. **Rate limits not enforced**
   - Check Redis connection
   - Verify middleware is enabled
   - Check API key validation

2. **Headers missing**
   - Verify middleware order
   - Check header name casing
   - Enable debug logging

3. **Tests timing out**
   - Increase timeouts in playwright.config.ts
   - Check API server performance
   - Reduce concurrent load

4. **Distributed tests failing**
   - Verify DISTRIBUTED_ENDPOINTS
   - Check network connectivity
   - Verify clock synchronization

### Debug Commands

```bash
# Run with verbose logging
DEBUG=* npm test

# Run single test with trace
npm test -- -g "should allow requests under the limit" --trace on

# Check Redis state
redis-cli KEYS "rate_limit:*"
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Phase 10 Tests
  env:
    API_BASE_URL: ${{ secrets.API_BASE_URL }}
    ADMIN_API_KEY: ${{ secrets.ADMIN_API_KEY }}
  run: |
    cd e2e/phase10
    npm install
    npm test
    
- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: phase10-test-results
    path: |
      e2e/phase10/test-results.json
      e2e/phase10/playwright-report/
```

## Contributing

### Adding New Tests

1. Create test file following naming convention
2. Use existing utilities for consistency
3. Document test scenarios clearly
4. Add to appropriate test suite in playwright.config.ts
5. Update this README

### Updating Baselines

```bash
# Generate new baseline
npm run test:perf > baseline-$(date +%Y%m%d).json

# Compare with previous
diff baseline-*.json
```

## Related Documentation

- [Phase 10 Planning](../../planning/e2e_testing/phases/phase_10_rate_limiting.md)
- [Rate Limiting Test Guide](./rate-limit-test-guide.md)
- [Performance Baseline](./performance-baseline.md)
- [API Documentation](../../docs/API.md)
- [E2E Testing Overview](../README.md)

## Success Metrics

- [x] All rate limiting tests pass
- [x] Headers 100% accurate
- [x] No race conditions detected
- [x] Performance within targets
- [x] Fair access for all users
- [x] Graceful degradation under load

## Next Steps

After Phase 10 completion:
1. Phase 11: Security Testing
2. Performance optimization based on baselines
3. Production monitoring setup
4. Rate limit tuning based on usage patterns