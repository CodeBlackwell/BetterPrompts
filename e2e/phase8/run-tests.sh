#!/bin/bash

# Quick test execution script for Phase 8

echo "🚀 BetterPrompts Phase 8 Test Runner"
echo "===================================="
echo ""
echo "Select test to run:"
echo "1) E2E - Performance Dashboard"
echo "2) E2E - Dashboard Stress Test"
echo "3) E2E - SLA Compliance"
echo "4) E2E - All Tests"
echo "5) k6 - Quick Ramp-up Test"
echo "6) k6 - Full Test Suite"
echo "7) Validate Everything"
echo "8) Open Grafana Dashboard"
echo ""

read -p "Enter selection (1-8): " selection

case $selection in
    1)
        echo "Running Performance Dashboard tests..."
        npx playwright test us-005-performance-metrics.spec.ts --headed
        ;;
    2)
        echo "Running Dashboard Stress tests..."
        npx playwright test dashboard-stress.spec.ts
        ;;
    3)
        echo "Running SLA Compliance tests..."
        npx playwright test sla-compliance.spec.ts
        ;;
    4)
        echo "Running all E2E tests..."
        npm test
        ;;
    5)
        echo "Running quick k6 ramp-up test..."
        k6 run scenarios/ramp-up.k6.js --duration 2m --vus 50
        ;;
    6)
        echo "Running full k6 test suite..."
        npm run k6:local
        ;;
    7)
        echo "Running full validation..."
        ./validate-tests.sh
        ;;
    8)
        echo "Opening Grafana dashboard..."
        open http://localhost:3001/d/betterprompts-performance
        ;;
    *)
        echo "Invalid selection"
        exit 1
        ;;
esac

echo ""
echo "✅ Test execution complete!"
echo "📊 Check reports/ directory for detailed results"