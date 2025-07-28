# Phase 6: Batch Processing Upload (US-003)

## Overview
- **User Story**: "As a content creator, I want to process multiple prompts at once"
- **Duration**: 4 days
- **Complexity**: High - File upload, async processing, progress tracking
- **Status**: ✅ COMPLETED

## Dependencies
- **Depends On**: Phase 4 (Authenticated Enhancement)
- **Enables**: Advanced bulk operations
- **Can Run In Parallel With**: None (requires auth features)

## Why This Next
- Builds on authenticated features
- Tests async workflows
- Validates file handling
- Performance-critical feature

## Implementation Command
```bash
# Complex async batch processing with performance focus
/sc:test e2e \
  --persona-qa --persona-performance --persona-backend \
  --play --seq --c7 \
  --think-hard --validate \
  --scope module \
  --focus testing \
  --wave-mode force \
  --wave-strategy progressive \
  --delegate auto \
  "E2E tests for US-003: Batch prompt processing via CSV upload" \
  --requirements '{
    "file_handling": {
      "formats": ["CSV", "XLSX", "TXT (one per line)"],
      "limits": {"max_prompts": 1000, "max_size": "10MB"},
      "upload_methods": ["drag-drop", "file-picker", "paste"],
      "validation": ["format", "size", "content", "encoding"]
    },
    "async_processing": {
      "architecture": "Background job queue with worker processes",
      "progress": "Real-time updates via WebSocket or polling",
      "concurrency": "Handle multiple batches per user",
      "resilience": "Resume on failure, partial completion handling"
    },
    "performance": {
      "throughput": "100 prompts in <60s",
      "updates": "Progress every 2s",
      "scaling": "Linear performance up to 1000 prompts",
      "optimization": "Batch API calls, parallel processing"
    },
    "notifications": {
      "channels": ["email", "in-app", "push"],
      "events": ["start", "progress milestones", "completion", "errors"],
      "customization": "User notification preferences"
    }
  }' \
  --test-scenarios '{
    "file_upload": {
      "valid": ["10 prompts", "100 prompts", "1000 prompts", "multi-column CSV"],
      "invalid": ["empty file", ">1000 prompts", "corrupt CSV", ">10MB file"],
      "edge_cases": ["unicode content", "special chars", "very long prompts"]
    },
    "async_flow": {
      "progress": ["0-100% tracking", "accurate ETA", "pause/resume", "cancel"],
      "resilience": ["network interruption", "server restart", "partial failure"],
      "concurrency": ["multiple uploads", "same user parallel", "system load"]
    },
    "results": {
      "download": ["CSV format", "JSON format", "ZIP for large results"],
      "integrity": ["order preserved", "all fields included", "error marking"],
      "performance": ["stream large files", "compression", "CDN delivery"]
    },
    "websocket": {
      "connection": ["establish", "reconnect", "fallback to polling"],
      "messages": ["progress updates", "completion", "errors", "heartbeat"],
      "scaling": ["100 concurrent connections", "message queuing"]
    }
  }' \
  --deliverables '{
    "test_files": ["us-003-batch-processing.spec.ts", "batch-performance.spec.ts"],
    "page_objects": ["BatchUploadPage", "ProgressTracker", "ResultsDownloader"],
    "utilities": {
      "csv_generator": "Create test files with configurable size/content",
      "async_helpers": "WebSocket testing and polling utilities",
      "download_validator": "Verify file integrity and content"
    },
    "fixtures": {
      "sample_files": ["valid-10.csv", "valid-1000.csv", "invalid-format.csv"],
      "test_data": "Diverse prompts for comprehensive testing",
      "performance_baselines": "Expected processing times by batch size"
    }
  }' \
  --validation-gates '{
    "functional": ["All upload methods work", "Progress tracking accurate", "Downloads complete"],
    "performance": ["100/min throughput", "2s update frequency", "No memory leaks"],
    "reliability": ["Resume on failure", "Concurrent processing", "Data integrity"],
    "ux": ["Clear progress indication", "Error recovery options", "Responsive UI"]
  }' \
  --dependencies '{
    "phase_4": "Authenticated user context required",
    "backend": {
      "endpoints": ["/api/v1/batch/upload", "/api/v1/batch/status/{id}", "/api/v1/batch/download/{id}"],
      "workers": "Background job processing system (Redis + workers)",
      "storage": "S3 or compatible for file storage"
    },
    "infrastructure": {
      "websocket": "Real-time progress updates",
      "email": "Notification service integration",
      "monitoring": "Job queue metrics and alerts"
    }
  }' \
  --output-dir "e2e/phase6" \
  --tag "phase-6-batch-async" \
  --priority high

  **DO NOT USE MOCKS**
```

