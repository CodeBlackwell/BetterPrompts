/**
 * Phase 9 Test Configuration
 * Input Validation & Edge Cases
 */

export const phase9Config = {
  phase: {
    number: 9,
    name: 'Input Validation & Edge Cases',
    duration: '3 days',
    complexity: 'medium',
    status: 'READY'
  },
  
  stories: [
    {
      id: 'EC-01',
      name: 'Character Limit Enforcement',
      priority: 'high',
      tests: ['exactly_2000', 'under_limit', 'over_limit', 'unicode_counting']
    },
    {
      id: 'EC-02', 
      name: 'Special Characters & Emojis',
      priority: 'high',
      tests: ['punctuation', 'mathematical', 'currency', 'emojis', 'zero_width']
    },
    {
      id: 'EC-03',
      name: 'Multilingual Support',
      priority: 'medium',
      tests: ['utf8', 'rtl_languages', 'mixed_scripts', 'unicode_normalization']
    },
    {
      id: 'EC-04',
      name: 'Empty & Whitespace',
      priority: 'medium',
      tests: ['empty', 'spaces_only', 'mixed_whitespace', 'trimming']
    },
    {
      id: 'EC-05',
      name: 'Security Injection',
      priority: 'critical',
      tests: ['xss', 'sql_injection', 'path_traversal', 'command_injection']
    }
  ],
  
  testSettings: {
    baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3000',
    timeout: {
      input: 5000,
      response: 10000,
      security: 15000
    },
    retries: 2,
    parallel: false, // Security tests should run sequentially
    
    selectors: {
      promptInput: 'textarea[placeholder*="prompt"], textarea[name="prompt"], #prompt-input',
      submitButton: 'button[type="submit"], button:has-text("Enhance"), button:has-text("Submit")',
      output: '.enhanced-prompt, .output, [data-testid="enhanced-prompt"]',
      error: '.error-message, .alert-error, [role="alert"]',
      charCount: '.char-count, .character-count, [data-testid="char-count"]'
    }
  },
  
  validation: {
    characterLimit: 2000,
    minLength: 1,
    allowedCharsets: ['unicode', 'emoji', 'mathematical', 'currency'],
    blockedPatterns: ['control_chars', 'null_bytes'],
    
    security: {
      enableXSSProtection: true,
      enableSQLProtection: true,
      enablePathTraversal: true,
      enableCommandInjection: true,
      sanitizationLevel: 'strict'
    },
    
    errorMessages: {
      EMPTY_INPUT: 'Please enter some text. Your prompt cannot be empty.',
      CHARACTER_LIMIT_EXCEEDED: 'Your input is too long. Please keep it under 2000 characters.',
      INVALID_CHARACTERS: 'Your input contains characters that cannot be processed.',
      SECURITY_PATTERN: 'Your input contains patterns that might be interpreted as code.'
    }
  },
  
  reporting: {
    generateSecurityReport: true,
    trackMetrics: true,
    logLevel: 'info',
    screenshots: {
      onFailure: true,
      onSecurityIssue: true
    }
  },
  
  personas: {
    primary: 'qa',
    secondary: 'security',
    collaboration: ['frontend', 'backend']
  }
};