#!/bin/bash
# Script to monitor TorchServe models and metrics

set -e

# Configuration
TORCHSERVE_HOST="${TORCHSERVE_HOST:-localhost}"
INFERENCE_PORT="${INFERENCE_PORT:-8080}"
MANAGEMENT_PORT="${MANAGEMENT_PORT:-8081}"
METRICS_PORT="${METRICS_PORT:-8082}"
INTERVAL="${INTERVAL:-5}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_health() {
    local service=$1
    local port=$2
    local endpoint=$3
    
    if curl -f "http://${TORCHSERVE_HOST}:${port}${endpoint}" &>/dev/null; then
        echo -e "${GREEN}✓${NC} ${service} is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} ${service} is not responding"
        return 1
    fi
}

# Function to get model list
get_models() {
    echo -e "\n${YELLOW}Registered Models:${NC}"
    curl -s "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models" | python -m json.tool 2>/dev/null || echo "Failed to get models"
}

# Function to get model metrics
get_model_metrics() {
    local model=$1
    echo -e "\n${YELLOW}Metrics for ${model}:${NC}"
    
    # Get model-specific metrics
    metrics=$(curl -s "http://${TORCHSERVE_HOST}:${METRICS_PORT}/metrics" | grep -E "(${model}|ts_)")
    
    if [ -n "$metrics" ]; then
        echo "$metrics" | while IFS= read -r line; do
            if echo "$line" | grep -q "inference_requests_total"; then
                echo "  Requests: $(echo "$line" | awk '{print $2}')"
            elif echo "$line" | grep -q "ts_inference_latency_microseconds"; then
                echo "  Latency: $(echo "$line" | awk '{print $2}') μs"
            elif echo "$line" | grep -q "ts_queue_latency_microseconds"; then
                echo "  Queue Latency: $(echo "$line" | awk '{print $2}') μs"
            fi
        done
    else
        echo "  No metrics available"
    fi
}

# Function to get system metrics
get_system_metrics() {
    echo -e "\n${YELLOW}System Metrics:${NC}"
    
    # CPU and Memory from TorchServe metrics
    curl -s "http://${TORCHSERVE_HOST}:${METRICS_PORT}/metrics" | grep -E "(cpu_utilization|memory_)" | while IFS= read -r line; do
        metric_name=$(echo "$line" | cut -d' ' -f1)
        metric_value=$(echo "$line" | cut -d' ' -f2)
        
        case "$metric_name" in
            *cpu_utilization*)
                echo "  CPU Usage: ${metric_value}%"
                ;;
            *memory_used*)
                echo "  Memory Used: $(echo "scale=2; ${metric_value}/1024/1024/1024" | bc) GB"
                ;;
            *memory_available*)
                echo "  Memory Available: $(echo "scale=2; ${metric_value}/1024/1024/1024" | bc) GB"
                ;;
        esac
    done
    
    # GPU metrics if available
    if curl -s "http://${TORCHSERVE_HOST}:${METRICS_PORT}/metrics" | grep -q "gpu_"; then
        echo -e "\n  ${YELLOW}GPU Metrics:${NC}"
        curl -s "http://${TORCHSERVE_HOST}:${METRICS_PORT}/metrics" | grep "gpu_" | while IFS= read -r line; do
            metric_name=$(echo "$line" | cut -d' ' -f1)
            metric_value=$(echo "$line" | cut -d' ' -f2)
            echo "    ${metric_name}: ${metric_value}"
        done
    fi
}

# Function for continuous monitoring
monitor_loop() {
    while true; do
        clear
        echo "=== TorchServe Monitor ==="
        echo "Time: $(date)"
        echo "Host: ${TORCHSERVE_HOST}"
        echo ""
        
        # Check health of all services
        echo -e "${YELLOW}Service Health:${NC}"
        check_health "Inference API" "${INFERENCE_PORT}" "/ping"
        check_health "Management API" "${MANAGEMENT_PORT}" "/models"
        check_health "Metrics API" "${METRICS_PORT}" "/metrics"
        
        # Get registered models
        get_models
        
        # Get metrics for each model
        models=$(curl -s "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models" | python -c "import sys, json; data = json.load(sys.stdin); print(' '.join(data.get('models', [])))" 2>/dev/null)
        
        if [ -n "$models" ]; then
            for model in $models; do
                get_model_metrics "$model"
            done
        fi
        
        # Get system metrics
        get_system_metrics
        
        echo -e "\n${YELLOW}Refreshing in ${INTERVAL} seconds... (Press Ctrl+C to exit)${NC}"
        sleep "${INTERVAL}"
    done
}

# Parse command line arguments
case "${1:-monitor}" in
    "health")
        echo "Performing health check..."
        check_health "Inference API" "${INFERENCE_PORT}" "/ping"
        check_health "Management API" "${MANAGEMENT_PORT}" "/models"
        check_health "Metrics API" "${METRICS_PORT}" "/metrics"
        ;;
    "models")
        get_models
        ;;
    "metrics")
        get_system_metrics
        ;;
    "monitor")
        monitor_loop
        ;;
    *)
        echo "Usage: $0 [health|models|metrics|monitor]"
        echo "  health  - Check service health"
        echo "  models  - List registered models"
        echo "  metrics - Show system metrics"
        echo "  monitor - Continuous monitoring (default)"
        exit 1
        ;;
esac