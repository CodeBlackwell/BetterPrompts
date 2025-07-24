#!/bin/bash
# Script to rebuild and restart all BetterPrompts services
# This ensures all dependencies are properly installed

set -e

echo "=== BetterPrompts Service Rebuild and Restart ==="
echo "This will rebuild all Docker services to ensure dependencies are up-to-date"
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Stop all services
echo "1. Stopping all services..."
docker compose down

# Remove old images to force rebuild
echo ""
echo "2. Removing old images to force fresh build..."
docker compose rm -f

# Build services that need rebuilding
echo ""
echo "3. Building services with updated dependencies..."
echo "   - Building prompt-generator (with psycopg2-binary)..."
docker compose build prompt-generator

echo "   - Building intent-classifier (with psycopg2-binary)..."
docker compose build intent-classifier

echo "   - Building api-gateway..."
docker compose build api-gateway

echo "   - Building nginx..."
docker compose build nginx

# Start all services
echo ""
echo "4. Starting all services..."
docker compose up -d

# Wait for services to be ready
echo ""
echo "5. Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "6. Checking service health status..."
docker compose ps

echo ""
echo "7. Checking specific service logs for errors..."
echo ""
echo "Prompt Generator logs:"
docker compose logs prompt-generator --tail=20

echo ""
echo "API Gateway logs:"
docker compose logs api-gateway --tail=10

echo ""
echo "8. Running health checks..."
# Check frontend
echo -n "Frontend health: "
curl -s http://localhost:3000/api/healthcheck | jq -r '.status' || echo "FAILED"

# Check API Gateway
echo -n "API Gateway health: "
curl -s http://localhost/api/v1/health | jq -r '.status' || echo "FAILED"

# Check Nginx
echo -n "Nginx health: "
curl -s http://localhost/health || echo "FAILED"

echo ""
echo ""
echo "=== Rebuild Complete ==="
echo "Services have been rebuilt and restarted with updated dependencies."
echo ""
echo "To run E2E tests, execute: ./tests/e2e/enhancement-flow.test.sh"
echo "To check logs: docker compose logs -f [service-name]"