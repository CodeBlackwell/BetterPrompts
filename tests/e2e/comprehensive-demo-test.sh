#!/bin/bash
# Comprehensive E2E Test Suite for BetterPrompts Demo Readiness
# This script validates the entire enhancement pipeline and all critical features

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test result tracking
declare -a TEST_RESULTS

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✅ $test_name")
    else
        echo -e "${RED}❌ FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("❌ $test_name")
    fi
}

# Function to check JSON response
check_json_field() {
    local json="$1"
    local field="$2"
    local expected="$3"
    
    local actual=$(echo "$json" | jq -r "$field" 2>/dev/null)
    [ "$actual" = "$expected" ]
}

echo "=== BetterPrompts Comprehensive Demo Test Suite ==="
echo "Date: $(date)"
echo ""

# 1. Service Health Checks
echo "1. SERVICE HEALTH CHECKS"
echo "------------------------"

run_test "Frontend Health" \
    "curl -s http://localhost:3000/api/healthcheck | jq -r '.status' | grep -q 'ok'" \
    "ok"

run_test "API Gateway Health" \
    "curl -s http://localhost/api/v1/health | jq -r '.status' | grep -q 'healthy'" \
    "healthy"

run_test "Nginx Health" \
    "curl -s http://localhost/health | grep -q 'healthy'" \
    "healthy"

run_test "Intent Classifier Health" \
    "curl -s http://localhost:8001/health | jq -r '.status' | grep -q 'healthy'" \
    "healthy"

run_test "Prompt Generator Health" \
    "curl -s http://localhost:8003/health | jq -r '.status' | grep -q 'healthy'" \
    "healthy"

run_test "Technique Selector Health" \
    "curl -s http://localhost:8002/health | jq -r '.status' | grep -q 'healthy'" \
    "healthy"

echo ""

# 2. Authentication Tests
echo "2. AUTHENTICATION TESTS"
echo "-----------------------"

