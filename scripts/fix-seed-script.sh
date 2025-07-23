#!/bin/bash

# =============================================================================
# Fix Script for seed-demo-data.sh Issues
# =============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Fixing seed-demo-data.sh Issues ===${NC}"
echo ""

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Fix 1: Update the health check endpoint in seed-demo-data.sh
echo -e "${BLUE}[1/3] Fixing health check endpoint...${NC}"
sed -i.bak 's|"$API_GATEWAY_URL/health"|"$API_GATEWAY_URL/api/v1/health"|g' "$PROJECT_ROOT/scripts/seed-demo-data.sh"
echo -e "${GREEN}✓ Updated health check endpoint${NC}"

# Fix 2: Update the health check endpoint in verify-demo-data.sh
echo -e "${BLUE}[2/3] Fixing verify script health check...${NC}"
sed -i.bak 's|"$API_GATEWAY_URL/health"|"$API_GATEWAY_URL/api/v1/health"|g' "$PROJECT_ROOT/scripts/verify-demo-data.sh"
echo -e "${GREEN}✓ Updated verify script${NC}"

# Fix 3: Create a .env.local override
echo -e "${BLUE}[3/3] Creating local environment override...${NC}"
cat > "$PROJECT_ROOT/.env.local" << 'EOF'
# Local development overrides
# This file overrides settings in .env for local development
API_GATEWAY_URL=http://localhost:8000
EOF
echo -e "${GREEN}✓ Created .env.local with correct API_GATEWAY_URL${NC}"

# Update seed script to load .env.local
echo -e "${BLUE}Updating scripts to use .env.local...${NC}"

# Add .env.local loading to seed-demo-data.sh
sed -i.bak '/# Load environment variables/,/fi/c\
# Load environment variables\
if [ -f "$PROJECT_ROOT/.env" ]; then\
    export $(cat "$PROJECT_ROOT/.env" | grep -v '"'"'^#'"'"' | xargs)\
fi\
# Load local overrides\
if [ -f "$PROJECT_ROOT/.env.local" ]; then\
    export $(cat "$PROJECT_ROOT/.env.local" | grep -v '"'"'^#'"'"' | xargs)\
fi' "$PROJECT_ROOT/scripts/seed-demo-data.sh"

# Add .env.local loading to verify-demo-data.sh
sed -i.bak '/# Load environment variables/,/fi/c\
# Load environment variables\
if [ -f "$PROJECT_ROOT/.env" ]; then\
    export $(cat "$PROJECT_ROOT/.env" | grep -v '"'"'^#'"'"' | xargs)\
fi\
# Load local overrides\
if [ -f "$PROJECT_ROOT/.env.local" ]; then\
    export $(cat "$PROJECT_ROOT/.env.local" | grep -v '"'"'^#'"'"' | xargs)\
fi' "$PROJECT_ROOT/scripts/verify-demo-data.sh"

echo -e "${GREEN}✓ Scripts updated to load .env.local${NC}"

# Test the connection
echo ""
echo -e "${BLUE}Testing API Gateway connection...${NC}"
if curl -f -s "http://localhost:8000/api/v1/health" > /dev/null; then
    echo -e "${GREEN}✓ API Gateway is reachable at http://localhost:8000${NC}"
else
    echo -e "${RED}✗ API Gateway is not reachable${NC}"
    echo -e "${YELLOW}Make sure services are running: docker compose up -d${NC}"
fi

# Clean up backup files
rm -f "$PROJECT_ROOT/scripts/seed-demo-data.sh.bak"
rm -f "$PROJECT_ROOT/scripts/verify-demo-data.sh.bak"

echo ""
echo -e "${GREEN}=== Fixes Applied Successfully ===${NC}"
echo ""
echo -e "${BLUE}You can now run:${NC}"
echo "  ./scripts/seed-demo-data.sh"
echo ""
echo -e "${YELLOW}Note: The script now uses:${NC}"
echo "  - Correct health endpoint: /api/v1/health"
echo "  - Local API URL: http://localhost:8000"
echo "  - .env.local for local overrides"