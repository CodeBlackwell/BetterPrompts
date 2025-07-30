# syntax=docker/dockerfile:1
# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies with cache mount
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies with cache mount
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --user -r requirements.txt

# Runtime stage
FROM python:3.11-slim

# Labels for better image management
LABEL maintainer="betterprompts-team"
LABEL version="1.0.0"
LABEL description="BetterPrompts Prompt Generator Service"

WORKDIR /app

# Install runtime dependencies with cache mount
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user first
RUN useradd -m -u 1000 appuser

# Copy Python dependencies from builder
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local

# Make sure scripts in .local are usable
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy application code with proper ownership
COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser configs/ ./configs/
COPY --chown=appuser:appuser scripts/ ./scripts/

# Create necessary directories and set permissions
RUN mkdir -p /app/models /app/logs && \
    chown -R appuser:appuser /app && \
    chmod +x scripts/*.sh

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8003/health/ready || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

# Run the application with optimized settings
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003", "--loop", "uvloop"]