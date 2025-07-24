#!/bin/bash
# Staging Deployment Script for BetterPrompts
# This script deploys the application to staging environment with validation

set -e
set -u
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.staging}"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"
DEPLOYMENT_LOG="${PROJECT_ROOT}/deployment-staging.log"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_DELAY=10

# Services to deploy
SERVICES=(
    "postgres"
    "redis"
    "nginx"
    "frontend"
    "api-gateway"
    "intent-classifier"
    "technique-selector"
    "prompt-generator"
)

# Function to log messages
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} ${message}"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} ${message}"
            ;;
        WARNING)
            echo -e "${YELLOW}[WARNING]${NC} ${message}"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} ${message}"
            ;;
    esac
    
    echo "[${timestamp}] [${level}] ${message}" >> "${DEPLOYMENT_LOG}"
}

# Function to check prerequisites
check_prerequisites() {
    log INFO "Checking deployment prerequisites..."
    
    # Check docker-compose file
    if [ ! -f "${COMPOSE_FILE}" ]; then
        log ERROR "docker-compose.prod.yml not found at ${COMPOSE_FILE}"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "${ENV_FILE}" ]; then
        log WARNING "Environment file not found at ${ENV_FILE}"
        log INFO "Creating from template..."
        
        if [ -f "${PROJECT_ROOT}/.env.example" ]; then
            cp "${PROJECT_ROOT}/.env.example" "${ENV_FILE}"
            log WARNING "Please edit ${ENV_FILE} with staging values before continuing"
            log INFO "Press Enter when ready to continue..."
            read -r
        else
            log ERROR "No .env.example found to create staging environment"
            exit 1
        fi
    fi
    
    # Validate environment variables
    log INFO "Validating environment configuration..."
    
    # Check required variables
    required_vars=(
        "DOCKER_REGISTRY"
        "VERSION"
        "DATABASE_URL"
        "REDIS_URL"
        "JWT_SECRET"
        "API_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "${ENV_FILE}"; then
            log ERROR "Required variable ${var} not found in ${ENV_FILE}"
            exit 1
        fi
    done
    
    log SUCCESS "Prerequisites validated"
}

# Function to create networks and volumes
setup_infrastructure() {
    log INFO "Setting up Docker infrastructure..."
    
    # Create network if it doesn't exist
    if ! docker network ls | grep -q "betterprompts-network"; then
        docker network create betterprompts-network
        log SUCCESS "Created Docker network: betterprompts-network"
    fi
    
    # Create required volumes
    volumes=(
        "postgres-data"
        "redis-data"
        "intent-models"
        "ml-cache"
        "prometheus-data"
        "grafana-data"
    )
    
    for volume in "${volumes[@]}"; do
        if ! docker volume ls | grep -q "${volume}"; then
            docker volume create "${volume}"
            log SUCCESS "Created Docker volume: ${volume}"
        fi
    done
}

# Function to deploy services
deploy_services() {
    log INFO "Deploying services to staging..."
    
    # Pull latest images
    log INFO "Pulling latest images..."
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull 2>&1 | tee -a "${DEPLOYMENT_LOG}"
    
    # Stop existing services
    log INFO "Stopping existing services..."
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" down --remove-orphans
    
    # Start services in dependency order
    log INFO "Starting services..."
    
    # Start infrastructure services first
    log INFO "Starting infrastructure services..."
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d postgres redis
    sleep 10  # Wait for databases to initialize
    
    # Start application services
    log INFO "Starting application services..."
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d \
        api-gateway \
        intent-classifier \
        technique-selector \
        prompt-generator
    
    # Start frontend and proxy
    log INFO "Starting frontend and proxy..."
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d frontend nginx
    
    # Start monitoring (if configured)
    if docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" config --services | grep -q "prometheus"; then
        log INFO "Starting monitoring services..."
        docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d prometheus grafana
    fi
    
    log SUCCESS "All services deployed"
}

# Function to check service health
check_service_health() {
    local service=$1
    local container_name="betterprompts-${service}"
    
    # Check if container is running
    if ! docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
        return 1
    fi
    
    # Check container health status
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' "${container_name}" 2>/dev/null || echo "none")
    
    case ${health_status} in
        healthy)
            return 0
            ;;
        none)
            # No health check defined, check if running
            local running=$(docker inspect --format='{{.State.Running}}' "${container_name}")
            if [ "${running}" = "true" ]; then
                return 0
            fi
            ;;
    esac
    
    return 1
}

