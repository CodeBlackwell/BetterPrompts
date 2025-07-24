#!/bin/bash
# Production Build Script for BetterPrompts
# This script builds all production Docker images with validation and safety checks

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_LOG="${PROJECT_ROOT}/build-production.log"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io/betterprompts}"
VERSION="${VERSION:-latest}"
BUILD_DATE=$(date +%Y%m%d-%H%M%S)

# Services to build
SERVICES=(
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
    
    echo "[${timestamp}] [${level}] ${message}" >> "${BUILD_LOG}"
}

# Function to check prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log ERROR "Docker is not installed"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log ERROR "Docker daemon is not running"
        exit 1
    fi
    
    # Check docker-compose
    if ! command -v docker-compose &> /dev/null; then
        log ERROR "docker-compose is not installed"
        exit 1
    fi
    
    # Check disk space (require at least 10GB)
    available_space=$(df -BG "${PROJECT_ROOT}" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "${available_space}" -lt 10 ]; then
        log WARNING "Low disk space: ${available_space}GB available (recommend at least 10GB)"
    fi
    
    log SUCCESS "Prerequisites check passed"
}

# Function to clean old images
clean_old_images() {
    log INFO "Cleaning old images..."
    
    # Remove dangling images
    dangling_images=$(docker images -f "dangling=true" -q)
    if [ -n "${dangling_images}" ]; then
        docker rmi ${dangling_images} || true
        log SUCCESS "Removed dangling images"
    fi
    
    # Remove old versions (keep last 3)
    for service in "${SERVICES[@]}"; do
        image_name="${DOCKER_REGISTRY}/${service}"
        old_images=$(docker images "${image_name}" --format "{{.Repository}}:{{.Tag}}" | tail -n +4)
        if [ -n "${old_images}" ]; then
            echo "${old_images}" | xargs -r docker rmi || true
            log INFO "Cleaned old images for ${service}"
        fi
    done
}

# Function to build a service
build_service() {
    local service=$1
    local service_path=""
    local dockerfile_path=""
    
    log INFO "Building ${service}..."
    
    # Determine service path and Dockerfile
    case ${service} in
        frontend)
            service_path="${PROJECT_ROOT}/frontend"
            dockerfile_path="${PROJECT_ROOT}/docker/frontend/Dockerfile"
            ;;
        api-gateway)
            service_path="${PROJECT_ROOT}/backend/services/api-gateway"
            dockerfile_path="${PROJECT_ROOT}/docker/backend/api-gateway.Dockerfile"
            ;;
        intent-classifier)
            service_path="${PROJECT_ROOT}/backend/services/intent-classifier"
            dockerfile_path="${PROJECT_ROOT}/docker/backend/intent-classifier.Dockerfile"
            ;;
        technique-selector)
            service_path="${PROJECT_ROOT}/backend/services/technique-selector"
            dockerfile_path="${PROJECT_ROOT}/docker/backend/technique-selector.Dockerfile"
            ;;
        prompt-generator)
            service_path="${PROJECT_ROOT}/backend/services/prompt-generator"
            dockerfile_path="${PROJECT_ROOT}/docker/backend/prompt-generator.Dockerfile"
            ;;
    esac
    
    # Check if Dockerfile exists
    if [ ! -f "${dockerfile_path}" ]; then
        log ERROR "Dockerfile not found for ${service} at ${dockerfile_path}"
        return 1
    fi
    
    # Build the image
    local image_name="${DOCKER_REGISTRY}/${service}:${VERSION}"
    local build_tag="${DOCKER_REGISTRY}/${service}:${BUILD_DATE}"
    
    log INFO "Building image: ${image_name}"
    
    # Build with buildkit for better caching and performance
    DOCKER_BUILDKIT=1 docker build \
        --file "${dockerfile_path}" \
        --tag "${image_name}" \
        --tag "${build_tag}" \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg VERSION="${VERSION}" \
        --progress=plain \
        "${service_path}" 2>&1 | tee -a "${BUILD_LOG}"
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log SUCCESS "Successfully built ${service}"
        
        # Verify the image
        local image_size=$(docker images "${image_name}" --format "{{.Size}}")
        log INFO "Image size for ${service}: ${image_size}"
        
        # Security scan (if trivy is available)
        if command -v trivy &> /dev/null; then
            log INFO "Running security scan on ${service}..."
            trivy image --severity HIGH,CRITICAL "${image_name}" || true
        fi
        
        return 0
    else
        log ERROR "Failed to build ${service}"
        return 1
    fi
}

