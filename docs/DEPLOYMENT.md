# 🚀 BetterPrompts Deployment Guide

This guide covers the deployment process for BetterPrompts, including building production images, deploying to staging, and running validation tests.

## 📋 Prerequisites

Before deploying, ensure you have:

- Docker 20.10+ and Docker Compose 2.0+
- At least 10GB free disk space
- Required tools: `curl`, `jq`, `make`
- Access to deployment environment
- Environment configuration files

## 🏗️ Build Process

### Quick Start

```bash
# Complete staging deployment (build + deploy + test)
./scripts/deploy-staging-complete.sh

# Skip building if images already exist
./scripts/deploy-staging-complete.sh --skip-build

# Dry run to see what would happen
./scripts/deploy-staging-complete.sh --dry-run
```

### Building Production Images

The build script creates optimized production Docker images for all services:

```bash
# Build all production images
./scripts/build-production.sh

# Images will be:
# - Tagged with VERSION and timestamp
# - Security scanned (if Trivy installed)
# - Saved to docker-images/ directory
# - Documented in build report
```

**What gets built:**
- Frontend (Next.js)
- API Gateway (Go)
- Intent Classifier (Python)
- Technique Selector (Go) 
- Prompt Generator (Python)

## 🌍 Environment Configuration

### Setting Up Staging Environment

1. **Create environment file:**
   ```bash
   cp .env.example .env.staging
   ```

2. **Update critical values:**
   - `DATABASE_URL` - PostgreSQL connection
   - `REDIS_URL` - Redis connection
   - `JWT_SECRET` - Authentication secret
   - `OPENAI_API_KEY` - OpenAI API key
   - `ANTHROPIC_API_KEY` - Anthropic API key

3. **Staging-specific settings:**
   ```env
   ENVIRONMENT=staging
   LOG_LEVEL=DEBUG
   GIN_MODE=debug
   NODE_ENV=staging
   ```

## 📦 Deployment Process

### Deploy to Staging

```bash
# Deploy using staging configuration
ENV_FILE=.env.staging ./scripts/deploy-staging.sh

# What happens:
# 1. Validates prerequisites
# 2. Creates Docker networks/volumes
# 3. Pulls/loads images
# 4. Starts services in order
# 5. Runs health checks
# 6. Executes database migrations
```

### Service Startup Order

1. **Infrastructure**: PostgreSQL, Redis
2. **Core Services**: API Gateway, ML services
3. **Frontend**: Next.js application
4. **Proxy**: Nginx reverse proxy
5. **Monitoring**: Prometheus, Grafana (optional)

## ✅ Validation & Testing

### Smoke Tests

Run comprehensive smoke tests to verify deployment:

```bash
# Run all smoke tests
./scripts/smoke-tests.sh

# Tests include:
# - Frontend accessibility
# - API health endpoints
# - Service connectivity
# - Authentication flow
# - Core enhancement functionality
# - Database/Redis connectivity
```

### Health Checks

All services expose health endpoints:

- API Gateway: `GET /api/v1/health`
- Intent Classifier: `GET /api/v1/intent-classifier/health`
- Technique Selector: `GET /api/v1/technique-selector/health`
- Prompt Generator: `GET /api/v1/prompt-generator/health`

### Manual Verification

```bash
# Check all services are running
docker-compose -f docker-compose.prod.yml ps

# View service logs
docker-compose -f docker-compose.prod.yml logs -f [service]

# Check resource usage
docker stats

# Test API endpoint
curl http://localhost/api/v1/health
```

## 📊 Monitoring

### Accessing Monitoring Tools

If monitoring is configured:

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

### Key Metrics to Monitor

1. **Service Health**: All services reporting healthy
2. **Response Times**: API < 200ms, Enhancement < 3s
3. **Error Rates**: < 0.1% for production
4. **Resource Usage**: CPU < 80%, Memory < 90%

## 🔧 Troubleshooting

### Common Issues

1. **Service Won't Start**
   ```bash
   # Check logs
   docker-compose -f docker-compose.prod.yml logs [service]
   
   # Verify environment variables
   docker-compose -f docker-compose.prod.yml exec [service] env
   ```

2. **Database Connection Failed**
   ```bash
   # Test database connectivity
   docker exec betterprompts-postgres pg_isready
   
   # Check migrations
   docker-compose -f docker-compose.prod.yml exec api-gateway /app/migrate status
   ```

3. **Frontend Can't Connect to API**
   - Verify `NEXT_PUBLIC_API_URL` in frontend environment
   - Check Nginx proxy configuration
   - Ensure CORS settings are correct

### Debug Commands

```bash
# Enter service container
docker-compose -f docker-compose.prod.yml exec [service] /bin/sh

# Check service configuration
docker-compose -f docker-compose.prod.yml config

# Force recreate services
docker-compose -f docker-compose.prod.yml up -d --force-recreate [service]

# Clean restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 Rollback Procedures

### Quick Rollback

1. **Stop current deployment:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

2. **Restore database (if backed up):**
   ```bash
   gunzip -c backup.sql.gz | docker exec -i betterprompts-postgres psql -U betterprompts
   ```

3. **Deploy previous version:**
   ```bash
   VERSION=previous-version docker-compose -f docker-compose.prod.yml up -d
   ```

### Backup Before Deployment

The deployment script automatically backs up:
- Database dump
- Current deployment state
- Configuration files

Backups are stored in: `deployment-[timestamp]/backups/`

## 🚀 Production Deployment

### Additional Considerations

1. **SSL/TLS Configuration**
   - Update Nginx with SSL certificates
   - Enable HTTPS redirect
   - Configure secure headers

2. **Domain Setup**
   - Update `API_URL` and `CORS_ALLOWED_ORIGINS`
   - Configure DNS records
   - Set up load balancer

3. **Security Hardening**
   - Change all default passwords
   - Rotate JWT secrets
   - Enable firewall rules
   - Configure rate limiting

4. **Performance Tuning**
   - Adjust service replicas
   - Configure resource limits
   - Enable caching layers
   - Optimize database indexes

## 📝 Deployment Checklist

- [ ] Environment file configured
- [ ] Docker images built successfully
- [ ] Staging environment accessible
- [ ] All services healthy
- [ ] Smoke tests passing
- [ ] Database migrations complete
- [ ] Monitoring configured
- [ ] Backups created
- [ ] Documentation updated
- [ ] Team notified

## 🆘 Support

For deployment issues:

1. Check deployment logs in `deployment-*/logs/`
2. Review service logs with docker-compose
3. Consult troubleshooting section
4. Contact DevOps team

---

Remember: Always test in staging before production deployment!