# BetterPrompts Troubleshooting Guide

This guide helps diagnose and resolve common issues with the BetterPrompts system.

## Table of Contents
1. [Critical Issues & Quick Fixes](#critical-issues--quick-fixes)
2. [Service Health Checks](#service-health-checks)
3. [Common Problems & Solutions](#common-problems--solutions)
4. [Debugging Commands](#debugging-commands)
5. [Performance Issues](#performance-issues)
6. [Demo Environment Setup](#demo-environment-setup)

## Critical Issues & Quick Fixes

### 🔴 Enhancement Not Working (Most Critical)

**Symptoms**: 
- Enhanced prompts are identical to original prompts
- Techniques not being applied despite being selected

**Root Cause**: 
The prompt generator requires `enhanced: true` in the context to apply techniques, but the API Gateway doesn't set this flag.

**Quick Fix**:
```go
// In backend/services/api-gateway/internal/handlers/enhance.go
// Around line 110, update the generation request:

generationRequest := models.PromptGenerationRequest{
    Text:       req.Text,
    Intent:     intentResult.Intent,
    Complexity: intentResult.Complexity,
    Techniques: techniques,
    Context: map[string]interface{}{
        "enhanced": true,  // ADD THIS LINE
        // ... other context fields
    },
}
```

**Verification**:
```bash
# After fix, rebuild and test:
docker compose build api-gateway
docker compose up -d api-gateway
curl -X POST http://localhost/api/v1/enhance \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "explain quantum computing"}'
```

### 🔴 Authentication Issues

**Symptoms**:
- Registration returns 500 error
- Login fails with 401
- No users in database

**Quick Fix**:
```bash
# 1. Check database migrations
docker compose exec postgres psql -U betterprompts -d betterprompts \
  -c "SELECT * FROM schema_migrations;"

# 2. Create demo user manually
docker compose exec postgres psql -U betterprompts -d betterprompts << EOF
INSERT INTO users (id, email, username, password_hash, is_active, tier, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'demo@betterprompts.ai',
  'demo',
  '\$2a\$10\$YourHashedPasswordHere',  -- Use proper bcrypt hash
  true,
  'free',
  NOW(),
  NOW()
);
EOF

# 3. Restart API Gateway
docker compose restart api-gateway
```

### 🔴 Service Health Issues

**Frontend Healthcheck Failing**:
```bash
# Check Next.js logs
docker compose logs -f frontend

# Common fix - rebuild with proper dependencies
cd frontend
npm install --legacy-peer-deps
npm run build
docker compose build frontend
docker compose up -d frontend
```

**TorchServe Not Healthy**:
```bash
# Check if model is loaded
curl http://localhost:8080/models

# Restart TorchServe
docker compose restart torchserve

# If persists, check model files
docker compose exec torchserve ls -la /models
```

## Service Health Checks

### Quick Health Status
```bash
# All services status
docker compose ps

# API Gateway health
curl http://localhost/health

# Individual service health
curl http://localhost:8001/health  # Intent Classifier
curl http://localhost:8002/health  # Technique Selector
curl http://localhost:8003/health  # Prompt Generator
```

### Database Connectivity
```bash
# Test PostgreSQL
docker compose exec postgres pg_isready

# Test Redis
docker compose exec redis redis-cli ping

# Check database tables
docker compose exec postgres psql -U betterprompts -d betterprompts \
  -c "\dt"
```

## Common Problems & Solutions

### 1. CORS Errors in Frontend

**Symptom**: "Access to fetch at 'http://localhost/api/v1' from origin 'http://localhost:3000' has been blocked by CORS policy"

**Solution**:
```go
// Ensure CORS middleware is properly configured in API Gateway
// backend/services/api-gateway/internal/middleware/cors.go
AllowOrigins: []string{
    "http://localhost:3000",
    "http://localhost",
},
```

### 2. Redis Connection Refused

**Symptom**: "dial tcp 127.0.0.1:6379: connect: connection refused"

**Solution**:
```bash
# Check Redis is running
docker compose ps redis

# Restart Redis
docker compose restart redis

# Verify connection
docker compose exec redis redis-cli ping
```

### 3. Intent Classifier Timeout

**Symptom**: "Post \"http://intent-classifier:8001/api/v1/intents/classify\": context deadline exceeded"

**Solution**:
```bash
# Check service logs
docker compose logs intent-classifier

# Increase timeout in API Gateway
# backend/services/api-gateway/internal/services/clients.go
client: &http.Client{Timeout: 30 * time.Second}, // Increase from 10s
```

### 4. Frontend Build Failures

**Symptom**: "Module not found" or "Cannot resolve dependency"

**Solution**:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run build
```

## Debugging Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api-gateway
docker compose logs -f intent-classifier

# Last 100 lines
docker compose logs --tail=100 api-gateway
```

### Database Queries
```bash
# Check users
docker compose exec postgres psql -U betterprompts -d betterprompts \
  -c "SELECT id, email, username, is_active FROM users;"

# Check prompts
docker compose exec postgres psql -U betterprompts -d betterprompts \
  -c "SELECT id, intent, complexity, created_at FROM prompts ORDER BY created_at DESC LIMIT 5;"

# Check API usage
docker compose exec postgres psql -U betterprompts -d betterprompts \
  -c "SELECT endpoint, status_code, response_time_ms FROM api_usage ORDER BY created_at DESC LIMIT 10;"
```

### Redis Inspection
```bash
# List all keys
docker compose exec redis redis-cli KEYS "*"

# Get specific key
docker compose exec redis redis-cli GET "betterprompts:session:xxx"

# Monitor Redis commands in real-time
docker compose exec redis redis-cli MONITOR
```

## Performance Issues

### Slow API Response

1. **Check database query performance**:
```sql
-- In PostgreSQL
EXPLAIN ANALYZE SELECT * FROM prompts WHERE user_id = 'xxx' AND task_type = 'enhance';
```

2. **Verify indexes are created**:
```sql
\di  -- List all indexes
```

3. **Check Redis cache hit rate**:
```bash
docker compose exec redis redis-cli INFO stats | grep hit
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Limit memory if needed in docker-compose.yml
services:
  api-gateway:
    mem_limit: 512m
```

## Demo Environment Setup

### Pre-Demo Checklist

1. **Start all services**:
```bash
docker compose down
docker compose up -d
docker compose ps  # Verify all are running
```

2. **Wait for services to be ready**:
```bash
# Wait 30 seconds for all services to initialize
sleep 30

# Run health checks
./scripts/health-check.sh
```

3. **Create demo data**:
```bash
# Create demo user
./scripts/create-demo-user.sh

# Generate sample prompts
./scripts/generate-demo-data.sh
```

4. **Verify core functionality**:
```bash
# Test enhancement flow
./scripts/test-enhancement.sh
```

5. **Clear any errors**:
```bash
# Clear Redis cache
docker compose exec redis redis-cli FLUSHALL

# Restart any unhealthy services
docker compose restart api-gateway frontend
```

### Demo Script Validation

```bash
# Run through demo scenarios
./scripts/validate-demo.sh

# Expected output:
# ✅ User registration working
# ✅ User login working
# ✅ Prompt enhancement working
# ✅ History retrieval working
# ✅ Feedback submission working
```

### Emergency Fixes During Demo

**If enhancement stops working**:
```bash
docker compose restart api-gateway prompt-generator
```

**If frontend shows errors**:
```bash
docker compose restart frontend nginx
```

**If database connection lost**:
```bash
docker compose restart postgres
# Wait 10 seconds
docker compose restart api-gateway
```

## Monitoring During Demo

Keep these open in separate terminals:

```bash
# Terminal 1 - Service logs
docker compose logs -f api-gateway

# Terminal 2 - Performance metrics
watch -n 2 'docker stats --no-stream'

# Terminal 3 - Health checks
watch -n 5 'curl -s http://localhost/health | jq'
```

## Post-Demo Cleanup

```bash
# Stop all services
docker compose down

# Remove volumes (optional - removes all data)
docker compose down -v

# Clean up Docker resources
docker system prune -f
```

---

**Remember**: Always test the enhancement flow before any demo. It's the core feature and must work flawlessly!