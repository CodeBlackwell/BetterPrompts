package websocket

import (
	"math/rand"
	"time"
)

// MetricsGenerator generates realistic metrics for broadcasting
type MetricsGenerator struct {
	baselineResponseTime float64
	baselineThroughput   int
	baselineErrorRate    float64
}

// NewMetricsGenerator creates a new metrics generator
func NewMetricsGenerator() *MetricsGenerator {
	return &MetricsGenerator{
		baselineResponseTime: 50.0,
		baselineThroughput:   850,
		baselineErrorRate:    0.0005,
	}
}

// GeneratePerformanceMetrics generates performance metrics
func (m *MetricsGenerator) GeneratePerformanceMetrics() map[string]interface{} {
	// Add some realistic variation
	variation := (rand.Float64() - 0.5) * 0.2
	
	return map[string]interface{}{
		"response_time": map[string]interface{}{
			"p50": m.baselineResponseTime * (1 + variation),
			"p95": m.baselineResponseTime * 2.5 * (1 + variation),
			"p99": m.baselineResponseTime * 5 * (1 + variation),
		},
		"throughput": int(float64(m.baselineThroughput) * (1 + variation)),
		"error_rate": m.baselineErrorRate * (1 + variation*2),
		"active_connections": 150 + rand.Intn(100),
		"requests_per_second": 14.2 + rand.Float64()*5,
	}
}

// GenerateUsageMetrics generates usage metrics
func (m *MetricsGenerator) GenerateUsageMetrics() map[string]interface{} {
	return map[string]interface{}{
		"active_users":     230 + rand.Intn(50),
		"total_requests":   125000 + rand.Intn(10000),
		"unique_users":     892 + rand.Intn(100),
		"api_calls":        45000 + rand.Intn(5000),
		"cache_hit_rate":   0.92 + rand.Float64()*0.05,
		"session_duration": 420 + rand.Intn(180), // seconds
	}
}

// GenerateTechniqueStats generates technique statistics
func (m *MetricsGenerator) GenerateTechniqueStats() map[string]interface{} {
	techniques := []string{
		"chain_of_thought",
		"few_shot",
		"role_playing",
		"structured_output",
		"tree_of_thoughts",
	}

	stats := make([]map[string]interface{}, 0, len(techniques))
	
	for i, tech := range techniques {
		stat := map[string]interface{}{
			"technique":      tech,
			"usage_count":    1000 - (i * 150) + rand.Intn(100),
			"success_rate":   0.85 + rand.Float64()*0.1,
			"avg_time_ms":    300 + rand.Intn(200),
			"error_count":    rand.Intn(10),
			"satisfaction":   0.8 + rand.Float64()*0.15,
		}
		stats = append(stats, stat)
	}

	return map[string]interface{}{
		"techniques":     stats,
		"total_usage":    5000 + rand.Intn(1000),
		"avg_success":    0.87 + rand.Float64()*0.05,
		"last_updated":   time.Now().UTC().Format(time.RFC3339),
	}
}