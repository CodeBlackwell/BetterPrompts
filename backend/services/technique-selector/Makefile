# Makefile for Technique Selector Service

.PHONY: all build test clean run dev lint fmt vet test-coverage test-integration test-unit test-bench help

# Variables
BINARY_NAME=technique-selector
BINARY_PATH=bin/$(BINARY_NAME)
GO_FILES=$(shell find . -name '*.go' -type f)
COVERAGE_OUT=coverage.out
COVERAGE_HTML=coverage.html

# Build flags
LDFLAGS=-ldflags "-s -w"
BUILD_FLAGS=-trimpath

# Go commands
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOFMT=gofmt
GOVET=$(GOCMD) vet
GOLINT=golangci-lint

# Colors
GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m # No Color

# Default target
all: clean lint test build

# Help target
help:
	@echo "Technique Selector Service Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  all             Clean, lint, test, and build"
	@echo "  build           Build the binary"
	@echo "  test            Run all tests"
	@echo "  test-unit       Run unit tests only"
	@echo "  test-integration Run integration tests only"
	@echo "  test-coverage   Run tests with coverage"
	@echo "  test-bench      Run benchmarks"
	@echo "  lint            Run linters"
	@echo "  fmt             Format code"
	@echo "  vet             Run go vet"
	@echo "  run             Build and run the service"
	@echo "  dev             Run with hot reload (requires air)"
	@echo "  clean           Clean build artifacts"
	@echo "  deps            Download dependencies"
	@echo "  tidy            Tidy go.mod"

# Build the binary
build:
	@echo "$(GREEN)Building $(BINARY_NAME)...$(NC)"
	@mkdir -p bin
	$(GOBUILD) $(BUILD_FLAGS) $(LDFLAGS) -o $(BINARY_PATH) ./cmd/server

# Run tests
test:
	@echo "$(GREEN)Running tests...$(NC)"
	$(GOTEST) -v -race ./...

# Run unit tests only
test-unit:
	@echo "$(GREEN)Running unit tests...$(NC)"
	$(GOTEST) -v -race -short ./...

# Run integration tests only
test-integration:
	@echo "$(GREEN)Running integration tests...$(NC)"
	$(GOTEST) -v -race -run Integration ./...

# Run tests with coverage
test-coverage:
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	$(GOTEST) -v -race -coverprofile=$(COVERAGE_OUT) -covermode=atomic ./...
	@echo "$(YELLOW)Generating coverage report...$(NC)"
	$(GOCMD) tool cover -func=$(COVERAGE_OUT)
	$(GOCMD) tool cover -html=$(COVERAGE_OUT) -o $(COVERAGE_HTML)
	@echo "$(GREEN)Coverage report generated: $(COVERAGE_HTML)$(NC)"

# Run benchmarks
test-bench:
	@echo "$(GREEN)Running benchmarks...$(NC)"
	$(GOTEST) -bench=. -benchmem ./...

# Run linters
lint:
	@echo "$(GREEN)Running linters...$(NC)"
	@if command -v golangci-lint >/dev/null 2>&1; then \
		$(GOLINT) run ./...; \
	else \
		echo "$(YELLOW)golangci-lint not installed, using go vet only$(NC)"; \
		$(GOVET) ./...; \
	fi

# Format code
fmt:
	@echo "$(GREEN)Formatting code...$(NC)"
	$(GOFMT) -s -w $(GO_FILES)

# Run go vet
vet:
	@echo "$(GREEN)Running go vet...$(NC)"
	$(GOVET) ./...

# Build and run
run: build
	@echo "$(GREEN)Running $(BINARY_NAME)...$(NC)"
	./$(BINARY_PATH)

# Development mode with hot reload
dev:
	@if command -v air >/dev/null 2>&1; then \
		echo "$(GREEN)Starting development server with hot reload...$(NC)"; \
		air; \
	else \
		echo "$(RED)Air not installed. Install with: go install github.com/cosmtrek/air@latest$(NC)"; \
		exit 1; \
	fi

# Clean build artifacts
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	$(GOCLEAN)
	@rm -rf bin/
	@rm -f $(COVERAGE_OUT) $(COVERAGE_HTML)

# Download dependencies
deps:
	@echo "$(GREEN)Downloading dependencies...$(NC)"
	$(GOGET) -v ./...

# Tidy go.mod
tidy:
	@echo "$(GREEN)Tidying go.mod...$(NC)"
	$(GOMOD) tidy

# CI-specific targets
ci-test:
	@echo "$(GREEN)Running CI tests...$(NC)"
	$(GOTEST) -v -race -coverprofile=$(COVERAGE_OUT) -covermode=atomic ./...

ci-lint:
	@echo "$(GREEN)Running CI linters...$(NC)"
	@if command -v golangci-lint >/dev/null 2>&1; then \
		$(GOLINT) run --timeout=5m ./...; \
	else \
		$(GOVET) ./...; \
	fi

# Docker targets
docker-build:
	@echo "$(GREEN)Building Docker image...$(NC)"
	docker build -t $(BINARY_NAME):latest .

docker-run:
	@echo "$(GREEN)Running Docker container...$(NC)"
	docker run --rm -p 8082:8082 $(BINARY_NAME):latest