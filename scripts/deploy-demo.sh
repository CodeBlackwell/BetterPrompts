#!/bin/bash
# One-click deployment script for BetterPrompts demo

echo "🚀 BetterPrompts Demo Deployment Script"
echo "======================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📦 Step 1: Building services with fixes..."
docker compose build api-gateway

echo ""
echo "🔄 Step 2: Restarting services..."
docker compose down
docker compose up -d

echo ""
echo "⏳ Step 3: Waiting for services to be ready..."
sleep 10

echo ""
echo "🔧 Step 4: Applying database fixes and creating demo users..."
./scripts/fix-auth-and-create-demo-users.sh

echo ""
echo "✅ Step 5: Running validation..."
./scripts/validate-demo-fixes.sh

echo ""
echo -e "${GREEN}🎉 Demo deployment complete!${NC}"
echo ""
echo "Quick test commands:"
echo "1. Get token:    TOKEN=\$(./scripts/get-auth-token.sh demo DemoPass123!)"
echo "2. Test enhance: curl -X POST http://localhost/api/v1/enhance -H \"Authorization: Bearer \$TOKEN\" -H \"Content-Type: application/json\" -d '{\"text\": \"explain AI\"}' | jq"
echo ""
echo "Access the application at: http://localhost"
echo ""
echo "Demo credentials:"
echo "- demo / DemoPass123!"
echo "- admin / AdminPass123!"
echo "- testuser / TestPass123!"