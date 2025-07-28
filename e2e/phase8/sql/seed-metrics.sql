-- Seed historical metrics data for the last 24 hours
-- This provides realistic data for testing the performance dashboard

-- Generate performance metrics (5-minute intervals for 24 hours = 288 data points)
INSERT INTO metrics.performance_metrics (
    timestamp, 
    response_time_p50, 
    response_time_p95, 
    response_time_p99,
    throughput, 
    error_rate, 
    requests_total, 
    success_rate
)
SELECT 
    NOW() - (interval '5 minutes' * s.i),
    -- Add realistic variation based on time of day
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 8 AND 17 THEN
            40 + (RANDOM() * 20) -- Business hours: 40-60ms
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 18 AND 22 THEN
            50 + (RANDOM() * 30) -- Evening peak: 50-80ms
        ELSE
            30 + (RANDOM() * 15) -- Night hours: 30-45ms
    END,
    -- p95 is typically 2-3x p50
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 8 AND 17 THEN
            100 + (RANDOM() * 50)
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 18 AND 22 THEN
            120 + (RANDOM() * 80)
        ELSE
            80 + (RANDOM() * 40)
    END,
    -- p99 is typically 4-5x p50
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 8 AND 17 THEN
            200 + (RANDOM() * 100)
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 18 AND 22 THEN
            250 + (RANDOM() * 150)
        ELSE
            150 + (RANDOM() * 80)
    END,
    -- Throughput varies by time
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 8 AND 17 THEN
            800 + FLOOR(RANDOM() * 400)::INTEGER
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 18 AND 22 THEN
            600 + FLOOR(RANDOM() * 300)::INTEGER
        ELSE
            200 + FLOOR(RANDOM() * 200)::INTEGER
    END,
    -- Error rate (target < 0.1%)
    0.0001 + (RANDOM() * 0.0008),
    -- Total requests accumulator
    100000 + (s.i * 1000) + FLOOR(RANDOM() * 500)::BIGINT,
    -- Success rate (inverse of error rate)
    0.999 - (RANDOM() * 0.001)
FROM generate_series(0, 287) AS s(i);

-- Generate infrastructure metrics
INSERT INTO metrics.infrastructure_metrics (
    timestamp,
    cpu_usage,
    memory_usage,
    db_connections_active,
    db_connections_max,
    db_connections_idle,
    cache_hit_rate,
    disk_usage,
    network_bytes_in,
    network_bytes_out
)
SELECT 
    NOW() - (interval '5 minutes' * s.i),
    -- CPU usage varies with load
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 8 AND 17 THEN
            45 + (RANDOM() * 25)
        ELSE
            20 + (RANDOM() * 20)
    END,
    -- Memory usage
    55 + (RANDOM() * 20),
    -- Active DB connections
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 8 AND 17 THEN
            20 + FLOOR(RANDOM() * 30)::INTEGER
        ELSE
            5 + FLOOR(RANDOM() * 15)::INTEGER
    END,
    100, -- Max connections
    -- Idle connections
    CASE 
        WHEN EXTRACT(HOUR FROM NOW() - (interval '5 minutes' * s.i)) BETWEEN 8 AND 17 THEN
            30 + FLOOR(RANDOM() * 20)::INTEGER
        ELSE
            60 + FLOOR(RANDOM() * 20)::INTEGER
    END,
    -- Cache hit rate (should be high)
    0.88 + (RANDOM() * 0.08),
    -- Disk usage (slowly increasing)
    30 + (s.i * 0.01) + (RANDOM() * 5),
    -- Network I/O
    1000000 + FLOOR(RANDOM() * 500000)::BIGINT,
    2000000 + FLOOR(RANDOM() * 1000000)::BIGINT
FROM generate_series(0, 287) AS s(i);

-- Generate business metrics (hourly for 24 hours)
INSERT INTO metrics.business_metrics (
    timestamp,
    user_satisfaction,
    sla_compliance,
    cost_per_request,
    active_users,
    mrr,
    arr,
    growth_rate
)
SELECT 
    NOW() - (interval '1 hour' * s.i),
    -- User satisfaction (target > 85%)
    0.85 + (RANDOM() * 0.1),
    -- SLA compliance (target > 99.9%)
    0.998 + (RANDOM() * 0.0015),
    -- Cost per request
    0.0012 + (RANDOM() * 0.0006),
    -- Active users
    800 + FLOOR(RANDOM() * 200)::INTEGER,
    -- MRR
    42000 + (RANDOM() * 6000),
    -- ARR
    504000 + (RANDOM() * 72000),
    -- Growth rate
    0.12 + (RANDOM() * 0.06)
