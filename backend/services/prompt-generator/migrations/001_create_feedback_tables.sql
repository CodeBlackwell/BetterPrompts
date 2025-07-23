-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS prompts;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create feedback table
CREATE TABLE IF NOT EXISTS prompts.prompt_feedback (
    id VARCHAR(255) PRIMARY KEY,
    prompt_history_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    
    -- Feedback data
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(50) NOT NULL DEFAULT 'rating',
    feedback_text TEXT,
    
    -- Technique-specific feedback
    technique_ratings JSONB,
    most_helpful_technique VARCHAR(100),
    least_helpful_technique VARCHAR(100),
    
    -- Additional metadata
    user_agent TEXT,
    ip_address VARCHAR(45),
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_prompt_feedback_prompt_history_id ON prompts.prompt_feedback(prompt_history_id);
CREATE INDEX idx_prompt_feedback_user_id ON prompts.prompt_feedback(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_prompt_feedback_created_at ON prompts.prompt_feedback(created_at);
CREATE INDEX idx_prompt_feedback_rating ON prompts.prompt_feedback(rating) WHERE rating IS NOT NULL;

-- Create technique effectiveness metrics table
CREATE TABLE IF NOT EXISTS analytics.technique_effectiveness_metrics (
    id VARCHAR(255) PRIMARY KEY,
    technique VARCHAR(100) NOT NULL,
    intent VARCHAR(100),
    complexity VARCHAR(50),
    
    -- Metrics
    total_uses INTEGER DEFAULT 0,
    total_feedback_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    average_token_increase DECIMAL(10,2),
    average_processing_time_ms DECIMAL(10,2),
    
    -- Effectiveness scores
    effectiveness_score DECIMAL(3,2),
    confidence_interval DECIMAL(3,2),
    
    -- Time-based data
    period_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    period_end TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create indexes for technique effectiveness
CREATE INDEX idx_technique_effectiveness_technique ON analytics.technique_effectiveness_metrics(technique);
CREATE INDEX idx_technique_effectiveness_intent ON analytics.technique_effectiveness_metrics(intent) WHERE intent IS NOT NULL;
CREATE INDEX idx_technique_effectiveness_complexity ON analytics.technique_effectiveness_metrics(complexity) WHERE complexity IS NOT NULL;
CREATE INDEX idx_technique_effectiveness_period ON analytics.technique_effectiveness_metrics(period_start, period_end);

-- Create composite index for common queries
CREATE INDEX idx_technique_effectiveness_composite ON analytics.technique_effectiveness_metrics(technique, intent, complexity);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prompt_feedback_updated_at BEFORE UPDATE ON prompts.prompt_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technique_effectiveness_updated_at BEFORE UPDATE ON analytics.technique_effectiveness_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint to link feedback with prompt history
-- Note: This assumes the prompts.history table exists
-- If it doesn't exist yet, this constraint can be added later
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'prompts' 
        AND table_name = 'history'
    ) THEN
        ALTER TABLE prompts.prompt_feedback
        ADD CONSTRAINT fk_prompt_feedback_history
        FOREIGN KEY (prompt_history_id)
        REFERENCES prompts.history(id)
        ON DELETE CASCADE;
    END IF;
END $$;