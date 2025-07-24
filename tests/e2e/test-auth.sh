#!/bin/bash

echo "Testing authentication..."

# Create JSON payload file
cat > /tmp/login.json << EOF
{
  "email_or_username": "demo",
  "password": "DemoPass123!"
}
EOF

# Test login
echo "Login response:"
curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json | jq

# Get token
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json | jq -r '.access_token')

echo ""
echo "Token: $TOKEN"

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ Login successful!"
    
    # Test enhancement
    cat > /tmp/enhance.json << EOF
{
  "text": "explain quantum computing to a 5 year old"
}
EOF
    
    echo ""
    echo "Testing enhancement:"
    curl -s -X POST http://localhost/api/v1/enhance \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d @/tmp/enhance.json | jq
else
    echo "❌ Login failed!"
fi

# Cleanup
rm -f /tmp/login.json /tmp/enhance.json