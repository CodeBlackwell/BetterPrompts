#!/bin/bash

# Phase 10: Rate Limiting & Concurrent Access Tests Runner

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
API_BASE_URL=${API_BASE_URL:-"http://localhost/api/v1"}
TEST_SUITE=${1:-"all"}

echo -e "${GREEN}=== Phase 10: Rate Limiting & Concurrent Access Tests ===${NC}"
echo "API Base URL: $API_BASE_URL"
echo "Test Suite: $TEST_SUITE"
echo ""

# Check if API is reachable
echo -e "${YELLOW}Checking API availability...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/health" | grep -q "200"; then
    echo -e "${GREEN}✓ API is available${NC}"
else
    echo -e "${RED}✗ API is not reachable at $API_BASE_URL${NC}"
    echo "Please ensure the API server is running and accessible."
    exit 1
fi

# Check if Redis is available (if we can)
if command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}Checking Redis availability...${NC}"
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✓ Redis is available${NC}"
    else
        echo -e "${YELLOW}⚠ Redis might not be available (rate limiting may not work properly)${NC}"
    fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Run tests based on suite selection
case $TEST_SUITE in
    "all")
        echo -e "${GREEN}Running all Phase 10 tests...${NC}"
        npm test
        ;;
    "rate-limits")
        echo -e "${GREEN}Running rate limiting tests...${NC}"
        npm run test:rate-limits
        ;;
    "concurrent")
        echo -e "${GREEN}Running concurrent access tests...${NC}"
        npm run test:concurrent
        ;;
    "headers")
        echo -e "${GREEN}Running header validation tests...${NC}"
        npm run test:headers
        ;;
    "distributed")
        echo -e "${GREEN}Running distributed limiting tests...${NC}"
        if [ -z "$DISTRIBUTED_ENDPOINTS" ]; then
            echo -e "${YELLOW}⚠ DISTRIBUTED_ENDPOINTS not set, tests may be skipped${NC}"
        fi
        npm run test:distributed
        ;;
    "perf")
        echo -e "${GREEN}Running performance baseline tests...${NC}"
        npm run test:perf
        ;;
    *)
        echo -e "${RED}Unknown test suite: $TEST_SUITE${NC}"
        echo "Available suites: all, rate-limits, concurrent, headers, distributed, perf"
        exit 1
        ;;
esac

# Check test results
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Tests completed successfully!${NC}"
    
    # Show report location
    if [ -f "playwright-report/index.html" ]; then
        echo -e "${YELLOW}Test report available at: $(pwd)/playwright-report/index.html${NC}"
    fi
    
    # Show performance metrics if available
    if [ -f "test-results.json" ] && [ "$TEST_SUITE" == "perf" ]; then
        echo -e "${YELLOW}Performance metrics saved to: test-results.json${NC}"
    fi
else
    echo -e "${RED}✗ Tests failed!${NC}"
    echo "Check the test report for details."
    exit 1
fi