#!/bin/bash

# BetterPrompts Phase 11 Security Test Runner
# OWASP Top 10 Compliance Testing

set -e

echo "🔒 BetterPrompts Security Testing - Phase 11"
echo "=========================================="
echo ""

# Check if services are running
check_services() {
    echo "🔍 Checking services..."
    
    # Check frontend
    if curl -s http://localhost:3000 > /dev/null; then
        echo "✅ Frontend is running"
    else
        echo "❌ Frontend is not running on port 3000"
        echo "   Please start with: cd frontend && npm run dev"
        exit 1
    fi
    
    # Check API
    if curl -s http://localhost/api/v1/health > /dev/null; then
        echo "✅ API is running"
    else
        echo "❌ API is not running"
        echo "   Please start with: docker compose up -d"
        exit 1
    fi
    
    echo ""
}

# Install dependencies
install_deps() {
    echo "📦 Installing dependencies..."
    npm install
    echo ""
}

# Run specific test suite
run_test_suite() {
    local suite=$1
    local name=$2
    
    echo "🧪 Running $name tests..."
    npm run test:$suite || true
    echo ""
}

# Main execution
main() {
    # Check command line arguments
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Usage: ./run-tests.sh [options]"
        echo ""
        echo "Options:"
        echo "  --all              Run all security tests (default)"
        echo "  --sql              Run SQL injection tests only"
        echo "  --xss              Run XSS protection tests only"
        echo "  --auth             Run authentication tests only"
        echo "  --session          Run session management tests only"
        echo "  --encryption       Run encryption tests only"
        echo "  --quick            Run critical tests only"
        echo "  --with-zap         Include OWASP ZAP scanning"
        echo "  --skip-checks      Skip service checks"
        echo ""
        exit 0
    fi
    
    # Skip checks if requested
    if [ "$1" != "--skip-checks" ] && [ "$2" != "--skip-checks" ]; then
        check_services
    fi
    
    # Install dependencies
    install_deps
    
    # Run tests based on arguments
    case "$1" in
        "--sql")
            run_test_suite "sql" "SQL Injection Prevention"
            ;;
        "--xss")
            run_test_suite "xss" "XSS Protection"
            ;;
        "--auth")
            run_test_suite "auth" "Authentication Security"
            ;;
        "--session")
            run_test_suite "session" "Session Management"
            ;;
        "--encryption")
            run_test_suite "encryption" "Data Encryption"
            ;;
        "--quick")
            echo "🚀 Running critical security tests..."
            run_test_suite "sql" "SQL Injection Prevention"
            run_test_suite "xss" "XSS Protection"
            ;;
        "--with-zap")
            echo "🕷️  Running tests with OWASP ZAP..."
            npm run test:with-zap
            ;;
        *)
            echo "🔒 Running all security tests..."
            echo ""
            
            # Run all test suites
            run_test_suite "sql" "SQL Injection Prevention (SS-01)"
            run_test_suite "xss" "XSS Protection (SS-02)"
            run_test_suite "auth" "Authentication Security (SS-03)"
            run_test_suite "session" "Session Management (SS-04)"
            run_test_suite "encryption" "Data Encryption (SS-05)"
            ;;
    esac
    
    # Generate report
    echo "📊 Generating security report..."
    npm run report:generate 2>/dev/null || echo "   Report generation not configured"
    
    # Show report location
    echo ""
    echo "✅ Security testing complete!"
    echo ""
    echo "📋 View detailed results:"
    echo "   - HTML Report: npx playwright show-report"
    echo "   - JSON Summary: cat reports/test-summary.json"
    echo "   - Security Assessment: cat reports/security-assessment.md"
    echo ""
    
    # Check for failures
    if [ -f "test-results.json" ]; then
        FAILURES=$(grep -o '"failed":[0-9]*' test-results.json | cut -d':' -f2)
        if [ "$FAILURES" -gt 0 ]; then
            echo "⚠️  WARNING: $FAILURES security tests failed!"
            echo "   Review the reports and fix vulnerabilities before deployment."
            exit 1
        else
            echo "🎉 All security tests passed!"
        fi
    fi
}

# Run main function
main "$@"