# Function to save images
save_images() {
    local output_dir="${PROJECT_ROOT}/docker-images"
    mkdir -p "${output_dir}"
    
    log INFO "Saving images to ${output_dir}..."
    
    for service in "${SERVICES[@]}"; do
        local image_name="${DOCKER_REGISTRY}/${service}:${VERSION}"
        local output_file="${output_dir}/${service}-${VERSION}.tar"
        
        log INFO "Saving ${image_name}..."
        docker save "${image_name}" -o "${output_file}"
        
        # Compress the image
        gzip -f "${output_file}"
        log SUCCESS "Saved ${service} image ($(du -h ${output_file}.gz | cut -f1))"
    done
}

# Function to generate build report
generate_build_report() {
    local report_file="${PROJECT_ROOT}/build-report-${BUILD_DATE}.md"
    
    log INFO "Generating build report..."
    
    cat > "${report_file}" << EOF
# BetterPrompts Production Build Report

**Build Date**: ${BUILD_DATE}  
**Version**: ${VERSION}  
**Registry**: ${DOCKER_REGISTRY}

## Build Summary

| Service | Image | Size | Status |
|---------|-------|------|--------|
EOF
    
    local total_size=0
    for service in "${SERVICES[@]}"; do
        local image_name="${DOCKER_REGISTRY}/${service}:${VERSION}"
        if docker images "${image_name}" --format "{{.Repository}}:{{.Tag}}" | grep -q "${image_name}"; then
            local size=$(docker images "${image_name}" --format "{{.Size}}")
            echo "| ${service} | ${image_name} | ${size} | ✅ Success |" >> "${report_file}"
        else
            echo "| ${service} | ${image_name} | - | ❌ Failed |" >> "${report_file}"
        fi
    done
    
    cat >> "${report_file}" << EOF

## Build Logs

See full build logs at: \`${BUILD_LOG}\`

## Security Scan Summary

EOF
    
    # Add security scan results if available
    if command -v trivy &> /dev/null; then
        echo "Security scans were performed using Trivy. No HIGH or CRITICAL vulnerabilities should be present in production images." >> "${report_file}"
    else
        echo "⚠️ Security scanning was skipped (Trivy not installed)" >> "${report_file}"
    fi
    
    cat >> "${report_file}" << EOF

## Deployment Instructions

1. Load images on staging server:
   \`\`\`bash
   cd docker-images
   for img in *.tar.gz; do
     gunzip -c "\$img" | docker load
   done
   \`\`\`

2. Update environment variables:
   \`\`\`bash
   cp .env.example .env.staging
   # Edit .env.staging with staging values
   \`\`\`

3. Deploy with docker-compose:
   \`\`\`bash
   docker-compose -f docker-compose.prod.yml --env-file .env.staging up -d
   \`\`\`

4. Verify deployment:
   \`\`\`bash
   docker-compose -f docker-compose.prod.yml ps
   ./scripts/smoke-tests.sh
   \`\`\`

## Notes

- All images are tagged with both \`${VERSION}\` and \`${BUILD_DATE}\`
- Images are saved in \`docker-images/\` directory as compressed tarballs
- Ensure staging environment has sufficient resources before deployment
EOF
    
    log SUCCESS "Build report generated: ${report_file}"
}

# Main execution
main() {
    log INFO "Starting BetterPrompts production build..."
    log INFO "Build version: ${VERSION}"
    log INFO "Docker registry: ${DOCKER_REGISTRY}"
    
    # Initialize log file
    echo "BetterPrompts Production Build Log - ${BUILD_DATE}" > "${BUILD_LOG}"
    
    # Check prerequisites
    check_prerequisites
    
    # Clean old images
    clean_old_images
    
    # Build all services
    local failed_services=()
    for service in "${SERVICES[@]}"; do
        if ! build_service "${service}"; then
            failed_services+=("${service}")
        fi
    done
    
    # Check if any builds failed
    if [ ${#failed_services[@]} -gt 0 ]; then
        log ERROR "Failed to build services: ${failed_services[*]}"
        log ERROR "Build process failed. Check ${BUILD_LOG} for details."
        exit 1
    fi
    
    # Save images
    save_images
    
    # Generate build report
    generate_build_report
    
    log SUCCESS "Production build completed successfully!"
    log INFO "Build artifacts:"
    log INFO "  - Images: ${#SERVICES[@]} services built"
    log INFO "  - Saved to: ${PROJECT_ROOT}/docker-images/"
    log INFO "  - Report: ${PROJECT_ROOT}/build-report-${BUILD_DATE}.md"
    log INFO "  - Logs: ${BUILD_LOG}"
    
    # Display next steps
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Review the build report"
    echo "2. Transfer images to staging server"
    echo "3. Run: ./scripts/deploy-staging.sh"
    echo "4. Execute smoke tests: ./scripts/smoke-tests.sh"
}

# Run main function
main "$@"