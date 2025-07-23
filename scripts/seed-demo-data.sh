#!/bin/bash

# =============================================================================
# BetterPrompts Demo Data Seeder Script
# =============================================================================
# This script populates the database with realistic demo data including:
# - Example users with different roles and tiers
# - Sample prompts across various domains
# - Enhancement history with different techniques
# - API keys for developer testing
# - Saved prompts and templates
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
DATABASE_URL="${DATABASE_URL:-postgresql://betterprompts:betterprompts@localhost:5432/betterprompts?sslmode=disable}"
API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:8000}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if PostgreSQL is available
check_postgres() {
    log_info "Checking PostgreSQL connection..."
    
    if command -v psql &> /dev/null; then
        # Extract connection details from DATABASE_URL
        DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1" &> /dev/null
        if [ $? -eq 0 ]; then
            log_success "PostgreSQL connection successful"
            return 0
        else
            log_error "Failed to connect to PostgreSQL"
            return 1
        fi
    else
        log_warning "psql command not found. Will use API endpoints instead."
        return 1
    fi
}

# Check if API Gateway is available
check_api_gateway() {
    log_info "Checking API Gateway availability..."
    
    if curl -f -s "$API_GATEWAY_URL/api/v1/health" &> /dev/null; then
        log_success "API Gateway is available"
        return 0
    else
        log_error "API Gateway is not available at $API_GATEWAY_URL"
        return 1
    fi
}

# Create demo users
create_demo_users() {
    log_info "Creating demo users..."
    
    # Array of demo users with different roles and tiers
    declare -a users=(
        "alice.johnson@demo.com|alice_demo|Alice|Johnson|admin|premium|Alice123!"
        "bob.smith@demo.com|bob_demo|Bob|Smith|user|premium|Bob123!"
        "carol.white@demo.com|carol_demo|Carol|White|user|pro|Carol123!"
        "david.brown@demo.com|david_demo|David|Brown|user|basic|David123!"
        "emma.davis@demo.com|emma_demo|Emma|Davis|developer|enterprise|Emma123!"
        "frank.miller@demo.com|frank_demo|Frank|Miller|user|basic|Frank123!"
        "grace.wilson@demo.com|grace_demo|Grace|Wilson|user|pro|Grace123!"
        "henry.moore@demo.com|henry_demo|Henry|Moore|user|premium|Henry123!"
        "test@example.com|testuser|Test|User|user|basic|Test123!"
    )
    
    for user_data in "${users[@]}"; do
        IFS='|' read -r email username first_name last_name role tier password <<< "$user_data"
        
        log_info "Creating user: $email ($role, $tier tier)"
        
        # Register user via API
        response=$(curl -s -X POST "$API_GATEWAY_URL/api/v1/auth/register" \
            -H "Content-Type: application/json" \
            -d '{
                "email": "'"$email"'",
                "username": "'"$username"'",
                "password": "'"$password"'",
                "first_name": "'"$first_name"'",
                "last_name": "'"$last_name"'"
            }' 2>&1) || true
        
        if [[ $response == *"token"* ]]; then
            log_success "Created user: $email"
            
            # Update user role and tier in database (requires admin access)
            # This would typically be done via an admin API endpoint
            # For demo purposes, we'll note this for manual update
            echo "$email|$role|$tier" >> "$PROJECT_ROOT/demo-users-roles.txt"
        else
            log_warning "User might already exist: $email"
        fi
    done
}

