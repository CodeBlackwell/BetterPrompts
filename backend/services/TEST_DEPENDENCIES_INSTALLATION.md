# Test Dependencies Installation Summary

This document summarizes the installation of Python test dependencies (faker, pytest-cov, pytest-timeout) for the intent-classifier and prompt-generator services.

## Intent Classifier Service

### Location
`/backend/services/intent-classifier/`

### Existing Configuration
The service already had a `requirements-test.txt` file containing all required dependencies:
- faker==22.2.0
- pytest-cov==4.1.0
- pytest-timeout==2.2.0

### Installation Command
```bash
cd backend/services/intent-classifier
pip install -r requirements-test.txt
```

### Verification
```bash
python -c "import faker; import pytest_cov; import pytest_timeout; print('All test dependencies installed!')"
```

## Prompt Generator Service

### Location
`/backend/services/prompt-generator/`

### Configuration Changes
Created a new `requirements-test.txt` file to organize test dependencies separately from main requirements:
- faker==22.2.0
- pytest-cov==4.1.0
- pytest-timeout==2.2.0
- And other test dependencies

### Installation Commands
```bash
cd backend/services/prompt-generator
# Install all test dependencies
pip install -r requirements-test.txt

# Or install only the missing ones
pip install faker==22.2.0 pytest-timeout==2.2.0
```

### Verification
```bash
python -c "import faker; import pytest_cov; import pytest_timeout; print('All test dependencies installed!')"
```

## Key Dependencies Installed

1. **faker==22.2.0**: A library for generating fake data for testing
2. **pytest-cov==4.1.0**: Coverage plugin for pytest to measure code coverage
3. **pytest-timeout==2.2.0**: Plugin to control test execution time and prevent hanging tests

## Next Steps

With these dependencies installed, you can now:
1. Run tests with coverage: `pytest --cov=app tests/`
2. Set test timeouts: `pytest --timeout=300`
3. Use faker in tests for generating test data

## Notes

- Both services now have consistent test dependency versions
- The dependencies are compatible with the existing pytest versions
- All dependencies were successfully verified through imports