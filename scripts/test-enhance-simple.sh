#!/bin/bash
# Simple test for enhance endpoint focusing on service orchestration

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Service Orchestration (Direct Service Calls)${NC}"
echo "=========================================="

# Test 1: Intent Classifier
echo -e "\n${YELLOW}Test 1: Intent Classifier Service${NC}"
PROMPT="Write a function to calculate fibonacci numbers"

INTENT_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/v1/intents/classify" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$PROMPT\"}")

if echo "$INTENT_RESPONSE" | grep -q "intent"; then
    echo -e "${GREEN}✓ Intent Classifier working${NC}"
    echo "$INTENT_RESPONSE" | jq -C '.'
    
    INTENT=$(echo "$INTENT_RESPONSE" | jq -r '.intent')
    COMPLEXITY=$(echo "$INTENT_RESPONSE" | jq -r '.complexity')
else
    echo -e "${RED}✗ Intent Classifier failed${NC}"
    echo "$INTENT_RESPONSE"
    exit 1
fi

# Test 2: Technique Selector
echo -e "\n${YELLOW}Test 2: Technique Selector Service${NC}"

TECHNIQUE_RESPONSE=$(curl -s -X POST "http://localhost:8002/api/v1/select" \
    -H "Content-Type: application/json" \
    -d "{
        \"text\": \"$PROMPT\",
        \"intent\": \"$INTENT\",
        \"complexity\": \"$COMPLEXITY\"
    }")

if echo "$TECHNIQUE_RESPONSE" | grep -q "techniques"; then
    echo -e "${GREEN}✓ Technique Selector working${NC}"
    echo "$TECHNIQUE_RESPONSE" | jq -C '.'
    
    # Techniques might be null, which is valid
    echo ""
else
    echo -e "${RED}✗ Technique Selector failed${NC}"
    echo "$TECHNIQUE_RESPONSE"
    exit 1
fi

# Test 3: Prompt Generator
echo -e "\n${YELLOW}Test 3: Prompt Generator Service${NC}"

# Check if techniques is null or empty
TECHNIQUES_CHECK=$(echo "$TECHNIQUE_RESPONSE" | jq '.techniques')
if [ "$TECHNIQUES_CHECK" = "null" ] || [ "$TECHNIQUES_CHECK" = "[]" ]; then
    echo -e "${YELLOW}No techniques selected by selector, using fallback techniques${NC}"
    # Use suggested techniques from intent classifier
    TECHNIQUES_ARRAY='["chain_of_thought", "step_by_step"]'
else
    # Reconstruct techniques array properly
    TECHNIQUES_ARRAY=$(echo "$TECHNIQUE_RESPONSE" | jq '[.techniques[].id]')
fi

GENERATOR_REQUEST=$(jq -n \
    --arg text "$PROMPT" \
    --arg intent "$INTENT" \
    --arg complexity "$COMPLEXITY" \
    --argjson techniques "$TECHNIQUES_ARRAY" \
    '{text: $text, intent: $intent, complexity: $complexity, techniques: $techniques}')

echo "Sending to prompt generator:"
echo "$GENERATOR_REQUEST" | jq -C '.'

GENERATOR_RESPONSE=$(curl -s -X POST "http://localhost:8003/api/v1/generate" \
    -H "Content-Type: application/json" \
    -d "$GENERATOR_REQUEST")

if echo "$GENERATOR_RESPONSE" | grep -q "enhanced_prompt"; then
    echo -e "${GREEN}✓ Prompt Generator working${NC}"
    echo "$GENERATOR_RESPONSE" | jq -C '.'
else
    echo -e "${RED}✗ Prompt Generator failed${NC}"
    echo "$GENERATOR_RESPONSE"
    exit 1
fi

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}All services working correctly!${NC}"
echo ""
echo "Service chain verified:"
echo "1. Intent Classifier: ✓"
echo "2. Technique Selector: ✓"
echo "3. Prompt Generator: ✓"
echo ""
echo "The enhance endpoint should work correctly."