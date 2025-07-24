-- Rollback performance optimization indexes

-- Drop indexes from prompts table
DROP INDEX IF EXISTS idx_prompts_intent;
DROP INDEX IF EXISTS idx_prompts_complexity;
DROP INDEX IF EXISTS idx_prompts_user_task;
DROP INDEX IF EXISTS idx_prompts_techniques;
DROP INDEX IF EXISTS idx_prompts_user_created_rating;
DROP INDEX IF EXISTS idx_prompts_metadata_gin;

-- Drop indexes from api_usage table
DROP INDEX IF EXISTS idx_api_usage_status_code;
DROP INDEX IF EXISTS idx_api_usage_response_time;
DROP INDEX IF EXISTS idx_api_usage_endpoint_created;
DROP INDEX IF EXISTS idx_api_usage_user_endpoint_date;

-- Drop indexes from users table
DROP INDEX IF EXISTS idx_users_tier;
DROP INDEX IF EXISTS idx_users_is_active;
DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_users_last_login;
DROP INDEX IF EXISTS idx_users_preferences_gin;
DROP INDEX IF EXISTS idx_users_metadata_gin;

-- Drop indexes from sessions table
DROP INDEX IF EXISTS idx_sessions_user_expires;