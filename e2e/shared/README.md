# Shared E2E Test Resources

This directory contains shared resources used across all test phases.

## Structure

- **`configs/`** - Shared configuration files
  - `base.config.ts` - Base Playwright configuration
  
- **`utils/`** - Common utility functions
  - Test helpers
  - API clients
  - Data generators
  
- **`pages/`** - Shared page objects
  - Base page classes
  - Common UI components
  
- **`fixtures/`** - Test data and fixtures
  - User data
  - Sample prompts
  - Mock responses

## Usage

Import shared resources in your test files:

```typescript
import { baseConfig } from '../shared/configs/base.config';
import { TestHelper } from '../shared/utils/test-helper';
import { BasePage } from '../shared/pages/base.page';
```

## Guidelines

1. Only add truly shared code here
2. Phase-specific code stays in phase directories
3. Keep utilities focused and well-documented
4. Update this README when adding new shared resources