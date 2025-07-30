#!/bin/bash

# Docker Cleanup Script for BetterPrompts
set -e

echo "🧹 Docker Cleanup Script for BetterPrompts"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to confirm action
confirm() {
    read -p "$1 (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return 1
    fi
    return 0
}

# 1. Clean up duplicate Dockerfiles
echo -e "\n${YELLOW}1. Checking for duplicate Dockerfiles...${NC}"
DUPLICATES=(
    "docker/backend/technique-selector/Dockerfile"
    "docker/backend/intent-classifier/Dockerfile"
    "docker/backend/prompt-generator/Dockerfile"
    "backend/services/prompt-generator/Dockerfile.light"
)

for file in "${DUPLICATES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${RED}Found duplicate/obsolete:${NC} $file"
        if confirm "Remove $file?"; then
            rm -f "$file"
            echo -e "${GREEN}✓ Removed${NC}"
        fi
    fi
done

# 2. Clean up obsolete docker-compose files
echo -e "\n${YELLOW}2. Checking for obsolete docker-compose files...${NC}"
OBSOLETE_COMPOSE=(
    "backend/docker-compose.yml"
    "backend/services/intent-classifier/docker-compose.prod.yml"
    "docker-compose.yml.backup"
)

for file in "${OBSOLETE_COMPOSE[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${RED}Found obsolete:${NC} $file"
        if confirm "Remove $file?"; then
            rm -f "$file"
            echo -e "${GREEN}✓ Removed${NC}"
        fi
    fi
done

# 3. Clean up empty Docker directories
echo -e "\n${YELLOW}3. Cleaning up empty directories...${NC}"
find docker/backend -type d -empty -print -delete 2>/dev/null || true

# 4. Clean up Docker system resources
echo -e "\n${YELLOW}4. Docker system cleanup...${NC}"
if confirm "Clean Docker build cache?"; then
    docker builder prune -f
    echo -e "${GREEN}✓ Build cache cleaned${NC}"
fi

if confirm "Remove unused Docker images?"; then
    docker image prune -a -f --filter "label!=maintainer=betterprompts-team"
    echo -e "${GREEN}✓ Unused images removed${NC}"
fi

if confirm "Remove unused Docker volumes?"; then
    docker volume prune -f
    echo -e "${GREEN}✓ Unused volumes removed${NC}"
fi

if confirm "Remove unused Docker networks?"; then
    # Don't remove the default bridge network or our project network
    docker network prune -f --filter "label!=com.docker.compose.project=betterprompts"
    echo -e "${GREEN}✓ Unused networks removed${NC}"
fi

# 5. Show disk usage
echo -e "\n${YELLOW}5. Docker disk usage:${NC}"
docker system df

# 6. Optional: Full system prune
echo -e "\n${YELLOW}6. Full system cleanup (optional):${NC}"
if confirm "Perform full Docker system prune? (This will remove ALL unused resources)"; then
    docker system prune -a -f --volumes
    echo -e "${GREEN}✓ Full system cleanup completed${NC}"
fi

echo -e "\n${GREEN}✅ Docker cleanup completed!${NC}"

# Show remaining Docker resources
echo -e "\n${YELLOW}Remaining Docker resources:${NC}"
echo "Images: $(docker images | tail -n +2 | wc -l)"
echo "Containers: $(docker ps -a | tail -n +2 | wc -l)"
echo "Volumes: $(docker volume ls | tail -n +2 | wc -l)"
echo "Networks: $(docker network ls | tail -n +2 | wc -l)"

# Recommendations
echo -e "\n${YELLOW}📝 Recommendations:${NC}"
echo "1. Run 'docker compose down' before major cleanups"
echo "2. Use 'docker compose down -v' to also remove volumes"
echo "3. Regular cleanup: Run this script weekly"
echo "4. Monitor disk usage: 'docker system df'"
echo "5. Use BuildKit for better caching: export DOCKER_BUILDKIT=1"