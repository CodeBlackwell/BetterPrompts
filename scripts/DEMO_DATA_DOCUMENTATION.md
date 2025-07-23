# Demo Data Seeder Documentation

## Overview

The `seed-demo-data.sh` script populates the BetterPrompts database with realistic demo data for showcasing the system's capabilities. This includes example users, prompts, enhancement history, and analytics data.

## Prerequisites

1. **API Gateway Running**: The script requires the API Gateway to be accessible at `http://localhost:8090`
2. **PostgreSQL Database**: For full functionality, PostgreSQL should be running and accessible
3. **Environment Variables**: Copy `.env.example` to `.env` and configure database credentials

## Usage

```bash
# Basic usage
./scripts/seed-demo-data.sh

# With custom API Gateway URL
API_GATEWAY_URL=http://api.example.com ./scripts/seed-demo-data.sh

# With custom database URL
DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/seed-demo-data.sh
```

## Data Created

### 1. Demo Users (9 total)

| Email | Username | Role | Tier | Password |
|-------|----------|------|------|----------|
| alice.johnson@demo.com | alice_demo | admin | premium | Alice123! |
| bob.smith@demo.com | bob_demo | user | premium | Bob123! |
| carol.white@demo.com | carol_demo | user | pro | Carol123! |
| david.brown@demo.com | david_demo | user | basic | David123! |
| emma.davis@demo.com | emma_demo | developer | enterprise | Emma123! |
| frank.miller@demo.com | frank_demo | user | basic | Frank123! |
| grace.wilson@demo.com | grace_demo | user | pro | Grace123! |
| henry.moore@demo.com | henry_demo | user | premium | Henry123! |
| test@example.com | testuser | user | basic | Test123! |

### 2. Enhancement History

The script creates 5-10 enhanced prompts for each premium user (Alice and Bob), covering various domains:

- **Educational**: "Explain quantum computing to a 10-year-old"
- **Technical**: "Write a Python function to calculate fibonacci numbers"
- **Business**: "Create a marketing plan for a sustainable coffee shop"
- **Creative**: "Write a haiku about artificial intelligence"
- **Analytical**: "Analyze the pros and cons of remote work"

### 3. Saved Prompts & Templates

Creates SQL file (`demo-saved-prompts.sql`) with:

#### Saved Prompts
- Code Review Template
- Data Analysis Framework
- Project Planning Guide
- Learning Path Creator
- API Documentation

#### Prompt Templates
- Socratic Method (education)
- STAR Method (business)
- Five Whys (analysis)
- Devil's Advocate (critical thinking)
- Eisenhower Matrix (productivity)

### 4. API Keys

Creates SQL file (`demo-api-keys.sql`) with developer API keys for Emma:
- Production API Key (1000 requests/hour)
- Development API Key (100 requests/hour)
- Testing API Key (10 requests/minute)

### 5. Analytics Data

Creates SQL file (`demo-analytics.sql`) with:
- Technique effectiveness metrics for all 10 techniques
- 30 days of usage statistics
- Performance metrics and user engagement data

## Output Files

The script generates several files in the project root:

1. **demo-users-roles.txt**: List of users with their intended roles and tiers
2. **demo-saved-prompts.sql**: SQL for saved prompts and templates
3. **demo-api-keys.sql**: SQL for API keys
4. **demo-analytics.sql**: SQL for analytics data

## Post-Setup Steps

### 1. Import SQL Files

If PostgreSQL is accessible:

```bash
# Import saved prompts and templates
psql $DATABASE_URL < demo-saved-prompts.sql

# Import API keys
psql $DATABASE_URL < demo-api-keys.sql

# Import analytics data
psql $DATABASE_URL < demo-analytics.sql
```

### 2. Update User Roles and Tiers

The script creates users with basic permissions. To set proper roles and tiers:

1. Use an admin API endpoint (when available)
2. Or manually update in the database:

```sql
-- Update Alice to admin with premium tier
UPDATE users 
SET roles = ARRAY['admin'], tier = 'premium' 
WHERE email = 'alice.johnson@demo.com';

-- Update Emma to developer with enterprise tier
UPDATE users 
SET roles = ARRAY['developer'], tier = 'enterprise' 
WHERE email = 'emma.davis@demo.com';
```

## Demo Scenarios

### Scenario 1: Basic User Journey
1. Login as `test@example.com` (basic tier)
2. Try enhancing a simple prompt
3. View limited features available to basic tier

### Scenario 2: Premium Features
1. Login as `bob.smith@demo.com` (premium tier)
2. Access advanced techniques
3. Save and organize prompts
4. View enhancement history

### Scenario 3: Admin Dashboard
1. Login as `alice.johnson@demo.com` (admin)
2. Access admin dashboard
3. View system analytics
4. Manage users and settings

### Scenario 4: Developer Integration
1. Login as `emma.davis@demo.com` (developer)
2. Generate API keys
3. Test API integration
4. Monitor usage metrics

## Troubleshooting

### API Gateway Not Available
```bash
# Start the services
docker compose up -d

# Wait for services to be ready
./scripts/health-check.sh
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Users Already Exist
The script handles existing users gracefully. To reset:

```sql
-- Clear existing demo data
DELETE FROM prompt_history WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE '%@demo.com'
);
DELETE FROM users WHERE email LIKE '%@demo.com';
```

## Customization

### Adding More Users

Edit the `users` array in the script:

```bash
declare -a users=(
    "email|username|first|last|role|tier|password"
    # Add more users here
)
```

### Adding More Prompts

Edit the `prompts` array to include domain-specific examples:

```bash
declare -a prompts=(
    "Your custom prompt here"
    # Add more prompts
)
```

### Modifying Templates

Edit the SQL generation sections to add custom templates:

```sql
INSERT INTO prompt_templates (...) VALUES
    (gen_random_uuid(), 'Your Template', ...);
```

## Security Notes

1. **Demo Passwords**: All demo passwords follow the pattern `{FirstName}123!`
2. **API Keys**: Generated API keys are for demo only, not cryptographically secure
3. **Production Use**: Do NOT use this script in production environments
4. **Cleanup**: Remember to remove demo data before production deployment

## Integration with CI/CD

The script can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Seed Demo Data
  run: |
    ./scripts/seed-demo-data.sh
    psql $DATABASE_URL < demo-saved-prompts.sql
    psql $DATABASE_URL < demo-api-keys.sql
    psql $DATABASE_URL < demo-analytics.sql
```

## Next Steps

After running the demo data seeder:

1. Test all user journeys with different tiers
2. Verify enhancement functionality works correctly
3. Check analytics dashboard displays data properly
4. Test API key authentication for developers
5. Prepare demo script highlighting key features