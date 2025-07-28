/**
 * Edge Case Generator for Input Validation Testing
 * Phase 9: Input Validation & Edge Cases
 */

export interface EdgeCase {
  name: string;
  input: string;
  description: string;
  expected: 'valid' | 'invalid';
  category: 'length' | 'special' | 'multilingual' | 'whitespace' | 'security';
  errorType?: string;
}

export class EdgeCaseGenerator {
  /**
   * EC-01: Character Limit Test Cases
   */
  static generateCharacterLimitCases(): EdgeCase[] {
    return [
      {
        name: 'exactly_5000_chars',
        input: 'x'.repeat(5000),
        description: 'Exactly at the character limit',
        expected: 'valid',
        category: 'length'
      },
      {
        name: 'under_limit_4999',
        input: 'x'.repeat(4999),
        description: 'Just under the character limit',
        expected: 'valid',
        category: 'length'
      },
      {
        name: 'over_limit_5001',
        input: 'x'.repeat(5001),
        description: 'Just over the character limit',
        expected: 'invalid',
        category: 'length',
        errorType: 'CHARACTER_LIMIT_EXCEEDED'
      },
      {
        name: 'way_over_limit_10000',
        input: 'x'.repeat(10000),
        description: 'Significantly over the character limit',
        expected: 'invalid',
        category: 'length',
        errorType: 'CHARACTER_LIMIT_EXCEEDED'
      },
      {
        name: 'emoji_counting',
        input: '👨‍👩‍👧‍👦'.repeat(500) + 'x'.repeat(1000), // Family emoji is 1 grapheme cluster
        description: 'Character counting with complex emojis',
        expected: 'valid',
        category: 'length'
      },
      {
        name: 'newline_counting',
        input: 'Line 1\nLine 2\r\nLine 3\n'.repeat(100),
        description: 'Character counting with various newline types',
        expected: 'valid',
        category: 'length'
      }
    ];
  }

  /**
   * EC-02: Special Characters & Emojis Test Cases
   */
  static generateSpecialCharacterCases(): EdgeCase[] {
    return [
      {
        name: 'common_punctuation',
        input: 'Test with punctuation: !@#$%^&*()_+-=[]{}|;:\'",.<>?/',
        description: 'Common punctuation marks',
        expected: 'valid',
        category: 'special'
      },
      {
        name: 'mathematical_symbols',
        input: 'Math symbols: ± ÷ × ∞ ∑ ∏ √ ∂ ∫ ≈ ≠ ≤ ≥',
        description: 'Mathematical symbols',
        expected: 'valid',
        category: 'special'
      },
      {
        name: 'currency_symbols',
        input: 'Prices: $100 €50 £75 ¥1000 ₹500 ₿0.001',
        description: 'Various currency symbols',
        expected: 'valid',
        category: 'special'
      },
      {
        name: 'emoji_variety',
        input: 'Emojis: 😀 🎉 🚀 💻 🌍 🔥 ⚡ 🎯 📊 🔐',
        description: 'Various emoji types',
        expected: 'valid',
        category: 'special'
      },
      {
        name: 'zero_width_characters',
        input: 'Hello\u200BWorld\u200CTest\u200D',
        description: 'Zero-width characters (invisible)',
        expected: 'valid',
        category: 'special'
      },
      {
        name: 'control_characters',
        input: 'Text with\x00null\x07bell\x08backspace',
        description: 'Control characters that could affect display',
        expected: 'invalid',
        category: 'special',
        errorType: 'INVALID_CHARACTERS'
      },
      {
        name: 'unicode_fancy_text',
        input: '𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉 𝓕𝓪𝓷𝓬𝔂 𝓣𝓮𝔁𝓽',
        description: 'Unicode stylized text',
        expected: 'valid',
        category: 'special'
      }
    ];
  }

  /**
   * EC-03: Multilingual Support Test Cases
   */
  static generateMultilingualCases(): EdgeCase[] {
    return [
      {
        name: 'english_baseline',
        input: 'Hello World! This is a test prompt for the BetterPrompts system.',
        description: 'Standard English text',
        expected: 'valid',
        category: 'multilingual'
      },
      {
        name: 'chinese_simplified',
        input: '你好世界！这是BetterPrompts系统的测试提示。',
        description: 'Simplified Chinese characters',
        expected: 'valid',
        category: 'multilingual'
      },
      {
        name: 'arabic_rtl',
        input: 'مرحبا بالعالم! هذا اختبار للنظام.',
        description: 'Arabic text (right-to-left)',
        expected: 'valid',
        category: 'multilingual'
      },
      {
        name: 'japanese_mixed',
        input: 'こんにちは世界！これはBetterPromptsシステムのテストです。',
        description: 'Japanese with hiragana, katakana, and kanji',
        expected: 'valid',
        category: 'multilingual'
      },
      {
        name: 'mixed_scripts',
        input: 'Hello مرحبا 你好 Здравствуйте こんにちは',
        description: 'Multiple scripts in one prompt',
        expected: 'valid',
        category: 'multilingual'
      },
      {
        name: 'rtl_ltr_mixed',
        input: 'English text مع نص عربي and back to English',
        description: 'Mixed RTL and LTR text',
        expected: 'valid',
        category: 'multilingual'
      },
      {
        name: 'unicode_normalization',
        input: 'café vs café', // NFC vs NFD forms
        description: 'Different Unicode normalization forms',
        expected: 'valid',
        category: 'multilingual'
      }
    ];
  }

