#!/bin/bash
# TorchServe startup script for BetterPrompts

set -e

echo "Starting TorchServe for BetterPrompts..."

# Environment setup
export MODEL_STORE="${MODEL_STORE:-/home/model-server/model-store}"
export CONFIG_FILE="${CONFIG_FILE:-/home/model-server/config/config.properties}"
export LOG_CONFIG="${LOG_CONFIG:-/home/model-server/config/log4j2.xml}"

# Create necessary directories
mkdir -p /home/model-server/logs
mkdir -p "${MODEL_STORE}"

# Function to wait for model store
wait_for_models() {
    echo "Waiting for models in ${MODEL_STORE}..."
    timeout=300  # 5 minutes
    counter=0
    
    while [ $counter -lt $timeout ]; do
        if ls "${MODEL_STORE}"/*.mar 1> /dev/null 2>&1; then
            echo "Models found in model store"
            return 0
        fi
        
        echo "No models found yet. Waiting... ($counter/$timeout)"
        sleep 5
        counter=$((counter + 5))
    done
    
    echo "Warning: No models found after ${timeout} seconds. Starting anyway..."
    return 1
}

# Function to register models
register_models() {
    echo "Registering models..."
    
    # Wait for TorchServe to be ready
    sleep 10
    
    # Register all .mar files in model store
    for model in "${MODEL_STORE}"/*.mar; do
        if [ -f "$model" ]; then
            model_name=$(basename "$model" .mar)
            echo "Registering model: $model_name"
            
            curl -X POST "http://localhost:8081/models?url=file://${model}&initial_workers=1&synchronous=true" || {
                echo "Failed to register model: $model_name"
            }
        fi
    done
}

# Health check function
health_check() {
    echo "Performing health check..."
    
    # Check inference API
    if curl -f http://localhost:8080/ping 2>/dev/null; then
        echo "Inference API is healthy"
    else
        echo "Warning: Inference API health check failed"
    fi
    
    # Check management API
    if curl -f http://localhost:8081/models 2>/dev/null; then
        echo "Management API is healthy"
    else
        echo "Warning: Management API health check failed"
    fi
    
    # Check metrics API
    if curl -f http://localhost:8082/metrics 2>/dev/null; then
        echo "Metrics API is healthy"
    else
        echo "Warning: Metrics API health check failed"
    fi
}

# Main execution
echo "Configuration file: ${CONFIG_FILE}"
echo "Model store: ${MODEL_STORE}"
echo "Log configuration: ${LOG_CONFIG}"

# Check if we should wait for models
if [ "${WAIT_FOR_MODELS}" = "true" ]; then
    wait_for_models
fi

# Start TorchServe in the background
echo "Starting TorchServe..."
torchserve --start \
    --model-store "${MODEL_STORE}" \
    --ts-config "${CONFIG_FILE}" \
    --log-config "${LOG_CONFIG}" \
    --ncs &

TORCHSERVE_PID=$!

# Register models if AUTO_REGISTER is true
if [ "${AUTO_REGISTER}" = "true" ]; then
    register_models &
fi

# Wait a bit for startup
sleep 15

# Perform health check
health_check

# Keep the container running and forward signals
echo "TorchServe is running (PID: ${TORCHSERVE_PID})"
echo "Logs are available at: /home/model-server/logs/"

# Handle shutdown gracefully
trap 'echo "Stopping TorchServe..."; torchserve --stop; exit 0' SIGTERM SIGINT

# Wait for the TorchServe process
wait $TORCHSERVE_PID