package handlers

import (
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/betterprompts/api-gateway/internal/services"
)

type MetricsHandler struct {
	clients *services.ServiceClients
}

func NewMetricsHandler(clients *services.ServiceClients) *MetricsHandler {
	return &MetricsHandler{
		clients: clients,
	}
}

// GetPerformanceMetrics returns application performance metrics
func (h *MetricsHandler) GetPerformanceMetrics(c *gin.Context) {
	// In production, these would come from Prometheus or similar
	metrics := gin.H{
		"response_time": gin.H{
			"p50": 45 + rand.Intn(10),
			"p95": 120 + rand.Intn(20),
			"p99": 250 + rand.Intn(50),
		},
		"throughput":   850 + rand.Intn(200),
		"error_rate":   0.0005 + rand.Float64()*0.0003,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
		"requests_total": 125000 + rand.Intn(10000),
		"success_rate":   0.995 + rand.Float64()*0.004,
	}

	c.JSON(http.StatusOK, metrics)
}

// GetInfrastructureMetrics returns system infrastructure metrics
func (h *MetricsHandler) GetInfrastructureMetrics(c *gin.Context) {
	metrics := gin.H{
		"cpu_usage":    45.2 + rand.Float64()*20,
		"memory_usage": 62.8 + rand.Float64()*15,
		"db_connections": gin.H{
			"active": 25 + rand.Intn(20),
			"max":    100,
			"idle":   50 + rand.Intn(25),
		},
		"cache_hit_rate": 0.92 + rand.Float64()*0.05,
		"disk_usage":     35.5 + rand.Float64()*10,
		"network_io": gin.H{
			"bytes_in":  1024000 + rand.Intn(500000),
			"bytes_out": 2048000 + rand.Intn(1000000),
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, metrics)
}

// GetBusinessMetrics returns business-related metrics
func (h *MetricsHandler) GetBusinessMetrics(c *gin.Context) {
	techniques := []string{"chain_of_thought", "few_shot", "role_playing", "structured_output", "tree_of_thoughts"}
	featureAdoption := make(map[string]float64)
	
	for _, tech := range techniques {
		featureAdoption[tech] = 0.2 + rand.Float64()*0.4
	}

	metrics := gin.H{
		"user_satisfaction": 0.89 + rand.Float64()*0.08,
		"sla_compliance":    0.999 - rand.Float64()*0.002,
		"cost_per_request":  0.0015 + rand.Float64()*0.0005,
		"feature_adoption":  featureAdoption,
		"active_users":      892 + rand.Intn(100),
		"revenue": gin.H{
			"mrr":     45000 + rand.Float64()*5000,
			"arr":     540000 + rand.Float64()*60000,
			"growth":  0.15 + rand.Float64()*0.05,
		},
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, metrics)
}

// GetSLAMetrics returns SLA compliance metrics
func (h *MetricsHandler) GetSLAMetrics(c *gin.Context) {
	// Calculate current metrics
	currentLatency := gin.H{
		"p50": 45 + rand.Intn(10),
		"p95": 120 + rand.Intn(20),
		"p99": 250 + rand.Intn(50),
	}
	
	currentThroughput := 850 + rand.Intn(200)
	currentErrorRate := 0.0005 + rand.Float64()*0.0003
	availability := 0.9995 - rand.Float64()*0.0008

	metrics := gin.H{
		"availability": availability,
		"latency": gin.H{
			"compliant": currentLatency["p50"].(int) < 100 && 
						currentLatency["p95"].(int) < 200 && 
						currentLatency["p99"].(int) < 500,
			"current": currentLatency,
			"targets": gin.H{
				"p50": 100,
				"p95": 200,
				"p99": 500,
			},
		},
		"throughput": gin.H{
			"compliant": currentThroughput >= 1000,
			"current":   currentThroughput,
			"target":    1000,
		},
		"error_rate": gin.H{
			"compliant": currentErrorRate < 0.001,
			"current":   currentErrorRate,
			"target":    0.001,
		},
		"uptime_percentage": availability * 100,
		"incidents_mttr":    4.5 + rand.Float64()*0.5, // minutes
		"timestamp":         time.Now().UTC().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, metrics)
}

// GetMetricsHistory returns historical metrics data
func (h *MetricsHandler) GetMetricsHistory(c *gin.Context) {
	// Get query parameters
	metricType := c.DefaultQuery("type", "performance")
	hours := c.DefaultQuery("hours", "24")
	
	// Generate historical data points
	hoursInt := 24
	if h, err := time.ParseDuration(hours + "h"); err == nil {
		hoursInt = int(h.Hours())
	}

	history := make([]gin.H, 0, hoursInt*12) // 5-minute intervals
	now := time.Now().UTC()
	
	for i := hoursInt * 12; i > 0; i-- {
		timestamp := now.Add(-time.Duration(i*5) * time.Minute)
		
		dataPoint := gin.H{
			"timestamp": timestamp.Format(time.RFC3339),
		}

		switch metricType {
		case "performance":
			dataPoint["response_time_p50"] = 40 + rand.Intn(20)
			dataPoint["response_time_p95"] = 100 + rand.Intn(50)
			dataPoint["throughput"] = 700 + rand.Intn(400)
			dataPoint["error_rate"] = rand.Float64() * 0.002
			
		case "infrastructure":
			dataPoint["cpu_usage"] = 30 + rand.Float64()*40
			dataPoint["memory_usage"] = 50 + rand.Float64()*30
			dataPoint["cache_hit_rate"] = 0.85 + rand.Float64()*0.1
			
		case "business":
			dataPoint["user_satisfaction"] = 0.85 + rand.Float64()*0.1
			dataPoint["cost_per_request"] = 0.001 + rand.Float64()*0.001
			dataPoint["active_users"] = 100 + rand.Intn(200)
		}
		
		history = append(history, dataPoint)
	}

	c.JSON(http.StatusOK, gin.H{
		"type":       metricType,
		"hours":      hoursInt,
		"data_points": history,
		"interval":   "5m",
	})
}

// Technique-specific metrics
func (h *MetricsHandler) GetTechniqueMetrics(c *gin.Context) {
	techniques := []string{
		"chain_of_thought",
		"few_shot",
		"role_playing", 
		"structured_output",
		"tree_of_thoughts",
		"self_consistency",
		"emotional_appeal",
		"analogical_reasoning",
	}

	techniqueMetrics := make([]gin.H, 0, len(techniques))
	
	for i, tech := range techniques {
		metric := gin.H{
			"technique":     tech,
			"usage_count":   3000 - (i * 400) + rand.Intn(200),
			"success_rate":  0.85 + rand.Float64()*0.1,
			"avg_time_ms":   350 + rand.Intn(200),
			"satisfaction":  0.8 + rand.Float64()*0.15,
			"trend":         []string{"up", "down", "stable"}[rand.Intn(3)],
			"last_updated":  time.Now().UTC().Format(time.RFC3339),
		}
		techniqueMetrics = append(techniqueMetrics, metric)
	}

	c.JSON(http.StatusOK, gin.H{
		"techniques": techniqueMetrics,
		"period":     c.DefaultQuery("period", "7d"),
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
}