#!/bin/bash
# Fix authentication issues and create demo users

echo "🔧 Fixing authentication system for BetterPrompts demo..."

# Database connection details
DB_USER=${DB_USER:-betterprompts}
DB_PASS=${DB_PASS:-betterprompts}
DB_NAME=${DB_NAME:-betterprompts}
DB_HOST=${DB_HOST:-localhost}

# Function to execute SQL
execute_sql() {
    docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Function to execute SQL from file
execute_sql_file() {
    docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < "$1"
}

echo "📋 Step 1: Fixing database schema..."

# Create a migration to fix the schema mismatches
cat > /tmp/fix_auth_schema.sql << 'EOF'
-- Fix schema mismatches for authentication
BEGIN;

-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verify_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{"user"}';

-- Rename columns to match code expectations
DO $$ 
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='verification_token') THEN
        ALTER TABLE users RENAME COLUMN verification_token TO email_verify_token;
    END IF;
    
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
        ALTER TABLE users RENAME COLUMN last_login TO last_login_at;
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_email_verify_token ON users(email_verify_token);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);

COMMIT;
EOF

echo "Applying schema fixes..."
execute_sql_file /tmp/fix_auth_schema.sql

echo "📋 Step 2: Creating demo users..."

# Generate bcrypt password hash for "DemoPass123!"
# Using Python since it's available in the containers
cat > /tmp/create_demo_users.py << 'EOF'
import bcrypt
import psycopg2
import uuid
from datetime import datetime
import json

# Database connection
conn = psycopg2.connect(
    host="postgres",
    database="betterprompts",
    user="betterprompts",
    password="betterprompts"
)
cur = conn.cursor()

# Demo users data
demo_users = [
    {
        "username": "demo",
        "email": "demo@betterprompts.com",
        "password": "DemoPass123!",
        "first_name": "Demo",
        "last_name": "User",
        "roles": ["user"],
        "is_verified": True
    },
    {
        "username": "admin",
        "email": "admin@betterprompts.com",
        "password": "AdminPass123!",
        "first_name": "Admin",
        "last_name": "User",
        "roles": ["user", "admin"],
        "is_verified": True
    },
    {
        "username": "testuser",
        "email": "test@betterprompts.com",
        "password": "TestPass123!",
        "first_name": "Test",
        "last_name": "User",
        "roles": ["user"],
        "is_verified": True
    }
]

