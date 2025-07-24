# 📊 BetterPrompts Test Coverage Guide

This guide explains how to work with the unified test coverage system for BetterPrompts, which aggregates coverage across Go, Python, and TypeScript/JavaScript services.

## 🎯 Coverage Goals

- **Global Target**: 80% minimum coverage
- **Service-Specific Targets**:
  - API Gateway (Go): 85%
  - Technique Selector (Go): 90%
  - Intent Classifier (Python): 85%
  - Prompt Generator (Python): 85%
  - Frontend (TypeScript): 80%

## 🚀 Quick Start

### Running Coverage Locally

```bash
# Run all tests with coverage
make -f Makefile.coverage coverage

# Run coverage for specific languages
make -f Makefile.coverage coverage-go
make -f Makefile.coverage coverage-python
make -f Makefile.coverage coverage-frontend

# Generate coverage report
make -f Makefile.coverage coverage-report

# Generate badges
make -f Makefile.coverage coverage-badges
```

### Viewing Coverage Dashboard

```bash
# Start the coverage dashboard server
python scripts/serve-coverage-dashboard.py --open

# Dashboard will be available at http://localhost:8080
```

## 📁 Project Structure

```
BetterPrompts/
├── .coverage/                    # Generated coverage reports
│   ├── coverage.json            # Aggregated coverage data
│   ├── COVERAGE.md              # Markdown report
│   └── html/                    # HTML coverage reports
├── badges/                      # Coverage badges
├── scripts/
│   ├── coverage-aggregator.py   # Main aggregation script
│   ├── generate-badges.sh       # Badge generation
│   ├── serve-coverage-dashboard.py # Dashboard server
│   └── coverage-dashboard.html  # Dashboard template
├── Makefile.coverage            # Coverage make targets
├── codecov.yml                  # Codecov configuration
└── .github/workflows/coverage.yml # CI/CD coverage workflow
```

## 🔧 Service-Specific Configuration

### Go Services

Coverage is generated using Go's built-in coverage tools:

```bash
# In service directory
go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
go tool cover -html=coverage.out -o coverage.html
```

### Python Services

Coverage is generated using pytest-cov:

```bash
# In service directory
pytest --cov=app --cov-report=xml --cov-report=html --cov-report=term
```

Configuration in `pytest.ini`:
```ini
[tool:pytest]
addopts = 
    --cov=app
    --cov-report=term-missing
    --cov-report=html
    --cov-report=xml
    --cov-fail-under=85
```

### Frontend (TypeScript/JavaScript)

Coverage is generated using Jest:

```bash
# In frontend directory
npm test -- --coverage --watchAll=false
```

Configuration in `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

## 📊 Coverage Aggregation

The `coverage-aggregator.py` script collects coverage from all services and provides:

1. **Weighted Total Coverage**: Based on actual lines of code
2. **Service-Level Metrics**: Individual service coverage
3. **Multiple Output Formats**: Text, JSON, Markdown
4. **Badge Generation**: For README display

### Usage

```bash
# Generate text report (stdout)
python scripts/coverage-aggregator.py

# Generate JSON report
python scripts/coverage-aggregator.py --format json --output coverage.json

# Generate Markdown report
python scripts/coverage-aggregator.py --format markdown --output COVERAGE.md

# Generate badge data
python scripts/coverage-aggregator.py --badges
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/coverage.yml` workflow:

1. **Parallel Testing**: Runs tests for all services concurrently
2. **Coverage Collection**: Aggregates coverage from all services
3. **Threshold Checking**: Fails if below 80% total coverage
4. **PR Comments**: Adds coverage report to pull requests
5. **Codecov Upload**: Sends coverage to Codecov.io
6. **Badge Updates**: Auto-updates badges on main branch

### Codecov Integration

1. Add `CODECOV_TOKEN` to GitHub secrets
2. Coverage is automatically uploaded on push/PR
3. View detailed reports at codecov.io/gh/[your-org]/BetterPrompts

## 📈 Coverage Dashboard

The interactive dashboard provides:

- **Real-time Updates**: Auto-refreshes coverage data
- **Service Breakdown**: Coverage by service and language
- **Visual Progress Bars**: Quick coverage assessment
- **Historical Trends**: Coverage over time (when data available)
- **Responsive Design**: Works on all devices

### Running the Dashboard

```bash
# Basic usage
python scripts/serve-coverage-dashboard.py

# Custom port
python scripts/serve-coverage-dashboard.py --port 9000

# Disable file watching
python scripts/serve-coverage-dashboard.py --no-watch

# Open browser automatically
python scripts/serve-coverage-dashboard.py --open
```

## 🛡️ Coverage Badges

Badges are automatically generated and can be included in README files:

```markdown
![Total Coverage](./badges/coverage-total.svg)
![Service Coverage](./badges/coverage-[service-name].svg)
```

### Manual Badge Generation

```bash
# Generate all badges
./scripts/generate-badges.sh

# Badges will be saved to ./badges/
```

## 🔍 Troubleshooting

### Common Issues

1. **Missing Coverage Files**
   - Ensure tests have been run for all services
   - Check service directories for coverage output files

2. **Aggregation Errors**
   - Verify Python 3.8+ is installed
   - Check file permissions on coverage files

3. **Badge Generation Fails**
   - Ensure `jq` and `curl` are installed
   - Check internet connection for badge downloads

### Debug Mode

```bash
# Run aggregator with verbose output
python scripts/coverage-aggregator.py --debug

# Check individual service coverage
cd backend/services/[service-name]
# Run service-specific coverage command
```

## 📋 Best Practices

1. **Run Coverage Locally**: Before pushing changes
2. **Monitor Trends**: Use dashboard to track coverage over time
3. **Fix Coverage Gaps**: Focus on uncovered critical paths
4. **Update Thresholds**: Gradually increase as coverage improves
5. **Exclude Generated Code**: Update codecov.yml as needed

## 🚨 Coverage Requirements

### Pull Request Checks

- Total coverage must be ≥80%
- No service should drop >5% from baseline
- All new code should have tests

### Exceptions

Valid reasons to exclude from coverage:
- Generated code (protobuf, mocks)
- Main entry points (cmd/main.go)
- Pure configuration files
- Migration scripts

Update `codecov.yml` to exclude these patterns.

## 🤝 Contributing

When adding new services:

1. Add service to `coverage-aggregator.py`
2. Update `Makefile.coverage` targets
3. Add to CI workflow matrix
4. Set appropriate coverage threshold
5. Update this documentation

---

For questions or issues, please open a GitHub issue or contact the development team.