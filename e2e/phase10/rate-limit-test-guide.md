# Rate Limit Testing Guide

## Overview

This guide provides comprehensive instructions for testing rate limiting functionality in the BetterPrompts API. The tests ensure that rate limits are accurately enforced, headers provide correct information, and the system handles concurrent access gracefully.

## Test Structure

### Test Files

1. **us-015-rate-limiting.spec.ts** - Core rate limiting functionality
2. **ec-06-concurrent-access.spec.ts** - Concurrent request handling
3. **rate-limit-headers.spec.ts** - Header validation and accuracy
4. **distributed-limiting.spec.ts** - Distributed system rate limiting

### Utility Files

1. **rate-limit-tester.ts** - Core rate limiting test functionality
2. **concurrent-request-helper.ts** - Concurrent request generation
3. **rate-limit-header-validator.ts** - Header validation logic
4. **load-generator.ts** - Load pattern generation for stress testing

## Configuration

### Environment Variables

```bash
# Required
API_BASE_URL=http://localhost/api/v1

# Optional
DISTRIBUTED_ENDPOINTS=http://server1/api/v1,http://server2/api/v1
RATE_LIMIT_TEST_DURATION=60000
```

### Test Configuration

```typescript
const testConfig = {
  perUserLimit: 1000,      // Requests per user per minute
  perIPLimit: 5000,        // Requests per IP per minute
  windowDuration: 60000,   // Rate limit window (1 minute)
  testApiKeys: [           // Test API keys
    'test-key-user1-primary',
    'test-key-user1-secondary',
    'test-key-user2-primary',
  ],
};
```

## Running Tests

### All Rate Limit Tests

```bash
npm test -- e2e/phase10/
```

### Specific Test Suites

```bash
# Core rate limiting
npm test -- e2e/phase10/us-015-rate-limiting.spec.ts

# Concurrent access
npm test -- e2e/phase10/ec-06-concurrent-access.spec.ts

# Header validation
npm test -- e2e/phase10/rate-limit-headers.spec.ts

# Distributed limiting (requires multiple endpoints)
npm test -- e2e/phase10/distributed-limiting.spec.ts
```

### With Specific Configuration

```bash
# Custom rate limits
API_BASE_URL=https://api.staging.com/v1 npm test -- e2e/phase10/

# Distributed testing
DISTRIBUTED_ENDPOINTS=http://api1.com/v1,http://api2.com/v1 npm test -- e2e/phase10/distributed-limiting.spec.ts
```

## Test Scenarios

### Per-User Rate Limiting

1. **Under Limit** - Verify requests succeed when under limit
2. **At Limit** - Verify exactly limit requests succeed
3. **Over Limit** - Verify 429 responses when exceeding limit
4. **Multiple API Keys** - Verify limits shared across user's keys
5. **User Isolation** - Verify limits independent between users
6. **Reset Behavior** - Verify limits reset after window expires

### Per-IP Rate Limiting

1. **Anonymous Requests** - Verify IP-based limits for unauthenticated requests
2. **Multiple Users Same IP** - Verify IP limits with multiple users
3. **Proxy Headers** - Verify correct handling of X-Forwarded-For
4. **IPv4/IPv6** - Verify both IP versions handled correctly

### Rate Limit Headers

