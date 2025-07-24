#!/usr/bin/env node

/**
 * Security Test Runner
 * Orchestrates all security tests and integrates with security scanning tools
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Test configuration
const SECURITY_TESTS = {
  backend: {
    name: 'Backend Security Tests',
    command: 'cd backend/services/api-gateway && go test -v ./tests/security/...',
    scanners: ['gosec', 'staticcheck'],
  },
  frontend: {
    name: 'Frontend Security Tests',
    command: 'cd frontend && npm run test:security',
    scanners: ['eslint-security', 'npm-audit'],
  },
  integration: {
    name: 'Integration Security Tests',
    command: 'docker-compose -f docker-compose.security-test.yml up --abort-on-container-exit',
    scanners: ['zap', 'trivy'],
  },
};

// Security scanners configuration
const SECURITY_SCANNERS = {
  // Go security scanners
  gosec: {
    name: 'GoSec',
    install: 'go install github.com/securego/gosec/v2/cmd/gosec@latest',
    command: 'gosec -fmt json -out gosec-report.json ./...',
    workDir: 'backend/services/api-gateway',
  },
  staticcheck: {
    name: 'Staticcheck',
    install: 'go install honnef.co/go/tools/cmd/staticcheck@latest',
    command: 'staticcheck -f json ./... > staticcheck-report.json',
    workDir: 'backend/services/api-gateway',
  },
  
  // Frontend security scanners
  'eslint-security': {
    name: 'ESLint Security Plugin',
    install: 'cd frontend && npm install --save-dev eslint-plugin-security',
    command: 'npx eslint --ext .ts,.tsx --plugin security --format json -o eslint-security-report.json src/',
    workDir: 'frontend',
  },
  'npm-audit': {
    name: 'NPM Audit',
    command: 'npm audit --json > npm-audit-report.json',
    workDir: 'frontend',
  },
  
  // Integration scanners
  zap: {
    name: 'OWASP ZAP',
    docker: true,
    command: `docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable zap-baseline.py \
      -t http://host.docker.internal:3000 -J zap-report.json`,
  },
  trivy: {
    name: 'Trivy Container Scanner',
    docker: true,
    command: 'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
      -v $(pwd):/tmp aquasec/trivy image --format json -o /tmp/trivy-report.json \
      betterprompts/api-gateway:latest',
  },
};

// Main execution
async function main() {
  console.log(chalk.bold.blue('🛡️  BetterPrompts Security Test Suite\n'));
  
  const results = {
    tests: {},
    scanners: {},
    summary: {
      passed: 0,
      failed: 0,
      warnings: 0,
    },
  };
  
  // Create reports directory
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Run security tests
  console.log(chalk.bold('Running Security Tests...\n'));
  
  for (const [key, test] of Object.entries(SECURITY_TESTS)) {
    console.log(chalk.yellow(`Running ${test.name}...`));
    
    try {
      execSync(test.command, { stdio: 'inherit' });
      results.tests[key] = { status: 'passed', name: test.name };
      results.summary.passed++;
      console.log(chalk.green(`✓ ${test.name} passed\n`));
    } catch (error) {
      results.tests[key] = { status: 'failed', name: test.name, error: error.message };
      results.summary.failed++;
      console.log(chalk.red(`✗ ${test.name} failed\n`));
    }
  }
  
  // Run security scanners
  console.log(chalk.bold('\nRunning Security Scanners...\n'));
  
  for (const [key, scanner] of Object.entries(SECURITY_SCANNERS)) {
    console.log(chalk.yellow(`Running ${scanner.name}...`));
    
    try {
      // Install if needed
      if (scanner.install) {
        execSync(scanner.install, { stdio: 'pipe' });
      }
      
      // Run scanner
      const workDir = scanner.workDir || '.';
      const command = scanner.docker ? scanner.command : `cd ${workDir} && ${scanner.command}`;
      
      execSync(command, { stdio: 'pipe' });
      
      // Parse results if JSON report exists
      const reportFile = path.join(workDir, `${key}-report.json`);
      if (fs.existsSync(reportFile)) {
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        const issues = parseSecurityReport(key, report);
        
        results.scanners[key] = {
          status: issues.critical > 0 ? 'failed' : 'passed',
          name: scanner.name,
          issues,
        };
        
        if (issues.critical > 0) {
          results.summary.failed++;
          console.log(chalk.red(`✗ ${scanner.name} found critical issues`));
        } else if (issues.high > 0 || issues.medium > 0) {
          results.summary.warnings++;
          console.log(chalk.yellow(`⚠ ${scanner.name} found warnings`));
        } else {
          results.summary.passed++;
          console.log(chalk.green(`✓ ${scanner.name} passed`));
        }
        
        // Move report to reports directory
        fs.renameSync(reportFile, path.join(reportsDir, path.basename(reportFile)));
      }
    } catch (error) {
      results.scanners[key] = {
        status: 'error',
        name: scanner.name,
        error: error.message,
      };
      console.log(chalk.red(`✗ ${scanner.name} error: ${error.message}`));
    }
  }
  
  // Generate summary report
  generateSummaryReport(results);
  
  // Exit with appropriate code
  process.exit(results.summary.failed > 0 ? 1 : 0);
}

// Parse security scanner reports
function parseSecurityReport(scanner, report) {
  const issues = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  switch (scanner) {
    case 'gosec':
      if (report.Issues) {
        report.Issues.forEach((issue) => {
          const severity = issue.severity.toLowerCase();
          if (issues[severity] !== undefined) {
            issues[severity]++;
          }
        });
      }
      break;
      
    case 'npm-audit':
      if (report.metadata && report.metadata.vulnerabilities) {
        const vulns = report.metadata.vulnerabilities;
        issues.critical = vulns.critical || 0;
        issues.high = vulns.high || 0;
        issues.medium = vulns.moderate || 0;
        issues.low = vulns.low || 0;
      }
      break;
      
    case 'zap':
      if (report.site && report.site[0] && report.site[0].alerts) {
        report.site[0].alerts.forEach((alert) => {
          const risk = alert.riskdesc.toLowerCase();
          if (risk.includes('high')) issues.high++;
          else if (risk.includes('medium')) issues.medium++;
          else if (risk.includes('low')) issues.low++;
        });
      }
      break;
      
    case 'trivy':
      if (report.Results) {
        report.Results.forEach((result) => {
          if (result.Vulnerabilities) {
            result.Vulnerabilities.forEach((vuln) => {
              const severity = vuln.Severity.toLowerCase();
              if (issues[severity] !== undefined) {
                issues[severity]++;
              }
            });
          }
        });
      }
      break;
  }
  
  return issues;
}

// Generate HTML summary report
function generateSummaryReport(results) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, 'reports', 'security-summary.html');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>BetterPrompts Security Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { 
      background: #f5f5f5; 
      padding: 15px; 
      border-radius: 5px; 
      margin: 20px 0;
    }
    .passed { color: #28a745; }
    .failed { color: #dc3545; }
    .warning { color: #ffc107; }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin: 20px 0;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 8px; 
      text-align: left;
    }
    th { background-color: #f2f2f2; }
    .status-passed { background-color: #d4edda; }
    .status-failed { background-color: #f8d7da; }
    .status-warning { background-color: #fff3cd; }
  </style>
</head>
<body>
  <h1>BetterPrompts Security Test Report</h1>
  <p>Generated: ${timestamp}</p>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><span class="passed">Passed: ${results.summary.passed}</span></p>
    <p><span class="failed">Failed: ${results.summary.failed}</span></p>
    <p><span class="warning">Warnings: ${results.summary.warnings}</span></p>
  </div>
  
  <h2>Test Results</h2>
  <table>
    <tr>
      <th>Test Suite</th>
      <th>Status</th>
      <th>Details</th>
    </tr>
    ${Object.entries(results.tests)
      .map(
        ([key, test]) => `
    <tr class="status-${test.status}">
      <td>${test.name}</td>
      <td>${test.status}</td>
      <td>${test.error || 'Passed'}</td>
    </tr>
    `
      )
      .join('')}
  </table>
  
  <h2>Security Scanner Results</h2>
  <table>
    <tr>
      <th>Scanner</th>
      <th>Status</th>
      <th>Critical</th>
      <th>High</th>
      <th>Medium</th>
      <th>Low</th>
    </tr>
    ${Object.entries(results.scanners)
      .map(
        ([key, scanner]) => `
    <tr class="status-${scanner.status}">
      <td>${scanner.name}</td>
      <td>${scanner.status}</td>
      <td>${scanner.issues?.critical || '-'}</td>
      <td>${scanner.issues?.high || '-'}</td>
      <td>${scanner.issues?.medium || '-'}</td>
      <td>${scanner.issues?.low || '-'}</td>
    </tr>
    `
      )
      .join('')}
  </table>
  
  <h2>Recommendations</h2>
  <ul>
    ${results.summary.failed > 0 ? '<li>Fix all critical security issues before deployment</li>' : ''}
    ${results.summary.warnings > 0 ? '<li>Review and address security warnings</li>' : ''}
    <li>Regularly update dependencies to patch known vulnerabilities</li>
    <li>Conduct periodic security audits and penetration testing</li>
    <li>Implement security monitoring and alerting in production</li>
  </ul>
</body>
</html>
`;
  
  fs.writeFileSync(reportPath, html);
  console.log(chalk.bold(`\n📊 Summary report generated: ${reportPath}`));
}

// Run main function
main().catch((error) => {
  console.error(chalk.red('Security test runner failed:'), error);
  process.exit(1);
});