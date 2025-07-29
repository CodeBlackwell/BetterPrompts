#!/bin/bash

# Setup script for Phase 10 Rate Limiting Tests
# This script sets up test API keys directly in the database

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Phase 10: Test Data Setup ===${NC}"

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Run the setup
echo -e "${YELLOW}Setting up test API keys in database...${NC}"
node test-data-setup.js setup

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Test data setup complete!${NC}"
    echo ""
    echo "You can now run the tests with:"
    echo "  npm test"
    echo ""
    echo "Or run specific test suites:"
    echo "  npm run test:rate-limits"
    echo "  npm run test:concurrent"
    echo "  npm run test:headers"
    echo "  npm run test:distributed"
else
    echo -e "${RED}❌ Setup failed!${NC}"
    echo "Please check your database connection settings:"
    echo "  DB_HOST=${DB_HOST:-localhost}"
    echo "  DB_PORT=${DB_PORT:-5432}"
    echo "  DB_NAME=${DB_NAME:-betterprompts}"
    echo "  DB_USER=${DB_USER:-betterprompts}"
    echo "  REDIS_HOST=${REDIS_HOST:-localhost}"
    echo "  REDIS_PORT=${REDIS_PORT:-6379}"
    exit 1
fi