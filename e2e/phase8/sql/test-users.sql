-- Test users for Phase 8 Performance Testing
-- Password for all users: Test123!@# (bcrypt hash with cost factor 10)

-- Admin user
INSERT INTO auth.users (email, username, password_hash, first_name, last_name, roles, tier, is_verified, is_active) 
VALUES ('admin@betterprompts.ai', 'admin', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 
        'Admin', 'User', ARRAY['admin', 'user'], 'enterprise', true, true)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C',
    is_verified = true,
    is_active = true,
    roles = ARRAY['admin', 'user'];

-- Regular test users
INSERT INTO auth.users (email, username, password_hash, first_name, last_name, roles, tier, is_verified, is_active) VALUES
    ('user1@example.com', 'user1', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User1', ARRAY['user'], 'free', true, true),
    ('user2@example.com', 'user2', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User2', ARRAY['user'], 'pro', true, true),
    ('user3@example.com', 'user3', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User3', ARRAY['user'], 'free', true, true),
    ('user4@example.com', 'user4', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User4', ARRAY['user'], 'pro', true, true),
    ('user5@example.com', 'user5', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User5', ARRAY['user'], 'enterprise', true, true),
    ('user6@example.com', 'user6', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User6', ARRAY['user'], 'free', true, true),
    ('user7@example.com', 'user7', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User7', ARRAY['user'], 'pro', true, true),
    ('user8@example.com', 'user8', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User8', ARRAY['user'], 'free', true, true),
    ('user9@example.com', 'user9', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User9', ARRAY['user'], 'pro', true, true),
    ('user10@example.com', 'user10', '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C', 'Test', 'User10', ARRAY['user'], 'enterprise', true, true)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = '$2a$10$g566yZvqXuqCoIaQR58ymO09./gAS27eQz12Q3zja7ZxiSPwtAk7C',
    is_verified = true,
    is_active = true;

-- Create preferences for all test users
INSERT INTO auth.user_preferences (user_id, preferred_techniques, ui_theme)
SELECT id, 
       CASE 
           WHEN tier = 'enterprise' THEN ARRAY['chain_of_thought', 'few_shot', 'tree_of_thoughts', 'self_consistency']
           WHEN tier = 'pro' THEN ARRAY['chain_of_thought', 'few_shot', 'role_playing']
           ELSE ARRAY['chain_of_thought', 'few_shot']
       END,
       CASE 
           WHEN EXTRACT(EPOCH FROM created_at)::BIGINT % 3 = 0 THEN 'dark'
           WHEN EXTRACT(EPOCH FROM created_at)::BIGINT % 3 = 1 THEN 'light'
           ELSE 'system'
       END
FROM auth.users
WHERE email LIKE '%@example.com' OR email = 'admin@betterprompts.ai'
ON CONFLICT (user_id) DO UPDATE SET
    preferred_techniques = EXCLUDED.preferred_techniques,
    ui_theme = EXCLUDED.ui_theme;

-- Create some API keys for testing (removed tier column as it doesn't exist in api_keys table)
INSERT INTO auth.api_keys (user_id, key_hash, name, rate_limit, is_active)
SELECT 
    id,
    md5(random()::text || id::text)::varchar(64),
    'Test API Key ' || username,
    CASE 
        WHEN tier = 'enterprise' THEN 10000
        WHEN tier = 'pro' THEN 1000
        ELSE 100
    END,
    true
FROM auth.users
WHERE email IN ('admin@betterprompts.ai', 'user2@example.com', 'user5@example.com', 'user10@example.com')
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO betterprompts;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA metrics TO betterprompts;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA auth TO betterprompts;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA metrics TO betterprompts;