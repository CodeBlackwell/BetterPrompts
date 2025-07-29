/**
 * API Security Test - SQL Injection focused on API endpoints
 */

import { test, expect } from '@playwright/test';

test.describe('API Security - SQL Injection', () => {
  let authToken: string;
  
  test.beforeAll(async ({ request }) => {
    // Login to get token
    const response = await request.post('http://localhost/api/v1/auth/login', {
      data: {
        email_or_username: 'security_test_user@betterprompts.ai',
        password: 'SecureTest123!'
      }
    });
    
    const data = await response.json();
    authToken = data.access_token;
  });
  
  test('should prevent SQL injection in login endpoint', async ({ request }) => {
    const sqlPayloads = [
      "' OR '1'='1",
      "admin'--",
      "' OR 1=1--",
      "' UNION SELECT * FROM users--"
    ];
    
    for (const payload of sqlPayloads) {
      const response = await request.post('http://localhost/api/v1/auth/login', {
        data: {
          email_or_username: payload,
          password: 'anypassword'
        },
        failOnStatusCode: false
      });
      
      // Should return 401 Unauthorized, not 500
      expect(response.status()).toBe(401);
      
      const data = await response.json();
      // Error should be generic, not expose SQL details
      expect(data.error).toBe('Invalid credentials');
      expect(data.error).not.toMatch(/SQL/i);
      expect(data.error).not.toMatch(/database/i);
    }
  });
  
  test('should prevent SQL injection in query parameters', async ({ request }) => {
    const sqlPayloads = [
      "' OR '1'='1",
      "1; DROP TABLE prompts;--",
      "' UNION SELECT * FROM users--"
    ];
    
    for (const payload of sqlPayloads) {
      // Try search parameter
      const response = await request.get(`http://localhost/api/v1/prompts?search=${encodeURIComponent(payload)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        failOnStatusCode: false
      });
      
      // Should not return 500 Internal Server Error
      expect(response.status()).not.toBe(500);
      
      if (response.ok()) {
        const data = await response.json();
        // Should return empty array or filtered results
        expect(Array.isArray(data) || data.prompts).toBeTruthy();
      }
    }
  });
  
  test('should prevent SQL injection in path parameters', async ({ request }) => {
    const sqlPayloads = [
      "1' OR '1'='1",
      "1; DELETE FROM prompts;--"
    ];
    
    for (const payload of sqlPayloads) {
      const response = await request.get(`http://localhost/api/v1/prompts/${encodeURIComponent(payload)}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        failOnStatusCode: false
      });
      
      // Should return 400 or 404, not 500
      expect([400, 404]).toContain(response.status());
      
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error).not.toMatch(/SQL/i);
    }
  });
});

test.describe('API Security - XSS', () => {
  let authToken: string;
  
  test.beforeAll(async ({ request }) => {
    const response = await request.post('http://localhost/api/v1/auth/login', {
      data: {
        email_or_username: 'security_test_user@betterprompts.ai',
        password: 'SecureTest123!'
      }
    });
    
    const data = await response.json();
    authToken = data.access_token;
  });
  
  test('should prevent XSS in prompt enhancement', async ({ request }) => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")'
    ];
    
    for (const payload of xssPayloads) {
      const response = await request.post('http://localhost/api/v1/enhance', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          prompt: payload,
          technique: 'auto'
        },
        failOnStatusCode: false
      });
      
      if (response.ok()) {
        const data = await response.json();
        // Response should be escaped/sanitized
        expect(data.enhanced_prompt).not.toContain('<script>');
        expect(data.enhanced_prompt).not.toContain('javascript:');
      }
    }
  });
});