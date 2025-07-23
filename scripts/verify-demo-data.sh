#!/bin/bash

# =============================================================================
# Demo Data Verification Script
# =============================================================================
# This script verifies that demo data was created successfully
# =============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi
# Load local overrides
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    export $(cat "$PROJECT_ROOT/.env.local" | grep -v '^#' | xargs)
fi
# Default values
API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:8000}"

# Test login for each demo user
test_user_login() {
    local email=$1
    local password=$2
    local expected_role=$3
    
    echo -e "${BLUE}Testing login for $email...${NC}"
    
    response=$(curl -s -X POST "$API_GATEWAY_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "'"$email"'",
            "password": "'"$password"'"
        }' 2>&1) || true
    
    if [[ $response == *"token"* ]]; then
        echo -e "${GREEN}✓ Login successful${NC}"
        
        # Extract token and check profile
        token=$(echo $response | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
        
        profile_response=$(curl -s -X GET "$API_GATEWAY_URL/api/v1/auth/profile" \
            -H "Authorization: Bearer $token" 2>&1) || true
        
        if [[ $profile_response == *"$email"* ]]; then
            echo -e "${GREEN}✓ Profile accessible${NC}"
        else
            echo -e "${RED}✗ Profile not accessible${NC}"
        fi
        
        # Test enhancement
        enhance_response=$(curl -s -X POST "$API_GATEWAY_URL/api/v1/enhance" \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d '{
                "prompt": "Test prompt for verification"
            }' 2>&1) || true
        
        if [[ $enhance_response == *"enhanced_prompt"* ]]; then
            echo -e "${GREEN}✓ Enhancement works${NC}"
        else
            echo -e "${RED}✗ Enhancement failed${NC}"
        fi
        
        # Check history
        history_response=$(curl -s -X GET "$API_GATEWAY_URL/api/v1/history" \
            -H "Authorization: Bearer $token" 2>&1) || true
        
        if [[ $history_response == *"history"* ]] || [[ $history_response == *"[]"* ]]; then
            echo -e "${GREEN}✓ History accessible${NC}"
        else
            echo -e "${RED}✗ History not accessible${NC}"
        fi
        
    else
        echo -e "${RED}✗ Login failed${NC}"
    fi
    
    echo ""
}

# Main verification
main() {
    echo -e "${BLUE}=== Demo Data Verification ===${NC}"
    echo ""
    
    # Check API Gateway
    if curl -f -s "$API_GATEWAY_URL/api/v1/health" &> /dev/null; then
        echo -e "${GREEN}✓ API Gateway is running${NC}"
    else
        echo -e "${RED}✗ API Gateway is not available${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}Testing Demo Users:${NC}"
    echo ""
    
    # Test key demo users
    test_user_login "alice.johnson@demo.com" "Alice123!" "admin"
    test_user_login "bob.smith@demo.com" "Bob123!" "user"
    test_user_login "emma.davis@demo.com" "Emma123!" "developer"
    test_user_login "test@example.com" "Test123!" "user"
    
    # Check for generated files
    echo -e "${BLUE}Checking Generated Files:${NC}"
    
    if [ -f "$PROJECT_ROOT/demo-users-roles.txt" ]; then
        echo -e "${GREEN}✓ demo-users-roles.txt exists${NC}"
        echo "  Users to update: $(wc -l < "$PROJECT_ROOT/demo-users-roles.txt")"
    else
        echo -e "${YELLOW}⚠ demo-users-roles.txt not found${NC}"
    fi
    
    if [ -f "$PROJECT_ROOT/demo-saved-prompts.sql" ]; then
        echo -e "${GREEN}✓ demo-saved-prompts.sql exists${NC}"
    else
        echo -e "${YELLOW}⚠ demo-saved-prompts.sql not found${NC}"
    fi
    
    if [ -f "$PROJECT_ROOT/demo-api-keys.sql" ]; then
        echo -e "${GREEN}✓ demo-api-keys.sql exists${NC}"
    else
        echo -e "${YELLOW}⚠ demo-api-keys.sql not found${NC}"
    fi
    
    if [ -f "$PROJECT_ROOT/demo-analytics.sql" ]; then
        echo -e "${GREEN}✓ demo-analytics.sql exists${NC}"
    else
        echo -e "${YELLOW}⚠ demo-analytics.sql not found${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}=== Verification Complete ===${NC}"
    echo ""
    echo -e "${YELLOW}Note: Some features may require database updates:${NC}"
    echo "  - User roles and tiers need to be updated in the database"
    echo "  - SQL files need to be imported for full functionality"
    echo ""
}

# Run main function
main "$@"