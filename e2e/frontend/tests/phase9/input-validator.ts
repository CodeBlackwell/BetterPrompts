/**
 * Input Validator Utility for Testing
 * Phase 9: Input Validation & Edge Cases
 */

export interface ValidationResult {
  isValid: boolean;
  errorType?: string;
  errorMessage?: string;
  sanitizedInput?: string;
}

export interface ValidationOptions {
  maxLength?: number;
  allowEmpty?: boolean;
  allowSpecialChars?: boolean;
  allowControlChars?: boolean;
  sanitize?: boolean;
  trimWhitespace?: boolean;
}

export class InputValidator {
  static readonly DEFAULT_MAX_LENGTH = 5000;
  static readonly CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
  
  /**
   * Main validation function
   */
  static validate(
    input: string,
    options: ValidationOptions = {}
  ): ValidationResult {
    const {
      maxLength = this.DEFAULT_MAX_LENGTH,
      allowEmpty = false,
      allowControlChars = false,
      sanitize = true,
      trimWhitespace = true
    } = options;

    // Process input
    let processedInput = input;
    if (trimWhitespace) {
      processedInput = processedInput.trim();
    }

    // Check for empty input
    if (!allowEmpty && this.isEffectivelyEmpty(processedInput)) {
      return {
        isValid: false,
        errorType: 'EMPTY_INPUT',
        errorMessage: 'Input cannot be empty or contain only whitespace'
      };
    }

    // Check length using grapheme clusters for accurate emoji counting
    const length = this.getGraphemeLength(processedInput);
    if (length > maxLength) {
      return {
        isValid: false,
        errorType: 'CHARACTER_LIMIT_EXCEEDED',
        errorMessage: `Input exceeds maximum length of ${maxLength} characters (actual: ${length})`
      };
    }

    // Check for control characters
    if (!allowControlChars && this.hasControlCharacters(processedInput)) {
      return {
        isValid: false,
        errorType: 'INVALID_CHARACTERS',
        errorMessage: 'Input contains invalid control characters'
      };
    }

    // Sanitize if requested
    let sanitizedInput = processedInput;
    if (sanitize) {
      sanitizedInput = this.sanitizeInput(processedInput);
    }

    return {
      isValid: true,
      sanitizedInput
    };
  }

  /**
   * Check if input is effectively empty
   */
  static isEffectivelyEmpty(input: string): boolean {
    // Remove all types of whitespace including non-breaking spaces
    const cleaned = input
      .replace(/\s/g, '')
      .replace(/\u00A0/g, '') // Non-breaking space
      .replace(/\u200B/g, '') // Zero-width space
      .replace(/\u200C/g, '') // Zero-width non-joiner
      .replace(/\u200D/g, '') // Zero-width joiner
      .replace(/\uFEFF/g, ''); // Zero-width no-break space
    
    return cleaned.length === 0;
  }

  /**
   * Get accurate character count using grapheme clusters
   */
  static getGraphemeLength(input: string): number {
    // Use Intl.Segmenter if available (modern browsers/Node)
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      try {
        const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' });
        return Array.from(segmenter.segment(input)).length;
      } catch (e) {
        // Fallback if Segmenter is not supported
      }
    }
    
    // Fallback: Simple length (may miscount complex emojis)
    return Array.from(input).length;
  }

  /**
   * Check for control characters
   */
  static hasControlCharacters(input: string): boolean {
    return this.CONTROL_CHAR_REGEX.test(input);
  }

  /**
   * Sanitize input for safe display
   */
  static sanitizeInput(input: string): string {
    // HTML entity encoding
    const htmlEncoded = input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    // Remove control characters
    const noControlChars = htmlEncoded.replace(this.CONTROL_CHAR_REGEX, '');
    
    return noControlChars;
  }

  /**
   * Validate against specific security patterns
   */
  static hasSecurityPattern(input: string): {
    hasPattern: boolean;
    patterns: string[];
  } {
    const patterns: string[] = [];
    
    // XSS patterns
    if (/<script[^>]*>.*?<\/script>/gi.test(input)) {
      patterns.push('script_tag');
    }
    if (/<.*?on\w+\s*=.*?>/gi.test(input)) {
      patterns.push('event_handler');
    }
    if (/javascript:/gi.test(input)) {
      patterns.push('javascript_url');
    }
    
    // SQL injection patterns
    if (/(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|table|where)\b)/gi.test(input)) {
      patterns.push('sql_keywords');
    }
    if (/--\s*$/.test(input)) {
      patterns.push('sql_comment');
    }
    
    // Path traversal
    if (/\.\.[\\/]/.test(input)) {
      patterns.push('path_traversal');
    }
    
    // Command injection
    if (/[;&|`$]/.test(input)) {
      patterns.push('command_chars');
    }
    
    return {
      hasPattern: patterns.length > 0,
      patterns
    };
  }

  /**
   * Generate user-friendly error message
   */
  static getUserFriendlyError(errorType: string): string {
    const errorMessages: Record<string, string> = {
      EMPTY_INPUT: 'Please enter some text. Your prompt cannot be empty.',
      CHARACTER_LIMIT_EXCEEDED: 'Your input is too long. Please keep it under 5000 characters.',
      INVALID_CHARACTERS: 'Your input contains characters that cannot be processed. Please remove any special control characters.',
      SECURITY_PATTERN: 'Your input contains patterns that might be interpreted as code. Please rephrase your prompt.',
    };
    
    return errorMessages[errorType] || 'Your input could not be processed. Please try again.';
  }

  /**
   * Normalize Unicode text
   */
  static normalizeUnicode(input: string): string {
    // Normalize to NFC (Canonical Decomposition, followed by Canonical Composition)
    return input.normalize('NFC');
  }

  /**
   * Check if text has mixed directionality
   */
  static hasMixedDirection(input: string): boolean {
    const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/; // Hebrew, Arabic, Syriac
    const ltrRegex = /[A-Za-z]/;
    
    return rtlRegex.test(input) && ltrRegex.test(input);
  }

  /**
   * Validate for specific language support
   */
  static supportsLanguage(input: string, language: string): boolean {
    const languagePatterns: Record<string, RegExp> = {
      english: /[A-Za-z]/,
      chinese: /[\u4E00-\u9FFF]/,
      japanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
      arabic: /[\u0600-\u06FF]/,
      hebrew: /[\u0590-\u05FF]/,
      cyrillic: /[\u0400-\u04FF]/,
      korean: /[\uAC00-\uD7AF]/,
    };
    
    const pattern = languagePatterns[language.toLowerCase()];
    return pattern ? pattern.test(input) : false;
  }
}