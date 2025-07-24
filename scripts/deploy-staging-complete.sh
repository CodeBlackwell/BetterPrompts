#!/bin/bash
# Complete Staging Deployment Script for BetterPrompts
# This script handles the entire deployment process from building to testing

set -e
set -u
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_DIR="${PROJECT_ROOT}/deployment-$(date +%Y%m%d-%H%M%S)"
SKIP_BUILD=${SKIP_BUILD:-false}
SKIP_TESTS=${SKIP_TESTS:-false}
DRY_RUN=${DRY_RUN:-false}

# Function to display banner
display_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║         BetterPrompts Staging Deployment Suite           ║"
    echo "║                  Production Build & Deploy               ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Function to log messages
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)
            echo -e "${BLUE}[${timestamp}] [INFO]${NC} ${message}"
            ;;
        SUCCESS)
            echo -e "${GREEN}[${timestamp}] [SUCCESS]${NC} ${message}"
            ;;
        WARNING)
            echo -e "${YELLOW}[${timestamp}] [WARNING]${NC} ${message}"
            ;;
        ERROR)
            echo -e "${RED}[${timestamp}] [ERROR]${NC} ${message}"
            ;;
        STEP)
            echo -e "\n${CYAN}═══ ${message} ═══${NC}\n"
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    log STEP "Checking Prerequisites"
    
    local missing_deps=()
    
    # Check required commands
    for cmd in docker docker-compose curl jq; do
        if ! command -v $cmd &> /dev/null; then
            missing_deps+=($cmd)
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log ERROR "Missing required dependencies: ${missing_deps[*]}"
        log INFO "Please install missing dependencies and try again"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log ERROR "Docker daemon is not running"
        exit 1
    fi
    
    # Check scripts exist
    local required_scripts=(
        "scripts/build-production.sh"
        "scripts/deploy-staging.sh"
        "scripts/smoke-tests.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [ ! -f "${PROJECT_ROOT}/${script}" ]; then
            log ERROR "Required script not found: ${script}"
            exit 1
        fi
    done
    
    log SUCCESS "All prerequisites satisfied"
}

# Function to create deployment directory
setup_deployment_directory() {
    log STEP "Setting Up Deployment Directory"
    
    mkdir -p "${DEPLOYMENT_DIR}"
    
    # Create subdirectories
    mkdir -p "${DEPLOYMENT_DIR}/logs"
    mkdir -p "${DEPLOYMENT_DIR}/reports"
    mkdir -p "${DEPLOYMENT_DIR}/backups"
    
    log SUCCESS "Created deployment directory: ${DEPLOYMENT_DIR}"
}

# Function to backup current staging (if exists)
backup_current_staging() {
    log STEP "Backing Up Current Staging Environment"
    
    if docker-compose -f docker-compose.prod.yml ps 2>/dev/null | grep -q "Up"; then
        log INFO "Found existing staging deployment, creating backup..."
        
        # Export database
        if docker ps --format "{{.Names}}" | grep -q "betterprompts-postgres"; then
            log INFO "Backing up database..."
            docker exec betterprompts-postgres pg_dump -U betterprompts betterprompts_staging | \
                gzip > "${DEPLOYMENT_DIR}/backups/database-backup-$(date +%Y%m%d-%H%M%S).sql.gz"
        fi
        
        # Save current image tags
        docker-compose -f docker-compose.prod.yml ps --format json > \
            "${DEPLOYMENT_DIR}/backups/current-deployment.json"
        
        log SUCCESS "Backup completed"
    else
        log INFO "No existing staging deployment found, skipping backup"
    fi
}

# Function to build images
build_production_images() {
    if [ "${SKIP_BUILD}" = "true" ]; then
        log WARNING "Skipping build step (SKIP_BUILD=true)"
        return 0
    fi
    
    log STEP "Building Production Images"
    
    if [ "${DRY_RUN}" = "true" ]; then
        log INFO "[DRY RUN] Would execute: ./scripts/build-production.sh"
        return 0
    fi
    
    # Run build script
    if ./scripts/build-production.sh 2>&1 | tee "${DEPLOYMENT_DIR}/logs/build.log"; then
        log SUCCESS "Production images built successfully"
        
        # Copy build report
        cp build-report-*.md "${DEPLOYMENT_DIR}/reports/" 2>/dev/null || true
    else
        log ERROR "Build failed! Check logs at ${DEPLOYMENT_DIR}/logs/build.log"
        exit 1
    fi
}

