#!/bin/bash
# BetterPrompts API cURL Examples
# 
# This script demonstrates various API calls using cURL

API_BASE="http://localhost:8080/api/v1"

echo "=== BetterPrompts API cURL Examples ==="
echo

# Example 1: Basic Enhancement
echo "1. Basic Enhancement"
echo "----------------------------------------"
curl -X POST "$API_BASE/enhance" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Explain the water cycle"
  }' | jq '.'
echo

# Example 2: Enhancement with Preferences
echo "2. Enhancement with Preferences"
echo "----------------------------------------"
curl -X POST "$API_BASE/enhance" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "How to learn programming",
    "prefer_techniques": ["step_by_step", "structured_output"],
    "context": {
      "audience": "complete_beginner",
      "goal": "web_development"
    }
  }' | jq '.'
echo

# Example 3: Intent Analysis
echo "3. Intent Analysis"
echo "----------------------------------------"
curl -X POST "$API_BASE/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Write a business proposal for a new app"
  }' | jq '.'
echo

# Example 4: Get Available Techniques
echo "4. Get Available Techniques"
echo "----------------------------------------"
curl -X GET "$API_BASE/techniques" | jq '.'
echo

# Example 5: Register New User
echo "5. Register New User"
echo "----------------------------------------"
curl -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }' | jq '.'
echo

# Example 6: Login
echo "6. Login and Get Token"
echo "----------------------------------------"
TOKEN=$(curl -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }' | jq -r '.token')

echo "Token received: ${TOKEN:0:20}..."
echo

# Example 7: Authenticated Request
echo "7. Get History (Authenticated)"
echo "----------------------------------------"
curl -X GET "$API_BASE/history" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo

# Example 8: Submit Feedback
echo "8. Submit Feedback (Authenticated)"
echo "----------------------------------------"
curl -X POST "$API_BASE/feedback" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enhancement_id": "550e8400-e29b-41d4-a716-446655440000",
    "score": 5,
    "comment": "Very helpful enhancement!"
  }' | jq '.'
echo

# Example 9: Complex Enhancement Request
echo "9. Complex Enhancement Request"
echo "----------------------------------------"
curl -X POST "$API_BASE/enhance" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Create a comprehensive guide for machine learning",
    "prefer_techniques": ["structured_output", "step_by_step", "visual_thinking"],
    "exclude_techniques": ["role_play"],
    "target_complexity": "intermediate",
    "context": {
      "audience": "data_scientists",
      "format": "tutorial",
      "length": "comprehensive"
    }
  }' | jq '.'
echo

# Example 10: Health Check
echo "10. API Health Check"
echo "----------------------------------------"
curl -X GET "$API_BASE/health" | jq '.'
echo

# Example 11: Using API Key (if enabled)
echo "11. Enhancement with API Key"
echo "----------------------------------------"
curl -X POST "$API_BASE/enhance" \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Explain Docker containers"
  }' | jq '.'
echo

# Example 12: Batch-like Processing
echo "12. Sequential Batch Processing"
echo "----------------------------------------"
PROMPTS=(
  "Explain quantum computing"
  "How to start investing"
  "Best practices for REST APIs"
)

for prompt in "${PROMPTS[@]}"; do
  echo "Enhancing: $prompt"
  curl -s -X POST "$API_BASE/enhance" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$prompt\"}" | jq -r '.techniques_used | join(", ")'
  echo
done

echo "=== Examples Complete ==="