# Create sample prompts and enhancement history
create_sample_prompts() {
    log_info "Creating sample prompts and enhancement history..."
    
    # First, we need to get auth tokens for our demo users
    declare -A user_tokens
    
    # Login as alice (admin)
    response=$(curl -s -X POST "$API_GATEWAY_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "alice.johnson@demo.com",
            "password": "Alice123!"
        }')
    
    if [[ $response == *"token"* ]]; then
        alice_token=$(echo $response | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
        user_tokens["alice"]=$alice_token
        log_success "Logged in as Alice (admin)"
    fi
    
    # Login as bob (premium user)
    response=$(curl -s -X POST "$API_GATEWAY_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "bob.smith@demo.com",
            "password": "Bob123!"
        }')
    
    if [[ $response == *"token"* ]]; then
        bob_token=$(echo $response | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
        user_tokens["bob"]=$bob_token
        log_success "Logged in as Bob (premium user)"
    fi
    
    # Array of sample prompts
    declare -a prompts=(
        "Explain quantum computing to a 10-year-old"
        "Write a Python function to calculate fibonacci numbers"
        "Create a marketing plan for a sustainable coffee shop"
        "Debug this React component that's not rendering properly"
        "Analyze the pros and cons of remote work"
        "Write a haiku about artificial intelligence"
        "Design a REST API for a todo list application"
        "Explain the difference between machine learning and deep learning"
        "Create a SQL query to find top customers by revenue"
        "Write a cover letter for a software engineering position"
        "Summarize the key points of climate change"
        "Generate test cases for a login functionality"
        "Explain blockchain technology in simple terms"
        "Create a meal plan for a vegetarian athlete"
        "Write a recursive algorithm to solve tower of hanoi"
        "Design a user interface for a mobile banking app"
        "Analyze this sales data and identify trends"
        "Write a short story about time travel"
        "Create a business plan for a tech startup"
        "Explain the theory of relativity"
    )
    
    # Enhance prompts for each user
    for user in "alice" "bob"; do
        if [ -z "${user_tokens[$user]}" ]; then
            log_warning "No token for $user, skipping prompt enhancement"
            continue
        fi
        
        token="${user_tokens[$user]}"
        
        # Select random prompts for this user
        selected_prompts=()
        for i in {1..5}; do
            random_index=$((RANDOM % ${#prompts[@]}))
            selected_prompts+=("${prompts[$random_index]}")
        done
        
        # Enhance each selected prompt
        for prompt in "${selected_prompts[@]}"; do
            log_info "Enhancing prompt for $user: $prompt"
            
            response=$(curl -s -X POST "$API_GATEWAY_URL/api/v1/enhance" \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json" \
                -d '{
                    "prompt": "'"$prompt"'",
                    "options": {
                        "auto_apply": true,
                        "show_explanations": true
                    }
                }' 2>&1) || true
            
            if [[ $response == *"enhanced_prompt"* ]]; then
                log_success "Enhanced prompt successfully"
            else
                log_warning "Failed to enhance prompt: $prompt"
            fi
            
            # Small delay to avoid rate limiting
            sleep 0.5
        done
    done
}

# Create saved prompts and templates
create_saved_prompts() {
    log_info "Creating saved prompts and templates..."
    
    # This would typically be done via API endpoints
    # For now, we'll create a SQL file that can be executed manually
    
    cat > "$PROJECT_ROOT/demo-saved-prompts.sql" << 'EOF'
-- Insert saved prompts for demo users
INSERT INTO saved_prompts (id, user_id, title, description, prompt_text, tags, is_favorite, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    u.id,
    titles.title,
    titles.description,
    titles.prompt_text,
    titles.tags,
    (RANDOM() < 0.3),
    NOW() - (RANDOM() * INTERVAL '30 days'),
    NOW() - (RANDOM() * INTERVAL '7 days')
FROM users u
CROSS JOIN (
    VALUES 
        ('Code Review Template', 'Template for thorough code reviews', 'Review this code for: 1) Functionality 2) Performance 3) Security 4) Maintainability 5) Best practices', ARRAY['development', 'code-review', 'template']),
        ('Data Analysis Framework', 'Structured approach to data analysis', 'Analyze this dataset by: 1) Identifying patterns 2) Finding anomalies 3) Creating visualizations 4) Drawing conclusions', ARRAY['data', 'analysis', 'framework']),
        ('Project Planning Guide', 'Comprehensive project planning template', 'Create a project plan including: 1) Objectives 2) Timeline 3) Resources 4) Risks 5) Milestones', ARRAY['planning', 'project-management', 'template']),
        ('Learning Path Creator', 'Design learning paths for any topic', 'Create a learning path for [TOPIC] including: 1) Prerequisites 2) Core concepts 3) Practical exercises 4) Resources', ARRAY['education', 'learning', 'template']),
        ('API Documentation', 'Standard API documentation template', 'Document this API endpoint with: 1) Purpose 2) Parameters 3) Response format 4) Examples 5) Error codes', ARRAY['api', 'documentation', 'template'])
) AS titles(title, description, prompt_text, tags)
WHERE u.email IN ('alice.johnson@demo.com', 'bob.smith@demo.com', 'emma.davis@demo.com');

-- Insert prompt templates
INSERT INTO prompt_templates (id, name, slug, description, technique, category, template_text, variables, effectiveness_score, is_public, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'Socratic Method', 'socratic-method', 'Guide through questions rather than direct answers', 'socratic', 'education', 'Instead of directly answering, help me understand {topic} by asking me guiding questions that lead me to discover the answer myself.', ARRAY['topic'], 0.85, true, NOW(), NOW()),
    (gen_random_uuid(), 'STAR Method', 'star-method', 'Situation, Task, Action, Result framework', 'structured_output', 'business', 'Help me describe {experience} using the STAR method: Situation (context), Task (challenge), Action (what I did), Result (outcome).', ARRAY['experience'], 0.90, true, NOW(), NOW()),
    (gen_random_uuid(), 'Five Whys', 'five-whys', 'Root cause analysis through iterative questioning', 'chain_of_thought', 'analysis', 'Analyze {problem} using the Five Whys technique. Start with the problem and ask "why" five times to uncover the root cause.', ARRAY['problem'], 0.88, true, NOW(), NOW()),
    (gen_random_uuid(), 'Devil''s Advocate', 'devils-advocate', 'Challenge assumptions and explore counterarguments', 'critical_thinking', 'analysis', 'Play devil''s advocate for {proposition}. Challenge the assumptions and provide strong counterarguments.', ARRAY['proposition'], 0.82, true, NOW(), NOW()),
    (gen_random_uuid(), 'Eisenhower Matrix', 'eisenhower-matrix', 'Prioritize tasks by urgency and importance', 'structured_output', 'productivity', 'Organize these tasks using the Eisenhower Matrix (Urgent/Important, Not Urgent/Important, Urgent/Not Important, Not Urgent/Not Important): {tasks}', ARRAY['tasks'], 0.87, true, NOW(), NOW());
EOF
    
    log_success "Created SQL file for saved prompts and templates: demo-saved-prompts.sql"
}

# Create API keys for developers
create_api_keys() {
    log_info "Creating API keys for developer users..."
    
    # This would be done via API endpoints when implemented
    cat > "$PROJECT_ROOT/demo-api-keys.sql" << 'EOF'
-- Create API keys for developer users
INSERT INTO api_keys (id, user_id, name, key_hash, scopes, rate_limit, rate_limit_window, is_active, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    u.id,
    key_names.name,
    -- In production, this would be a properly hashed key
    encode(sha256((u.email || key_names.name || NOW()::text)::bytea), 'hex'),
    key_names.scopes,
    key_names.rate_limit,
    key_names.window,
    true,
    NOW(),
    NOW()
FROM users u
CROSS JOIN (
    VALUES 
        ('Production API Key', ARRAY['enhance', 'analyze', 'history'], 1000, 'hour'),
        ('Development API Key', ARRAY['enhance', 'analyze'], 100, 'hour'),
        ('Testing API Key', ARRAY['enhance'], 10, 'minute')
) AS key_names(name, scopes, rate_limit, window)
WHERE u.email = 'emma.davis@demo.com';
EOF
    
    log_success "Created SQL file for API keys: demo-api-keys.sql"
}

# Create analytics data
create_analytics_data() {
    log_info "Creating analytics data..."
    
    cat > "$PROJECT_ROOT/demo-analytics.sql" << 'EOF'
-- Insert technique effectiveness data
INSERT INTO technique_analytics (id, technique_name, usage_count, success_rate, avg_feedback_score, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'chain_of_thought', 1543, 0.89, 4.2, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'few_shot', 1234, 0.85, 4.1, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'step_by_step', 987, 0.92, 4.5, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'role_play', 654, 0.78, 3.9, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'structured_output', 876, 0.87, 4.3, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'emotional_appeal', 432, 0.72, 3.7, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'constraints', 765, 0.83, 4.0, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'analogical', 543, 0.80, 4.1, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'self_consistency', 321, 0.86, 4.2, NOW() - INTERVAL '30 days', NOW()),
    (gen_random_uuid(), 'react', 234, 0.88, 4.4, NOW() - INTERVAL '30 days', NOW());

-- Insert daily usage statistics
INSERT INTO usage_statistics (id, date, total_requests, unique_users, avg_response_time_ms, created_at)
SELECT 
    gen_random_uuid(),
    date_series::date,
    (RANDOM() * 1000 + 500)::int,
    (RANDOM() * 100 + 50)::int,
    (RANDOM() * 200 + 100)::int,
    NOW()
FROM generate_series(
    NOW() - INTERVAL '30 days',
    NOW(),
    INTERVAL '1 day'
) AS date_series;
EOF
    
    log_success "Created SQL file for analytics data: demo-analytics.sql"
}

# Main execution
main() {
    echo -e "${BLUE}=== BetterPrompts Demo Data Seeder ===${NC}"
    echo ""
    
    # Check prerequisites
    if ! check_api_gateway; then
        log_error "API Gateway must be running. Start it with: docker compose up -d"
        exit 1
    fi
    
    # Create demo data
    create_demo_users
    echo ""
    
    create_sample_prompts
    echo ""
    
    create_saved_prompts
    echo ""
    
    create_api_keys
    echo ""
    
    create_analytics_data
    echo ""
    
    # Summary
    echo -e "${GREEN}=== Demo Data Creation Complete ===${NC}"
    echo ""
    log_info "Created demo users with various roles and tiers"
    log_info "Generated enhancement history for multiple prompts"
    log_info "Created SQL files for additional data:"
    echo "  - demo-saved-prompts.sql (saved prompts and templates)"
    echo "  - demo-api-keys.sql (API keys for developers)"
    echo "  - demo-analytics.sql (usage analytics data)"
    echo ""
    
    if check_postgres; then
        log_info "To import the SQL files, run:"
        echo "  psql $DATABASE_URL < demo-saved-prompts.sql"
        echo "  psql $DATABASE_URL < demo-api-keys.sql"
        echo "  psql $DATABASE_URL < demo-analytics.sql"
    else
        log_info "Import the SQL files manually when PostgreSQL is available"
    fi
    
    echo ""
    log_info "Demo user credentials saved in: demo-users-roles.txt"
    log_info "Update user roles and tiers using admin API or database access"
    echo ""
    
    echo -e "${BLUE}Demo Users:${NC}"
    echo "  Admin: alice.johnson@demo.com / Alice123!"
    echo "  Premium: bob.smith@demo.com / Bob123!"
    echo "  Developer: emma.davis@demo.com / Emma123!"
    echo "  Basic: test@example.com / Test123!"
    echo ""
    
    log_success "Demo data seeding complete!"
}

# Run main function
main "$@"