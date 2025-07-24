# Prompt Generation Service - Python/FastAPI
# Build stage
FROM python:3.11-slim AS builder

# Build argument for PyTorch variant (cpu or gpu)
ARG PYTORCH_VARIANT=cpu

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy all requirements files
COPY backend/services/prompt-generator/requirements*.txt ./

# Install Python dependencies based on variant
RUN pip install --no-cache-dir --upgrade pip && \
    if [ "$PYTORCH_VARIANT" = "gpu" ]; then \
        echo "Installing GPU-enabled PyTorch..."; \
        pip install --no-cache-dir -r requirements-gpu.txt; \
    else \
        echo "Installing CPU-only PyTorch..."; \
        pip install --no-cache-dir -r requirements-cpu.txt; \
    fi

# Production stage
FROM python:3.11-slim AS runner

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 -s /bin/bash appuser

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser backend/services/prompt-generator/ .

# Create directories for templates and cache
RUN mkdir -p /app/templates /app/cache && \
    chown -R appuser:appuser /app/templates /app/cache

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TEMPLATE_PATH=/app/templates \
    CACHE_PATH=/app/cache

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

# Start the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "2"]