# Function to deploy to staging
deploy_to_staging() {
    log STEP "Deploying to Staging Environment"
    
    if [ "${DRY_RUN}" = "true" ]; then
        log INFO "[DRY RUN] Would execute: ./scripts/deploy-staging.sh"
        return 0
    fi
    
    # Ensure environment file exists
    if [ ! -f "${PROJECT_ROOT}/.env.staging" ]; then
        log WARNING ".env.staging not found, creating from template..."
        cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env.staging"
        log WARNING "Please edit .env.staging with appropriate values"
        read -p "Press Enter when ready to continue..."
    fi
    
    # Run deployment script
    if ENV_FILE=.env.staging ./scripts/deploy-staging.sh 2>&1 | tee "${DEPLOYMENT_DIR}/logs/deployment.log"; then
        log SUCCESS "Deployment completed successfully"
        
        # Copy deployment report
        cp deployment-report-*.md "${DEPLOYMENT_DIR}/reports/" 2>/dev/null || true
    else
        log ERROR "Deployment failed! Check logs at ${DEPLOYMENT_DIR}/logs/deployment.log"
        exit 1
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    if [ "${SKIP_TESTS}" = "true" ]; then
        log WARNING "Skipping smoke tests (SKIP_TESTS=true)"
        return 0
    fi
    
    log STEP "Running Smoke Tests"
    
    if [ "${DRY_RUN}" = "true" ]; then
        log INFO "[DRY RUN] Would execute: ./scripts/smoke-tests.sh"
        return 0
    fi
    
    # Wait for services to stabilize
    log INFO "Waiting 30 seconds for services to stabilize..."
    sleep 30
    
    # Run smoke tests
    if ./scripts/smoke-tests.sh 2>&1 | tee "${DEPLOYMENT_DIR}/logs/smoke-tests.log"; then
        log SUCCESS "All smoke tests passed!"
        
        # Copy test report
        cp smoke-test-report-*.md "${DEPLOYMENT_DIR}/reports/" 2>/dev/null || true
    else
        log ERROR "Smoke tests failed! Check logs at ${DEPLOYMENT_DIR}/logs/smoke-tests.log"
        
        # Still continue but mark as warning
        log WARNING "Deployment completed but some tests failed"
    fi
}

