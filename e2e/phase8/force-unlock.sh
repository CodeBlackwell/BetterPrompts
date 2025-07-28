#!/bin/bash

echo "🔓 Force unlocking all accounts..."

# Clear all Redis data
echo "Clearing Redis..."
docker compose exec redis redis-cli FLUSHALL

# Delete and recreate the admin user
echo "Recreating admin user..."
docker compose exec postgres psql -U betterprompts -d betterprompts -c "DELETE FROM auth.users WHERE email = 'admin@betterprompts.ai';"

# Create fresh admin user with password123
docker compose exec postgres psql -U betterprompts -d betterprompts -c "
INSERT INTO auth.users (email, username, password_hash, first_name, last_name, roles, tier, is_verified, is_active) 
VALUES ('admin@betterprompts.ai', 'admin', '\$2a\$10\$xGqhm3Tz7JNrZLmVP2xXCOaA7gWWhzJDWDZqUzHZkGPvDZ6hW6vQy', 
        'Admin', 'User', ARRAY['admin', 'user'], 'enterprise', true, true);"

# Restart API to clear any in-memory state
echo "Restarting API gateway..."
docker compose restart api-gateway

echo "Waiting for API to be ready..."
sleep 5

# Test the login
echo "Testing login..."
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email_or_username":"admin@betterprompts.ai","password":"password123"}' \
  | jq .

echo "✅ Done!"