#!/bin/bash
# Run comprehensive integration tests for BetterPrompts microservices

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results/integration"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create test results directory
mkdir -p "$TEST_RESULTS_DIR"

echo -e "${YELLOW}Starting BetterPrompts Integration Tests${NC}"
echo "================================================"

# Function to check if services are healthy
check_services_health() {
    echo -e "\n${YELLOW}Checking service health...${NC}"
    
    local services=(
        "http://localhost:8090/api/v1/health:API Gateway"
        "http://localhost:8001/health:Intent Classifier"
        "http://localhost:8002/health:Technique Selector"
        "http://localhost:8003/health:Prompt Generator"
        "http://localhost:8080/ping:TorchServe"
    )
    
    local all_healthy=true
    
    for service in "${services[@]}"; do
        IFS=':' read -r url name <<< "$service"
        if curl -f -s "$url" > /dev/null; then
            echo -e "  ✓ ${name}: ${GREEN}Healthy${NC}"
        else
            echo -e "  ✗ ${name}: ${RED}Unhealthy${NC}"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = false ]; then
        echo -e "\n${RED}Some services are not healthy. Please check docker-compose logs.${NC}"
        return 1
    fi
    
    echo -e "\n${GREEN}All services are healthy!${NC}"
    return 0
}

# Function to run Go integration tests
run_go_tests() {
    echo -e "\n${YELLOW}Running Go Integration Tests${NC}"
    echo "--------------------------------"
    
    cd "$PROJECT_ROOT/tests/integration/go"
    
    # Install dependencies if needed
    if [ ! -d "vendor" ]; then
        echo "Installing Go dependencies..."
        go mod init integration_tests 2>/dev/null || true
        go get github.com/gin-gonic/gin
        go get github.com/stretchr/testify
        go mod tidy
    fi
    
    # Run tests with coverage
    go test -v -tags=integration -coverprofile="$TEST_RESULTS_DIR/go-coverage.out" \
        -json ./... | tee "$TEST_RESULTS_DIR/go-integration.json"
    
    # Generate coverage report
    go tool cover -html="$TEST_RESULTS_DIR/go-coverage.out" \
        -o "$TEST_RESULTS_DIR/go-coverage.html"
    
    echo -e "${GREEN}Go tests completed!${NC}"
}

# Function to run Python integration tests
run_python_tests() {
    echo -e "\n${YELLOW}Running Python Integration Tests${NC}"
    echo "----------------------------------"
    
    cd "$PROJECT_ROOT/tests/integration/python"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -q pytest pytest-asyncio httpx redis sqlalchemy psycopg2-binary pytest-json-report
    
    # Run tests with coverage
    python -m pytest -v \
        --json-report --json-report-file="$TEST_RESULTS_DIR/python-integration.json" \
        --junit-xml="$TEST_RESULTS_DIR/python-junit.xml" \
        test_backend_services_integration.py
    
    deactivate
    
    echo -e "${GREEN}Python tests completed!${NC}"
}

# Function to run Frontend integration tests
run_frontend_tests() {
    echo -e "\n${YELLOW}Running Frontend Integration Tests${NC}"
    echo "-----------------------------------"
    
    cd "$PROJECT_ROOT/tests/integration/frontend"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing Node.js dependencies..."
        npm install --save-dev @playwright/test axios
    fi
    
    # Run Playwright tests
    npx playwright test frontend_api_integration.test.ts \
        --reporter=json --reporter=html \
        --output="$TEST_RESULTS_DIR/frontend-results"
    
    # Copy test results
    cp test-results.json "$TEST_RESULTS_DIR/frontend-integration.json" 2>/dev/null || true
    
    echo -e "${GREEN}Frontend tests completed!${NC}"
}

# Function to generate summary report
generate_summary() {
    echo -e "\n${YELLOW}Generating Test Summary${NC}"
    echo "------------------------"
    
    cat > "$TEST_RESULTS_DIR/summary.md" << EOF
# Integration Test Summary

**Test Run Date:** $(date)

## Test Results

### Go Integration Tests
- Test file: \`go-integration.json\`
- Coverage report: \`go-coverage.html\`

### Python Integration Tests
- Test file: \`python-integration.json\`
- JUnit report: \`python-junit.xml\`

### Frontend Integration Tests
- Test file: \`frontend-integration.json\`
- HTML report: \`frontend-results/index.html\`

## Service Health Check
All services were verified healthy before test execution.

## Key Test Scenarios Covered

1. **Authentication Flow**
   - User registration
   - Login/logout
   - JWT token validation
   - Session persistence

2. **Enhancement Pipeline**
   - Intent classification
   - Technique selection
   - Prompt generation
   - End-to-end enhancement

3. **Caching Strategy**
   - Result caching
   - Cache invalidation
   - Cache warming

4. **Error Handling**
   - Service failures
   - Network errors
   - Timeouts
   - Circuit breakers

5. **Performance**
   - Concurrent requests
   - Response times
   - Resource usage

## Recommendations
- Monitor service health regularly
- Review failed tests in CI/CD pipeline
- Update tests when adding new features
EOF

    echo -e "${GREEN}Summary generated at: $TEST_RESULTS_DIR/summary.md${NC}"
}

# Main execution
main() {
    echo "Project root: $PROJECT_ROOT"
    echo "Test results will be saved to: $TEST_RESULTS_DIR"
    
    # Check if running in Docker or locally
    if [ -f "/.dockerenv" ]; then
        echo -e "${YELLOW}Running inside Docker container${NC}"
    else
        echo -e "${YELLOW}Running locally - ensure services are running${NC}"
        
        # Check if docker-compose is running
        if ! docker-compose -f "$PROJECT_ROOT/docker-compose.integration-test.yml" ps | grep -q "Up"; then
            echo -e "${YELLOW}Starting integration test environment...${NC}"
            docker-compose -f "$PROJECT_ROOT/docker-compose.integration-test.yml" up -d
            
            echo "Waiting for services to be ready..."
            sleep 30
        fi
    fi
    
    # Check service health
    if ! check_services_health; then
        exit 1
    fi
    
    # Run tests
    run_go_tests
    run_python_tests
    run_frontend_tests
    
    # Generate summary
    generate_summary
    
    echo -e "\n${GREEN}✓ All integration tests completed!${NC}"
    echo -e "Test results available at: ${YELLOW}$TEST_RESULTS_DIR${NC}"
}

# Handle script arguments
case "${1:-}" in
    "go")
        check_services_health && run_go_tests
        ;;
    "python")
        check_services_health && run_python_tests
        ;;
    "frontend")
        check_services_health && run_frontend_tests
        ;;
    "health")
        check_services_health
        ;;
    *)
        main
        ;;
esac