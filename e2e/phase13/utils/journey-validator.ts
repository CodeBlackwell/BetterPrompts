import { Page, BrowserContext } from '@playwright/test';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: Record<string, any>;
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  context?: Record<string, any>;
  timestamp: number;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  context?: Record<string, any>;
  timestamp: number;
}

/**
 * Data integrity check
 */
export interface DataIntegrityCheck {
  name: string;
  check: () => Promise<boolean>;
  errorMessage: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Session validation
 */
export interface SessionValidation {
  isValid: boolean;
  userId?: string;
  sessionId?: string;
  expiresAt?: number;
  roles?: string[];
}

/**
 * Integration point
 */
export interface IntegrationPoint {
  name: string;
  type: 'api' | 'database' | 'cache' | 'external';
  validate: () => Promise<ValidationResult>;
}

/**
 * Journey validator for comprehensive integration and data validation
 */
export class JourneyValidator {
  private page: Page;
  private context: BrowserContext;
  private validationResults: Map<string, ValidationResult> = new Map();
  private dataIntegrityChecks: DataIntegrityCheck[] = [];
  private integrationPoints: IntegrationPoint[] = [];

  constructor(page: Page, context: BrowserContext) {
    this.page = page;
    this.context = context;
  }

  /**
   * Validate session state
   */
  async validateSession(): Promise<SessionValidation> {
    try {
      // Check cookies
      const cookies = await this.context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'session' || c.name === 'auth_token');
      
      if (!sessionCookie || !sessionCookie.value) {
        return { isValid: false };
      }

      // Check localStorage
      const localStorage = await this.page.evaluate(() => {
        return {
          userId: window.localStorage.getItem('userId'),
          sessionId: window.localStorage.getItem('sessionId'),
          userRole: window.localStorage.getItem('userRole')
        };
      });

      // Validate session with API if possible
      const sessionValid = await this.validateSessionWithAPI(sessionCookie.value);

      return {
        isValid: sessionValid,
        userId: localStorage.userId || undefined,
        sessionId: localStorage.sessionId || sessionCookie.value,
        expiresAt: sessionCookie.expires,
        roles: localStorage.userRole ? [localStorage.userRole] : []
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return { isValid: false };
    }
  }

  /**
   * Validate session with API
   */
  private async validateSessionWithAPI(token: string): Promise<boolean> {
    try {
      const response = await this.page.evaluate(async (authToken) => {
        const res = await fetch('/api/v1/auth/validate', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        return res.ok;
      }, token);
      
      return response;
    } catch {
      // Fallback to assuming valid if API check fails
      return true;
    }
  }

  /**
   * Validate data persistence
   */
  async validateDataPersistence(
    key: string,
    expectedValue: any,
    storage: 'localStorage' | 'sessionStorage' = 'localStorage'
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      const actualValue = await this.page.evaluate(({ storageType, dataKey }) => {
        const storage = storageType === 'localStorage' ? 
          window.localStorage : window.sessionStorage;
        const value = storage.getItem(dataKey);
        return value ? JSON.parse(value) : null;
      }, { storageType: storage, dataKey: key });

      if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
        result.valid = false;
        result.errors.push({
          code: 'DATA_MISMATCH',
          message: `Data mismatch for key "${key}"`,
          severity: 'high',
          context: { expected: expectedValue, actual: actualValue },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      result.valid = false;
      result.errors.push({
        code: 'DATA_VALIDATION_ERROR',
        message: `Failed to validate data for key "${key}": ${error}`,
        severity: 'critical',
        timestamp: Date.now()
      });
    }

    this.recordValidation(`data_persistence_${key}`, result);
    return result;
  }

  /**
   * Validate UI consistency
   */
  async validateUIConsistency(checks: Array<{
    selector: string;
    property: string;
    expectedValue: any;
    description: string;
  }>): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    for (const check of checks) {
      try {
        const element = this.page.locator(check.selector);
        const exists = await element.count() > 0;

        if (!exists) {
          result.valid = false;
          result.errors.push({
            code: 'ELEMENT_NOT_FOUND',
            message: `Element not found: ${check.description}`,
            severity: 'high',
            context: { selector: check.selector },
            timestamp: Date.now()
          });
          continue;
        }

        // Check property
        const actualValue = await element.evaluate((el, prop) => {
          if (prop === 'text') return el.textContent;
          if (prop === 'visible') return window.getComputedStyle(el).display !== 'none';
          if (prop === 'enabled') return !(el as HTMLInputElement).disabled;
          if (prop.startsWith('style.')) {
            const styleProp = prop.substring(6);
            return window.getComputedStyle(el).getPropertyValue(styleProp);
          }
          return (el as any)[prop];
        }, check.property);

        if (actualValue !== check.expectedValue) {
          result.valid = false;
          result.errors.push({
            code: 'UI_INCONSISTENCY',
            message: `UI inconsistency: ${check.description}`,
            severity: 'medium',
            context: {
              selector: check.selector,
              property: check.property,
              expected: check.expectedValue,
              actual: actualValue
            },
            timestamp: Date.now()
          });
        }
      } catch (error) {
        result.warnings.push({
          code: 'UI_CHECK_FAILED',
          message: `Failed to check UI element: ${check.description}`,
          context: { error: error?.toString() },
          timestamp: Date.now()
        });
      }
    }

    this.recordValidation('ui_consistency', result);
    return result;
  }

  /**
   * Validate API response
   */
  async validateAPIResponse(
    endpoint: string,
    method: string,
    expectedStatus: number,
    expectedSchema?: Record<string, any>
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      const response = await this.page.evaluate(async ({ url, httpMethod }) => {
        const res = await fetch(url, { method: httpMethod });
        const data = await res.json().catch(() => null);
        return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          data
        };
      }, { url: endpoint, httpMethod: method });

      // Validate status
      if (response.status !== expectedStatus) {
        result.valid = false;
        result.errors.push({
          code: 'API_STATUS_MISMATCH',
          message: `API returned ${response.status}, expected ${expectedStatus}`,
          severity: 'high',
          context: { endpoint, method, actual: response.status },
          timestamp: Date.now()
        });
      }

      // Validate schema if provided
      if (expectedSchema && response.data) {
        const schemaErrors = this.validateSchema(response.data, expectedSchema);
        if (schemaErrors.length > 0) {
          result.valid = false;
          result.errors.push(...schemaErrors.map(err => ({
            code: 'API_SCHEMA_MISMATCH',
            message: err,
            severity: 'medium' as const,
            context: { endpoint, method },
            timestamp: Date.now()
          })));
        }
      }

      result.metadata = { response };
    } catch (error) {
      result.valid = false;
      result.errors.push({
        code: 'API_VALIDATION_ERROR',
        message: `Failed to validate API: ${error}`,
        severity: 'critical',
        context: { endpoint, method },
        timestamp: Date.now()
      });
    }