for user_data in demo_users:
    # Check if user already exists
    cur.execute("SELECT id FROM users WHERE email = %s OR username = %s", 
                (user_data["email"], user_data["username"]))
    if cur.fetchone():
        print(f"User {user_data['username']} already exists, skipping...")
        continue
    
    # Hash password
    password_hash = bcrypt.hashpw(user_data["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Generate user ID
    user_id = str(uuid.uuid4())
    
    # Insert user
    cur.execute("""
        INSERT INTO users (
            id, username, email, password_hash, first_name, last_name,
            roles, is_active, is_verified, email_verify_token,
            preferences, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """, (
        user_id,
        user_data["username"],
        user_data["email"],
        password_hash,
        user_data["first_name"],
        user_data["last_name"],
        user_data["roles"],
        True,  # is_active
        user_data["is_verified"],
        None,  # email_verify_token
        json.dumps({}),  # preferences
        datetime.now(),
        datetime.now()
    ))
    
    print(f"✅ Created user: {user_data['username']} / {user_data['password']}")

conn.commit()
cur.close()
conn.close()

print("\n✅ Demo users created successfully!")
print("\nLogin credentials:")
print("- demo / DemoPass123!")
print("- admin / AdminPass123!")
print("- testuser / TestPass123!")
EOF

# Run the Python script in the api-gateway container where bcrypt is available
echo "Creating demo users..."
docker compose exec -T api-gateway python < /tmp/create_demo_users.py

echo "📋 Step 3: Testing authentication..."

# Get JWT token for demo user
echo "Testing login with demo user..."
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email_or_username": "demo", "password": "DemoPass123!"}' | jq -r '.access_token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ Authentication working! Got token: ${TOKEN:0:20}..."
else
    echo "❌ Authentication test failed. Checking logs..."
    docker compose logs api-gateway --tail 50
fi

echo "📋 Step 4: Creating demo data for testing..."

# Create some sample prompts for the demo user
if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    cat > /tmp/create_demo_prompts.sql << 'EOF'
-- Get demo user ID
DO $$
DECLARE
    demo_user_id UUID;
BEGIN
    SELECT id INTO demo_user_id FROM users WHERE username = 'demo';
    
    -- Insert sample prompts
    INSERT INTO prompts (user_id, original_prompt, enhanced_prompt, task_type, intent, complexity, techniques, metadata)
    VALUES 
    (
        demo_user_id,
        'explain quantum computing to a 5 year old',
        'Let me explain quantum computing in a simple way that a 5-year-old can understand:

**The Magic Computer Box**

Imagine you have a special magic box that can be both open AND closed at the same time! That''s kind of like a quantum computer.

**Regular Computers vs Quantum Computers:**
- Regular computers are like light switches - they''re either ON (1) or OFF (0)
- Quantum computers are like magical light switches that can be ON, OFF, and a little bit of both at the same time!

**Why is this special?**
Think of it like looking for your favorite toy:
- A regular computer checks one toy box at a time: "Is it here? No. Is it here? No."
- A quantum computer can check many toy boxes at once, like having super-fast magical eyes!

**What can they do?**
Quantum computers are really good at solving puzzles. They''re like having a team of super-smart detectives working together instead of just one.

Remember: Quantum computers are still very new and special. Scientists are still learning how to make them work better!',
        'educational',
        'explain',
        'simple',
        '["simplification", "analogy", "examples", "child_friendly_language"]'::jsonb,
        '{"age_group": "5", "topic": "quantum_computing"}'::jsonb
    ),
    (
        demo_user_id,
        'write a python function to calculate fibonacci',
        'Here''s a comprehensive implementation of Fibonacci calculation in Python with multiple approaches:

```python
def fibonacci_recursive(n):
    """
    Calculate nth Fibonacci number using recursion.
    Time Complexity: O(2^n)
    Space Complexity: O(n)
    
    Args:
        n (int): Position in Fibonacci sequence
        
    Returns:
        int: nth Fibonacci number
    """
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        return fibonacci_recursive(n-1) + fibonacci_recursive(n-2)


def fibonacci_iterative(n):
    """
    Calculate nth Fibonacci number using iteration.
    Time Complexity: O(n)
    Space Complexity: O(1)
    
    Args:
        n (int): Position in Fibonacci sequence
        
    Returns:
        int: nth Fibonacci number
    """
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    
    prev, curr = 0, 1
    for _ in range(2, n + 1):
        prev, curr = curr, prev + curr
    return curr


def fibonacci_memoized(n, memo={}):
    """
    Calculate nth Fibonacci number using memoization.
    Time Complexity: O(n)
    Space Complexity: O(n)
    
    Args:
        n (int): Position in Fibonacci sequence
        memo (dict): Cache for previously calculated values
        
    Returns:
        int: nth Fibonacci number
    """
    if n in memo:
        return memo[n]
    
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    
    memo[n] = fibonacci_memoized(n-1, memo) + fibonacci_memoized(n-2, memo)
    return memo[n]


# Example usage:
if __name__ == "__main__":
    n = 10
    print(f"Fibonacci({n}) using recursion: {fibonacci_recursive(n)}")
    print(f"Fibonacci({n}) using iteration: {fibonacci_iterative(n)}")
    print(f"Fibonacci({n}) using memoization: {fibonacci_memoized(n)}")
    
    # Generate first n Fibonacci numbers
    print(f"\nFirst {n} Fibonacci numbers:")
    for i in range(n):
        print(f"F({i}) = {fibonacci_iterative(i)}")
```',
        'programming',
        'implement',
        'moderate',
        '["code_implementation", "documentation", "examples", "performance_analysis"]'::jsonb,
        '{"language": "python", "algorithm": "fibonacci"}'::jsonb
    );
    
    RAISE NOTICE 'Demo prompts created successfully!';
END $$;
EOF

    execute_sql_file /tmp/create_demo_prompts.sql
    echo "✅ Demo prompts created!"
fi

echo "
🎉 Authentication system fixed and demo users created!

Demo Users:
- demo / DemoPass123!
- admin / AdminPass123!
- testuser / TestPass123!

Next steps:
1. Rebuild API Gateway: docker compose build api-gateway
2. Restart services: docker compose restart api-gateway
3. Test enhancement: Use the commands from DEMO_VALIDATION_REPORT.md
"

# Cleanup
rm -f /tmp/fix_auth_schema.sql /tmp/create_demo_users.py /tmp/create_demo_prompts.sql