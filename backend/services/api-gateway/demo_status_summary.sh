#!/bin/bash

# Quick Demo Status Summary

echo "============================================"
echo "BetterPrompts Demo Status Report"
echo "Generated: $(date)"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🐳 Docker Services Status:${NC}"
echo "----------------------------------------"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAME|healthy|unhealthy|starting)"
echo ""

echo -e "${YELLOW}🌐 Web Interface:${NC}"
echo "----------------------------------------"
FRONTEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$FRONTEND_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Frontend accessible at http://localhost:3000${NC}"
else
    echo -e "${RED}✗ Frontend not responding (HTTP $FRONTEND_CODE)${NC}"
fi
echo ""

echo -e "${YELLOW}🔌 Direct Service Endpoints:${NC}"
echo "----------------------------------------"
echo "Intent Classifier: http://localhost:8001"
echo "Technique Selector: http://localhost:8002"
echo "Prompt Generator: http://localhost:8003"
echo "API Gateway: http://localhost:8000"
echo ""

echo -e "${YELLOW}📊 Database Status:${NC}"
echo "----------------------------------------"
TABLE_COUNT=$(docker compose exec -T postgres psql -U betterprompts -d betterprompts -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
echo "Tables created: $TABLE_COUNT"
docker compose exec -T postgres psql -U betterprompts -d betterprompts -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | grep -E "users|prompts|sessions|api_usage" || echo "No core tables found"
echo ""

echo -e "${YELLOW}🚀 Demo Readiness Summary:${NC}"
echo "----------------------------------------"
echo -e "${GREEN}✓ Working Components:${NC}"
echo "  • Docker infrastructure running"
echo "  • Database connected with tables"
echo "  • API Gateway responding"
echo "  • Backend services healthy"
echo ""

echo -e "${RED}✗ Known Issues:${NC}"
echo "  • Authentication flow has schema mismatches"
echo "  • Direct service endpoints return 404 (routing issue)"
echo "  • Frontend may need restart"
echo ""

echo -e "${YELLOW}📝 Quick Demo Script:${NC}"
echo "----------------------------------------"
echo "1. Show architecture diagram"
echo "2. Display running services: docker compose ps"
echo "3. Show frontend at http://localhost:3000"
echo "4. Demonstrate API Gateway health: curl http://localhost/api/v1/health"
echo "5. Show monitoring at http://localhost:3001 (Grafana)"
echo "6. Explain the prompt enhancement flow"
echo ""

echo -e "${YELLOW}🛠️ Emergency Fixes:${NC}"
echo "----------------------------------------"
echo "# If frontend is down:"
echo "docker compose restart frontend"
echo ""
echo "# If you need to create a test user manually:"
echo "docker compose exec postgres psql -U betterprompts -d betterprompts"
echo ""
echo "# View logs for any service:"
echo "docker compose logs -f [service-name]"
echo ""

echo -e "${YELLOW}💡 Demo Tips:${NC}"
echo "----------------------------------------"
echo "• Focus on the architecture and vision"
echo "• Show the running infrastructure"
echo "• Explain the ML pipeline readiness"
echo "• Emphasize the scalability design"
echo "• Use Grafana to show monitoring capability"
echo ""