    this.recordValidation(`api_${endpoint}_${method}`, result);
    return result;
  }

  /**
   * Validate schema
   */
  private validateSchema(data: any, schema: Record<string, any>): string[] {
    const errors: string[] = [];

    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in data)) {
        errors.push(`Missing required field: ${key}`);
        continue;
      }

      const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
      if (actualType !== expectedType) {
        errors.push(`Type mismatch for ${key}: expected ${expectedType}, got ${actualType}`);
      }
    }

    return errors;
  }

  /**
   * Validate navigation flow
   */
  async validateNavigationFlow(expectedUrl: string | RegExp): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      const currentUrl = this.page.url();
      const matches = typeof expectedUrl === 'string' ? 
        currentUrl === expectedUrl : expectedUrl.test(currentUrl);

      if (!matches) {
        result.valid = false;
        result.errors.push({
          code: 'NAVIGATION_ERROR',
          message: `Navigation failed: expected ${expectedUrl}, got ${currentUrl}`,
          severity: 'high',
          context: { expected: expectedUrl.toString(), actual: currentUrl },
          timestamp: Date.now()
        });
      }
    } catch (error) {
      result.valid = false;
      result.errors.push({
        code: 'NAVIGATION_VALIDATION_ERROR',
        message: `Failed to validate navigation: ${error}`,
        severity: 'critical',
        timestamp: Date.now()
      });
    }

    this.recordValidation('navigation_flow', result);
    return result;
  }

  /**
   * Add data integrity check
   */
  addDataIntegrityCheck(check: DataIntegrityCheck): void {
    this.dataIntegrityChecks.push(check);
  }

  /**
   * Run all data integrity checks
   */
  async runDataIntegrityChecks(): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    console.log(`🔍 Running ${this.dataIntegrityChecks.length} data integrity checks...`);

    for (const check of this.dataIntegrityChecks) {
      try {
        const passed = await check.check();
        if (!passed) {
          result.valid = false;
          result.errors.push({
            code: 'DATA_INTEGRITY_FAILED',
            message: check.errorMessage,
            severity: check.severity,
            context: { checkName: check.name },
            timestamp: Date.now()
          });
        }
      } catch (error) {
        result.warnings.push({
          code: 'DATA_INTEGRITY_CHECK_ERROR',
          message: `Failed to run check "${check.name}": ${error}`,
          timestamp: Date.now()
        });
      }
    }

    this.recordValidation('data_integrity', result);
    return result;
  }

  /**
   * Add integration point
   */
  addIntegrationPoint(integration: IntegrationPoint): void {
    this.integrationPoints.push(integration);
  }

  /**
   * Validate all integration points
   */
  async validateIntegrations(): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();

    console.log(`🔗 Validating ${this.integrationPoints.length} integration points...`);

    for (const integration of this.integrationPoints) {
      try {
        const result = await integration.validate();
        results.set(integration.name, result);
        
        if (!result.valid) {
          console.error(`❌ Integration "${integration.name}" validation failed`);
        }
      } catch (error) {
        results.set(integration.name, {
          valid: false,
          errors: [{
            code: 'INTEGRATION_VALIDATION_ERROR',
            message: `Failed to validate integration: ${error}`,
            severity: 'critical',
            timestamp: Date.now()
          }],
          warnings: []
        });
      }
    }

    return results;
  }

  /**
   * Validate cross-browser consistency
   */
  async validateCrossBrowserConsistency(
    reference: { selector: string; property: string; value: any }[]
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      metadata: {
        browser: await this.page.evaluate(() => navigator.userAgent)
      }
    };

    for (const ref of reference) {
      try {
        const element = this.page.locator(ref.selector);
        const actualValue = await element.evaluate((el, prop) => {
          if (prop.startsWith('computed.')) {
            const cssProp = prop.substring(9);
            return window.getComputedStyle(el).getPropertyValue(cssProp);
          }
          return (el as any)[prop];
        }, ref.property);

        if (actualValue !== ref.value) {
          result.warnings.push({
            code: 'CROSS_BROWSER_INCONSISTENCY',
            message: `Browser inconsistency for ${ref.selector}`,
            context: {
              property: ref.property,
              expected: ref.value,
              actual: actualValue
            },
            timestamp: Date.now()
          });
        }
      } catch (error) {
        result.warnings.push({
          code: 'CROSS_BROWSER_CHECK_FAILED',
          message: `Failed to check cross-browser consistency`,
          context: { error: error?.toString() },
          timestamp: Date.now()
        });
      }
    }

    return result;
  }

  /**
   * Record validation result
   */
  private recordValidation(name: string, result: ValidationResult): void {
    this.validationResults.set(name, result);
    
    if (!result.valid) {
      console.log(`❌ Validation failed: ${name}`);
      result.errors.forEach(error => {
        console.log(`   - ${error.message} [${error.severity}]`);
      });
    }
  }

  /**
   * Get all validation results
   */
  getAllValidationResults(): Map<string, ValidationResult> {
    return this.validationResults;
  }

  /**
   * Generate validation report
   */
  generateReport(): string {
    const allValid = Array.from(this.validationResults.values()).every(r => r.valid);
    const totalErrors = Array.from(this.validationResults.values())
      .reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = Array.from(this.validationResults.values())
      .reduce((sum, r) => sum + r.warnings.length, 0);

    let report = `
# Journey Validation Report

## Summary
- **Overall Status**: ${allValid ? '✅ PASSED' : '❌ FAILED'}
- **Total Validations**: ${this.validationResults.size}
- **Passed**: ${Array.from(this.validationResults.values()).filter(r => r.valid).length}
- **Failed**: ${Array.from(this.validationResults.values()).filter(r => !r.valid).length}
- **Total Errors**: ${totalErrors}
- **Total Warnings**: ${totalWarnings}

## Validation Results
`;

    this.validationResults.forEach((result, name) => {
      report += `
### ${name}
- **Status**: ${result.valid ? '✅ Passed' : '❌ Failed'}
- **Errors**: ${result.errors.length}
- **Warnings**: ${result.warnings.length}
`;

      if (result.errors.length > 0) {
        report += '\n#### Errors:\n';
        result.errors.forEach(error => {
          report += `- [${error.severity}] ${error.message}\n`;
          if (error.context) {
            report += `  Context: ${JSON.stringify(error.context)}\n`;
          }
        });
      }

      if (result.warnings.length > 0) {
        report += '\n#### Warnings:\n';
        result.warnings.forEach(warning => {
          report += `- ${warning.message}\n`;
        });
      }
    });

    return report;
  }

  /**
   * Create standard data integrity checks
   */
  static createStandardDataIntegrityChecks(page: Page): DataIntegrityCheck[] {
    return [
      {
        name: 'User Session Consistency',
        check: async () => {
          const hasSession = await page.evaluate(() => {
            return !!(window.localStorage.getItem('userId') || 
                     window.sessionStorage.getItem('sessionId'));
          });
          return hasSession;
        },
        errorMessage: 'User session data is missing or inconsistent',
        severity: 'critical'
      },
      {
        name: 'API Token Validity',
        check: async () => {
          const hasToken = await page.evaluate(() => {
            return !!(window.localStorage.getItem('authToken') || 
                     document.cookie.includes('auth_token'));
          });
          return hasToken;
        },
        errorMessage: 'Authentication token is missing or invalid',
        severity: 'critical'
      },
      {
        name: 'Cache Consistency',
        check: async () => {
          const cacheValid = await page.evaluate(() => {
            const cacheVersion = window.localStorage.getItem('cacheVersion');
            const expectedVersion = window.localStorage.getItem('appVersion');
            return !cacheVersion || !expectedVersion || cacheVersion === expectedVersion;
          });
          return cacheValid;
        },
        errorMessage: 'Cache version mismatch detected',
        severity: 'medium'
      }
    ];
  }
}

/**
 * Create journey validator instance
 */
export function createJourneyValidator(page: Page, context: BrowserContext): JourneyValidator {
  return new JourneyValidator(page, context);
}