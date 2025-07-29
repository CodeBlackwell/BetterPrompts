#!/bin/bash

# Phase 13: End-to-End User Journey Tests
# This script runs comprehensive user journey tests with various options

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PHASE_DIR="e2e/phase13"
REPORTS_DIR="$PHASE_DIR/reports"
DOWNLOADS_DIR="$PHASE_DIR/downloads"
WORKERS=1  # Journey tests should run sequentially

# Default values
JOURNEY=""
HEADED=false
DEBUG=false
TIMEOUT=900000  # 15 minutes per test
RETRIES=2

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --journey)
            JOURNEY="$2"
            shift 2
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --no-retries)
            RETRIES=0
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --journey <name>     Run specific journey (new-user, power-user, developer, mobile, accessibility, concurrent)"
            echo "  --headed             Run tests in headed mode (see browser)"
            echo "  --debug              Enable debug mode with slow motion"
            echo "  --timeout <ms>       Set test timeout in milliseconds (default: 900000)"
            echo "  --no-retries         Disable test retries"
            echo "  --help               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Run all journey tests"
            echo "  $0 --journey new-user        # Run only new user journey"
            echo "  $0 --headed --debug          # Run in headed mode with debugging"
            echo "  $0 --journey concurrent      # Run load test only"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create directories
echo -e "${YELLOW}Setting up directories...${NC}"
mkdir -p "$REPORTS_DIR"
mkdir -p "$DOWNLOADS_DIR"

# Clean previous reports
if [ -z "$JOURNEY" ]; then
    echo -e "${YELLOW}Cleaning previous reports...${NC}"
    rm -f "$REPORTS_DIR"/*.html
    rm -f "$REPORTS_DIR"/*.md
    rm -f "$DOWNLOADS_DIR"/*
fi

# Build Playwright config
PLAYWRIGHT_CONFIG="playwright.config.ts"
HEADED_FLAG=""
DEBUG_FLAGS=""

if [ "$HEADED" = true ]; then
    HEADED_FLAG="--headed"
fi

if [ "$DEBUG" = true ]; then
    DEBUG_FLAGS="--debug --slow-mo=1000"
fi

# Determine which tests to run
if [ -n "$JOURNEY" ]; then
    case $JOURNEY in
        new-user)
            TEST_PATTERN="$PHASE_DIR/journeys/new-user-journey.spec.ts"
            ;;
        power-user)
            TEST_PATTERN="$PHASE_DIR/journeys/power-user-journey.spec.ts"
            ;;
        developer)
            TEST_PATTERN="$PHASE_DIR/journeys/developer-journey.spec.ts"
            ;;
        mobile)
            TEST_PATTERN="$PHASE_DIR/journeys/mobile-journey.spec.ts"
            ;;
        accessibility)
            TEST_PATTERN="$PHASE_DIR/journeys/accessibility-journey.spec.ts"
            ;;
        concurrent)
            TEST_PATTERN="$PHASE_DIR/journeys/concurrent-journeys.spec.ts"
            ;;
        *)
            echo -e "${RED}Unknown journey: $JOURNEY${NC}"
            echo "Valid journeys: new-user, power-user, developer, mobile, accessibility, concurrent"
            exit 1
            ;;
    esac
    echo -e "${GREEN}Running $JOURNEY journey tests...${NC}"
else
    TEST_PATTERN="$PHASE_DIR/journeys/*.spec.ts"
    echo -e "${GREEN}Running all journey tests...${NC}"
fi

# Set environment variables
export PW_TEST_TIMEOUT=$TIMEOUT
export PW_TEST_RETRIES=$RETRIES

# Ensure test data exists
echo -e "${YELLOW}Verifying test data...${NC}"

# Check for power user
if ! grep -q "poweruser@example.com" .env 2>/dev/null; then
    echo -e "${YELLOW}Note: Power user journey requires 'poweruser@example.com' to be seeded${NC}"
fi

# Check for admin user
if ! grep -q "admin@example.com" .env 2>/dev/null; then
    echo -e "${YELLOW}Note: Concurrent journey requires 'admin@example.com' to be seeded${NC}"
fi

# Run the tests
echo -e "${GREEN}Starting Phase 13 journey tests...${NC}"
echo "Configuration:"
echo "  - Timeout: ${TIMEOUT}ms"
echo "  - Retries: $RETRIES"
echo "  - Workers: $WORKERS"
echo "  - Headed: $HEADED"
echo "  - Debug: $DEBUG"
echo ""

# Run Playwright tests
npx playwright test $TEST_PATTERN \
    --config="$PLAYWRIGHT_CONFIG" \
    --workers=$WORKERS \
    --timeout=$TIMEOUT \
    --retries=$RETRIES \
    $HEADED_FLAG \
    $DEBUG_FLAGS

# Check exit code
TEST_EXIT_CODE=$?

# Generate summary report
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All journey tests passed!${NC}"
    
    # Show report locations
    echo -e "${YELLOW}Reports generated:${NC}"
    ls -la "$REPORTS_DIR"/*.html 2>/dev/null || echo "  No HTML reports found"
    ls -la "$REPORTS_DIR"/*.md 2>/dev/null || echo "  No Markdown reports found"
    
    # Open reports if in headed mode
    if [ "$HEADED" = true ] && [ -f "$REPORTS_DIR/concurrent-load-test-dashboard.html" ]; then
        echo -e "${YELLOW}Opening load test dashboard...${NC}"
        open "$REPORTS_DIR/concurrent-load-test-dashboard.html" 2>/dev/null || \
        xdg-open "$REPORTS_DIR/concurrent-load-test-dashboard.html" 2>/dev/null || \
        echo "Please open $REPORTS_DIR/concurrent-load-test-dashboard.html manually"
    fi
else
    echo -e "${RED}❌ Some journey tests failed!${NC}"
    echo "Check the Playwright HTML report for details:"
    echo "  npx playwright show-report"
fi

# Performance summary
if [ -z "$JOURNEY" ] || [ "$JOURNEY" = "concurrent" ]; then
    echo ""
    echo -e "${YELLOW}Load Test Summary:${NC}"
    echo "  - Total concurrent users: 185"
    echo "  - Required success rate: >95%"
    echo "  - Required response time: <500ms"
    echo "  - Required error rate: <0.1%"
fi

# Cleanup tips
echo ""
echo -e "${YELLOW}Cleanup:${NC}"
echo "  - Test downloads: $DOWNLOADS_DIR"
echo "  - Test reports: $REPORTS_DIR"
echo "  - Playwright report: playwright-report/"

exit $TEST_EXIT_CODE