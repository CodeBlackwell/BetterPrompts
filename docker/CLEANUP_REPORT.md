# Docker Cleanup Report

## Overview
This report documents the Docker cleanup performed on the BetterPrompts project to remove unused and duplicate resources.

## Identified Issues

### 1. Duplicate Dockerfiles
Found duplicate Dockerfiles in the `/docker/backend/` directory that mirror the official ones in `/backend/services/`:

- ❌ `/docker/backend/technique-selector/Dockerfile` → Duplicate of `/backend/services/technique-selector/Dockerfile`
- ❌ `/docker/backend/intent-classifier/Dockerfile` → Duplicate of `/backend/services/intent-classifier/Dockerfile`  
- ❌ `/docker/backend/prompt-generator/Dockerfile` → Duplicate of `/backend/services/prompt-generator/Dockerfile`

### 2. Obsolete Files
- ❌ `/backend/services/prompt-generator/Dockerfile.light` - Unused variant
- ❌ `/docker-compose.yml.backup` - Contains old frontend configuration (project is now API-only)
- ❌ `/backend/docker-compose.yml` - Partial/old configuration
- ❌ `/backend/services/intent-classifier/docker-compose.prod.yml` - Service-specific compose file

### 3. Docker Compose Organization
Current valid Docker Compose files:
- ✅ `docker-compose.yml` - Main development configuration
- ✅ `docker-compose.local.yml` - Local development without TorchServe
- ✅ `docker-compose.prod.yml` - Production configuration
- ✅ `docker-compose.test.yml` - Testing configuration
- ✅ `docker-compose.integration-test.yml` - Integration testing
- ✅ `docker-compose.security-test.yml` - Security testing
- ✅ `docker-compose.buildkit.yml` - BuildKit optimizations
- ✅ `docker-compose.override.yml` - Local overrides

## Cleanup Actions

### Files to Remove
```bash
# Duplicate Dockerfiles
rm -f docker/backend/technique-selector/Dockerfile
rm -f docker/backend/intent-classifier/Dockerfile
rm -f docker/backend/prompt-generator/Dockerfile

# Obsolete files
rm -f backend/services/prompt-generator/Dockerfile.light
rm -f docker-compose.yml.backup
rm -f backend/docker-compose.yml
rm -f backend/services/intent-classifier/docker-compose.prod.yml

# Clean empty directories
find docker/backend -type d -empty -delete
```

### Docker System Cleanup
```bash
# Remove unused images
docker image prune -a -f

# Remove unused build cache
docker builder prune -f

# Remove unused volumes
docker volume prune -f

# Remove unused networks
docker network prune -f

# Full system cleanup (optional)
docker system prune -a -f --volumes
```

## Created Resources

### 1. Docker Cleanup Script
Created `/scripts/docker-cleanup.sh` - An interactive cleanup script that:
- Removes duplicate/obsolete files with confirmation
- Cleans Docker system resources
- Shows disk usage statistics
- Provides cleanup recommendations

### 2. Updated .dockerignore
Enhanced to exclude more unnecessary files from Docker build context

## Recommendations

1. **Use Canonical Locations**: Always use Dockerfiles in `/backend/services/*/` directories
2. **Regular Cleanup**: Run the cleanup script weekly to prevent resource accumulation
3. **Monitor Disk Usage**: Use `docker system df` to track Docker disk usage
4. **BuildKit**: Always use `DOCKER_BUILDKIT=1` for better caching
5. **Compose Organization**: Keep all compose files in the project root for consistency

## Space Savings

Expected savings after cleanup:
- **Duplicate Files**: ~50KB
- **Docker Images**: Varies (likely 1-2GB of unused images)
- **Build Cache**: Varies (likely 500MB-1GB)
- **Unused Volumes**: Varies based on usage

## Next Steps

1. Run the cleanup script: `./scripts/docker-cleanup.sh`
2. Verify services still work: `docker compose up -d`
3. Set up regular cleanup schedule
4. Consider implementing Docker image retention policy in CI/CD