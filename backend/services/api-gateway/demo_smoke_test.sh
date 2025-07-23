#!/bin/bash

# Demo Smoke Tests for BetterPrompts
# Tests only the critical paths needed for demonstration

set -e

BASE_URL="http://localhost/api/v1"
TEST_EMAIL="demo@example.com"
TEST_PASSWORD="Demo123!"
TEST_PROMPT="Write a story about a robot learning to paint"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "BetterPrompts Demo Smoke Tests"
echo "============================================"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}Test 1: API Gateway Health Check${NC}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ API Gateway is healthy${NC}"
else
    echo -e "${RED}✗ API Gateway health check failed (HTTP $HEALTH_RESPONSE)${NC}"
fi
echo ""

# Test 2: User Registration
echo -e "${YELLOW}Test 2: User Registration${NC}"
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Demo User\"}")

if echo "$REGISTER_RESPONSE" | grep -q "token" || echo "$REGISTER_RESPONSE" | grep -q "already exists"; then
    echo -e "${GREEN}✓ Registration endpoint working${NC}"
else
    echo -e "${RED}✗ Registration failed: $REGISTER_RESPONSE${NC}"
fi
echo ""

# Test 3: User Login
echo -e "${YELLOW}Test 3: User Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$TOKEN" ]; then
    echo -e "${GREEN}✓ Login successful, token received${NC}"
else
    echo -e "${RED}✗ Login failed: $LOGIN_RESPONSE${NC}"
fi
echo ""

# Test 4: Prompt Enhancement (Core Feature)
echo -e "${YELLOW}Test 4: Prompt Enhancement Flow${NC}"
if [ ! -z "$TOKEN" ]; then
    ENHANCE_RESPONSE=$(curl -s -X POST $BASE_URL/enhance \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"prompt\":\"$TEST_PROMPT\",\"task_type\":\"creative_writing\"}")
    
    if echo "$ENHANCE_RESPONSE" | grep -q "enhanced_prompt"; then
        echo -e "${GREEN}✓ Prompt enhancement working${NC}"
        echo "  Original: $TEST_PROMPT"
        ENHANCED=$(echo "$ENHANCE_RESPONSE" | grep -o '"enhanced_prompt":"[^"]*' | cut -d'"' -f4)
        echo "  Enhanced: ${ENHANCED:0:100}..."
    else
        echo -e "${RED}✗ Enhancement failed: $ENHANCE_RESPONSE${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping enhancement test (no auth token)${NC}"
fi
echo ""

# Test 5: Prompt Analysis
echo -e "${YELLOW}Test 5: Prompt Analysis${NC}"
if [ ! -z "$TOKEN" ]; then
    ANALYZE_RESPONSE=$(curl -s -X POST $BASE_URL/analyze \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"prompt\":\"$TEST_PROMPT\"}")
    
    if echo "$ANALYZE_RESPONSE" | grep -q "intent" || echo "$ANALYZE_RESPONSE" | grep -q "task_type"; then
        echo -e "${GREEN}✓ Prompt analysis working${NC}"
        echo "  Response preview: ${ANALYZE_RESPONSE:0:100}..."
    else
        echo -e "${RED}✗ Analysis failed: $ANALYZE_RESPONSE${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping analysis test (no auth token)${NC}"
fi
echo ""

# Test 6: History Retrieval
echo -e "${YELLOW}Test 6: Prompt History${NC}"
if [ ! -z "$TOKEN" ]; then
    HISTORY_RESPONSE=$(curl -s -X GET $BASE_URL/history \
        -H "Authorization: Bearer $TOKEN")
    
    HISTORY_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET $BASE_URL/history \
        -H "Authorization: Bearer $TOKEN")
    
    if [ "$HISTORY_CODE" = "200" ]; then
        echo -e "${GREEN}✓ History endpoint accessible${NC}"
        echo "  Response preview: ${HISTORY_RESPONSE:0:100}..."
    else
        echo -e "${RED}✗ History retrieval failed (HTTP $HISTORY_CODE)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping history test (no auth token)${NC}"
fi
echo ""

# Summary
echo "============================================"
echo "Demo Smoke Test Summary"
echo "============================================"
echo ""

# Check service connectivity
echo -e "${YELLOW}Service Connectivity:${NC}"
for SERVICE in intent-classifier technique-selector prompt-generator; do
    SERVICE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/$SERVICE/health 2>/dev/null || echo "000")
    if [ "$SERVICE_HEALTH" = "200" ]; then
        echo -e "  ${GREEN}✓ $SERVICE: Connected${NC}"
    else
        echo -e "  ${RED}✗ $SERVICE: Not responding (HTTP $SERVICE_HEALTH)${NC}"
    fi
done

echo ""
echo "============================================"
echo "Quick Demo Script:"
echo "============================================"
echo "1. Show the web interface at http://localhost:3000"
echo "2. Register/login with: $TEST_EMAIL / $TEST_PASSWORD"
echo "3. Enter prompt: '$TEST_PROMPT'"
echo "4. Show the enhancement process and results"
echo "5. Check history to show persistence"
echo ""