FROM generate_series(0, 23) AS s(i);

-- Generate SLA compliance metrics (every 15 minutes)
INSERT INTO metrics.sla_compliance (
    timestamp,
    availability,
    latency_p50_compliant,
    latency_p95_compliant,
    latency_p99_compliant,
    throughput_compliant,
    error_rate_compliant,
    uptime_percentage,
    incidents_mttr
)
SELECT 
    NOW() - (interval '15 minutes' * s.i),
    -- Availability (target 99.9%)
    0.9985 + (RANDOM() * 0.0012),
    -- Latency compliance
    RANDOM() > 0.05, -- 95% compliant
    RANDOM() > 0.08, -- 92% compliant
    RANDOM() > 0.10, -- 90% compliant
    -- Throughput compliance
    RANDOM() > 0.05, -- 95% compliant
    -- Error rate compliance
    RANDOM() > 0.03, -- 97% compliant
    -- Uptime percentage
    99.85 + (RANDOM() * 0.12),
    -- MTTR in minutes
    3.5 + (RANDOM() * 1.5)
FROM generate_series(0, 95) AS s(i);

-- Generate technique metrics
INSERT INTO metrics.technique_metrics (
    technique_name,
    timestamp,
    usage_count,
    success_rate,
    avg_time_ms,
    error_count,
    satisfaction_score,
    trend
)
SELECT 
    t.technique,
    NOW() - (interval '1 hour' * s.i),
    -- Usage count varies by technique popularity
    CASE t.technique
        WHEN 'chain_of_thought' THEN 300 + FLOOR(RANDOM() * 100)::INTEGER
        WHEN 'few_shot' THEN 250 + FLOOR(RANDOM() * 80)::INTEGER
        WHEN 'role_playing' THEN 200 + FLOOR(RANDOM() * 60)::INTEGER
        WHEN 'structured_output' THEN 180 + FLOOR(RANDOM() * 50)::INTEGER
        WHEN 'tree_of_thoughts' THEN 150 + FLOOR(RANDOM() * 40)::INTEGER
        WHEN 'self_consistency' THEN 120 + FLOOR(RANDOM() * 30)::INTEGER
        WHEN 'emotional_appeal' THEN 80 + FLOOR(RANDOM() * 20)::INTEGER
        ELSE 60 + FLOOR(RANDOM() * 20)::INTEGER
    END,
    -- Success rate
    0.82 + (RANDOM() * 0.12),
    -- Average time
    300 + FLOOR(RANDOM() * 200)::INTEGER,
    -- Error count
    FLOOR(RANDOM() * 5)::INTEGER,
    -- Satisfaction score
    0.78 + (RANDOM() * 0.17),
    -- Trend
    CASE 
        WHEN RANDOM() < 0.4 THEN 'up'
        WHEN RANDOM() < 0.7 THEN 'stable'
        ELSE 'down'
    END
FROM (VALUES 
    ('chain_of_thought'),
    ('few_shot'),
    ('role_playing'),
    ('structured_output'),
    ('tree_of_thoughts'),
    ('self_consistency'),
    ('emotional_appeal'),
    ('analogical_reasoning')
) AS t(technique)
CROSS JOIN generate_series(0, 23) AS s(i);

-- Create some prompt history entries for the test users
INSERT INTO public.prompt_histories (
    user_id,
    original_prompt,
    enhanced_prompt,
    selected_techniques,
    confidence_score,
    created_at
)
SELECT 
    u.id,
    'Test prompt ' || s.i || ' from ' || u.username,
    'Enhanced: Test prompt ' || s.i || ' from ' || u.username || ' using advanced techniques',
    ARRAY['chain_of_thought', 'few_shot'],
    0.75 + (RANDOM() * 0.2),
    NOW() - (interval '1 hour' * s.i)
FROM auth.users u
CROSS JOIN generate_series(0, 23) AS s(i)
WHERE u.email LIKE '%@example.com'
LIMIT 100;