# API Gateway Makefile

# Variables
BINARY_NAME=api-gateway
MAIN_PATH=cmd/server/main.go
TEST_TIMEOUT=30s
COVERAGE_FILE=coverage.out
COVERAGE_HTML=coverage.html

# Go commands
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOFMT=$(GOCMD) fmt
GOVET=$(GOCMD) vet
GOLINT=golangci-lint

# Build flags
LDFLAGS=-ldflags "-w -s"

# Colors for output
GREEN=\033[0;32m
RED=\033[0;31m
BLUE=\033[0;34m
NC=\033[0m # No Color

.PHONY: all build clean test test-verbose test-coverage test-unit test-integration fmt vet lint run deps help

# Default target
all: test build

# Build the binary
build:
	@echo "$(BLUE)Building $(BINARY_NAME)...$(NC)"
	@$(GOBUILD) $(LDFLAGS) -o $(BINARY_NAME) -v $(MAIN_PATH)
	@echo "$(GREEN)Build complete!$(NC)"

# Clean build artifacts
clean:
	@echo "$(BLUE)Cleaning...$(NC)"
	@$(GOCLEAN)
	@rm -f $(BINARY_NAME)
	@rm -f $(COVERAGE_FILE)
	@rm -f $(COVERAGE_HTML)
	@echo "$(GREEN)Clean complete!$(NC)"

# Run all tests
test:
	@echo "$(BLUE)Running tests...$(NC)"
	@$(GOTEST) -v -race -timeout $(TEST_TIMEOUT) ./...
	@echo "$(GREEN)Tests complete!$(NC)"

# Run tests with verbose output
test-verbose:
	@echo "$(BLUE)Running tests with verbose output...$(NC)"
	@$(GOTEST) -v -race -timeout $(TEST_TIMEOUT) ./... -args -test.v

# Run tests with coverage
test-coverage:
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@$(GOTEST) -v -race -coverprofile=$(COVERAGE_FILE) -covermode=atomic -timeout $(TEST_TIMEOUT) ./...
	@$(GOCMD) tool cover -html=$(COVERAGE_FILE) -o $(COVERAGE_HTML)
	@echo "$(GREEN)Coverage report generated: $(COVERAGE_HTML)$(NC)"
	@echo "$(BLUE)Coverage summary:$(NC)"
	@$(GOCMD) tool cover -func=$(COVERAGE_FILE) | grep total

# Run only unit tests
test-unit:
	@echo "$(BLUE)Running unit tests...$(NC)"
	@$(GOTEST) -v -race -timeout $(TEST_TIMEOUT) -short ./...
	@echo "$(GREEN)Unit tests complete!$(NC)"

# Run only integration tests
test-integration:
	@echo "$(BLUE)Running integration tests...$(NC)"
	@$(GOTEST) -v -race -timeout $(TEST_TIMEOUT) -run Integration ./...
	@echo "$(GREEN)Integration tests complete!$(NC)"

# Run specific test
test-specific:
	@echo "$(BLUE)Running specific test: $(TEST)$(NC)"
	@$(GOTEST) -v -race -timeout $(TEST_TIMEOUT) -run $(TEST) ./...

# Run tests for a specific package
test-package:
	@echo "$(BLUE)Running tests for package: $(PKG)$(NC)"
	@$(GOTEST) -v -race -timeout $(TEST_TIMEOUT) ./$(PKG)/...

# Format code
fmt:
	@echo "$(BLUE)Formatting code...$(NC)"
	@$(GOFMT) ./...
	@echo "$(GREEN)Format complete!$(NC)"

# Run go vet
vet:
	@echo "$(BLUE)Running go vet...$(NC)"
	@$(GOVET) ./...
	@echo "$(GREEN)Vet complete!$(NC)"

# Run linter (requires golangci-lint)
lint:
	@echo "$(BLUE)Running linter...$(NC)"
	@if command -v $(GOLINT) >/dev/null 2>&1; then \
		$(GOLINT) run ./...; \
	else \
		echo "$(RED)golangci-lint not installed. Install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest$(NC)"; \
	fi

# Run the application
run:
	@echo "$(BLUE)Running $(BINARY_NAME)...$(NC)"
	@$(GOCMD) run $(MAIN_PATH)

# Update dependencies
deps:
	@echo "$(BLUE)Updating dependencies...$(NC)"
	@$(GOMOD) download
	@$(GOMOD) tidy
	@echo "$(GREEN)Dependencies updated!$(NC)"

# Run all quality checks
check: fmt vet lint test
	@echo "$(GREEN)All checks passed!$(NC)"

# Benchmark tests
bench:
	@echo "$(BLUE)Running benchmarks...$(NC)"
	@$(GOTEST) -bench=. -benchmem -timeout $(TEST_TIMEOUT) ./...

# Test with race detector
test-race:
	@echo "$(BLUE)Running tests with race detector...$(NC)"
	@$(GOTEST) -race -timeout $(TEST_TIMEOUT) ./...
	@echo "$(GREEN)Race detection complete!$(NC)"

# Generate test mocks (requires mockery)
mocks:
	@echo "$(BLUE)Generating mocks...$(NC)"
	@if command -v mockery >/dev/null 2>&1; then \
		mockery --all --output=./mocks; \
	else \
		echo "$(RED)mockery not installed. Install with: go install github.com/vektra/mockery/v2@latest$(NC)"; \
	fi

# Help
help:
	@echo "$(BLUE)API Gateway Makefile Commands:$(NC)"
	@echo "  $(GREEN)make$(NC)              - Run tests and build"
	@echo "  $(GREEN)make build$(NC)        - Build the binary"
	@echo "  $(GREEN)make clean$(NC)        - Clean build artifacts"
	@echo "  $(GREEN)make test$(NC)         - Run all tests"
	@echo "  $(GREEN)make test-verbose$(NC) - Run tests with verbose output"
	@echo "  $(GREEN)make test-coverage$(NC)- Run tests with coverage report"
	@echo "  $(GREEN)make test-unit$(NC)    - Run only unit tests"
	@echo "  $(GREEN)make test-integration$(NC) - Run only integration tests"
	@echo "  $(GREEN)make test-specific TEST=TestName$(NC) - Run specific test"
	@echo "  $(GREEN)make test-package PKG=internal/handlers$(NC) - Run tests for specific package"
	@echo "  $(GREEN)make fmt$(NC)          - Format code"
	@echo "  $(GREEN)make vet$(NC)          - Run go vet"
	@echo "  $(GREEN)make lint$(NC)         - Run linter"
	@echo "  $(GREEN)make run$(NC)          - Run the application"
	@echo "  $(GREEN)make deps$(NC)         - Update dependencies"
	@echo "  $(GREEN)make check$(NC)        - Run all quality checks"
	@echo "  $(GREEN)make bench$(NC)        - Run benchmarks"
	@echo "  $(GREEN)make test-race$(NC)    - Run tests with race detector"
	@echo "  $(GREEN)make mocks$(NC)        - Generate test mocks"

# CI/CD targets
ci-test:
	@echo "$(BLUE)Running CI tests...$(NC)"
	@$(GOTEST) -v -race -coverprofile=$(COVERAGE_FILE) -covermode=atomic -timeout $(TEST_TIMEOUT) ./...
	@echo "$(GREEN)CI tests complete!$(NC)"

ci-lint:
	@echo "$(BLUE)Running CI linting...$(NC)"
	@$(GOFMT) -l . | grep -v vendor | (! grep .) || (echo "$(RED)Unformatted files found$(NC)" && exit 1)
	@$(GOVET) ./...
	@echo "$(GREEN)CI linting complete!$(NC)"