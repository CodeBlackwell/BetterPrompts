# syntax=docker/dockerfile:1
# Multi-stage build for optimized ML image
FROM python:3.11-slim as builder

# Install build dependencies with cache mount
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with cache mounts
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install wheel for faster builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel setuptools

# Install ML dependencies with cache mounts
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=/tmp/requirements.txt \
    pip install torch==2.1.1 --index-url https://download.pytorch.org/whl/cpu && \
    pip install transformers==4.36.0 && \
    pip install -r /tmp/requirements.txt

# Production stage
FROM python:3.11-slim

# Labels for better image management
LABEL maintainer="betterprompts-team"
LABEL version="1.0.0"
LABEL description="BetterPrompts Intent Classifier Service"

# Install runtime dependencies with cache mount
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app:$PYTHONPATH"
ENV PYTHONUNBUFFERED=1
ENV TRANSFORMERS_CACHE="/app/.cache/huggingface"

# Set working directory
WORKDIR /app

# Copy application code first
COPY --chown=1000:1000 . .

# Create cache directory and non-root user in single layer
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/.cache/huggingface && \
    chown -R appuser:appuser /app /app/.cache

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the application with optimized settings
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--loop", "uvloop"]