# Test login with demo user
LOGIN_RESPONSE=$(curl -s -X POST http://localhost/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email_or_username": "demo", "password": "DemoPass123!"}')

run_test "Demo User Login" \
    "echo '$LOGIN_RESPONSE' | jq -r '.access_token' | grep -qE '^eyJ'" \
    "JWT token"

# Extract token for subsequent tests
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

run_test "Admin User Login" \
    "curl -s -X POST http://localhost/api/v1/auth/login \
        -H 'Content-Type: application/json' \
        -d '{\"email_or_username\": \"admin\", \"password\": \"AdminPass123!\"}' | \
        jq -r '.access_token' | grep -qE '^eyJ'" \
    "JWT token"

run_test "Invalid Login" \
    "curl -s -X POST http://localhost/api/v1/auth/login \
        -H 'Content-Type: application/json' \
        -d '{\"email_or_username\": \"demo\", \"password\": \"wrong\"}' | \
        jq -r '.status' | grep -q '401'" \
    "401"

echo ""

# 3. Enhancement Pipeline Tests
echo "3. ENHANCEMENT PIPELINE TESTS"
echo "-----------------------------"

# Test simple enhancement
ENHANCE_RESPONSE=$(curl -s -X POST http://localhost/api/v1/enhance \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "explain quantum computing to a 5 year old"}')

run_test "Simple Enhancement Request" \
    "echo '$ENHANCE_RESPONSE' | jq -r '.enhanced' | grep -q 'true'" \
    "enhanced: true"

run_test "Enhancement Has Techniques" \
    "echo '$ENHANCE_RESPONSE' | jq -r '.techniques | length' | grep -qE '^[1-9]'" \
    "techniques > 0"

run_test "Enhancement Has Enhanced Prompt" \
    "echo '$ENHANCE_RESPONSE' | jq -r '.enhanced_prompt' | grep -qv 'null'" \
    "enhanced_prompt exists"

# Test with context
CONTEXT_RESPONSE=$(curl -s -X POST http://localhost/api/v1/enhance \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "text": "write a function to calculate fibonacci",
        "context": {
            "language": "python",
            "level": "beginner"
        }
    }')

run_test "Enhancement with Context" \
    "echo '$CONTEXT_RESPONSE' | jq -r '.enhanced' | grep -q 'true'" \
    "enhanced: true"

# Test different prompts
TEST_PROMPTS=(
    "how do I learn machine learning"
    "debug this code"
    "explain recursion"
    "write unit tests"
    "optimize database queries"
)

for prompt in "${TEST_PROMPTS[@]}"; do
    RESPONSE=$(curl -s -X POST http://localhost/api/v1/enhance \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$prompt\"}")
    
    run_test "Enhancement: '$prompt'" \
        "echo '$RESPONSE' | jq -r '.enhanced' | grep -q 'true'" \
        "enhanced: true"
done

echo ""

# 4. Intent Classification Tests
echo "4. INTENT CLASSIFICATION TESTS"
echo "------------------------------"

INTENT_RESPONSE=$(curl -s -X POST http://localhost/api/v1/intent/classify \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "explain how neural networks work"}')

run_test "Intent Classification" \
    "echo '$INTENT_RESPONSE' | jq -r '.intent' | grep -qE '^(explanation|education|analysis)'" \
    "valid intent"

run_test "Complexity Score" \
    "echo '$INTENT_RESPONSE' | jq -r '.complexity' | grep -qE '^[0-9]\.'" \
    "complexity score"

echo ""

# 5. Technique Selection Tests
echo "5. TECHNIQUE SELECTION TESTS"
echo "----------------------------"

TECHNIQUE_RESPONSE=$(curl -s -X POST http://localhost/api/v1/techniques/select \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "intent": "explanation",
        "complexity": 0.7
    }')

run_test "Technique Selection" \
    "echo '$TECHNIQUE_RESPONSE' | jq -r '. | length' | grep -qE '^[1-9]'" \
    "techniques selected"

echo ""

# 6. Error Handling Tests
echo "6. ERROR HANDLING TESTS"
echo "-----------------------"

run_test "Empty Text Validation" \
    "curl -s -X POST http://localhost/api/v1/enhance \
        -H 'Authorization: Bearer $TOKEN' \
        -H 'Content-Type: application/json' \
        -d '{\"text\": \"\"}' | \
        jq -r '.status' | grep -q '400'" \
    "400 error"

run_test "Missing Authorization" \
    "curl -s -X POST http://localhost/api/v1/enhance \
        -H 'Content-Type: application/json' \
        -d '{\"text\": \"test\"}' | \
        jq -r '.status' | grep -q '401'" \
    "401 error"

run_test "Invalid JSON" \
    "curl -s -X POST http://localhost/api/v1/enhance \
        -H 'Authorization: Bearer $TOKEN' \
        -H 'Content-Type: application/json' \
        -d 'invalid json' | \
        jq -r '.status' | grep -q '400'" \
    "400 error"

echo ""

# 7. Performance Tests
echo "7. PERFORMANCE TESTS"
echo "--------------------"

# Test response time
START_TIME=$(date +%s%N)
curl -s -X POST http://localhost/api/v1/enhance \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text": "quick test"}' > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))

run_test "API Response Time < 1000ms" \
    "[ $RESPONSE_TIME -lt 1000 ]" \
    "< 1000ms"

echo "   Actual response time: ${RESPONSE_TIME}ms"

echo ""

# Generate Report
echo "========================================"
echo "DEMO READINESS TEST REPORT"
echo "========================================"
echo ""
echo "Test Summary:"
echo "-------------"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
echo ""

echo "Detailed Results:"
echo "-----------------"
for result in "${TEST_RESULTS[@]}"; do
    echo "$result"
done

echo ""

# Final Status
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ SYSTEM IS DEMO READY!${NC}"
    echo "All critical features are working correctly."
    exit 0
else
    echo -e "${RED}❌ SYSTEM NOT READY FOR DEMO${NC}"
    echo "$FAILED_TESTS tests failed. Please fix the issues above."
    exit 1
fi