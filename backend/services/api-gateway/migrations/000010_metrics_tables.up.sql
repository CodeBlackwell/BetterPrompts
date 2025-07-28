-- Create schema for metrics if it doesn't exist
CREATE SCHEMA IF NOT EXISTS metrics;

-- Performance metrics table
CREATE TABLE IF NOT EXISTS metrics.performance_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    response_time_p50 DECIMAL(10,2) NOT NULL,
    response_time_p95 DECIMAL(10,2) NOT NULL,
    response_time_p99 DECIMAL(10,2) NOT NULL,
    throughput INTEGER NOT NULL,
    error_rate DECIMAL(8,6) NOT NULL,
    requests_total BIGINT NOT NULL,
    success_rate DECIMAL(5,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Infrastructure metrics table
CREATE TABLE IF NOT EXISTS metrics.infrastructure_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    cpu_usage DECIMAL(5,2) NOT NULL,
    memory_usage DECIMAL(5,2) NOT NULL,
    db_connections_active INTEGER NOT NULL,
    db_connections_max INTEGER NOT NULL,
    db_connections_idle INTEGER NOT NULL,
    cache_hit_rate DECIMAL(5,4) NOT NULL,
    disk_usage DECIMAL(5,2) NOT NULL,
    network_bytes_in BIGINT NOT NULL,
    network_bytes_out BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business metrics table
CREATE TABLE IF NOT EXISTS metrics.business_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_satisfaction DECIMAL(5,4) NOT NULL,
    sla_compliance DECIMAL(5,4) NOT NULL,
    cost_per_request DECIMAL(10,6) NOT NULL,
    active_users INTEGER NOT NULL,
    mrr DECIMAL(15,2) NOT NULL,
    arr DECIMAL(15,2) NOT NULL,
    growth_rate DECIMAL(5,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SLA compliance table
CREATE TABLE IF NOT EXISTS metrics.sla_compliance (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    availability DECIMAL(7,6) NOT NULL,
    latency_p50_compliant BOOLEAN NOT NULL,
    latency_p95_compliant BOOLEAN NOT NULL,
    latency_p99_compliant BOOLEAN NOT NULL,
    throughput_compliant BOOLEAN NOT NULL,
    error_rate_compliant BOOLEAN NOT NULL,
    uptime_percentage DECIMAL(6,3) NOT NULL,
    incidents_mttr DECIMAL(6,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Technique metrics table
CREATE TABLE IF NOT EXISTS metrics.technique_metrics (
    id SERIAL PRIMARY KEY,
    technique_name VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    usage_count INTEGER NOT NULL,
    success_rate DECIMAL(5,4) NOT NULL,
    avg_time_ms INTEGER NOT NULL,
    error_count INTEGER NOT NULL DEFAULT 0,
    satisfaction_score DECIMAL(5,4) NOT NULL,
    trend VARCHAR(10) CHECK (trend IN ('up', 'down', 'stable')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient time-based queries
CREATE INDEX idx_performance_metrics_timestamp ON metrics.performance_metrics(timestamp DESC);
CREATE INDEX idx_infrastructure_metrics_timestamp ON metrics.infrastructure_metrics(timestamp DESC);
CREATE INDEX idx_business_metrics_timestamp ON metrics.business_metrics(timestamp DESC);
CREATE INDEX idx_sla_compliance_timestamp ON metrics.sla_compliance(timestamp DESC);
CREATE INDEX idx_technique_metrics_timestamp_technique ON metrics.technique_metrics(timestamp DESC, technique_name);

-- Create a composite index for date range queries
CREATE INDEX idx_performance_metrics_date_range ON metrics.performance_metrics(timestamp, response_time_p50, throughput);
CREATE INDEX idx_sla_compliance_date_range ON metrics.sla_compliance(timestamp, availability, uptime_percentage);

-- Create a function to clean up old metrics (older than 90 days)
CREATE OR REPLACE FUNCTION metrics.cleanup_old_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM metrics.performance_metrics WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM metrics.infrastructure_metrics WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM metrics.business_metrics WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM metrics.sla_compliance WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM metrics.technique_metrics WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE metrics.performance_metrics IS 'Application performance metrics including response times and throughput';
COMMENT ON TABLE metrics.infrastructure_metrics IS 'System infrastructure metrics including CPU, memory, and network usage';
COMMENT ON TABLE metrics.business_metrics IS 'Business KPIs including user satisfaction and revenue metrics';
COMMENT ON TABLE metrics.sla_compliance IS 'SLA compliance tracking and uptime metrics';
COMMENT ON TABLE metrics.technique_metrics IS 'Per-technique usage and effectiveness metrics';