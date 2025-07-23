-- Migration: Create effectiveness tracking tables
-- Version: 001
-- Description: Creates tables for tracking prompt engineering technique effectiveness

-- Create analytics schema if not exists
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create technique effectiveness records table
CREATE TABLE IF NOT EXISTS analytics.technique_effectiveness_records (
    id VARCHAR(36) PRIMARY KEY,
    technique_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Application metrics
    application_time_ms FLOAT NOT NULL,
    tokens_before INTEGER NOT NULL,
    tokens_after INTEGER NOT NULL,
    token_increase_ratio FLOAT NOT NULL,
    
    -- Context information
    intent_type VARCHAR(100),
    complexity_level VARCHAR(50),
    domain VARCHAR(100),
    target_model VARCHAR(100),
    
    -- Performance metrics
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Additional metadata
    metadata JSONB,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for technique effectiveness records
CREATE INDEX idx_ter_technique_timestamp ON analytics.technique_effectiveness_records(technique_id, timestamp);
CREATE INDEX idx_ter_session_id ON analytics.technique_effectiveness_records(session_id);
CREATE INDEX idx_ter_user_id ON analytics.technique_effectiveness_records(user_id);
CREATE INDEX idx_ter_timestamp ON analytics.technique_effectiveness_records(timestamp);
CREATE INDEX idx_ter_intent_type ON analytics.technique_effectiveness_records(intent_type);
CREATE INDEX idx_ter_complexity_level ON analytics.technique_effectiveness_records(complexity_level);

-- Create user feedback table
CREATE TABLE IF NOT EXISTS analytics.user_feedback (
    id VARCHAR(36) PRIMARY KEY,
    effectiveness_record_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(100),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Feedback data
    rating FLOAT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(50) NOT NULL,
    helpful BOOLEAN,
    comments TEXT,
    
    -- Technique-specific ratings
    technique_ratings JSONB,
    most_helpful_technique VARCHAR(100),
    least_helpful_technique VARCHAR(100),
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_effectiveness_record
        FOREIGN KEY (effectiveness_record_id)
        REFERENCES analytics.technique_effectiveness_records(id)
        ON DELETE CASCADE
);

-- Create indexes for user feedback
CREATE INDEX idx_uf_effectiveness_record_id ON analytics.user_feedback(effectiveness_record_id);
CREATE INDEX idx_uf_timestamp ON analytics.user_feedback(timestamp);
CREATE INDEX idx_uf_user_id ON analytics.user_feedback(user_id);
CREATE INDEX idx_uf_rating ON analytics.user_feedback(rating);
CREATE INDEX idx_uf_feedback_type ON analytics.user_feedback(feedback_type);

-- Create aggregated metrics table
CREATE TABLE IF NOT EXISTS analytics.aggregated_metrics (
    id VARCHAR(36) PRIMARY KEY,
    technique_id VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    
    -- Aggregated values
    count INTEGER NOT NULL,
    avg_value FLOAT NOT NULL,
    min_value FLOAT NOT NULL,
    max_value FLOAT NOT NULL,
    std_dev FLOAT,
    percentile_25 FLOAT,
    percentile_50 FLOAT,
    percentile_75 FLOAT,
    
    -- Breakdown by context
    context_breakdown JSONB,
    
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicate aggregations
    UNIQUE(technique_id, metric_type, period_start, period_end)
);

-- Create indexes for aggregated metrics
CREATE INDEX idx_am_technique_period ON analytics.aggregated_metrics(technique_id, period_start, period_end);
CREATE INDEX idx_am_metric_type ON analytics.aggregated_metrics(metric_type);
CREATE INDEX idx_am_period ON analytics.aggregated_metrics(period_start, period_end);

-- Create materialized view for technique performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.technique_performance_summary AS
SELECT
    ter.technique_id,
    COUNT(*) as total_applications,
    AVG(CASE WHEN ter.success THEN 1 ELSE 0 END) as success_rate,
    AVG(ter.application_time_ms) as avg_application_time_ms,
    AVG(ter.token_increase_ratio) as avg_token_increase_ratio,
    MIN(ter.application_time_ms) as min_application_time_ms,
    MAX(ter.application_time_ms) as max_application_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ter.application_time_ms) as median_application_time_ms,
    COUNT(DISTINCT ter.user_id) as unique_users,
    COUNT(DISTINCT ter.session_id) as unique_sessions,
    COUNT(DISTINCT uf.id) as feedback_count,
    AVG(uf.rating) as avg_user_rating,
    MAX(ter.timestamp) as last_used,
    MIN(ter.timestamp) as first_used
FROM
    analytics.technique_effectiveness_records ter
LEFT JOIN
    analytics.user_feedback uf ON ter.id = uf.effectiveness_record_id
GROUP BY
    ter.technique_id;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_tps_technique_id ON analytics.technique_performance_summary(technique_id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION analytics.refresh_technique_performance_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.technique_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to track table modifications
CREATE TABLE IF NOT EXISTS analytics.effectiveness_tracking_metadata (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    last_aggregation TIMESTAMP,
    last_cleanup TIMESTAMP,
    records_processed BIGINT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial metadata
INSERT INTO analytics.effectiveness_tracking_metadata (table_name)
VALUES ('technique_effectiveness_records'), ('user_feedback'), ('aggregated_metrics')
ON CONFLICT DO NOTHING;

-- Create function to update metadata timestamp
CREATE OR REPLACE FUNCTION analytics.update_tracking_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for metadata updates
CREATE TRIGGER update_tracking_metadata_timestamp
BEFORE UPDATE ON analytics.effectiveness_tracking_metadata
FOR EACH ROW
EXECUTE FUNCTION analytics.update_tracking_metadata_timestamp();

-- Grant permissions (adjust based on your user roles)
GRANT USAGE ON SCHEMA analytics TO prompt_generator_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO prompt_generator_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO prompt_generator_user;