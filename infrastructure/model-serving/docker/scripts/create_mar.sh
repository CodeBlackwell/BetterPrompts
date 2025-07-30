#!/bin/bash
# Script to create MAR (Model Archive) files for TorchServe

set -e

# Default values
MODEL_NAME="${1:-intent_classifier}"
MODEL_VERSION="${2:-1.0}"
MODEL_PATH="${3:-./model}"
HANDLER="${4:-intent_classifier_handler.py}"
EXTRA_FILES="${5:-}"

echo "Creating MAR file for ${MODEL_NAME} v${MODEL_VERSION}"

# Check if torch-model-archiver is installed
if ! command -v torch-model-archiver &> /dev/null; then
    echo "Installing torch-model-archiver..."
    pip install torch-model-archiver torch-workflow-archiver
fi

# Create MAR file
torch-model-archiver \
    --model-name "${MODEL_NAME}" \
    --version "${MODEL_VERSION}" \
    --serialized-file "${MODEL_PATH}/pytorch_model.bin" \
    --handler "${HANDLER}" \
    --extra-files "${MODEL_PATH}/config.json,${MODEL_PATH}/tokenizer_config.json,${MODEL_PATH}/tokenizer.json,${MODEL_PATH}/special_tokens_map.json,${MODEL_PATH}/intent_labels.json${EXTRA_FILES:+,$EXTRA_FILES}" \
    --export-path "./model-store" \
    --force

echo "MAR file created: ./model-store/${MODEL_NAME}.mar"

# Verify MAR file
if [ -f "./model-store/${MODEL_NAME}.mar" ]; then
    echo "MAR file size: $(du -h ./model-store/${MODEL_NAME}.mar | cut -f1)"
    echo "MAR file created successfully!"
else
    echo "Error: MAR file creation failed"
    exit 1
fi