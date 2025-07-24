#!/bin/bash
# E2E test for enhancement flow

echo "🧪 Enhancement Flow E2E Test"
echo "=========================="

# Test config
API_URL="http://localhost/api/v1"
TEST_USER="demo"
TEST_PASS='DemoPass123!'
RESULTS=()

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0

# Test function
test_step() {
    local name=$1
    local result=$2
    local expected=$3
    
    if [[ "$result" == *"$expected"* ]]; then
        echo -e "${GREEN}✅ $name${NC}"
        PASSED=$((PASSED + 1))
        RESULTS+=("✅ $name")
    else
        echo -e "${RED}❌ $name${NC}"
        echo "   Expected: $expected"
        echo "   Got: ${result:0:100}..."
        FAILED=$((FAILED + 1))
        RESULTS+=("❌ $name: $result")
    fi
}

echo "1️⃣ Testing Authentication"
echo "-----------------------"

# Get auth token
AUTH_RESP=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email_or_username\": \"$TEST_USER\", \"password\": \"$TEST_PASS\"}")

TOKEN=$(echo "$AUTH_RESP" | jq -r '.access_token' 2>/dev/null)
test_step "Auth: Login successful" "$TOKEN" "ey"

echo ""
echo "2️⃣ Testing Enhancement Pipeline"
echo "-----------------------------"

# Test 1: Simple prompt
ENHANCE_RESP=$(curl -s -X POST "$API_URL/enhance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "explain quantum computing"}')

ORIGINAL=$(echo "$ENHANCE_RESP" | jq -r '.original_text' 2>/dev/null)
ENHANCED=$(echo "$ENHANCE_RESP" | jq -r '.enhanced_text' 2>/dev/null)
TECHNIQUES=$(echo "$ENHANCE_RESP" | jq -r '.techniques_used[]' 2>/dev/null | wc -l)

test_step "Enhancement: Original text preserved" "$ORIGINAL" "explain quantum computing"
test_step "Enhancement: Text was enhanced" "$([ "$ORIGINAL" != "$ENHANCED" ] && echo "true")" "true"
test_step "Enhancement: Techniques applied" "$([ $TECHNIQUES -gt 0 ] && echo "true")" "true"

# Test 2: Complex prompt
COMPLEX_RESP=$(curl -s -X POST "$API_URL/enhance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "write a comprehensive guide on machine learning for beginners"}')

COMPLEX_ENHANCED=$(echo "$COMPLEX_RESP" | jq -r '.enhanced_text' 2>/dev/null)
COMPLEX_LEN=${#COMPLEX_ENHANCED}

test_step "Complex: Enhancement successful" "$([ $COMPLEX_LEN -gt 100 ] && echo "true")" "true"

echo ""
echo "3️⃣ Testing Response Structure"
echo "---------------------------"

# Validate response fields
INTENT=$(echo "$ENHANCE_RESP" | jq -r '.intent' 2>/dev/null)
COMPLEXITY=$(echo "$ENHANCE_RESP" | jq -r '.complexity' 2>/dev/null)
CONFIDENCE=$(echo "$ENHANCE_RESP" | jq -r '.confidence' 2>/dev/null)

test_step "Response: Has intent field" "$([ -n "$INTENT" ] && [ "$INTENT" != "null" ] && echo "true")" "true"
test_step "Response: Has complexity field" "$([ -n "$COMPLEXITY" ] && [ "$COMPLEXITY" != "null" ] && echo "true")" "true"
test_step "Response: Has confidence score" "$([ -n "$CONFIDENCE" ] && [ "$CONFIDENCE" != "null" ] && echo "true")" "true"

echo ""
echo "4️⃣ Testing Performance"
echo "--------------------"

# Measure response time
START=$(date +%s%N)
curl -s -X POST "$API_URL/enhance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}' > /dev/null
END=$(date +%s%N)
DURATION=$(( (END - START) / 1000000 ))

test_step "Performance: Response < 500ms" "$([ $DURATION -lt 500 ] && echo "true")" "true"

echo ""
echo "5️⃣ Testing Error Handling"
echo "-----------------------"

# Test with invalid token
ERROR_RESP=$(curl -s -X POST "$API_URL/enhance" \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}')

ERROR_STATUS=$(echo "$ERROR_RESP" | jq -r '.error' 2>/dev/null)
test_step "Error: Handles invalid auth" "$([ -n "$ERROR_STATUS" ] && echo "true")" "true"

# Test with empty text
EMPTY_RESP=$(curl -s -X POST "$API_URL/enhance" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": ""}')

EMPTY_ERROR=$(echo "$EMPTY_RESP" | jq -r '.error' 2>/dev/null)
test_step "Error: Validates empty text" "$([ -n "$EMPTY_ERROR" ] && echo "true")" "true"

echo ""
echo "=============================="
echo "📊 E2E TEST SUMMARY"
echo "=============================="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL E2E TESTS PASSED!${NC}"
    echo "The enhancement flow is working correctly end-to-end."
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Failed tests:"
    for result in "${RESULTS[@]}"; do
        if [[ $result == ❌* ]]; then
            echo "  $result"
        fi
    done
    exit 1
fi