-- Simple test user with password: password123
-- bcrypt hash for 'password123' with cost factor 10
INSERT INTO auth.users (email, username, password_hash, first_name, last_name, roles, tier, is_verified, is_active) 
VALUES ('admin@betterprompts.ai', 'admin', '$2a$10$xGqhm3Tz7JNrZLmVP2xXCOaA7gWWhzJDWDZqUzHZkGPvDZ6hW6vQy', 
        'Admin', 'User', ARRAY['admin', 'user'], 'enterprise', true, true)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = '$2a$10$xGqhm3Tz7JNrZLmVP2xXCOaA7gWWhzJDWDZqUzHZkGPvDZ6hW6vQy';