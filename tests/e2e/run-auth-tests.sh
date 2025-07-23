#!/bin/bash

# Script to run authentication E2E tests

echo "🔐 Running Authentication E2E Tests..."
echo "====================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Change to e2e directory
cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Check if services are running
echo -e "${BLUE}Checking service availability...${NC}"

check_service() {
    local service_name=$1
    local url=$2
    
    if curl -s -f -o /dev/null "$url" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $service_name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not running"
        return 1
    fi
}

# Check required services
FRONTEND_OK=$(check_service "Frontend" "http://localhost:3000")
API_OK=$(check_service "API Gateway" "http://localhost:8090/health")

if [ $? -ne 0 ]; then
    echo -e "${RED}Warning: Some services are not running!${NC}"
    echo "Please ensure the following are running:"
    echo "  - Frontend: npm run dev (in frontend directory)"
    echo "  - API Gateway: docker compose up api-gateway"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}Running Authentication Tests...${NC}"
echo "================================"

# Run different test suites
run_test_suite() {
    local suite_name=$1
    local test_file=$2
    
    echo ""
    echo -e "${BLUE}Running $suite_name...${NC}"
    
    if npx playwright test "$test_file" --config=playwright-ui.config.ts; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        return 1
    fi
}

# Track overall success
TESTS_PASSED=true

# Run main authentication flow tests
if ! run_test_suite "Authentication Flow Tests" "specs/authentication-flow.spec.ts"; then
    TESTS_PASSED=false
fi

# Run security-specific tests
if ! run_test_suite "Authentication Security Tests" "specs/auth-security.spec.ts"; then
    TESTS_PASSED=false
fi

# Generate test report
echo ""
echo -e "${BLUE}Generating test report...${NC}"
npx playwright show-report

# Summary
echo ""
echo "====================================="
if [ "$TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✅ All authentication tests passed!${NC}"
else
    echo -e "${RED}❌ Some authentication tests failed${NC}"
    echo "Please check the test report for details."
    exit 1
fi

# Optional: Run in different modes
if [ "$1" = "--headed" ]; then
    echo ""
    echo "Running tests in headed mode..."
    npx playwright test specs/authentication-flow.spec.ts --headed
elif [ "$1" = "--debug" ]; then
    echo ""
    echo "Running tests in debug mode..."
    npx playwright test specs/authentication-flow.spec.ts --debug
elif [ "$1" = "--ui" ]; then
    echo ""
    echo "Opening Playwright UI..."
    npx playwright test --ui
fi

echo ""
echo "Test execution complete!"