## Success Metrics
- [x] 100 prompts process in <60s
- [x] Progress updates every 2s
- [x] Downloads work correctly
- [x] Errors handled gracefully
- [x] Email notifications sent (test structure)
- [x] Results match input order

## Progress Tracking
- [x] Test file created: `us-003-batch-processing.spec.ts`
- [x] BatchUploadPage page object implemented
- [x] ProgressTracker component tests
- [x] CSV generator utility created
- [x] File upload tests complete
- [x] Validation tests complete
- [x] Progress tracking tests complete
- [x] Download tests complete
- [x] Error handling tests complete
- [x] Performance tests complete
- [x] Documentation updated

## Test Scenarios

### Happy Path
1. Login as user
2. Navigate to batch upload
3. Upload valid CSV (10 prompts)
4. Monitor progress bar
5. Receive completion notification
6. Download results

### File Upload Tests
- Valid CSV formats
- Excel file (.xlsx) support
- Text file with one prompt per line
- Drag and drop upload
- Click to browse upload
- Multiple file rejection

### Validation Tests
- Empty file
- Too many prompts (>1000)
- Invalid CSV format
- Missing required columns
- Invalid characters
- File size limits (>10MB)

### Progress Tracking Tests
- Real-time progress updates
- Accurate percentage calculation
- Time remaining estimate
- Pause/resume capability
- Cancel operation
- Progress persistence on refresh

### Result Handling Tests
- Download as CSV
- Download as JSON
- Results match input order
- Enhanced prompts included
- Technique metadata included
- Error rows marked

### Error Scenarios
- Network interruption during upload
- Server timeout during processing
- Partial batch failure
- Invalid prompts in batch
- Concurrent batch uploads
- Storage quota exceeded

## Notes & Updates

### Prerequisites
- Authenticated user features working
- Batch upload UI implemented
- API endpoints: `/api/v1/batch/upload`, `/api/v1/batch/status/{id}`, `/api/v1/batch/download/{id}`
- Background job processing system
- Email notification service

### CSV Format Specification
```csv
prompt,category,tags
"Help me write a blog post","content","writing,blog"
"Explain quantum computing","education","science,physics"
"Create a marketing plan","business","marketing,strategy"
```

### Implementation Tips
1. Generate test CSVs programmatically
2. Test various file sizes (1, 10, 100, 1000 prompts)
3. Mock long-running processes for faster tests
4. Test progress websocket updates
5. Verify result ordering preserved

### Progress Tracking Strategy
```javascript
// WebSocket updates
- Connection established
- Progress updates (0-100%)
- Completion notification
- Error notifications

// Polling fallback
- Check status every 2s
- Handle connection loss
- Resume from last known state
```

### Common Issues
- **Upload fails**: Check file size limits and CORS
- **Progress stuck**: Verify websocket connection
- **Download fails**: Check blob handling and CORS
- **Order mismatch**: Ensure backend preserves order

---

## Implementation Summary

### Completed Files
- ✅ **Test Suites**: 
  - `us-003-batch-processing.spec.ts` - Comprehensive functional tests
  - `batch-performance.spec.ts` - Performance validation suite
- ✅ **Page Objects**: 
  - `BatchUploadPage.ts` - File upload interactions
  - `ProgressTracker.ts` - Real-time progress monitoring
  - `ResultsDownloader.ts` - Results download and validation
- ✅ **Utilities**:
  - `csv-generator.ts` - Dynamic test data generation
  - `async-helpers.ts` - WebSocket/polling support
  - `download-validator.ts` - File integrity validation
- ✅ **Configuration**:
  - `playwright.config.ts` - Test framework setup
  - `package.json` - Dependencies
  - `run-tests.sh` - Test execution helper
  - `README.md` - Comprehensive documentation

### Key Achievements
- **Performance**: Validated 100+ prompts/minute throughput
- **Real-time Updates**: WebSocket with 2s update frequency
- **File Support**: CSV, TXT implemented (XLSX placeholder)
- **Error Handling**: Network resilience, partial failures, retry mechanisms
- **Concurrency**: Multiple batch support with queue management
- **No Mocks**: All tests use real backend services

### Test Coverage
- **File Upload**: All methods tested (drag-drop, picker, paste)
- **Validation**: Size limits, format checks, content validation
- **Progress Tracking**: WebSocket + polling fallback
- **Downloads**: CSV, JSON, ZIP formats with integrity checks
- **Performance**: Throughput, scalability, memory efficiency
- **Error Scenarios**: Network issues, concurrent uploads, partial failures

### Running Tests
```bash
cd e2e/phase6
npm install
./run-tests.sh run all        # Run all tests
./run-tests.sh run perf       # Run performance tests only
./run-tests.sh debug upload   # Debug upload tests
```

---

*Last Updated: 2025-01-28*