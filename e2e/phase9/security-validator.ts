/**
 * Security Validator for E2E Testing
 * Phase 9: Input Validation & Edge Cases
 */

import { Page } from '@playwright/test';

export interface SecurityValidationResult {
  passed: boolean;
  issues: SecurityIssue[];
  headers: Record<string, string>;
  sanitizationWorking: boolean;
}

export interface SecurityIssue {
  type: 'xss' | 'injection' | 'header' | 'sanitization';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence?: string;
}

export class SecurityValidator {
  /**
   * Validate security headers
   */
  static async validateSecurityHeaders(page: Page): Promise<{
    headers: Record<string, string>;
    issues: SecurityIssue[];
  }> {
    const response = await page.goto(page.url());
    const headers = response?.headers() || {};
    const issues: SecurityIssue[] = [];

    // Check for Content Security Policy
    if (!headers['content-security-policy']) {
      issues.push({
        type: 'header',
        severity: 'high',
        description: 'Missing Content-Security-Policy header'
      });
    } else {
      // Validate CSP directives
      const csp = headers['content-security-policy'];
      if (!csp.includes("default-src 'self'")) {
        issues.push({
          type: 'header',
          severity: 'medium',
          description: 'CSP should include restrictive default-src directive'
        });
      }
    }

    // Check for X-Frame-Options
    if (!headers['x-frame-options']) {
      issues.push({
        type: 'header',
        severity: 'medium',
        description: 'Missing X-Frame-Options header'
      });
    }

    // Check for X-Content-Type-Options
    if (!headers['x-content-type-options']) {
      issues.push({
        type: 'header',
        severity: 'medium',
        description: 'Missing X-Content-Type-Options header'
      });
    }

    // Check for Strict-Transport-Security
    if (!headers['strict-transport-security']) {
      issues.push({
        type: 'header',
        severity: 'medium',
        description: 'Missing Strict-Transport-Security header'
      });
    }

    return { headers, issues };
  }

  /**
   * Test XSS protection
   */
  static async testXSSProtection(
    page: Page,
    inputSelector: string,
    outputSelector: string
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    const xssPayloads = [
      {
        payload: '<script>alert("XSS")</script>',
        check: 'script execution'
      },
      {
        payload: '<img src=x onerror=alert(1)>',
        check: 'event handler execution'
      },
      {
        payload: '<svg onload=alert(1)>',
        check: 'SVG event execution'
      },
      {
        payload: 'javascript:alert(1)',
        check: 'javascript URL execution'
      }
    ];

    for (const { payload, check } of xssPayloads) {
      // Input the payload
      await page.fill(inputSelector, payload);
      await page.keyboard.press('Enter');
      
      // Wait for potential XSS execution
      let xssExecuted = false;
      page.on('dialog', async dialog => {
        xssExecuted = true;
        await dialog.dismiss();
      });
      
      await page.waitForTimeout(1000);
      
      if (xssExecuted) {
        issues.push({
          type: 'xss',
          severity: 'critical',
          description: `XSS vulnerability: ${check}`,
          evidence: payload
        });
      }
      
      // Check if output is properly sanitized
      const outputText = await page.textContent(outputSelector);
      if (outputText?.includes('<script>') || outputText?.includes('onerror=')) {
        issues.push({
          type: 'sanitization',
          severity: 'high',
          description: 'Output not properly sanitized',
          evidence: outputText
        });
      }
    }

    return issues;
  }

  /**
   * Test SQL injection protection
   */
  static async testSQLInjectionProtection(
    page: Page,
    inputSelector: string
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM passwords --"
    ];

    for (const payload of sqlPayloads) {
      await page.fill(inputSelector, payload);
      await page.keyboard.press('Enter');
      
      // Check for SQL error messages
      const pageContent = await page.content();
      const sqlErrorPatterns = [
        /SQL syntax/i,
        /mysql_/i,
        /ORA-\d+/,
        /PostgreSQL/i,
        /SQLite/i
      ];
      
      for (const pattern of sqlErrorPatterns) {
        if (pattern.test(pageContent)) {
          issues.push({
            type: 'injection',
            severity: 'critical',
            description: 'SQL error exposed in response',
            evidence: payload
          });
          break;
        }
      }
    }

