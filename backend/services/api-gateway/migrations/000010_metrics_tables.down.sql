-- Drop all metrics tables and schema
DROP TABLE IF EXISTS metrics.technique_metrics CASCADE;
DROP TABLE IF EXISTS metrics.sla_compliance CASCADE;
DROP TABLE IF EXISTS metrics.business_metrics CASCADE;
DROP TABLE IF EXISTS metrics.infrastructure_metrics CASCADE;
DROP TABLE IF EXISTS metrics.performance_metrics CASCADE;

-- Drop the cleanup function
DROP FUNCTION IF EXISTS metrics.cleanup_old_metrics();

-- Drop the metrics schema
DROP SCHEMA IF EXISTS metrics CASCADE;