#!/bin/bash

# Phase 12: Mobile & Accessibility Test Runner
# This script runs the e2e tests for US-019 (Mobile Experience) and US-020 (Accessibility)

set -e

echo "🚀 Phase 12: Mobile & Accessibility Tests"
echo "========================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Set environment variables
export BASE_URL="${BASE_URL:-http://localhost:3000}"
export HEADLESS="${HEADLESS:-true}"

echo "🔧 Configuration:"
echo "  - Base URL: $BASE_URL"
echo "  - Headless: $HEADLESS"
echo ""

# Function to run tests
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo "📱 Running $test_name..."
    if npx playwright test $test_file; then
        echo "✅ $test_name passed!"
    else
        echo "❌ $test_name failed!"
        return 1
    fi
    echo ""
}

# Main test execution
echo "🧪 Starting test execution..."
echo ""

# Track overall success
TESTS_PASSED=true

# Run individual test suites
if [ "$1" == "mobile" ]; then
    run_test "Mobile Experience Tests (US-019)" "us-019-mobile-experience.spec.ts" || TESTS_PASSED=false
elif [ "$1" == "a11y" ]; then
    run_test "Accessibility Tests (US-020)" "us-020-accessibility.spec.ts" || TESTS_PASSED=false
elif [ "$1" == "combined" ]; then
    run_test "Combined Mobile & A11y Tests" "mobile-a11y-combined.spec.ts" || TESTS_PASSED=false
else
    # Run all tests
    run_test "Mobile Experience Tests (US-019)" "us-019-mobile-experience.spec.ts" || TESTS_PASSED=false
    run_test "Accessibility Tests (US-020)" "us-020-accessibility.spec.ts" || TESTS_PASSED=false
    run_test "Combined Mobile & A11y Tests" "mobile-a11y-combined.spec.ts" || TESTS_PASSED=false
fi

# Generate reports
echo "📊 Generating test reports..."

# Show HTML report if tests completed
if [ -d "playwright-report" ]; then
    echo "📄 HTML report available at: playwright-report/index.html"
    
    # Open report in browser if not in CI
    if [ -z "$CI" ] && [ "$2" != "--no-report" ]; then
        echo "🌐 Opening test report in browser..."
        npx playwright show-report
    fi
fi

# Check for accessibility report
if [ -f "accessibility-audit.md" ]; then
    echo "♿ Accessibility audit report: accessibility-audit.md"
fi

# Final status
echo ""
echo "========================================"
if [ "$TESTS_PASSED" = true ]; then
    echo "✅ All Phase 12 tests completed successfully!"
    exit 0
else
    echo "❌ Some tests failed. Please check the reports for details."
    exit 1
fi