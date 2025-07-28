#!/bin/bash

# Test End-to-End Enhancement Flow
echo "Testing BetterPrompts End-to-End Flow"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test 1: Health Checks
echo -e "\n1. Testing Health Endpoints..."
echo "------------------------------"

# API Gateway Health
API_HEALTH=$(curl -s http://localhost/api/v1/health)
if [[ $API_HEALTH == *"healthy"* ]]; then
    echo -e "${GREEN}✓ API Gateway is healthy${NC}"
else
    echo -e "${RED}✗ API Gateway health check failed${NC}"
fi

# TorchServe Health
TORCH_HEALTH=$(curl -s http://localhost:8080/ping)
if [[ $TORCH_HEALTH == *"Healthy"* ]]; then
    echo -e "${GREEN}✓ TorchServe is healthy${NC}"
else
    echo -e "${RED}✗ TorchServe health check failed${NC}"
fi

# Test 2: Intent Classification
echo -e "\n2. Testing Intent Classification..."
echo "-----------------------------------"
INTENT_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/intents/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "Write a Python function to calculate fibonacci numbers"}')

if [[ $INTENT_RESPONSE == *"intent"* ]]; then
    echo -e "${GREEN}✓ Intent classification working${NC}"
    echo "Response: $INTENT_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Intent classification failed${NC}"
fi

# Test 3: Enhancement Flow
echo -e "\n3. Testing Enhancement Flow..."
echo "------------------------------"
ENHANCE_RESPONSE=$(curl -s -X POST http://localhost/api/v1/enhance \
  -H "Content-Type: application/json" \
  -d '{"text": "Explain machine learning to a beginner"}')

if [[ $ENHANCE_RESPONSE == *"enhanced_text"* ]]; then
    echo -e "${GREEN}✓ Enhancement flow working${NC}"
    echo "Enhanced prompt:"
    echo "$ENHANCE_RESPONSE" | jq -r '.enhanced_text'
else
    echo -e "${RED}✗ Enhancement flow failed${NC}"
    echo "$ENHANCE_RESPONSE"
fi

# Test 4: Performance Check
echo -e "\n4. Testing Performance..."
echo "-------------------------"
START_TIME=$(date +%s%3N)
curl -s -X POST http://localhost/api/v1/enhance \
  -H "Content-Type: application/json" \
  -d '{"text": "Quick test"}' > /dev/null
END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

if [ $DURATION -lt 200 ]; then
    echo -e "${GREEN}✓ API Response time: ${DURATION}ms (< 200ms target)${NC}"
else
    echo -e "${RED}✗ API Response time: ${DURATION}ms (exceeds 200ms target)${NC}"
fi

# Test 5: Frontend Access
echo -e "\n5. Testing Frontend..."
echo "----------------------"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ $FRONTEND_STATUS -eq 200 ]; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
else
    echo -e "${RED}✗ Frontend returned status: $FRONTEND_STATUS${NC}"
fi

echo -e "\n===================================="
echo "End-to-End Test Complete!"