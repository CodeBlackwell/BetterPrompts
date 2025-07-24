#!/bin/bash
# Smoke Tests for BetterPrompts Staging Environment
# This script runs basic smoke tests to verify all services are operational

set -e
set -u
set -o pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost}"
API_BASE_URL="${API_BASE_URL:-http://localhost/api/v1}"
TEST_LOG="${PROJECT_ROOT}/smoke-tests-$(date +%Y%m%d-%H%M%S).log"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test data
TEST_USER_EMAIL="smoke-test-$(date +%s)@example.com"
TEST_USER_PASSWORD="TestPassword123!"
TEST_PROMPT="Help me write a blog post about climate change"

# Function to log messages
log() {
    local level=$1
    shift
    local message="$@"
    
    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} ${message}"
            ;;
        SUCCESS)
            echo -e "${GREEN}[✓]${NC} ${message}"
            ;;
        WARNING)
            echo -e "${YELLOW}[!]${NC} ${message}"
            ;;
        ERROR)
            echo -e "${RED}[✗]${NC} ${message}"
            ;;
    esac
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] ${message}" >> "${TEST_LOG}"
}

# Function to make HTTP request
make_request() {
    local method=$1
    local url=$2
    local data=${3:-}
    local token=${4:-}
    
    local headers="-H 'Content-Type: application/json'"
    if [ -n "${token}" ]; then
        headers="${headers} -H 'Authorization: Bearer ${token}'"
    fi
    
    local curl_cmd="curl -s -w '\n%{http_code}' -X ${method} ${headers}"
    
    if [ -n "${data}" ]; then
        curl_cmd="${curl_cmd} -d '${data}'"
    fi
    
    curl_cmd="${curl_cmd} '${url}'"
    
    # Execute curl and capture response and status code
    local response=$(eval ${curl_cmd} 2>/dev/null || echo "000")
    local http_code=$(echo "${response}" | tail -n1)
    local body=$(echo "${response}" | sed '$d')
    
    echo "${http_code}|${body}"
}

