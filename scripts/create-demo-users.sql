-- Create demo users directly with pre-computed bcrypt hashes
-- These hashes were generated for the passwords specified

BEGIN;

-- Clear existing demo users
DELETE FROM users WHERE username IN ('demo', 'admin', 'testuser');

-- Insert demo users with pre-generated bcrypt hashes
-- Password: DemoPass123!
INSERT INTO users (
    id, username, email, password_hash, first_name, last_name,
    roles, is_active, is_verified, preferences,
    created_at, updated_at
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'demo',
    'demo@betterprompts.com',
    '$2a$10$VnrH.3x5rKFwGNv7aRWJH.wCfgBzJKgOLtfH8B.4H4.7nNnA.uAYa', -- DemoPass123!
    'Demo',
    'User',
    ARRAY['user']::text[],
    true,
    true,
    '{}',
    NOW(),
    NOW()
);

-- Password: AdminPass123!
INSERT INTO users (
    id, username, email, password_hash, first_name, last_name,
    roles, is_active, is_verified, preferences,
    created_at, updated_at
) VALUES (
    'b2c3d4e5-f678-90ab-cdef-123456789012',
    'admin',
    'admin@betterprompts.com',
    '$2a$10$2LhQpQB5FJ9vCG1Y84Q.JeWFKQ1S0rHmYz.UGrNfRbgvP8OBXjVD6', -- AdminPass123!
    'Admin',
    'User',
    ARRAY['user', 'admin']::text[],
    true,
    true,
    '{}',
    NOW(),
    NOW()
);

-- Password: TestPass123!
INSERT INTO users (
    id, username, email, password_hash, first_name, last_name,
    roles, is_active, is_verified, preferences,
    created_at, updated_at
) VALUES (
    'c3d4e5f6-7890-abcd-ef12-345678901234',
    'testuser',
    'test@betterprompts.com',
    '$2a$10$3Y2iEKdVnkqOPpB9W5ZQJ.HFpM3BWJrUl7Gy7jD2HNqYp5QkQnzGm', -- TestPass123!
    'Test',
    'User',
    ARRAY['user']::text[],
    true,
    true,
    '{}',
    NOW(),
    NOW()
);

COMMIT;

-- Verify users were created
SELECT username, email, first_name, last_name, roles, is_active, is_verified
FROM users
WHERE username IN ('demo', 'admin', 'testuser')
ORDER BY username;