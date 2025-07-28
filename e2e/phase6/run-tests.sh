#!/bin/bash

# Phase 6 E2E Test Runner Script
# This script helps run batch processing tests with various configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
BASE_URL="${BASE_URL:-http://localhost:3000}"
HEADLESS="${HEADLESS:-true}"
WORKERS="${WORKERS:-4}"
RETRIES="${RETRIES:-0}"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if services are running
check_services() {
    print_info "Checking if required services are running..."
    
    # Check frontend
    if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|302"; then
        print_error "Frontend is not accessible at $BASE_URL"
        exit 1
    fi
    
    # Check API
    if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/health" | grep -q "200"; then
        print_error "API is not accessible at $BASE_URL/api/v1/health"
        exit 1
    fi
    
    print_info "All services are running ✓"
}

# Function to clean up test artifacts
cleanup() {
    print_info "Cleaning up test artifacts..."
    rm -rf test-results downloads fixtures/generated
    mkdir -p test-results downloads fixtures/generated
}

# Function to generate test data
generate_test_data() {
    print_info "Generating additional test data..."
    
    # Create a simple script to generate test data if needed
    cat > fixtures/generated/generate.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Generate performance test files
const sizes = [250, 500, 750];
sizes.forEach(size => {
    let csv = 'prompt,category,priority\n';
    for (let i = 0; i < size; i++) {
        csv += `"Test prompt ${i + 1} for performance testing",performance,high\n`;
    }
    fs.writeFileSync(path.join(__dirname, `perf-${size}.csv`), csv);
});

console.log('Generated performance test files');
EOF
    
    node fixtures/generated/generate.js
    rm fixtures/generated/generate.js
}

# Function to run tests
run_tests() {
    local test_type=$1
    local extra_args="${@:2}"
    
    case $test_type in
        "all")
            print_info "Running all Phase 6 tests..."
            npx playwright test $extra_args
            ;;
        "batch")
            print_info "Running batch processing tests..."
            npx playwright test us-003-batch-processing.spec.ts $extra_args
            ;;
        "perf")
            print_info "Running performance tests..."
            npx playwright test batch-performance.spec.ts $extra_args
            ;;
        "upload")
            print_info "Running file upload tests..."
            npx playwright test -g "File Upload Methods" $extra_args
            ;;
        "websocket")
            print_info "Running WebSocket tests..."
            npx playwright test -g "Async Processing with WebSocket" $extra_args
            ;;
        "progress")
            print_info "Running progress tracking tests..."
            npx playwright test -g "Progress Tracking Features" $extra_args
            ;;
        "download")
            print_info "Running download tests..."
            npx playwright test -g "Results Download" $extra_args
            ;;
        "error")
            print_info "Running error handling tests..."
            npx playwright test -g "Error Handling and Recovery" $extra_args
            ;;
        *)
            print_error "Unknown test type: $test_type"
            echo "Available test types: all, batch, perf, upload, websocket, progress, download, error"
            exit 1
            ;;
    esac
}

# Function to show test report
show_report() {
    print_info "Opening test report..."
    npx playwright show-report test-results/html
}

# Main script logic
main() {
    local command=${1:-help}
    
    case $command in
        "check")
            check_services
            ;;
        "clean")
            cleanup
            ;;
        "generate")
            generate_test_data
            ;;
        "run")
            check_services
            cleanup
            generate_test_data
            run_tests "${@:2}"
            ;;
        "report")
            show_report
            ;;
        "ci")
            # CI mode - headless, single worker, with retries
            export HEADLESS=true
            export WORKERS=1
            export RETRIES=2
            export CI=true
            check_services
            cleanup
            generate_test_data
            run_tests "all" --reporter=junit,html
            ;;
        "debug")
            # Debug mode - headed, single worker, no retries
            export HEADLESS=false
            export WORKERS=1
            export RETRIES=0
            check_services
            run_tests "${2:-all}" --debug
            ;;
        "help"|*)
            echo "Phase 6 E2E Test Runner"
            echo ""
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  check                    Check if required services are running"
            echo "  clean                    Clean up test artifacts"
            echo "  generate                 Generate additional test data"
            echo "  run [type] [options]     Run tests (types: all, batch, perf, upload, etc.)"
            echo "  report                   Show HTML test report"
            echo "  ci                       Run tests in CI mode"
            echo "  debug [type]             Run tests in debug mode"
            echo "  help                     Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BASE_URL                 Base URL for tests (default: http://localhost:3000)"
            echo "  HEADLESS                 Run in headless mode (default: true)"
            echo "  WORKERS                  Number of parallel workers (default: 4)"
            echo "  RETRIES                  Number of retries (default: 0)"
            echo ""
            echo "Examples:"
            echo "  $0 run all                    # Run all tests"
            echo "  $0 run batch --headed         # Run batch tests with browser"
            echo "  $0 run perf --workers=1       # Run performance tests with 1 worker"
            echo "  $0 debug upload               # Debug upload tests"
            echo "  $0 ci                         # Run in CI mode"
            ;;
    esac
}

# Run main function
main "$@"