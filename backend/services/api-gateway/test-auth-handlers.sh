#!/bin/bash

# Script to run API Gateway authentication handler tests

echo "🧪 Running API Gateway Authentication Handler Tests..."
echo "=================================================="

cd "$(dirname "$0")"

# Run tests with verbose output and race detection
echo "Running tests with race detection..."
go test ./internal/handlers -v -race -run TestAuthHandlerTestSuite

# Check if tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    
    # Generate coverage report
    echo ""
    echo "📊 Generating coverage report..."
    go test ./internal/handlers -coverprofile=coverage.out -run TestAuthHandlerTestSuite > /dev/null 2>&1
    
    # Display coverage summary
    echo ""
    echo "📈 Coverage Summary:"
    go tool cover -func=coverage.out | grep -E "(auth\.go|total)"
    
    # Generate HTML coverage report
    go tool cover -html=coverage.out -o coverage.html
    echo ""
    echo "📄 HTML coverage report generated: coverage.html"
    
    # Clean up
    rm coverage.out
else
    echo ""
    echo "❌ Some tests failed. Please check the output above."
    exit 1
fi

echo ""
echo "🎯 Test Execution Complete!"