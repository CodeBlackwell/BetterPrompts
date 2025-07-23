#!/bin/bash
# Comprehensive validation script for BetterPrompts demo fixes

echo "🔍 BetterPrompts Demo Validation Script"
echo "======================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_cmd=$2
    local expected_result=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name... "
    
    result=$(eval "$test_cmd" 2>&1)
    
    if [[ $result == *"$expected_result"* ]]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "  Expected: $expected_result"
        echo "  Got: $result"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local health_url=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Checking health: $service_name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" 2>/dev/null || echo "000")
    
    if [[ $response == "200" ]]; then
        echo -e "${GREEN}✅ HEALTHY (200)${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ UNHEALTHY ($response)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

echo "📋 Step 1: Checking Service Health"
echo "=================================="

# Check all services
check_service_health "Nginx" "http://localhost/health"
check_service_health "API Gateway" "http://localhost/api/v1/health"
check_service_health "Frontend" "http://localhost:3000/api/health"
check_service_health "Intent Classifier" "http://localhost/api/v1/intent-classifier/health"
check_service_health "Technique Selector" "http://localhost/api/v1/technique-selector/health"
check_service_health "Prompt Generator" "http://localhost/api/v1/prompt-generator/health"

echo ""
echo "📋 Step 2: Testing Authentication"
echo "================================="

# Test login with demo user
echo "Testing login with demo user..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email_or_username": "demo", "password": "DemoPass123!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token' 2>/dev/null)

if [[ -n "$TOKEN" ]] && [[ "$TOKEN" != "null" ]]; then
    echo -e "${GREEN}✅ Login successful${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo "   Token: ${TOKEN:0:20}..."
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TOKEN=""
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test with other users
for user in "admin:AdminPass123!" "testuser:TestPass123!"; do
    IFS=':' read -r username password <<< "$user"
    echo -n "Testing login: $username... "
    
    response=$(curl -s -X POST http://localhost/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"email_or_username\": \"$username\", \"password\": \"$password\"}" | jq -r '.access_token' 2>/dev/null)
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [[ -n "$response" ]] && [[ "$response" != "null" ]]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
done

echo ""
echo "📋 Step 3: Testing Enhancement Pipeline (CRITICAL)"
echo "================================================="

if [[ -z "$TOKEN" ]]; then
    echo -e "${RED}⚠️  Skipping enhancement tests - no auth token${NC}"
else
    # Test 1: Simple enhancement
    echo "Test 1: Simple prompt enhancement..."
    ENHANCE_RESPONSE=$(curl -s -X POST http://localhost/api/v1/enhance \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"text": "explain quantum computing to a 5 year old"}')
    
    ORIGINAL=$(echo "$ENHANCE_RESPONSE" | jq -r '.original_text' 2>/dev/null)
    ENHANCED=$(echo "$ENHANCE_RESPONSE" | jq -r '.enhanced_text' 2>/dev/null)
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [[ "$ORIGINAL" != "$ENHANCED" ]] && [[ -n "$ENHANCED" ]] && [[ "$ENHANCED" != "null" ]]; then
        echo -e "${GREEN}✅ Enhancement working - text was modified${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "   Original: $ORIGINAL"
        echo "   Enhanced: ${ENHANCED:0:100}..."
    else
        echo -e "${RED}❌ Enhancement FAILED - text unchanged${NC}"
        echo "   Response: $ENHANCE_RESPONSE"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test 2: Programming prompt
    echo ""
    echo "Test 2: Programming prompt enhancement..."
    PROG_RESPONSE=$(curl -s -X POST http://localhost/api/v1/enhance \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"text": "write a python function to calculate fibonacci"}')
    
    PROG_ENHANCED=$(echo "$PROG_RESPONSE" | jq -r '.enhanced_text' 2>/dev/null)
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [[ "$PROG_ENHANCED" == *"def"* ]] || [[ "$PROG_ENHANCED" == *"fibonacci"* ]]; then
        echo -e "${GREEN}✅ Programming enhancement working${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ Programming enhancement failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    # Test 3: Techniques used
    echo ""
    echo "Test 3: Checking techniques used..."
    TECHNIQUES=$(echo "$ENHANCE_RESPONSE" | jq -r '.techniques_used[]' 2>/dev/null | wc -l)
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [[ $TECHNIQUES -gt 0 ]]; then
        echo -e "${GREEN}✅ Techniques applied: $(echo "$ENHANCE_RESPONSE" | jq -r '.techniques_used | join(", ")' 2>/dev/null)${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ No techniques detected${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
fi

echo ""
echo "📋 Step 4: Testing API Endpoints"
echo "================================"

if [[ -n "$TOKEN" ]]; then
    # Test profile endpoint
    run_test "GET /api/v1/auth/profile" \
        "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost/api/v1/auth/profile | jq -r '.username'" \
        "demo"
    
    # Test history endpoint
    run_test "GET /api/v1/history" \
        "curl -s -H 'Authorization: Bearer $TOKEN' http://localhost/api/v1/history -o /dev/null -w '%{http_code}'" \
        "200"
fi

echo ""
echo "📋 Step 5: Performance Check"
echo "============================"

if [[ -n "$TOKEN" ]]; then
    echo "Testing enhancement response time..."
    START_TIME=$(date +%s%N)
    curl -s -X POST http://localhost/api/v1/enhance \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"text": "test prompt"}' > /dev/null
    END_TIME=$(date +%s%N)
    
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [[ $RESPONSE_TIME -lt 500 ]]; then
        echo -e "${GREEN}✅ Response time: ${RESPONSE_TIME}ms (< 500ms target)${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️  Response time: ${RESPONSE_TIME}ms (> 500ms target)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
fi

echo ""
echo "======================================"
echo "📊 VALIDATION SUMMARY"
echo "======================================"
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! System is demo-ready!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review and fix issues.${NC}"
    
    # Provide troubleshooting commands
    echo ""
    echo "🔧 Troubleshooting Commands:"
    echo "1. Check logs: docker compose logs -f api-gateway"
    echo "2. Rebuild services: docker compose build api-gateway && docker compose up -d"
    echo "3. Apply auth fixes: ./scripts/fix-auth-and-create-demo-users.sh"
    echo "4. Check database: docker compose exec postgres psql -U betterprompts -c 'SELECT username FROM users;'"
    
    exit 1
fi