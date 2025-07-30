# syntax=docker/dockerfile:1
# Build stage
FROM golang:1.23-alpine AS builder

# Install dependencies
RUN apk add --no-cache git gcc musl-dev

# Set working directory
WORKDIR /app

# Configure Go proxy and increase timeout
ENV GOPROXY=https://proxy.golang.org,direct
ENV GOSUMDB=sum.golang.org
ENV GOTIMEOUT=120

# Copy go mod files first for better caching
COPY go.mod go.sum ./

# Download dependencies with cache mount
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# Copy source code
COPY . .

# Build with cache mounts for faster rebuilds
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -ldflags='-w -s' -a -o api-gateway ./cmd/server

# Final stage - use distroless for smaller size and better security
FROM gcr.io/distroless/static-debian12:nonroot

# Labels for better image management
LABEL maintainer="betterprompts-team"
LABEL version="1.0.0"
LABEL description="BetterPrompts API Gateway Service"

WORKDIR /app

# Copy binary from builder with specific permissions
COPY --from=builder --chown=65532:65532 /app/api-gateway /app/api-gateway

# Use numeric UID for distroless
USER 65532

# Expose port
EXPOSE 8090

# Note: Health checks should be implemented at orchestration level for distroless images

# Run the application
ENTRYPOINT ["/app/api-gateway"]