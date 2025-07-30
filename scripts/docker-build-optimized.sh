#!/bin/bash

# Optimized Docker build script using BuildKit
set -e

echo "🚀 Building Docker images with BuildKit optimizations..."

# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to build with timing
build_service() {
    local service=$1
    echo -e "\n${YELLOW}Building $service...${NC}"
    
    start_time=$(date +%s)
    
    if docker compose build --progress=plain $service; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "${GREEN}✓ $service built in ${duration}s${NC}"
    else
        echo -e "${RED}✗ Failed to build $service${NC}"
        exit 1
    fi
}

# Build all services
echo "Using BuildKit for optimized builds..."
echo "Features enabled:"
echo "  - Layer caching with cache mounts"
echo "  - Parallel dependency downloads"
echo "  - Smaller final images (distroless for Go services)"
echo "  - Multi-stage optimization"

# Build services in parallel groups
echo -e "\n${YELLOW}Building Go services...${NC}"
build_service "api-gateway" &
build_service "technique-selector" &
wait

echo -e "\n${YELLOW}Building Python services...${NC}"
build_service "intent-classifier" &
build_service "prompt-generator" &
wait

echo -e "\n${YELLOW}Building infrastructure services...${NC}"
build_service "nginx" &
wait

# Show image sizes
echo -e "\n📊 Image sizes:"
docker images | grep betterprompts | sort -k7 -h

echo -e "\n${GREEN}✅ All services built successfully!${NC}"

# Provide next steps
echo -e "\n📝 Next steps:"
echo "1. Start services: docker compose up -d"
echo "2. Check health: docker compose ps"
echo "3. View logs: docker compose logs -f [service-name]"

# Optional: Push cache layers if using registry cache
if [ "$1" == "--push-cache" ]; then
    echo -e "\n${YELLOW}Pushing cache layers to registry...${NC}"
    docker compose -f docker-compose.yml -f docker-compose.buildkit.yml build --push
fi