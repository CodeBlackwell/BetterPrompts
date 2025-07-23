#!/bin/bash

# Run database migrations for BetterPrompts demo

echo "Running database migrations..."

# Execute the migration SQL directly in postgres container
docker compose exec -T postgres psql -U betterprompts -d betterprompts < ./internal/migrations/sql/001_initial_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi

# Verify tables were created
echo ""
echo "Verifying database tables:"
docker compose exec postgres psql -U betterprompts -d betterprompts -c '\dt'