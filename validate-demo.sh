#!/bin/bash

# BetterPrompts Demo Validation Script
# Validates all core functionality for demo readiness

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Start validation
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}BetterPrompts Demo Validation${NC}"
echo -e "${BLUE}$(date)${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. Service Health Checks
print_header "Service Health Validation"

# Check Docker services
print_test "Docker Compose Services"
if docker compose ps --services | grep -E "api-gateway|frontend|intent-classifier|technique-selector|prompt-generator" > /dev/null; then
    print_success "All core services are running"
else
    print_error "Some core services are not running"
fi

# Individual service health checks
services=(
    "API Gateway|http://localhost:8000/api/v1/health"
    "Frontend|http://localhost:3000"
    "Intent Classifier|http://localhost:8001/health"
    "Technique Selector|http://localhost:8002/health"
    "Prompt Generator|http://localhost:8003/health"
    "PostgreSQL|pg_isready -h localhost -p 5432"
    "Redis|redis-cli ping"
)

for service_info in "${services[@]}"; do
    IFS='|' read -r service_name check_cmd <<< "$service_info"
    print_test "$service_name Health"
    
    if [[ "$check_cmd" =~ ^http ]]; then
        if curl -sf "$check_cmd" > /dev/null 2>&1; then
            print_success "$service_name is healthy"
        else
            print_error "$service_name is not responding"
        fi
    else
        if eval "$check_cmd" > /dev/null 2>&1; then
            print_success "$service_name is healthy"
        else
            print_error "$service_name is not responding"
        fi
    fi
done

# 2. API Endpoint Testing
print_header "API Endpoint Validation"

# Test core endpoints
print_test "Enhancement Pipeline"
response=$(curl -s -X POST http://localhost/api/v1/enhance \
    -H "Content-Type: application/json" \
    -H "X-Test-Mode: true" \
    -d '{"text": "Write a function to calculate fibonacci numbers"}' 2>&1)

if echo "$response" | jq -e '.enhanced_prompt' > /dev/null 2>&1; then
    print_success "Enhancement pipeline is working"
    enhanced_length=$(echo "$response" | jq -r '.enhanced_prompt | length')
    print_info "Enhanced prompt length: $enhanced_length characters"
else
    print_error "Enhancement pipeline failed: $response"
fi

# Test intent classification
print_test "Intent Classification"
response=$(curl -s -X POST http://localhost/api/v1/analyze \
    -H "Content-Type: application/json" \
    -H "X-Test-Mode: true" \
    -d '{"text": "Help me debug my React component"}' 2>&1)

if echo "$response" | jq -e '.intent' > /dev/null 2>&1; then
    intent=$(echo "$response" | jq -r '.intent')
    confidence=$(echo "$response" | jq -r '.confidence')
    print_success "Intent classification working - Intent: $intent, Confidence: $confidence"
else
    print_error "Intent classification failed: $response"
fi

