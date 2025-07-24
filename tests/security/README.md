# BetterPrompts Security Test Suite

Comprehensive security testing framework for the BetterPrompts application, covering both backend and frontend security aspects.

## Overview

This security test suite validates:

1. **JWT Authentication & Authorization**
   - Token validation and manipulation
   - Token expiration and renewal
   - Session management

2. **RBAC (Role-Based Access Control)**
   - Role enforcement
   - Privilege escalation prevention
   - Permission validation

3. **XSS (Cross-Site Scripting) Prevention**
   - Input sanitization
   - Output encoding
   - Content Security Policy

4. **CSRF (Cross-Site Request Forgery) Protection**
   - Token generation and validation
   - Same-origin policy enforcement

5. **SQL Injection Prevention**
   - Parameterized queries
   - Input validation
   - Query sanitization

6. **API Rate Limiting**
   - Brute force protection
   - DDoS mitigation
   - Per-user/IP limits

7. **Input Validation & Sanitization**
   - Data type validation
   - Length limits
   - Format validation

8. **Session Management Security**
   - Session fixation prevention
   - Session timeout
   - Secure session storage

## Structure

```
tests/security/
├── backend_security_test.go      # Go backend security tests
├── frontend_security.test.tsx    # React/Next.js frontend tests
├── security-test-runner.js       # Test orchestration script
├── package.json                  # Test dependencies
├── README.md                     # This file
└── reports/                      # Generated test reports
    ├── security-summary.html     # Summary report
    ├── gosec-report.json        # Go security scan results
    ├── npm-audit-report.json    # NPM vulnerability scan
    ├── zap-report.json          # OWASP ZAP scan results
    └── trivy-report.json        # Container scan results
```

## Running Security Tests

### Quick Start

Run all security tests using Docker:

```bash
docker-compose -f docker-compose.security-test.yml up --build
```

### Individual Test Suites

#### Backend Security Tests (Go)

```bash
cd backend/services/api-gateway
go test -v ./tests/security/...
```

#### Frontend Security Tests (React/Next.js)

```bash
cd frontend
npm run test:security
```

#### Security Scanners Only

```bash
cd tests/security
npm run scan:dependencies
npm run scan:containers
```

### Local Development

1. Install dependencies:
   ```bash
   cd tests/security
   npm install
   ```

2. Run the test suite:
   ```bash
   npm test
   ```

## Security Test Cases

### Authentication Tests

- JWT token validation
- Token expiration handling
- Refresh token flow
- Session management
- Multi-factor authentication (if implemented)

### Authorization Tests

- Role-based access control
- Resource-level permissions
- API endpoint protection
- Admin vs user access

### Input Security Tests

- XSS payload detection
- SQL injection prevention
- Command injection protection
- Path traversal prevention
- File upload validation

### Session Security Tests

- Session fixation prevention
- Session timeout enforcement
- Concurrent session limits
- Session invalidation

### API Security Tests

- Rate limiting enforcement
- CORS policy validation
- Security header presence
- API versioning security

## Security Scanners

### Static Analysis

- **GoSec**: Go security checker
- **ESLint Security**: JavaScript/TypeScript security rules
- **Bandit**: Python security linter
- **Semgrep**: Multi-language static analysis

### Dynamic Analysis

- **OWASP ZAP**: Web application security scanner
- **SQLMap**: SQL injection detection
- **Nikto**: Web server scanner

### Dependency Scanning

- **NPM Audit**: Node.js dependency vulnerabilities
- **Snyk**: Cross-platform vulnerability database
- **OWASP Dependency Check**: Known vulnerability detection

### Container Scanning

- **Trivy**: Container vulnerability scanner
- **Clair**: Container static analysis
- **Anchore**: Container policy evaluation

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Security Tests
        run: |
          docker-compose -f docker-compose.security-test.yml up --build --abort-on-container-exit
          
      - name: Upload Security Reports
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: tests/security/reports/
```

### GitLab CI

```yaml
security-tests:
  stage: test
  services:
    - docker:dind
  script:
    - docker-compose -f docker-compose.security-test.yml up --build --abort-on-container-exit
  artifacts:
    reports:
      junit: tests/security/reports/junit.xml
    paths:
      - tests/security/reports/
```

## Security Compliance

The test suite helps ensure compliance with:

- **OWASP Top 10**: Coverage for all major web vulnerabilities
- **PCI DSS**: Payment card data security (if applicable)
- **SOC 2**: Security controls for service organizations
- **GDPR**: Data protection and privacy
- **HIPAA**: Healthcare data security (if applicable)

## Best Practices

1. **Run tests regularly**: Include in CI/CD pipeline
2. **Update dependencies**: Keep security tools current
3. **Review reports**: Don't ignore warnings
4. **Fix immediately**: Security issues are high priority
5. **Document fixes**: Track security improvements

## Troubleshooting

### Common Issues

1. **Docker permissions**: Ensure Docker socket is accessible
2. **Port conflicts**: Check ports 3000, 8080, 8090, 8091
3. **Memory limits**: Security scans can be memory-intensive
4. **Network issues**: Ensure containers can communicate

### Debug Mode

Run with verbose logging:

```bash
DEBUG=* npm test
```

## Contributing

When adding new security tests:

1. Follow the existing test structure
2. Document the vulnerability being tested
3. Include both positive and negative test cases
4. Update this README with new test descriptions
5. Ensure tests are deterministic and repeatable

## Security Contacts

- Security Team: security@betterprompts.ai
- Bug Bounty: https://betterprompts.ai/security/bug-bounty
- Security Advisories: https://github.com/betterprompts/security-advisories