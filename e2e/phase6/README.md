# Phase 6: Batch Processing E2E Tests

This directory contains comprehensive end-to-end tests for US-003: Batch prompt processing via CSV upload.

## Test Structure

```
phase6/
├── fixtures/                    # Test data files
│   ├── valid-10.csv            # Valid CSV with 10 prompts
│   ├── valid-100.csv           # Valid CSV with 100 prompts
│   ├── invalid-format.csv      # Invalid CSV format
│   ├── empty.csv               # Empty CSV file
│   ├── unicode-special.csv     # CSV with special characters
│   └── valid-prompts.txt       # TXT format test file
├── page-objects/               # Page Object Models
│   ├── BatchUploadPage.ts      # Upload page interactions
│   ├── ProgressTracker.ts      # Progress tracking page
│   └── ResultsDownloader.ts    # Results download page
├── utils/                      # Test utilities
│   ├── csv-generator.ts        # Dynamic CSV generation
│   ├── async-helpers.ts        # WebSocket/polling helpers
│   └── download-validator.ts   # File validation utilities
├── us-003-batch-processing.spec.ts  # Main test suite
├── batch-performance.spec.ts        # Performance tests
├── playwright.config.ts             # Test configuration
└── README.md                       # This file
```

## Key Features Tested

### File Upload Methods
- **File Picker**: Traditional file selection
- **Drag & Drop**: Drag files onto drop zone
- **Paste**: Direct text paste support
- **Multiple Formats**: CSV, XLSX, TXT support

### Async Processing
- **WebSocket Updates**: Real-time progress tracking
- **Polling Fallback**: When WebSocket unavailable
- **Progress Accuracy**: ETA and throughput calculations
- **Pause/Resume**: Control over processing

### Performance Requirements
- **Throughput**: 100+ prompts per minute
- **Update Frequency**: Progress updates every 2 seconds
- **Scalability**: Linear performance up to 1000 prompts
- **Concurrency**: Multiple batches per user

### Error Handling
- **File Validation**: Size limits, format checks
- **Partial Failures**: Graceful handling of errors
- **Network Resilience**: Resume after disconnection
- **Retry Failed**: Re-process failed prompts

## Running Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Set up test environment
cp .env.test.example .env.test

# Ensure backend services are running
docker compose up -d
```

### Run All Tests
```bash
# Run all phase 6 tests
npx playwright test e2e/phase6

# Run with UI mode
npx playwright test e2e/phase6 --ui

# Run specific test file
npx playwright test e2e/phase6/us-003-batch-processing.spec.ts

# Run performance tests only
npx playwright test e2e/phase6/batch-performance.spec.ts
```

### Run Specific Test Suites
```bash
# File upload tests
npx playwright test e2e/phase6 -g "File Upload Methods"

# WebSocket tests
npx playwright test e2e/phase6 -g "Async Processing with WebSocket"

# Performance tests
npx playwright test e2e/phase6 -g "Throughput Performance"
```

### Debug Mode
```bash
# Debug with browser
npx playwright test e2e/phase6 --debug

# Debug specific test
npx playwright test e2e/phase6 -g "should upload CSV via drag and drop" --debug
```

## Test Data Generation

The CSV generator utility can create test files dynamically:

```typescript
import { CSVGenerator } from './utils/csv-generator';

// Generate basic CSV
await CSVGenerator.generateFile('test.csv', {
  count: 100,
  promptLength: 'medium'
});

// Generate with special characters
await CSVGenerator.generateFile('special.csv', {
  count: 50,
  includeSpecialChars: true,
  includeUnicode: true
});

// Generate oversized file
await CSVGenerator.generateOversizedFile('large.csv', 11); // 11MB
```

## Performance Benchmarks

Expected performance metrics:

| Batch Size | Target Time | Min Throughput | Update Frequency |
|------------|-------------|----------------|------------------|
| 10         | < 6s        | 100/min        | 2s ± 200ms      |
| 100        | < 60s       | 100/min        | 2s ± 200ms      |
| 1000       | < 10min     | 100/min        | 2s ± 200ms      |

## WebSocket Testing

The tests include comprehensive WebSocket functionality:

```typescript
// Connect to WebSocket
await wsHelper.connect(batchId);

// Wait for specific progress
await wsHelper.waitForProgress(50); // 50%

// Get latest update
const update = await wsHelper.getLatestProgress();

// Validate update frequency
ProgressValidator.validateUpdateFrequency(messages, 2000);
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Phase 6 Tests
  run: |
    npx playwright test e2e/phase6
  env:
    BASE_URL: ${{ secrets.TEST_BASE_URL }}
    API_KEY: ${{ secrets.TEST_API_KEY }}
```

### Test Reports
- HTML Report: `test-results/html/index.html`
- JSON Report: `test-results/results.json`
- JUnit XML: `test-results/junit.xml`

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if backend WebSocket server is running
   - Verify WebSocket URL in environment config
   - Check for proxy/firewall blocking WebSocket

2. **File Upload Timeout**
   - Increase timeout in test configuration
   - Check file size limits in backend
   - Verify upload endpoint is responsive

3. **Performance Test Failures**
   - Ensure system has adequate resources
   - Check for other processes consuming CPU/memory
   - Verify backend is properly configured for load

### Debug Commands
```bash
# Check backend health
curl http://localhost/api/v1/health

# Test WebSocket connection
wscat -c ws://localhost/ws/test

# Monitor batch processing
curl http://localhost/api/v1/batch/status/{batchId}
```

## Test Maintenance

### Adding New Tests
1. Create test in appropriate describe block
2. Use existing page objects and utilities
3. Follow naming convention: `should [action] [expected result]`
4. Add appropriate tags for test filtering

### Updating Fixtures
1. Place new fixtures in `fixtures/` directory
2. Update CSV generator for dynamic generation
3. Document fixture purpose in this README

### Performance Baseline Updates
1. Run performance tests 3 times
2. Calculate average metrics
3. Update PERFORMANCE_REQUIREMENTS in test file
4. Document changes in commit message

## Dependencies

- **Authentication**: Requires Phase 4 auth implementation
- **Backend APIs**: 
  - `/api/v1/batch/upload`
  - `/api/v1/batch/status/{id}`
  - `/api/v1/batch/download/{id}`
- **WebSocket**: `ws://localhost/ws/batch/{id}`
- **Storage**: S3 or compatible for file storage

## Future Enhancements

1. **Additional File Formats**
   - Excel (.xlsx) support
   - JSON batch upload
   - ZIP file with multiple CSVs

2. **Advanced Features**
   - Batch scheduling
   - Priority queue support
   - Batch templates

3. **Performance Optimizations**
   - GPU acceleration testing
   - Distributed processing validation
   - CDN download testing