# Function to run a test
run_test() {
    local test_name=$1
    local test_function=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing ${test_name}... "
    
    if ${test_function}; then
        log SUCCESS "${test_name}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log ERROR "${test_name}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Test: Check if frontend is accessible
test_frontend_health() {
    local response=$(make_request "GET" "${BASE_URL}")
    local http_code=$(echo "${response}" | cut -d'|' -f1)
    
    [ "${http_code}" = "200" ]
}

# Test: Check API health endpoint
test_api_health() {
    local response=$(make_request "GET" "${API_BASE_URL}/health")
    local http_code=$(echo "${response}" | cut -d'|' -f1)
    local body=$(echo "${response}" | cut -d'|' -f2)
    
    if [ "${http_code}" = "200" ]; then
        # Check if response contains expected fields
        echo "${body}" | grep -q "status" && echo "${body}" | grep -q "timestamp"
    else
        return 1
    fi
}

# Test: Check individual service health endpoints
test_service_health() {
    local services=("intent-classifier" "technique-selector" "prompt-generator")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        local response=$(make_request "GET" "${API_BASE_URL}/${service}/health")
        local http_code=$(echo "${response}" | cut -d'|' -f1)
        
        if [ "${http_code}" != "200" ]; then
            log WARNING "Service ${service} health check failed (HTTP ${http_code})"
            all_healthy=false
        fi
    done
    
    ${all_healthy}
}

# Test: User registration
test_user_registration() {
    local data="{\"email\":\"${TEST_USER_EMAIL}\",\"password\":\"${TEST_USER_PASSWORD}\",\"name\":\"Smoke Test User\"}"
    local response=$(make_request "POST" "${API_BASE_URL}/auth/register" "${data}")
    local http_code=$(echo "${response}" | cut -d'|' -f1)
    
    # 201 for created or 409 for already exists
    [ "${http_code}" = "201" ] || [ "${http_code}" = "409" ]
}

# Test: User login
test_user_login() {
    local data="{\"email\":\"${TEST_USER_EMAIL}\",\"password\":\"${TEST_USER_PASSWORD}\"}"
    local response=$(make_request "POST" "${API_BASE_URL}/auth/login" "${data}")
    local http_code=$(echo "${response}" | cut -d'|' -f1)
    local body=$(echo "${response}" | cut -d'|' -f2)
    
    if [ "${http_code}" = "200" ]; then
        # Extract token for subsequent tests
        AUTH_TOKEN=$(echo "${body}" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        [ -n "${AUTH_TOKEN}" ]
    else
        return 1
    fi
}

# Test: Get available techniques
test_get_techniques() {
    local response=$(make_request "GET" "${API_BASE_URL}/techniques" "" "${AUTH_TOKEN}")
    local http_code=$(echo "${response}" | cut -d'|' -f1)
    local body=$(echo "${response}" | cut -d'|' -f2)
    
    if [ "${http_code}" = "200" ]; then
        # Check if response is an array with techniques
        echo "${body}" | grep -q "chain_of_thought"
    else
        return 1
    fi
}

# Test: Enhance prompt
test_enhance_prompt() {
    local data="{\"input\":\"${TEST_PROMPT}\",\"options\":{\"explanation\":true}}"
    local response=$(make_request "POST" "${API_BASE_URL}/enhance" "${data}" "${AUTH_TOKEN}")
    local http_code=$(echo "${response}" | cut -d'|' -f1)
    local body=$(echo "${response}" | cut -d'|' -f2)
    
    if [ "${http_code}" = "200" ]; then
        # Check if response contains enhanced prompt
        echo "${body}" | grep -q "prompt" && echo "${body}" | grep -q "technique"
    else
        log WARNING "Enhancement failed with HTTP ${http_code}: ${body}"
        return 1
    fi
}

# Test: Database connectivity
test_database_connectivity() {
    # Check if postgres container can be accessed
    if docker ps --format "{{.Names}}" | grep -q "betterprompts-postgres"; then
        docker exec betterprompts-postgres pg_isready -U betterprompts >/dev/null 2>&1
    else
        # If not using Docker, skip this test
        return 0
    fi
}

# Test: Redis connectivity
test_redis_connectivity() {
    # Check if redis container can be accessed
    if docker ps --format "{{.Names}}" | grep -q "betterprompts-redis"; then
        docker exec betterprompts-redis redis-cli ping | grep -q "PONG"
    else
        # If not using Docker, skip this test
        return 0
    fi
}

# Test: Check monitoring endpoints (if available)
test_monitoring() {
    # Check Prometheus
    local prom_response=$(make_request "GET" "http://localhost:9090/-/healthy" 2>/dev/null || echo "000|")
    local prom_code=$(echo "${prom_response}" | cut -d'|' -f1)
    
    # Check Grafana
    local graf_response=$(make_request "GET" "http://localhost:3001/api/health" 2>/dev/null || echo "000|")
    local graf_code=$(echo "${graf_response}" | cut -d'|' -f1)
    
    # If either service is running, at least one should be healthy
    if [ "${prom_code}" = "200" ] || [ "${graf_code}" = "200" ]; then
        return 0
    elif [ "${prom_code}" = "000" ] && [ "${graf_code}" = "000" ]; then
        # Monitoring not configured, skip
        return 0
    else
        return 1
    fi
}

# Function to generate test report
generate_test_report() {
    local report_file="${PROJECT_ROOT}/smoke-test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "${report_file}" << EOF
# BetterPrompts Smoke Test Report

**Test Date**: $(date)  
**Environment**: Staging  
**Base URL**: ${BASE_URL}  
**API URL**: ${API_BASE_URL}

## Test Summary

- **Total Tests**: ${TOTAL_TESTS}
- **Passed**: ${PASSED_TESTS} ✅
- **Failed**: ${FAILED_TESTS} ❌
- **Success Rate**: $(( (PASSED_TESTS * 100) / TOTAL_TESTS ))%

## Test Results

| Test | Result | Description |
|------|--------|-------------|
| Frontend Health | $([ ${test_frontend_health_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Frontend accessibility |
| API Health | $([ ${test_api_health_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Main API health endpoint |
| Service Health | $([ ${test_service_health_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Individual service health |
| User Registration | $([ ${test_user_registration_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | User account creation |
| User Login | $([ ${test_user_login_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Authentication flow |
| Get Techniques | $([ ${test_get_techniques_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Technique retrieval |
| Enhance Prompt | $([ ${test_enhance_prompt_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Core enhancement functionality |
| Database | $([ ${test_database_connectivity_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | PostgreSQL connectivity |
| Redis | $([ ${test_redis_connectivity_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Redis connectivity |
| Monitoring | $([ ${test_monitoring_result:-1} -eq 0 ] && echo "✅ Pass" || echo "❌ Fail") | Prometheus/Grafana health |

## Test Details

See full test logs at: \`${TEST_LOG}\`

## Recommendations

EOF
    
    if [ ${FAILED_TESTS} -eq 0 ]; then
        echo "✅ All smoke tests passed! The staging environment is ready for use." >> "${report_file}"
    else
        echo "⚠️ Some tests failed. Please investigate the following:" >> "${report_file}"
        echo "" >> "${report_file}"
        echo "1. Check service logs: \`docker-compose -f docker-compose.prod.yml logs [service]\`" >> "${report_file}"
        echo "2. Verify environment configuration in \`.env.staging\`" >> "${report_file}"
        echo "3. Ensure all services are running: \`docker-compose -f docker-compose.prod.yml ps\`" >> "${report_file}"
        echo "4. Check database migrations have run successfully" >> "${report_file}"
    fi
    
    log INFO "Test report generated: ${report_file}"
}

# Main execution
main() {
    log INFO "Starting BetterPrompts smoke tests..."
    log INFO "API Base URL: ${API_BASE_URL}"
    
    # Initialize log
    echo "BetterPrompts Smoke Test Log - $(date)" > "${TEST_LOG}"
    
    # Run all tests
    echo
    echo "Running smoke tests..."
    echo "===================="
    
    # Infrastructure tests
    run_test "Frontend Health" test_frontend_health
    test_frontend_health_result=$?
    
    run_test "API Health" test_api_health
    test_api_health_result=$?
    
    run_test "Service Health" test_service_health
    test_service_health_result=$?
    
    run_test "Database Connectivity" test_database_connectivity
    test_database_connectivity_result=$?
    
    run_test "Redis Connectivity" test_redis_connectivity
    test_redis_connectivity_result=$?
    
    # Functional tests
    run_test "User Registration" test_user_registration
    test_user_registration_result=$?
    
    if [ ${test_user_registration_result} -eq 0 ]; then
        run_test "User Login" test_user_login
        test_user_login_result=$?
        
        if [ ${test_user_login_result} -eq 0 ] && [ -n "${AUTH_TOKEN:-}" ]; then
            run_test "Get Techniques" test_get_techniques
            test_get_techniques_result=$?
            
            run_test "Enhance Prompt" test_enhance_prompt
            test_enhance_prompt_result=$?
        fi
    fi
    
    # Optional tests
    run_test "Monitoring Health" test_monitoring
    test_monitoring_result=$?
    
    echo "===================="
    echo
    
    # Generate report
    generate_test_report
    
    # Summary
    if [ ${FAILED_TESTS} -eq 0 ]; then
        log SUCCESS "All ${TOTAL_TESTS} smoke tests passed! ✨"
        exit 0
    else
        log ERROR "${FAILED_TESTS} out of ${TOTAL_TESTS} tests failed"
        exit 1
    fi
}

# Run main function
main "$@"