Required headers on all responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Reset` - Unix timestamp when window resets

Optional headers:
- `X-RateLimit-Reset-After` - Seconds until reset
- `X-RateLimit-Bucket` - Rate limit bucket identifier

429 Response headers:
- `Retry-After` - Seconds to wait before retry

### Concurrent Access

1. **Burst Handling** - 100, 1000 simultaneous requests
2. **Sustained Load** - Consistent RPS over time
3. **Alternating Patterns** - Burst followed by quiet periods
4. **Queue Fairness** - Equal access for multiple users
5. **No Starvation** - Light users not blocked by heavy users

### Distributed Rate Limiting

1. **Cross-Server Coordination** - Limits shared across instances
2. **Consistent State** - Same limits reported by all servers
3. **Reset Synchronization** - Coordinated window resets
4. **Failure Handling** - Graceful degradation with partial failures

## Common Issues and Solutions

### Issue: Rate limits not enforced

**Symptoms**: More than expected requests succeed

**Solutions**:
1. Check Redis/storage connection
2. Verify middleware ordering
3. Check distributed coordination
4. Verify API key validation

### Issue: Headers missing or incorrect

**Symptoms**: Required headers not present or wrong values

**Solutions**:
1. Verify middleware is active
2. Check header name casing
3. Verify time synchronization
4. Check storage backend

### Issue: Inconsistent limits across servers

**Symptoms**: Different servers report different limits/remaining

**Solutions**:
1. Check distributed storage configuration
2. Verify clock synchronization
3. Check network connectivity
4. Review cache settings

### Issue: Reset timing incorrect

**Symptoms**: Reset time not aligned with window boundaries

**Solutions**:
1. Verify timezone handling
2. Check server time sync
3. Review window calculation logic
4. Verify storage precision

## Performance Benchmarks

### Expected Performance

| Metric | Target | Acceptable |
|--------|--------|------------|
| Rate limit check overhead | < 5ms | < 10ms |
| 429 response time | < 50ms | < 100ms |
| Header accuracy | 100% | > 99% |
| Reset timing accuracy | ± 1s | ± 5s |
| Distributed sync delay | < 100ms | < 500ms |

### Load Test Targets

| Scenario | Target RPS | Success Rate |
|----------|------------|--------------|
| Normal load | 100 | > 99% |
| Burst (100 req) | - | > 90% |
| Burst (1000 req) | - | > 80% |
| Sustained high | 500 | > 95% |
| Extreme spike | 1000 | > 50% |

## Best Practices

### Test Data Management

1. Use unique API keys per test to avoid interference
2. Clean up test data after distributed tests
3. Allow time for rate limit windows to reset between test runs
4. Use meaningful test identifiers for debugging

### Performance Testing

1. Warm up the system before performance tests
2. Use multiple iterations for consistent results
3. Monitor system resources during tests
4. Test during different load conditions

### Debugging Failed Tests

1. Check test logs for specific error messages
2. Verify rate limit configuration matches expectations
3. Use header validator to debug header issues
4. Enable debug logging in rate limit middleware
5. Check distributed storage logs for sync issues

## Extending Tests

### Adding New Test Scenarios

1. Create new test file or add to existing suite
2. Use provided utilities for consistency
3. Follow naming conventions for test API keys
4. Document expected behavior clearly
5. Add to CI/CD pipeline

### Custom Load Patterns

```typescript
const customPattern: LoadPattern = {
  type: 'custom',
  duration: 60000,
  calculateRPS: (elapsed: number) => {
    // Custom RPS calculation
    return Math.sin(elapsed / 1000) * 100 + 100;
  }
};
```

### Utility Extensions

1. Add new validation methods to header validator
2. Extend load generator with custom patterns
3. Add specialized concurrent test scenarios
4. Create custom assertions for rate limits

## Troubleshooting Checklist

- [ ] API keys configured correctly
- [ ] Redis/storage backend running
- [ ] Rate limit middleware enabled
- [ ] Headers middleware in correct order
- [ ] Time synchronization verified
- [ ] Network connectivity confirmed
- [ ] Test isolation ensured
- [ ] Window duration matches config
- [ ] Distributed endpoints reachable
- [ ] Cache configuration reviewed

## Related Documentation

- [API Rate Limiting Design](../../../planning/API_RATE_LIMITING.md)
- [Performance Requirements](../../../planning/PERFORMANCE_REQUIREMENTS.md)
- [API Documentation](../../../docs/API.md)
- [Redis Configuration](../../../infrastructure/redis/README.md)