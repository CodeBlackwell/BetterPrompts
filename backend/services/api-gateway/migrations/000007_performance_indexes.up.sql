-- Performance optimization indexes for api-gateway database
-- This migration adds missing indexes identified during performance analysis

-- Indexes for prompts table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_intent ON prompts(intent);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_complexity ON prompts(complexity);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_user_task ON prompts(user_id, task_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_techniques ON prompts USING GIN(techniques);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_user_created_rating ON prompts(user_id, created_at DESC, rating);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompts_metadata_gin ON prompts USING GIN(metadata);

-- Indexes for api_usage table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_status_code ON api_usage(status_code);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_response_time ON api_usage(response_time_ms);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_endpoint_created ON api_usage(endpoint, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_user_endpoint_date ON api_usage(user_id, endpoint, created_at DESC);

-- Indexes for users table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preferences_gin ON users USING GIN(preferences);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_metadata_gin ON users USING GIN(metadata);

-- Indexes for sessions table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);

-- Add comment explaining the indexes
COMMENT ON INDEX idx_prompts_intent IS 'Optimize queries filtering by intent type';
COMMENT ON INDEX idx_prompts_complexity IS 'Optimize queries filtering by complexity level';
COMMENT ON INDEX idx_prompts_user_task IS 'Optimize user-specific task queries';
COMMENT ON INDEX idx_prompts_techniques IS 'Optimize JSONB queries on techniques array';
COMMENT ON INDEX idx_prompts_user_created_rating IS 'Optimize prompt history queries with sorting';
COMMENT ON INDEX idx_api_usage_status_code IS 'Optimize error rate monitoring queries';
COMMENT ON INDEX idx_api_usage_response_time IS 'Optimize performance monitoring queries';
COMMENT ON INDEX idx_api_usage_endpoint_created IS 'Optimize endpoint analytics queries';
COMMENT ON INDEX idx_api_usage_user_endpoint_date IS 'Optimize user activity tracking';
COMMENT ON INDEX idx_users_tier IS 'Optimize user segmentation queries';
COMMENT ON INDEX idx_users_is_active IS 'Optimize active user queries';
COMMENT ON INDEX idx_users_last_login IS 'Optimize user engagement queries';
COMMENT ON INDEX idx_sessions_user_expires IS 'Optimize session cleanup queries';