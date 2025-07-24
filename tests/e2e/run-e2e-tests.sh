#!/bin/bash

# E2E Test Runner Script for BetterPrompts
# This script provides various options for running the E2E test suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CONFIG_FILE="playwright.config.ts"
WORKERS=4
BROWSER="all"
TEST_PATTERN=""
HEADED=false
UI_MODE=false
DEBUG=false
REPORT=true

# Function to print colored output
print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -c, --config FILE      Use specific config file (default: playwright.config.ts)"
    echo "  -w, --workers NUM      Number of parallel workers (default: 4)"
    echo "  -b, --browser NAME     Browser to test (chromium|firefox|webkit|all) (default: all)"
    echo "  -t, --test PATTERN     Run tests matching pattern"
    echo "  -h, --headed           Run tests in headed mode (see browser)"
    echo "  -u, --ui               Run tests in UI mode (interactive)"
    echo "  -d, --debug            Run in debug mode"
    echo "  -n, --no-report        Skip generating HTML report"
    echo "  --comprehensive        Use comprehensive config with performance monitoring"
    echo "  --smoke                Run smoke tests only"
    echo "  --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 -t new-user                        # Run new user tests"
    echo "  $0 -b chromium -w 1 --headed         # Run in Chrome, single worker, headed"
    echo "  $0 --comprehensive                    # Run with performance monitoring"
    echo "  $0 --smoke                            # Run smoke tests only"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -t|--test)
            TEST_PATTERN="$2"
            shift 2
            ;;
        -h|--headed)
            HEADED=true
            shift
            ;;
        -u|--ui)
            UI_MODE=true
            shift
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -n|--no-report)
            REPORT=false
            shift
            ;;
        --comprehensive)
            CONFIG_FILE="playwright.config.comprehensive.ts"
            shift
            ;;
        --smoke)
            TEST_PATTERN="smoke"
            WORKERS=1
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if services are running
print_color "$BLUE" "🔍 Checking if services are running..."

if ! docker compose ps | grep -q "Up"; then
    print_color "$RED" "❌ Services are not running!"
    print_color "$YELLOW" "Starting services..."
    docker compose up -d
    
    # Wait for services to be healthy
    print_color "$YELLOW" "⏳ Waiting for services to be healthy..."
    sleep 10
fi

# Verify services are healthy
API_HEALTH=$(curl -s http://localhost/api/v1/health || echo "unhealthy")
if [[ ! "$API_HEALTH" =~ "healthy" ]] && [[ ! "$API_HEALTH" =~ "ok" ]]; then
    print_color "$RED" "❌ API Gateway is not healthy!"
    print_color "$YELLOW" "Please check the services and try again."
    exit 1
fi

print_color "$GREEN" "✅ Services are healthy"

# Clean up old test results
if [ -d "test-results" ]; then
    print_color "$BLUE" "🧹 Cleaning up old test results..."
    rm -rf test-results
fi

# Build Playwright command
PLAYWRIGHT_CMD="npx playwright test"

# Add config file
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --config=$CONFIG_FILE"

# Add workers
PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --workers=$WORKERS"

# Add browser if specific
if [ "$BROWSER" != "all" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --project=$BROWSER"
fi

# Add test pattern if specified
if [ -n "$TEST_PATTERN" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD $TEST_PATTERN"
fi

# Add headed mode
if [ "$HEADED" = true ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --headed"
fi

# Add UI mode
if [ "$UI_MODE" = true ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --ui"
fi

# Add debug mode
if [ "$DEBUG" = true ]; then
    export PWDEBUG=1
fi

# Run tests
print_color "$BLUE" "🚀 Running E2E tests..."
print_color "$YELLOW" "Command: $PLAYWRIGHT_CMD"
echo ""

# Execute tests and capture exit code
set +e
eval $PLAYWRIGHT_CMD
TEST_EXIT_CODE=$?
set -e

# Generate report if enabled and not in UI mode
if [ "$REPORT" = true ] && [ "$UI_MODE" = false ] && [ $TEST_EXIT_CODE -ne 0 ]; then
    print_color "$BLUE" "📊 Generating HTML report..."
    npx playwright show-report
fi

# Show summary
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_color "$GREEN" "✅ All tests passed!"
    
    # Show performance summary if using comprehensive config
    if [[ "$CONFIG_FILE" == *"comprehensive"* ]] && [ -f "test-results/performance/performance-report.md" ]; then
        print_color "$BLUE" "📊 Performance Summary:"
        cat test-results/performance/performance-report.md | grep -A 10 "## Summary"
    fi
else
    print_color "$RED" "❌ Some tests failed!"
    print_color "$YELLOW" "Check test-results/ for screenshots, videos, and traces"
    
    # Show failed test summary
    if [ -f "test-results/results.json" ]; then
        print_color "$YELLOW" "\nFailed tests:"
        npx playwright show-report --no-open || true
    fi
fi

# Cleanup debug mode
unset PWDEBUG

exit $TEST_EXIT_CODE