  /**
   * EC-04: Empty & Whitespace Test Cases
   */
  static generateWhitespaceCases(): EdgeCase[] {
    return [
      {
        name: 'completely_empty',
        input: '',
        description: 'Completely empty input',
        expected: 'invalid',
        category: 'whitespace',
        errorType: 'EMPTY_INPUT'
      },
      {
        name: 'single_space',
        input: ' ',
        description: 'Single space character',
        expected: 'invalid',
        category: 'whitespace',
        errorType: 'EMPTY_INPUT'
      },
      {
        name: 'multiple_spaces',
        input: '     ',
        description: 'Multiple spaces only',
        expected: 'invalid',
        category: 'whitespace',
        errorType: 'EMPTY_INPUT'
      },
      {
        name: 'tabs_and_newlines',
        input: '\t\n\r\n\t',
        description: 'Only tabs and newlines',
        expected: 'invalid',
        category: 'whitespace',
        errorType: 'EMPTY_INPUT'
      },
      {
        name: 'whitespace_with_text',
        input: '   Valid prompt text   ',
        description: 'Valid text with surrounding whitespace',
        expected: 'valid',
        category: 'whitespace'
      },
      {
        name: 'mixed_whitespace',
        input: '\t  \n  Valid text  \r\n  ',
        description: 'Mixed whitespace types with valid content',
        expected: 'valid',
        category: 'whitespace'
      },
      {
        name: 'non_breaking_spaces',
        input: '\u00A0\u00A0\u00A0', // Non-breaking spaces
        description: 'Non-breaking space characters',
        expected: 'invalid',
        category: 'whitespace',
        errorType: 'EMPTY_INPUT'
      }
    ];
  }

  /**
   * EC-05: Security Injection Test Cases
   */
  static generateSecurityCases(): EdgeCase[] {
    return [
      // XSS Attempts
      {
        name: 'xss_script_tag',
        input: '<script>alert("XSS")</script>',
        description: 'Basic script tag XSS attempt',
        expected: 'valid', // Should be sanitized, not rejected
        category: 'security'
      },
      {
        name: 'xss_img_onerror',
        input: '<img src=x onerror=alert(1)>',
        description: 'Image tag with onerror handler',
        expected: 'valid',
        category: 'security'
      },
      {
        name: 'xss_svg_onload',
        input: '<svg onload=alert(1)>',
        description: 'SVG with onload event',
        expected: 'valid',
        category: 'security'
      },
      {
        name: 'xss_javascript_url',
        input: '<a href="javascript:alert(1)">Click me</a>',
        description: 'JavaScript URL in link',
        expected: 'valid',
        category: 'security'
      },
      // SQL Injection
      {
        name: 'sql_basic_injection',
        input: "'; DROP TABLE users; --",
        description: 'Basic SQL injection attempt',
        expected: 'valid',
        category: 'security'
      },
      {
        name: 'sql_union_select',
        input: "' UNION SELECT * FROM passwords --",
        description: 'SQL UNION injection',
        expected: 'valid',
        category: 'security'
      },
      // Path Traversal
      {
        name: 'path_traversal_basic',
        input: '../../etc/passwd',
        description: 'Basic path traversal attempt',
        expected: 'valid',
        category: 'security'
      },
      {
        name: 'path_traversal_encoded',
        input: '..%2F..%2Fetc%2Fpasswd',
        description: 'URL encoded path traversal',
        expected: 'valid',
        category: 'security'
      },
      // Command Injection
      {
        name: 'command_injection_semicolon',
        input: '; rm -rf /',
        description: 'Command injection with semicolon',
        expected: 'valid',
        category: 'security'
      },
      {
        name: 'command_injection_backticks',
        input: '`cat /etc/passwd`',
        description: 'Command injection with backticks',
        expected: 'valid',
        category: 'security'
      },
      // XXE Attempts
      {
        name: 'xxe_doctype',
        input: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
        description: 'XXE via DOCTYPE',
        expected: 'valid',
        category: 'security'
      },
      // LDAP Injection
      {
        name: 'ldap_injection',
        input: '*)(uid=*))(|(uid=*',
        description: 'LDAP injection pattern',
        expected: 'valid',
        category: 'security'
      },
      // NoSQL Injection
      {
        name: 'nosql_injection',
        input: '{"$ne": null}',
        description: 'NoSQL injection attempt',
        expected: 'valid',
        category: 'security'
      }
    ];
  }

  /**
   * Get all test cases
   */
  static getAllCases(): EdgeCase[] {
    return [
      ...this.generateCharacterLimitCases(),
      ...this.generateSpecialCharacterCases(),
      ...this.generateMultilingualCases(),
      ...this.generateWhitespaceCases(),
      ...this.generateSecurityCases()
    ];
  }

  /**
   * Get cases by category
   */
  static getCasesByCategory(category: EdgeCase['category']): EdgeCase[] {
    return this.getAllCases().filter(c => c.category === category);
  }

  /**
   * Get cases by expected result
   */
  static getCasesByExpected(expected: 'valid' | 'invalid'): EdgeCase[] {
    return this.getAllCases().filter(c => c.expected === expected);
  }

  /**
   * Generate a summary report
   */
  static generateReport(): string {
    const cases = this.getAllCases();
    const byCategory = cases.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byExpected = cases.reduce((acc, c) => {
      acc[c.expected] = (acc[c.expected] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `
Edge Case Test Summary:
- Total Cases: ${cases.length}
- By Category: ${JSON.stringify(byCategory, null, 2)}
- By Expected: ${JSON.stringify(byExpected, null, 2)}
    `.trim();
  }
}