# Function to wait for services to be healthy
wait_for_services() {
    log INFO "Waiting for services to be healthy..."
    
    for service in "${SERVICES[@]}"; do
        local retries=0
        
        while [ ${retries} -lt ${HEALTH_CHECK_RETRIES} ]; do
            if check_service_health "${service}"; then
                log SUCCESS "${service} is healthy"
                break
            else
                retries=$((retries + 1))
                log WARNING "${service} not ready, retrying (${retries}/${HEALTH_CHECK_RETRIES})..."
                sleep ${HEALTH_CHECK_DELAY}
            fi
        done
        
        if [ ${retries} -eq ${HEALTH_CHECK_RETRIES} ]; then
            log ERROR "${service} failed to become healthy"
            return 1
        fi
    done
    
    return 0
}

# Function to run database migrations
run_migrations() {
    log INFO "Running database migrations..."
    
    # Run API Gateway migrations
    if docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" \
        exec -T api-gateway /app/migrate up 2>&1 | tee -a "${DEPLOYMENT_LOG}"; then
        log SUCCESS "Database migrations completed"
    else
        log WARNING "Database migrations may have failed - check logs"
    fi
}

# Function to display deployment status
display_status() {
    log INFO "Deployment Status:"
    
    echo
    docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
    echo
    
    # Get service URLs
    local frontend_url="http://localhost"
    local api_url="http://localhost/api/v1"
    local grafana_url="http://localhost:3001"
    
    # Display access URLs
    echo -e "${BLUE}Service URLs:${NC}"
    echo "  Frontend: ${frontend_url}"
    echo "  API: ${api_url}/health"
    echo "  API Docs: ${api_url}/docs"
    
    if docker-compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps | grep -q "grafana"; then
        echo "  Monitoring: ${grafana_url} (admin/admin)"
    fi
    
    echo
}

# Function to generate deployment report
generate_deployment_report() {
    local report_file="${PROJECT_ROOT}/deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    log INFO "Generating deployment report..."
    
    cat > "${report_file}" << EOF
# BetterPrompts Staging Deployment Report

**Deployment Date**: $(date)  
**Environment**: Staging  
**Compose File**: ${COMPOSE_FILE}  
**Environment File**: ${ENV_FILE}

## Service Status

| Service | Container | Status | Health |
|---------|-----------|--------|---------|
EOF
    
    for service in "${SERVICES[@]}"; do
        local container_name="betterprompts-${service}"
        local status="🔴 Not Running"
        local health="-"
        
        if docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
            status="🟢 Running"
            if check_service_health "${service}"; then
                health="✅ Healthy"
            else
                health="⚠️ Unhealthy"
            fi
        fi
        
        echo "| ${service} | ${container_name} | ${status} | ${health} |" >> "${report_file}"
    done
    
    cat >> "${report_file}" << EOF

## Resource Usage

\`\`\`
$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep betterprompts || true)
\`\`\`

## Deployment Logs

See full deployment logs at: \`${DEPLOYMENT_LOG}\`

## Next Steps

1. Run smoke tests: \`./scripts/smoke-tests.sh\`
2. Check application logs: \`docker-compose -f ${COMPOSE_FILE} logs -f [service]\`
3. Monitor health endpoints
4. Run integration tests

## Troubleshooting

- Check logs: \`docker-compose -f ${COMPOSE_FILE} logs [service]\`
- Restart service: \`docker-compose -f ${COMPOSE_FILE} restart [service]\`
- Check environment: \`docker-compose -f ${COMPOSE_FILE} exec [service] env\`
EOF
    
    log SUCCESS "Deployment report generated: ${report_file}"
}

# Main execution
main() {
    log INFO "Starting BetterPrompts staging deployment..."
    
    # Initialize log
    echo "BetterPrompts Staging Deployment Log - $(date)" > "${DEPLOYMENT_LOG}"
    
    # Check prerequisites
    check_prerequisites
    
    # Setup infrastructure
    setup_infrastructure
    
    # Deploy services
    deploy_services
    
    # Wait for services to be healthy
    if wait_for_services; then
        log SUCCESS "All services are healthy"
        
        # Run migrations
        run_migrations
    else
        log ERROR "Some services failed to become healthy"
        log ERROR "Check logs with: docker-compose -f ${COMPOSE_FILE} logs"
        exit 1
    fi
    
    # Display status
    display_status
    
    # Generate report
    generate_deployment_report
    
    log SUCCESS "Staging deployment completed successfully!"
    
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Run smoke tests: ./scripts/smoke-tests.sh"
    echo "2. Check the deployment report"
    echo "3. Monitor service logs"
    echo "4. Run full integration tests"
}

# Run main function
main "$@"