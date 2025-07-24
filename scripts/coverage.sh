#!/bin/bash
# Unified coverage script for BetterPrompts

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Function to display usage
usage() {
    echo -e "${BLUE}BetterPrompts Coverage Tool${NC}"
    echo
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  test       Run all tests with coverage"
    echo "  report     Generate coverage reports"
    echo "  badges     Generate coverage badges"
    echo "  dashboard  Start the coverage dashboard"
    echo "  ci         Run CI coverage workflow"
    echo "  clean      Clean all coverage files"
    echo
    echo "Options:"
    echo "  --go       Go services only"
    echo "  --python   Python services only"
    echo "  --frontend Frontend only"
    echo "  --help     Show this help message"
    echo
    exit 1
}

# Parse command
COMMAND=${1:-help}
shift || true

# Parse options
RUN_GO=true
RUN_PYTHON=true
RUN_FRONTEND=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --go)
            RUN_GO=true
            RUN_PYTHON=false
            RUN_FRONTEND=false
            shift
            ;;
        --python)
            RUN_GO=false
            RUN_PYTHON=true
            RUN_FRONTEND=false
            shift
            ;;
        --frontend)
            RUN_GO=false
            RUN_PYTHON=false
            RUN_FRONTEND=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Function to run tests
run_tests() {
    echo -e "${BLUE}🧪 Running tests with coverage...${NC}"
    
    if [ "$RUN_GO" = true ]; then
        echo -e "${YELLOW}Running Go tests...${NC}"
        make -f Makefile.coverage coverage-go || true
    fi
    
    if [ "$RUN_PYTHON" = true ]; then
        echo -e "${YELLOW}Running Python tests...${NC}"
        make -f Makefile.coverage coverage-python || true
    fi
    
    if [ "$RUN_FRONTEND" = true ]; then
        echo -e "${YELLOW}Running Frontend tests...${NC}"
        make -f Makefile.coverage coverage-frontend || true
    fi
    
    echo -e "${GREEN}✅ Tests completed!${NC}"
}

# Function to generate reports
generate_reports() {
    echo -e "${BLUE}📊 Generating coverage reports...${NC}"
    
    python3 scripts/coverage-aggregator.py --format text
    echo
    
    make -f Makefile.coverage coverage-report
    make -f Makefile.coverage coverage-html
    
    echo -e "${GREEN}✅ Reports generated!${NC}"
    echo -e "View reports at: ${BLUE}${PROJECT_ROOT}/.coverage/${NC}"
}

# Function to generate badges
generate_badges() {
    echo -e "${BLUE}🛡️  Generating coverage badges...${NC}"
    
    ./scripts/generate-badges.sh
    
    echo -e "${GREEN}✅ Badges generated!${NC}"
}

# Function to start dashboard
start_dashboard() {
    echo -e "${BLUE}🚀 Starting coverage dashboard...${NC}"
    
    python3 scripts/serve-coverage-dashboard.py --open
}

# Function to run CI workflow
run_ci() {
    echo -e "${BLUE}🔄 Running CI coverage workflow...${NC}"
    
    # Run all tests
    run_tests
    
    # Generate reports
    generate_reports
    
    # Generate badges
    generate_badges
    
    # Check thresholds
    echo -e "${YELLOW}Checking coverage thresholds...${NC}"
    
    COVERAGE_JSON="${PROJECT_ROOT}/.coverage/coverage.json"
    if [ -f "$COVERAGE_JSON" ]; then
        TOTAL_COVERAGE=$(jq -r '.total_coverage' "$COVERAGE_JSON")
        echo -e "Total Coverage: ${BLUE}${TOTAL_COVERAGE}%${NC}"
        
        if (( $(echo "$TOTAL_COVERAGE < 80" | bc -l) )); then
            echo -e "${RED}❌ Coverage is below 80% threshold!${NC}"
            exit 1
        else
            echo -e "${GREEN}✅ Coverage meets threshold!${NC}"
        fi
    else
        echo -e "${RED}❌ Coverage JSON not found!${NC}"
        exit 1
    fi
}

# Function to clean coverage files
clean_coverage() {
    echo -e "${YELLOW}🧹 Cleaning coverage files...${NC}"
    
    make -f Makefile.coverage clean
    
    echo -e "${GREEN}✅ Coverage files cleaned!${NC}"
}

# Execute command
case $COMMAND in
    test)
        run_tests
        ;;
    report)
        generate_reports
        ;;
    badges)
        generate_badges
        ;;
    dashboard)
        start_dashboard
        ;;
    ci)
        run_ci
        ;;
    clean)
        clean_coverage
        ;;
    help|*)
        usage
        ;;
esac