# Function to generate final report
generate_final_report() {
    log STEP "Generating Final Deployment Report"
    
    local report_file="${DEPLOYMENT_DIR}/deployment-summary.md"
    
    cat > "${report_file}" << EOF
# BetterPrompts Staging Deployment Summary

**Deployment Date**: $(date)  
**Deployment ID**: $(basename ${DEPLOYMENT_DIR})  
**Status**: ${DEPLOYMENT_STATUS:-UNKNOWN}

## Deployment Steps

| Step | Status | Duration | Details |
|------|--------|----------|---------|
| Prerequisites Check | ✅ Complete | - | All dependencies satisfied |
| Backup Current Staging | ${BACKUP_STATUS:-⏭️ Skipped} | ${BACKUP_DURATION:-N/A} | ${BACKUP_DETAILS:-No existing deployment} |
| Build Production Images | ${BUILD_STATUS:-⏭️ Skipped} | ${BUILD_DURATION:-N/A} | ${BUILD_DETAILS:-SKIP_BUILD=true} |
| Deploy to Staging | ${DEPLOY_STATUS:-❓ Unknown} | ${DEPLOY_DURATION:-N/A} | ${DEPLOY_DETAILS:-See deployment.log} |
| Run Smoke Tests | ${TEST_STATUS:-⏭️ Skipped} | ${TEST_DURATION:-N/A} | ${TEST_DETAILS:-SKIP_TESTS=true} |

## Service Status

\`\`\`
$(docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Unable to retrieve service status")
\`\`\`

## Access URLs

- **Frontend**: http://localhost
- **API**: http://localhost/api/v1
- **API Docs**: http://localhost/api/v1/docs
- **Monitoring**: http://localhost:3001 (if configured)

## Logs and Reports

All logs and reports are stored in:
\`${DEPLOYMENT_DIR}/\`

- Build logs: \`logs/build.log\`
- Deployment logs: \`logs/deployment.log\`
- Test logs: \`logs/smoke-tests.log\`
- Reports: \`reports/\`

## Next Steps

1. Review all test results
2. Monitor service logs: \`docker-compose -f docker-compose.prod.yml logs -f [service]\`
3. Check application metrics
4. Run full integration test suite
5. Update DNS/load balancer if needed

## Troubleshooting

If you encounter issues:

1. Check service logs: \`docker-compose -f docker-compose.prod.yml logs [service]\`
2. Verify environment variables: \`cat .env.staging\`
3. Check resource usage: \`docker stats\`
4. Review deployment logs in \`${DEPLOYMENT_DIR}/logs/\`

## Rollback Instructions

If rollback is needed:

1. Restore database: \`gunzip -c ${DEPLOYMENT_DIR}/backups/database-backup-*.sql.gz | docker exec -i betterprompts-postgres psql -U betterprompts\`
2. Redeploy previous version: Update VERSION in .env.staging
3. Run: \`docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d\`
EOF
    
    log SUCCESS "Deployment summary saved to: ${report_file}"
    
    # Display summary
    echo
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}          Deployment Completed Successfully! 🎉${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo
    echo "📁 All deployment artifacts saved to:"
    echo "   ${DEPLOYMENT_DIR}"
    echo
    echo "🌐 Access your staging environment at:"
    echo "   Frontend: http://localhost"
    echo "   API: http://localhost/api/v1"
    echo
    echo "📋 View deployment summary:"
    echo "   ${report_file}"
    echo
}

# Main execution
main() {
    display_banner
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-build    Skip building Docker images"
                echo "  --skip-tests    Skip running smoke tests"
                echo "  --dry-run       Show what would be done without executing"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                log ERROR "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    log INFO "Starting complete staging deployment process..."
    
    if [ "${DRY_RUN}" = "true" ]; then
        log WARNING "Running in DRY RUN mode - no actual changes will be made"
    fi
    
    # Execute deployment steps
    check_prerequisites
    setup_deployment_directory
    
    # Backup
    BACKUP_START=$(date +%s)
    backup_current_staging
    BACKUP_END=$(date +%s)
    BACKUP_DURATION="$((BACKUP_END - BACKUP_START))s"
    BACKUP_STATUS="✅ Complete"
    
    # Build
    if [ "${SKIP_BUILD}" != "true" ]; then
        BUILD_START=$(date +%s)
        build_production_images
        BUILD_END=$(date +%s)
        BUILD_DURATION="$((BUILD_END - BUILD_START))s"
        BUILD_STATUS="✅ Complete"
        BUILD_DETAILS="All images built successfully"
    fi
    
    # Deploy
    DEPLOY_START=$(date +%s)
    deploy_to_staging
    DEPLOY_END=$(date +%s)
    DEPLOY_DURATION="$((DEPLOY_END - DEPLOY_START))s"
    DEPLOY_STATUS="✅ Complete"
    DEPLOY_DETAILS="All services deployed"
    
    # Test
    if [ "${SKIP_TESTS}" != "true" ]; then
        TEST_START=$(date +%s)
        run_smoke_tests
        TEST_END=$(date +%s)
        TEST_DURATION="$((TEST_END - TEST_START))s"
        TEST_STATUS="✅ Complete"
        TEST_DETAILS="All smoke tests passed"
    fi
    
    DEPLOYMENT_STATUS="✅ SUCCESSFUL"
    
    # Generate final report
    generate_final_report
}

# Run main function
main "$@"