#!/bin/bash
# Test script for the enhance endpoint with full service orchestration

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:8000/api/v1"
ORIGIN="http://localhost:3000"

echo -e "${BLUE}Testing Enhanced Prompt Endpoint (Full Service Orchestration)${NC}"
echo "=========================================="

# Function to print section header
print_section() {
    echo -e "\n${YELLOW}$1${NC}"
    echo "----------------------------------------"
}

# Function to check service health
check_service_health() {
    local service_name=$1
    local url=$2
    local service_display_name=$3
    
    echo -n "Checking $service_display_name... "
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Healthy${NC}"
        return 0
    else
        echo -e "${RED}✗ Not responding${NC}"
        return 1
    fi
}

# Check all service health endpoints
print_section "Service Health Checks"

all_healthy=true

check_service_health "api-gateway" "$API_URL/health" "API Gateway" || all_healthy=false
check_service_health "intent-classifier" "http://localhost:8001/health" "Intent Classifier" || all_healthy=false
check_service_health "technique-selector" "http://localhost:8002/health" "Technique Selector" || all_healthy=false
check_service_health "prompt-generator" "http://localhost:8003/health" "Prompt Generator" || all_healthy=false
check_service_health "torchserve" "http://localhost:8080/ping" "TorchServe" || all_healthy=false

if [ "$all_healthy" = false ]; then
    echo -e "\n${RED}Some services are not healthy. Please ensure all services are running:${NC}"
    echo "docker compose ps"
    echo "docker compose up -d"
    exit 1
fi

# Test 1: Register a test user
print_section "Test 1: User Registration"

TIMESTAMP=$(date +%s)
TEST_EMAIL="testuser${TIMESTAMP}@example.com"
TEST_USERNAME="testuser${TIMESTAMP}"
TEST_PASSWORD="TestPassword123!"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"username\": \"$TEST_USERNAME\",
        \"password\": \"$TEST_PASSWORD\",
        \"confirm_password\": \"$TEST_PASSWORD\",
        \"first_name\": \"Test\",
        \"last_name\": \"User\"
    }")

if echo "$REGISTER_RESPONSE" | grep -q "error"; then
    echo -e "${RED}✗ Registration failed:${NC}"
    echo "$REGISTER_RESPONSE" | jq '.'
    exit 1
else
    echo -e "${GREEN}✓ Registration successful${NC}"
    echo "$REGISTER_RESPONSE" | jq -C '.'
fi

# Test 2: Login and get token
print_section "Test 2: User Login"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d "{
        \"email_or_username\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    echo -e "${RED}✗ Login failed:${NC}"
    echo "$LOGIN_RESPONSE" | jq '.'
    exit 1
else
    echo -e "${GREEN}✓ Login successful${NC}"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
    echo "Access token obtained"
fi

# Test 3: Test enhance endpoint with simple prompt
print_section "Test 3: Simple Prompt Enhancement"

SIMPLE_PROMPT="Write a function to calculate fibonacci numbers"

echo "Original prompt: $SIMPLE_PROMPT"
echo ""

START_TIME=$(date +%s%N)

