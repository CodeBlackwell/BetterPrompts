#!/bin/bash
# Script to deploy models to TorchServe

set -e

# Configuration
TORCHSERVE_HOST="${TORCHSERVE_HOST:-localhost}"
MANAGEMENT_PORT="${MANAGEMENT_PORT:-8081}"
MODEL_STORE="${MODEL_STORE:-./model-store}"
MODEL_NAME="${1:-intent_classifier}"
MODEL_VERSION="${2:-1.0}"
WORKERS="${3:-2}"

echo "Deploying ${MODEL_NAME} v${MODEL_VERSION} to TorchServe at ${TORCHSERVE_HOST}:${MANAGEMENT_PORT}"

# Function to check if TorchServe is running
check_torchserve() {
    if curl -f "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models" &>/dev/null; then
        echo "TorchServe is running"
        return 0
    else
        echo "TorchServe is not accessible at ${TORCHSERVE_HOST}:${MANAGEMENT_PORT}"
        return 1
    fi
}

# Function to unregister existing model
unregister_model() {
    local model=$1
    echo "Checking if ${model} is already registered..."
    
    if curl -s "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models/${model}" | grep -q "Model not found"; then
        echo "Model ${model} is not registered"
    else
        echo "Unregistering existing model: ${model}"
        curl -X DELETE "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models/${model}/${MODEL_VERSION}"
        sleep 5
    fi
}

# Function to register model
register_model() {
    local model=$1
    local mar_file="${MODEL_STORE}/${model}.mar"
    
    if [ ! -f "${mar_file}" ]; then
        echo "Error: MAR file not found: ${mar_file}"
        return 1
    fi
    
    echo "Registering model: ${model}"
    
    # Register the model
    response=$(curl -s -X POST \
        "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models?url=file://${mar_file}&initial_workers=${WORKERS}&synchronous=true")
    
    if echo "$response" | grep -q "Model .* registered"; then
        echo "Model registered successfully"
        return 0
    else
        echo "Failed to register model. Response: $response"
        return 1
    fi
}

# Function to scale workers
scale_workers() {
    local model=$1
    local workers=$2
    
    echo "Scaling ${model} to ${workers} workers..."
    
    curl -X PUT \
        "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models/${model}?min_worker=${workers}&max_worker=$((workers * 2))"
}

# Function to get model status
get_model_status() {
    local model=$1
    
    echo "Getting status for ${model}..."
    curl -s "http://${TORCHSERVE_HOST}:${MANAGEMENT_PORT}/models/${model}" | python -m json.tool
}

# Main deployment flow
echo "Starting model deployment..."

# Check if TorchServe is running
if ! check_torchserve; then
    echo "Please ensure TorchServe is running and accessible"
    exit 1
fi

# Unregister existing model
unregister_model "${MODEL_NAME}"

# Register new model
if register_model "${MODEL_NAME}"; then
    echo "Model deployment successful!"
    
    # Scale workers if needed
    if [ "${WORKERS}" -gt 1 ]; then
        sleep 5
        scale_workers "${MODEL_NAME}" "${WORKERS}"
    fi
    
    # Get final status
    sleep 5
    get_model_status "${MODEL_NAME}"
    
    # Test the model
    echo -e "\nTesting the deployed model..."
    curl -X POST "http://${TORCHSERVE_HOST}:8080/predictions/${MODEL_NAME}" \
        -H "Content-Type: application/json" \
        -d '{"text": "How can I improve my code performance?"}' | python -m json.tool
    
else
    echo "Model deployment failed!"
    exit 1
fi

echo -e "\nDeployment complete!"