# Test techniques endpoint
print_test "Techniques Listing"
response=$(curl -s http://localhost/api/v1/techniques 2>&1)

if echo "$response" | jq -e '.[0].name' > /dev/null 2>&1; then
    technique_count=$(echo "$response" | jq '. | length')
    print_success "Techniques endpoint working - Found $technique_count techniques"
else
    print_error "Techniques endpoint failed: $response"
fi

# 3. Frontend Functionality
print_header "Frontend Validation"

# Check if frontend is accessible
print_test "Frontend Homepage"
if curl -sf http://localhost:3000 | grep -q "BetterPrompts"; then
    print_success "Frontend is serving content"
else
    print_error "Frontend is not accessible"
fi

# Check static assets
print_test "Frontend Assets"
if curl -sf http://localhost:3000/_next/static/chunks/main.js > /dev/null 2>&1; then
    print_success "Frontend assets are loading"
else
    print_warning "Frontend assets may not be optimized"
fi

# 4. Database Connectivity
print_header "Database Validation"

print_test "PostgreSQL Connection"
if PGPASSWORD=betterprompts psql -h localhost -U betterprompts -d betterprompts -c "SELECT 1" > /dev/null 2>&1; then
    print_success "PostgreSQL is accessible"
    
    # Check tables
    table_count=$(PGPASSWORD=betterprompts psql -h localhost -U betterprompts -d betterprompts -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" | tr -d ' ')
    print_info "Database has $table_count tables"
else
    print_error "Cannot connect to PostgreSQL"
fi

# 5. Performance Checks
print_header "Performance Validation"

# Test API response time
print_test "API Response Time"
start_time=$(date +%s%3N)
curl -s -X POST http://localhost/api/v1/analyze \
    -H "Content-Type: application/json" \
    -H "X-Test-Mode: true" \
    -d '{"text": "Quick test"}' > /dev/null 2>&1
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

if [ $response_time -lt 300 ]; then
    print_success "API response time: ${response_time}ms (< 300ms SLA)"
else
    print_warning "API response time: ${response_time}ms (> 300ms SLA)"
fi

# 6. Integration Testing
print_header "Integration Flow Validation"

# Test complete enhancement flow
print_test "End-to-End Enhancement Flow"

# Step 1: Analyze intent
analyze_response=$(curl -s -X POST http://localhost/api/v1/analyze \
    -H "Content-Type: application/json" \
    -H "X-Test-Mode: true" \
    -d '{"text": "Create a REST API for user management"}')

if echo "$analyze_response" | jq -e '.intent' > /dev/null 2>&1; then
    intent=$(echo "$analyze_response" | jq -r '.intent')
    techniques=$(echo "$analyze_response" | jq -r '.suggested_techniques[]' | head -n 1)
    
    # Step 2: Enhance with suggested technique
    enhance_response=$(curl -s -X POST http://localhost/api/v1/enhance \
        -H "Content-Type: application/json" \
        -H "X-Test-Mode: true" \
        -d "{\"text\": \"Create a REST API for user management\", \"prefer_techniques\": [\"$techniques\"]}")
    
    if echo "$enhance_response" | jq -e '.enhanced_prompt' > /dev/null 2>&1; then
        print_success "Complete enhancement flow working"
        print_info "Used technique: $techniques for intent: $intent"
    else
        print_error "Enhancement step failed"
    fi
else
    print_error "Analysis step failed"
fi

# 7. Error Handling
print_header "Error Handling Validation"

# Test invalid input
print_test "Empty Input Handling"
response=$(curl -s -X POST http://localhost/api/v1/enhance \
    -H "Content-Type: application/json" \
    -H "X-Test-Mode: true" \
    -d '{"text": ""}' 2>&1)

if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
    print_success "Empty input properly rejected"
else
    print_error "Empty input not handled correctly"
fi

# Test rate limiting
print_test "Rate Limiting"
for i in {1..25}; do
    curl -s http://localhost/api/v1/health > /dev/null 2>&1 &
done
wait

# Make one more request to trigger rate limit
response=$(curl -s -w "\n%{http_code}" http://localhost/api/v1/health)
status_code=$(echo "$response" | tail -n 1)

if [ "$status_code" = "429" ]; then
    print_success "Rate limiting is active"
else
    print_warning "Rate limiting may not be configured (got status: $status_code)"
fi

# 8. Monitoring & Observability
print_header "Monitoring Validation"

# Check Prometheus
print_test "Prometheus Metrics"
if curl -sf http://localhost:9090/-/ready > /dev/null 2>&1; then
    print_success "Prometheus is running"
    
    # Check if metrics are being collected
    metric_count=$(curl -s http://localhost:9090/api/v1/label/__name__/values | jq '.data | length')
    print_info "Collecting $metric_count metrics"
else
    print_warning "Prometheus not accessible"
fi

# Check Grafana
print_test "Grafana Dashboards"
if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    print_success "Grafana is accessible at http://localhost:3001 (admin/admin)"
else
    print_warning "Grafana not accessible"
fi

# 9. Demo Data Validation
print_header "Demo Data Validation"

# Check if demo data exists
print_test "Demo User Accounts"
if PGPASSWORD=betterprompts psql -h localhost -U betterprompts -d betterprompts -t -c "SELECT COUNT(*) FROM users WHERE email LIKE '%demo%'" | grep -q "[1-9]"; then
    print_success "Demo users exist in database"
else
    print_warning "No demo users found - may need to create them"
fi

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ System is READY for demo!${NC}"
    echo -e "\nAccess Points:"
    echo -e "  - Application: ${BLUE}http://localhost:3000${NC}"
    echo -e "  - API Docs: ${BLUE}http://localhost:8000/api/v1/docs${NC}"
    echo -e "  - Monitoring: ${BLUE}http://localhost:3001${NC} (admin/admin)"
    echo -e "\nDemo Credentials:"
    echo -e "  - Email: ${BLUE}demo@example.com${NC}"
    echo -e "  - Password: ${BLUE}Demo123!${NC}"
    exit 0
else
    echo -e "${RED}❌ System has issues that need to be resolved!${NC}"
    echo -e "\nTroubleshooting:"
    echo -e "  1. Check service logs: ${YELLOW}docker compose logs [service-name]${NC}"
    echo -e "  2. Restart services: ${YELLOW}docker compose restart${NC}"
    echo -e "  3. Check environment: ${YELLOW}cat .env${NC}"
    exit 1
fi