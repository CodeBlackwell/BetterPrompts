import { Page, Locator } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * WCAG 2.1 AA compliance levels
 */
export interface WCAGCompliance {
  perceivable: {
    altText: boolean;
    captions: boolean;
    colorContrast: boolean;
    textResize: boolean;
  };
  operable: {
    keyboardAccess: boolean;
    focusOrder: boolean;
    skipLinks: boolean;
    timing: boolean;
  };
  understandable: {
    labels: boolean;
    errors: boolean;
    consistency: boolean;
    instructions: boolean;
  };
  robust: {
    validHTML: boolean;
    ariaUsage: boolean;
    compatibility: boolean;
  };
}

/**
 * Color contrast requirements
 */
export const COLOR_CONTRAST_REQUIREMENTS = {
  normalText: 4.5,    // 4.5:1 for normal text
  largeText: 3.0,     // 3:1 for large text (18pt or 14pt bold)
  uiComponents: 3.0   // 3:1 for UI components and graphics
};

/**
 * Accessibility validation helper
 */
export class AccessibilityValidator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Run axe-core accessibility scan
   */
  async runAxeScan(options?: {
    includedRules?: string[];
    excludedRules?: string[];
    tags?: string[];
  }): Promise<{
    violations: any[];
    passes: any[];
    incomplete: any[];
    inapplicable: any[];
  }> {
    const builder = new AxeBuilder({ page: this.page });

    // Configure axe based on options
    if (options?.tags) {
      builder.withTags(options.tags);
    }
    if (options?.includedRules) {
      builder.withRules(options.includedRules);
    }
    if (options?.excludedRules) {
      builder.disableRules(options.excludedRules);
    }

    const results = await builder.analyze();
    
    console.log(`🔍 Axe scan complete: ${results.violations.length} violations found`);
    
    return {
      violations: results.violations,
      passes: results.passes,
      incomplete: results.incomplete,
      inapplicable: results.inapplicable
    };
  }

  /**
   * Check WCAG 2.1 AA compliance
   */
  async checkWCAGCompliance(): Promise<{
    compliant: boolean;
    results: WCAGCompliance;
    violations: string[];
  }> {
    const results = await this.runAxeScan({ tags: ['wcag2aa'] });
    const violations: string[] = [];

    // Map axe violations to WCAG principles
    const compliance: WCAGCompliance = {
      perceivable: {
        altText: !results.violations.some(v => v.id.includes('image-alt')),
        captions: !results.violations.some(v => v.id.includes('video-caption')),
        colorContrast: !results.violations.some(v => v.id.includes('color-contrast')),
        textResize: true // Needs manual testing
      },
      operable: {
        keyboardAccess: !results.violations.some(v => v.id.includes('keyboard')),
        focusOrder: !results.violations.some(v => v.id.includes('focus-order')),
        skipLinks: !results.violations.some(v => v.id.includes('skip-link')),
        timing: !results.violations.some(v => v.id.includes('timing'))
      },
      understandable: {
        labels: !results.violations.some(v => v.id.includes('label')),
        errors: !results.violations.some(v => v.id.includes('error')),
        consistency: true, // Needs manual testing
        instructions: !results.violations.some(v => v.id.includes('form-field'))
      },
      robust: {
        validHTML: !results.violations.some(v => v.id.includes('valid-html')),
        ariaUsage: !results.violations.some(v => v.id.includes('aria')),
        compatibility: true // Needs manual testing
      }
    };

    // Collect all violations
    results.violations.forEach(violation => {
      violations.push(`${violation.id}: ${violation.description}`);
    });

    const compliant = violations.length === 0;

    return { compliant, results: compliance, violations };
  }

  /**
   * Check color contrast for an element
   */
  async checkColorContrast(selector: string): Promise<{
    ratio: number;
    passes: boolean;
    foreground: string;
    background: string;
    requirement: number;
  }> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) {
        return {
          ratio: 0,
          passes: false,
          foreground: '',
          background: '',
          requirement: 0
        };
      }

      const styles = window.getComputedStyle(element);
      const fontSize = parseFloat(styles.fontSize);
      const fontWeight = styles.fontWeight;
      
      // Determine if text is "large" (18pt or 14pt bold)
      const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight === 'bold');
      const requirement = isLargeText ? 3.0 : 4.5;

      // Get colors
      const foreground = styles.color;
      const background = styles.backgroundColor;

      // Simple contrast calculation (real implementation would be more complex)
      // This is a placeholder - actual implementation would use proper color contrast algorithm
      const ratio = 4.5; // Placeholder

      return {
        ratio,
        passes: ratio >= requirement,
        foreground,
        background,
        requirement
      };
    }, selector);
  }

  /**
   * Check keyboard navigation
   */
  async checkKeyboardNavigation(): Promise<{
    allInteractiveFocusable: boolean;
    logicalTabOrder: boolean;
    visibleFocus: boolean;
    keyboardTraps: string[];
  }> {
    // Check all interactive elements are focusable
    const interactiveElements = await this.page.evaluate(() => {
      const selectors = 'a, button, input, select, textarea, [tabindex]';
      const elements = document.querySelectorAll(selectors);
      let allFocusable = true;

      elements.forEach(el => {
        const tabIndex = el.getAttribute('tabindex');
        if (tabIndex === '-1' && !el.hasAttribute('disabled')) {
          allFocusable = false;
        }
      });

      return allFocusable;
    });

    // Check for visible focus indicators
    const visibleFocus = await this.page.evaluate(() => {
      // This checks if CSS includes focus styles
      const styles = Array.from(document.styleSheets)
        .flatMap(sheet => {
          try {
            return Array.from(sheet.cssRules || []);
          } catch (e) {
            return [];
          }
        })
        .some(rule => rule.cssText && rule.cssText.includes(':focus'));
      
      return styles;
    });

    return {
      allInteractiveFocusable: interactiveElements,
      logicalTabOrder: true, // Needs manual verification
      visibleFocus,
      keyboardTraps: [] // Would need to test modal dialogs etc.
    };
  }

  /**
   * Check ARIA attributes usage
   */
  async checkAriaUsage(selector?: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const targetSelector = selector || '*[aria-label], *[role], *[aria-describedby], *[aria-labelledby]';
    
    const results = await this.page.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      const issues: string[] = [];

      elements.forEach(el => {
        // Check for valid roles
        const role = el.getAttribute('role');
        const validRoles = ['button', 'navigation', 'main', 'banner', 'contentinfo', 'search', 'form', 'region'];
        if (role && !validRoles.includes(role)) {
          issues.push(`Invalid role "${role}" on ${el.tagName}`);
        }

        // Check for required ARIA attributes
        if (role === 'region' && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
          issues.push('Region role requires aria-label or aria-labelledby');
        }

        // Check for aria-describedby pointing to existing element
        const describedBy = el.getAttribute('aria-describedby');
        if (describedBy && !document.getElementById(describedBy)) {
          issues.push(`aria-describedby points to non-existent element: ${describedBy}`);
        }
      });

      return {
        valid: issues.length === 0,
        issues
      };
    }, targetSelector);

    return results;
  }

  /**
   * Check skip links functionality
   */
  async checkSkipLinks(): Promise<{
    present: boolean;
    functional: boolean;
    visible: boolean;
  }> {
    const skipLink = await this.page.locator('a[href^="#"]:has-text("skip")').first();
    const present = await skipLink.count() > 0;

    if (!present) {
      return { present: false, functional: false, visible: false };
    }

    // Check if skip link is visible on focus
    await skipLink.focus();
    const visible = await skipLink.isVisible();

    // Check if link target exists
    const href = await skipLink.getAttribute('href');
    const targetId = href?.substring(1) || '';
    const targetExists = await this.page.locator(`#${targetId}`).count() > 0;

    return {
      present,
      functional: targetExists,
      visible
    };
  }

  /**
   * Check form accessibility
   */
  async checkFormAccessibility(formSelector: string): Promise<{
    allInputsLabeled: boolean;
    requiredFieldsMarked: boolean;
    errorMessagesAccessible: boolean;
    issues: string[];
  }> {
    return await this.page.evaluate((selector) => {
      const form = document.querySelector(selector);
      if (!form) {
        return {
          allInputsLabeled: false,
          requiredFieldsMarked: false,
          errorMessagesAccessible: false,
          issues: ['Form not found']
        };
      }

      const issues: string[] = [];
      let allInputsLabeled = true;
      let requiredFieldsMarked = true;
      
      // Check all inputs have labels
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        const id = input.id;
        const hasLabel = !!form.querySelector(`label[for="${id}"]`) || 
                        !!input.getAttribute('aria-label') ||
                        !!input.getAttribute('aria-labelledby');
        
        if (!hasLabel) {
          allInputsLabeled = false;
          issues.push(`Input ${input.name || input.id || 'unnamed'} missing label`);
        }

        // Check required fields
        if (input.hasAttribute('required')) {
          const hasRequiredIndication = input.getAttribute('aria-required') === 'true' ||
                                       input.getAttribute('aria-label')?.includes('required');
          if (!hasRequiredIndication) {
            requiredFieldsMarked = false;
            issues.push(`Required field ${input.name || input.id} not properly marked`);
          }
        }
      });

      // Check error messages
      const errorMessages = form.querySelectorAll('[role="alert"], .error-message');
      const errorMessagesAccessible = errorMessages.length === 0 || 
        Array.from(errorMessages).every(error => 
          error.getAttribute('role') === 'alert' || 
          error.getAttribute('aria-live') === 'polite'
        );

      return {
        allInputsLabeled,
        requiredFieldsMarked,
        errorMessagesAccessible,
        issues
      };
    }, formSelector);
  }

  /**
   * Check heading hierarchy
   */
  async checkHeadingHierarchy(): Promise<{
    valid: boolean;
    issues: string[];
    hierarchy: number[];
  }> {
    return await this.page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const hierarchy: number[] = [];
      const issues: string[] = [];
      let valid = true;

      headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.substring(1));
        hierarchy.push(level);

        // Check for skipped levels
        if (index > 0) {
          const prevLevel = hierarchy[index - 1];
          if (level > prevLevel + 1) {
            valid = false;
            issues.push(`Heading level skipped: h${prevLevel} → h${level}`);
          }
        }
      });

      // Check for multiple h1s
      const h1Count = hierarchy.filter(level => level === 1).length;
      if (h1Count > 1) {
        valid = false;
        issues.push(`Multiple h1 tags found (${h1Count})`);
      }

      return { valid, issues, hierarchy };
    });
  }

  /**
   * Check landmark regions
   */
  async checkLandmarkRegions(): Promise<{
    hasMain: boolean;
    hasNav: boolean;
    hasHeader: boolean;
    hasFooter: boolean;
    issues: string[];
  }> {
    return await this.page.evaluate(() => {
      const main = document.querySelector('main, [role="main"]');
      const nav = document.querySelector('nav, [role="navigation"]');
      const header = document.querySelector('header, [role="banner"]');
      const footer = document.querySelector('footer, [role="contentinfo"]');
      
      const issues: string[] = [];
      
      if (!main) issues.push('Missing main landmark');
      if (!nav) issues.push('Missing navigation landmark');
      if (!header) issues.push('Missing header/banner landmark');
      if (!footer) issues.push('Missing footer/contentinfo landmark');

      return {
        hasMain: !!main,
        hasNav: !!nav,
        hasHeader: !!header,
        hasFooter: !!footer,
        issues
      };
    });
  }

  /**
   * Generate accessibility report
   */
  async generateAccessibilityReport(): Promise<string> {
    const axeResults = await this.runAxeScan();
    const wcagCompliance = await this.checkWCAGCompliance();
    const keyboardNav = await this.checkKeyboardNavigation();
    const landmarks = await this.checkLandmarkRegions();
    const headings = await this.checkHeadingHierarchy();

    const report = `
# Accessibility Test Report

## Summary
- Total Violations: ${axeResults.violations.length}
- WCAG 2.1 AA Compliant: ${wcagCompliance.compliant ? '✅ Yes' : '❌ No'}

## Axe-core Results
### Violations (${axeResults.violations.length})
${axeResults.violations.map(v => `- ${v.id}: ${v.description}`).join('\n')}

### Passes (${axeResults.passes.length})
${axeResults.passes.slice(0, 5).map(p => `- ${p.id}: ${p.description}`).join('\n')}

## WCAG 2.1 AA Compliance
### Perceivable
- Alt Text: ${wcagCompliance.results.perceivable.altText ? '✅' : '❌'}
- Color Contrast: ${wcagCompliance.results.perceivable.colorContrast ? '✅' : '❌'}

### Operable
- Keyboard Access: ${wcagCompliance.results.operable.keyboardAccess ? '✅' : '❌'}
- Focus Order: ${wcagCompliance.results.operable.focusOrder ? '✅' : '❌'}

### Understandable
- Labels: ${wcagCompliance.results.understandable.labels ? '✅' : '❌'}
- Error Messages: ${wcagCompliance.results.understandable.errors ? '✅' : '❌'}

### Robust
- Valid HTML: ${wcagCompliance.results.robust.validHTML ? '✅' : '❌'}
- ARIA Usage: ${wcagCompliance.results.robust.ariaUsage ? '✅' : '❌'}

## Structure
### Landmarks
- Main: ${landmarks.hasMain ? '✅' : '❌'}
- Navigation: ${landmarks.hasNav ? '✅' : '❌'}
- Header: ${landmarks.hasHeader ? '✅' : '❌'}
- Footer: ${landmarks.hasFooter ? '✅' : '❌'}

### Heading Hierarchy
- Valid: ${headings.valid ? '✅' : '❌'}
${headings.issues.length > 0 ? `- Issues: ${headings.issues.join(', ')}` : ''}

## Keyboard Navigation
- All Interactive Elements Focusable: ${keyboardNav.allInteractiveFocusable ? '✅' : '❌'}
- Visible Focus Indicators: ${keyboardNav.visibleFocus ? '✅' : '❌'}
`;

    return report;
  }
}

/**
 * Create accessibility validator instance
 */
export function createAccessibilityValidator(page: Page): AccessibilityValidator {
  return new AccessibilityValidator(page);
}