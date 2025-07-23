# Seed Script Troubleshooting Guide

## Problem Summary

The `seed-demo-data.sh` script was failing with the error:
```
[ERROR] API Gateway is not available at http://api-gateway:8000
```

## Root Causes Identified

### 1. **Environment Variable Conflict**
- The `.env` file contained `API_GATEWAY_URL=http://api-gateway:8000`
- `api-gateway` is the Docker internal hostname, only accessible from within the Docker network
- When running the script from the host machine, it needs to use `localhost` instead

### 2. **Wrong Health Check Endpoint**
- The script was checking `/health` 
- The correct endpoint is `/api/v1/health`

## Solutions Applied

### 1. **Created Local Environment Override**
Created `.env.local` with:
```bash
# Local development overrides
API_GATEWAY_URL=http://localhost:8000
```

### 2. **Updated Scripts to Load .env.local**
Modified both `seed-demo-data.sh` and `verify-demo-data.sh` to load `.env.local` after `.env`:
```bash
# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi
# Load local overrides
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    export $(cat "$PROJECT_ROOT/.env.local" | grep -v '^#' | xargs)
fi
```

### 3. **Fixed Health Check Endpoint**
Changed from:
```bash
curl -f -s "$API_GATEWAY_URL/health"
```
To:
```bash
curl -f -s "$API_GATEWAY_URL/api/v1/health"
```

## Quick Verification

Test the API Gateway connection:
```bash
# Should return healthy status
curl -s http://localhost:8000/api/v1/health | jq .
```

## Running the Fixed Script

Now you can run:
```bash
./scripts/seed-demo-data.sh
```

## Common Issues and Solutions

### Issue 1: Services Not Running
**Symptom**: API Gateway not available
**Solution**: 
```bash
docker compose up -d
docker compose ps  # Check all services are healthy
```

### Issue 2: Port Conflicts
**Symptom**: Cannot connect to localhost:8000
**Solution**: Check if port 8000 is in use:
```bash
lsof -i :8000
# If occupied, stop conflicting service or change port in docker-compose.yml
```

### Issue 3: Environment Variable Not Loading
**Symptom**: Still trying to connect to api-gateway hostname
**Solution**: 
```bash
# Verify .env.local exists
cat .env.local

# Test variable loading
source .env.local
echo $API_GATEWAY_URL  # Should show http://localhost:8000
```

### Issue 4: Authentication Failures
**Symptom**: Users already exist errors
**Solution**: This is normal if running multiple times. The script handles this gracefully.

## Docker Network vs Host Network

### Inside Docker Network
- Services communicate using container names: `http://api-gateway:8090`
- This is what services use internally

### From Host Machine
- Use localhost with exposed ports: `http://localhost:8000`
- Port 8000 on host maps to port 8090 in container

## File Structure After Fix

```
BetterPrompts/
├── .env                    # Original with Docker-internal URLs
├── .env.local             # Local overrides (gitignored)
├── scripts/
│   ├── seed-demo-data.sh  # Updated to use .env.local
│   ├── verify-demo-data.sh # Updated to use .env.local
│   └── fix-seed-script.sh  # Fix application script
```

## Prevention for Future

1. **Always use .env.local** for local development overrides
2. **Document port mappings** clearly in README
3. **Use consistent health check endpoints** across all services
4. **Test scripts from host machine** not just from within containers

## Debug Commands

```bash
# Check if API Gateway is accessible
curl -v http://localhost:8000/api/v1/health

# Test authentication endpoint
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!"}'

# Check Docker logs if issues persist
docker logs betterprompts-api-gateway --tail 50

# Verify environment variable loading
bash -x ./scripts/seed-demo-data.sh 2>&1 | head -20
```

## Summary

The issue was caused by:
1. Environment variable pointing to Docker-internal hostname
2. Wrong health check endpoint

Fixed by:
1. Creating `.env.local` with localhost URL
2. Updating scripts to load `.env.local`
3. Correcting the health check endpoint

The scripts now work correctly from the host machine!