    return issues;
  }

  /**
   * Validate error messages don't expose sensitive info
   */
  static async validateErrorMessages(
    page: Page,
    errorSelector: string
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    const errorText = await page.textContent(errorSelector);
    if (!errorText) return issues;
    
    // Check for technical details
    const technicalPatterns = [
      /stack trace/i,
      /at \w+\.\w+/,  // Stack trace pattern
      /\/[a-zA-Z0-9_\/]+\.(js|ts|py|java)/,  // File paths
      /line \d+/i,
      /column \d+/i,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,  // IP addresses
      /password/i,
      /token/i,
      /api[_\s]?key/i
    ];
    
    for (const pattern of technicalPatterns) {
      if (pattern.test(errorText)) {
        issues.push({
          type: 'sanitization',
          severity: 'medium',
          description: 'Error message exposes technical details',
          evidence: errorText.substring(0, 100)
        });
        break;
      }
    }
    
    // Check if error is user-friendly
    if (errorText.length > 200) {
      issues.push({
        type: 'sanitization',
        severity: 'low',
        description: 'Error message too verbose',
        evidence: errorText.substring(0, 100) + '...'
      });
    }
    
    return issues;
  }

  /**
   * Test Content Security Policy effectiveness
   */
  static async testCSPEffectiveness(page: Page): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    // Try to inject inline script
    const inlineScriptResult = await page.evaluate(() => {
      try {
        const script = document.createElement('script');
        script.textContent = 'window.cspTestPassed = true;';
        document.head.appendChild(script);
        return (window as any).cspTestPassed === true;
      } catch (e) {
        return false;
      }
    });
    
    if (inlineScriptResult) {
      issues.push({
        type: 'header',
        severity: 'high',
        description: 'CSP allows unsafe inline scripts'
      });
    }
    
    // Try to inject inline styles
    const inlineStyleResult = await page.evaluate(() => {
      try {
        const style = document.createElement('style');
        style.textContent = 'body { background: red !important; }';
        document.head.appendChild(style);
        return getComputedStyle(document.body).backgroundColor === 'red';
      } catch (e) {
        return false;
      }
    });
    
    if (inlineStyleResult) {
      issues.push({
        type: 'header',
        severity: 'low',
        description: 'CSP allows unsafe inline styles'
      });
    }
    
    return issues;
  }

  /**
   * Run comprehensive security validation
   */
  static async runFullSecurityValidation(
    page: Page,
    inputSelector: string,
    outputSelector: string,
    errorSelector: string
  ): Promise<SecurityValidationResult> {
    const allIssues: SecurityIssue[] = [];
    
    // Validate headers
    const { headers, issues: headerIssues } = await this.validateSecurityHeaders(page);
    allIssues.push(...headerIssues);
    
    // Test XSS protection
    const xssIssues = await this.testXSSProtection(page, inputSelector, outputSelector);
    allIssues.push(...xssIssues);
    
    // Test SQL injection protection
    const sqlIssues = await this.testSQLInjectionProtection(page, inputSelector);
    allIssues.push(...sqlIssues);
    
    // Test CSP effectiveness
    const cspIssues = await this.testCSPEffectiveness(page);
    allIssues.push(...cspIssues);
    
    // Validate error messages
    const errorIssues = await this.validateErrorMessages(page, errorSelector);
    allIssues.push(...errorIssues);
    
    return {
      passed: allIssues.filter(i => i.severity === 'critical').length === 0,
      issues: allIssues,
      headers,
      sanitizationWorking: !xssIssues.some(i => i.type === 'sanitization')
    };
  }

  /**
   * Generate security report
   */
  static generateReport(result: SecurityValidationResult): string {
    const criticalCount = result.issues.filter(i => i.severity === 'critical').length;
    const highCount = result.issues.filter(i => i.severity === 'high').length;
    const mediumCount = result.issues.filter(i => i.severity === 'medium').length;
    const lowCount = result.issues.filter(i => i.severity === 'low').length;
    
    let report = `
Security Validation Report
=========================

Overall Status: ${result.passed ? 'PASSED' : 'FAILED'}
Sanitization: ${result.sanitizationWorking ? 'Working' : 'Issues Found'}

Issue Summary:
- Critical: ${criticalCount}
- High: ${highCount}
- Medium: ${mediumCount}
- Low: ${lowCount}

Security Headers Present:
${Object.entries(result.headers)
  .filter(([key]) => key.toLowerCase().includes('security') || 
                     key.toLowerCase().includes('content-security') ||
                     key.toLowerCase().includes('x-'))
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Issues Found:
${result.issues.map(issue => 
  `\n[${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}` +
  (issue.evidence ? `\n  Evidence: ${issue.evidence}` : '')
).join('\n')}
    `.trim();
    
    return report;
  }
}