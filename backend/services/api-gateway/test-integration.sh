#!/bin/bash

# Script to run API Gateway integration tests

echo "🔗 Running API Gateway Service Integration Tests..."
echo "=================================================="

cd "$(dirname "$0")"

# Check if services are running (optional)
echo "📡 Checking service availability..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if real services are available (for full integration tests)
check_service() {
    local service_name=$1
    local url=$2
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
        echo -e "${GREEN}✓${NC} $service_name is available at $url"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $service_name is not available at $url (will use mocks)"
        return 1
    fi
}

# Check each service
INTENT_CLASSIFIER_URL=${INTENT_CLASSIFIER_URL:-"http://localhost:8001/health"}
TECHNIQUE_SELECTOR_URL=${TECHNIQUE_SELECTOR_URL:-"http://localhost:8002/health"}
PROMPT_GENERATOR_URL=${PROMPT_GENERATOR_URL:-"http://localhost:8003/health"}

check_service "Intent Classifier" "$INTENT_CLASSIFIER_URL"
INTENT_AVAILABLE=$?

check_service "Technique Selector" "$TECHNIQUE_SELECTOR_URL"
TECHNIQUE_AVAILABLE=$?

check_service "Prompt Generator" "$PROMPT_GENERATOR_URL"
PROMPT_AVAILABLE=$?

echo ""
echo "🧪 Running Integration Tests..."
echo "================================"

# Run integration tests with verbose output
if [ $INTENT_AVAILABLE -eq 0 ] && [ $TECHNIQUE_AVAILABLE -eq 0 ] && [ $PROMPT_AVAILABLE -eq 0 ]; then
    echo "Running with REAL services..."
    # Set environment variables for real service URLs
    export INTEGRATION_TEST_MODE="real"
    export INTENT_CLASSIFIER_URL="http://localhost:8001"
    export TECHNIQUE_SELECTOR_URL="http://localhost:8002"
    export PROMPT_GENERATOR_URL="http://localhost:8003"
else
    echo "Running with MOCK services..."
    export INTEGRATION_TEST_MODE="mock"
fi

# Run the service integration tests
go test ./internal/handlers -v -run TestServiceIntegrationTestSuite -timeout 30s

# Check if tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All integration tests passed!${NC}"
    
    # Generate coverage report
    echo ""
    echo "📊 Generating coverage report..."
    go test ./internal/handlers -coverprofile=integration_coverage.out -run TestServiceIntegrationTestSuite > /dev/null 2>&1
    
    # Display coverage summary
    echo ""
    echo "📈 Coverage Summary:"
    go tool cover -func=integration_coverage.out | grep -E "(enhance\.go|clients\.go|total)"
    
    # Generate HTML coverage report
    go tool cover -html=integration_coverage.out -o integration_coverage.html
    echo ""
    echo "📄 HTML coverage report generated: integration_coverage.html"
    
    # Run performance benchmark
    echo ""
    echo "⚡ Running Performance Benchmark..."
    go test ./internal/handlers -v -run TestEnhanceFlow_Performance -bench=.
    
    # Clean up
    rm integration_coverage.out
else
    echo ""
    echo -e "${RED}❌ Some integration tests failed. Please check the output above.${NC}"
    exit 1
fi

echo ""
echo "🎯 Integration Test Execution Complete!"
echo ""
echo "📋 Test Summary:"
echo "- Service Communication: Tested"
echo "- Error Handling: Tested"
echo "- Performance: Benchmarked"
echo "- Headers & Context: Verified"
echo ""

# Optional: Run with real services if available
if [ "$1" == "--real" ]; then
    echo "🚀 Running additional tests with real services..."
    echo ""
    
    # Create a test prompt file
    cat > test_prompt.json <<EOF
{
    "text": "Write a Python function to calculate fibonacci numbers",
    "context": {
        "language": "python",
        "level": "beginner"
    }
}
EOF
    
    # Test real endpoint
    echo "Testing real /api/v1/enhance endpoint..."
    curl -X POST http://localhost:8090/api/v1/enhance \
        -H "Content-Type: application/json" \
        -d @test_prompt.json \
        -w "\nResponse Time: %{time_total}s\n" \
        | jq '.'
    
    # Clean up
    rm test_prompt.json
fi