# Unified Test Runner Guide

## Overview

The `run-tests.py` CLI tool provides a unified interface for running and reporting on any phase or category of BetterPrompts E2E tests.

## Features

- **Run any combination of test phases** (1-13)
- **Category-based test execution** (security, auth, features, etc.)
- **Multiple report formats** (console, JSON, HTML, Markdown)
- **Browser selection** (Chromium, Firefox, WebKit)
- **Parallel execution control**
- **Dry run mode** for validation
- **Report-only mode** for existing results

## Installation

No installation needed - the tool uses Python 3 standard library only.

```bash
cd e2e
./run-tests.py --help
```

## Usage Examples

### Basic Usage

```bash
# Run all tests
./run-tests.py

# Run specific phases
./run-tests.py 1 2 3

# Run by category
./run-tests.py --category security
```

### Advanced Options

```bash
# Run with specific browser
./run-tests.py --browser firefox

# Run in headed mode with debugging
./run-tests.py 5 --headed --debug

# Run with custom worker count
./run-tests.py --all --workers 4
```

### Reporting

```bash
# Generate HTML report
./run-tests.py --report-format html --output report.html

# Generate Markdown report
./run-tests.py 1-5 --report-format markdown --output results.md

# Generate report from existing results
./run-tests.py --report-only --report-format json
```

### Utility Commands

```bash
# List all available phases
./run-tests.py --list-phases

# List all categories
./run-tests.py --list-categories

# Dry run to see what would execute
./run-tests.py --category api --dry-run
```

## Test Categories

- **core**: Basic functionality (Phase 1)
- **auth**: Authentication & registration (Phases 2-3)
- **features**: Core features (Phases 4-6)
- **api**: API & rate limiting (Phases 7, 10)
- **performance**: Performance testing (Phase 8)
- **security**: Security & validation (Phases 9, 11)
- **accessibility**: Mobile & WCAG (Phase 12)
- **integration**: E2E journeys (Phase 13)

## Report Formats

### Console (Default)
```
================================================================================
BetterPrompts E2E Test Results
================================================================================
Start Time: 2025-07-29T17:00:00
End Time: 2025-07-29T17:15:30
Total Duration: 930.00s

Phase Results:
--------------------------------------------------------------------------------
Phase 1: Anonymous Enhancement - ✅ PASSED
  Tests: 5 passed, 0 failed
  Duration: 45.23s
```

### JSON
```json
{
  "start_time": "2025-07-29T17:00:00",
  "phases": {
    "1": {
      "name": "Anonymous Enhancement",
      "success": true,
      "passed": 5,
      "failed": 0
    }
  }
}
```

### HTML
Generates a formatted HTML report with styling and summary tables.

### Markdown
Generates GitHub-flavored markdown suitable for documentation.

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed
- `2`: Invalid arguments or configuration error

## Integration with CI/CD

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: |
    cd e2e
    ./run-tests.py --all --report-format json --output results.json
    
- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: e2e/results.json
```

## Troubleshooting

### Prerequisites

1. Ensure Playwright is installed:
   ```bash
   cd e2e
   npm install
   ```

2. Set up test environment:
   ```bash
   ./setup-test-env.sh
   ```

### Common Issues

- **"Phase directory not found"**: Some phases use the frontend directory
- **"No tests found"**: Check that test files exist in the phase directory
- **"Permission denied"**: Run `chmod +x run-tests.py`

## Advanced Configuration

Set environment variables for default behavior:

```bash
export E2E_DEFAULT_BROWSER=firefox
export E2E_DEFAULT_WORKERS=4
export E2E_REPORT_FORMAT=html
```