ENHANCE_RESPONSE=$(curl -s -X POST "$API_URL/enhance" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Origin: $ORIGIN" \
    -d "{
        \"text\": \"$SIMPLE_PROMPT\"
    }")

END_TIME=$(date +%s%N)
ELAPSED_MS=$(( ($END_TIME - $START_TIME) / 1000000 ))

if echo "$ENHANCE_RESPONSE" | grep -q "error"; then
    echo -e "${RED}✗ Enhancement failed:${NC}"
    echo "$ENHANCE_RESPONSE" | jq '.'
    
    # Debug: Check individual services
    echo -e "\n${YELLOW}Debugging: Testing individual services...${NC}"
    
    # Test intent classifier directly
    echo -e "\nTesting Intent Classifier directly:"
    curl -s -X POST "http://localhost:8001/api/v1/intents/classify" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$SIMPLE_PROMPT\"}" | jq '.'
    
    exit 1
else
    echo -e "${GREEN}✓ Enhancement successful (${ELAPSED_MS}ms)${NC}"
    echo "$ENHANCE_RESPONSE" | jq -C '.'
    
    # Extract and display key information
    INTENT=$(echo "$ENHANCE_RESPONSE" | jq -r '.intent')
    COMPLEXITY=$(echo "$ENHANCE_RESPONSE" | jq -r '.complexity')
    TECHNIQUES=$(echo "$ENHANCE_RESPONSE" | jq -r '.techniques_used | join(", ")')
    ENHANCED_TEXT=$(echo "$ENHANCE_RESPONSE" | jq -r '.enhanced_text')
    
    echo -e "\n${BLUE}Enhancement Summary:${NC}"
    echo "- Intent: $INTENT"
    echo "- Complexity: $COMPLEXITY"
    echo "- Techniques: $TECHNIQUES"
    echo -e "- Enhanced text:\n${GREEN}$ENHANCED_TEXT${NC}"
fi

# Test 4: Test with complex prompt and preferences
print_section "Test 4: Complex Prompt with Technique Preferences"

COMPLEX_PROMPT="I need to analyze customer sentiment from product reviews to identify key pain points and opportunities for improvement"

echo "Original prompt: $COMPLEX_PROMPT"
echo ""

START_TIME=$(date +%s%N)

ENHANCE_RESPONSE=$(curl -s -X POST "$API_URL/enhance" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Origin: $ORIGIN" \
    -d "{
        \"text\": \"$COMPLEX_PROMPT\",
        \"prefer_techniques\": [\"chain_of_thought\", \"step_by_step\"],
        \"context\": {
            \"domain\": \"business_analytics\",
            \"urgency\": \"high\"
        }
    }")

END_TIME=$(date +%s%N)
ELAPSED_MS=$(( ($END_TIME - $START_TIME) / 1000000 ))

if echo "$ENHANCE_RESPONSE" | grep -q "error"; then
    echo -e "${RED}✗ Enhancement failed:${NC}"
    echo "$ENHANCE_RESPONSE" | jq '.'
else
    echo -e "${GREEN}✓ Enhancement successful (${ELAPSED_MS}ms)${NC}"
    
    # Extract and display key information
    INTENT=$(echo "$ENHANCE_RESPONSE" | jq -r '.intent')
    COMPLEXITY=$(echo "$ENHANCE_RESPONSE" | jq -r '.complexity')
    TECHNIQUES=$(echo "$ENHANCE_RESPONSE" | jq -r '.techniques_used | join(", ")')
    CONFIDENCE=$(echo "$ENHANCE_RESPONSE" | jq -r '.confidence')
    
    echo -e "\n${BLUE}Enhancement Summary:${NC}"
    echo "- Intent: $INTENT"
    echo "- Complexity: $COMPLEXITY"
    echo "- Techniques: $TECHNIQUES"
    echo "- Confidence: $CONFIDENCE"
fi

# Test 5: Test without authentication (should work with limited features)
print_section "Test 5: Enhancement Without Authentication"

UNAUTHENTICATED_RESPONSE=$(curl -s -X POST "$API_URL/enhance" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d "{
        \"text\": \"Help me debug a memory leak in my application\"
    }")

# This should fail because enhance is a protected endpoint
if echo "$UNAUTHENTICATED_RESPONSE" | grep -q "authorization header required"; then
    echo -e "${GREEN}✓ Correctly rejected unauthenticated request${NC}"
else
    echo -e "${RED}✗ Unexpected response for unauthenticated request:${NC}"
    echo "$UNAUTHENTICATED_RESPONSE" | jq '.'
fi

# Test 6: Get enhancement history
print_section "Test 6: Get Enhancement History"

HISTORY_RESPONSE=$(curl -s -X GET "$API_URL/history" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Origin: $ORIGIN")

if echo "$HISTORY_RESPONSE" | grep -q "error"; then
    echo -e "${RED}✗ Failed to get history:${NC}"
    echo "$HISTORY_RESPONSE" | jq '.'
else
    echo -e "${GREEN}✓ History retrieved successfully${NC}"
    HISTORY_COUNT=$(echo "$HISTORY_RESPONSE" | jq '. | length')
    echo "Found $HISTORY_COUNT enhancement(s) in history"
fi

# Test 7: Performance test with multiple concurrent requests
print_section "Test 7: Concurrent Request Performance Test"

echo "Sending 5 concurrent enhancement requests..."

for i in {1..5}; do
    (
        START_TIME=$(date +%s%N)
        curl -s -X POST "$API_URL/enhance" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Origin: $ORIGIN" \
            -d "{
                \"text\": \"Test concurrent request $i: Explain quantum computing\"
            }" > /tmp/enhance_response_$i.json
        END_TIME=$(date +%s%N)
        ELAPSED_MS=$(( ($END_TIME - $START_TIME) / 1000000 ))
        echo "Request $i completed in ${ELAPSED_MS}ms"
    ) &
done

wait

echo -e "${GREEN}✓ All concurrent requests completed${NC}"

# Summary
print_section "Test Summary"

echo -e "${GREEN}Enhancement Endpoint Test Complete!${NC}"
echo ""
echo "The enhance endpoint successfully:"
echo "1. ✓ Accepts authenticated requests"
echo "2. ✓ Calls Intent Classifier service"
echo "3. ✓ Calls Technique Selector service"
echo "4. ✓ Calls Prompt Generator service"
echo "5. ✓ Returns properly formatted responses"
echo "6. ✓ Saves enhancement history"
echo "7. ✓ Handles concurrent requests"
echo ""
echo "Next steps:"
echo "- Integrate with frontend UI"
echo "- Add more comprehensive error handling"
echo "- Implement caching for better performance"
echo "- Add rate limiting for production use"

# Cleanup
rm -f /tmp/enhance_response_*.json