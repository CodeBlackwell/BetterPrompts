/**
 * SS-01: SQL Injection Prevention Tests
 * Tests SQL injection protection across all input vectors
 */

import { test, expect } from '@playwright/test';
import { SecurityPayloadGenerator } from './utils/security-payload-generator';
import { VulnerabilityScanner } from './utils/vulnerability-scanner';

test.describe('SS-01: SQL Injection Prevention', () => {
  let authToken: string;
  
  test.beforeAll(async ({ request }) => {
    // Login as test user
    const response = await request.post('http://localhost/api/v1/auth/login', {
      data: {
        email_or_username: 'security_test_user@betterprompts.ai',
        password: 'SecureTest123!'
      }
    });
    
    const data = await response.json();
    authToken = data.access_token;
  });
  
  test.describe('Login Form SQL Injection', () => {
    test('should prevent SQL injection in login forms', async ({ page }) => {
      await page.goto('/login');
      
      const sqlPayloads = SecurityPayloadGenerator.getSQLInjectionPayloads()
        .filter(p => p.category === 'union_select' || p.category === 'boolean_blind');
      
      for (const payload of sqlPayloads) {
        // Try email field
        await page.fill('input[name="email"]', payload.payload);
        await page.fill('input[name="password"]', 'anypassword');
        await page.click('button[type="submit"]');
        
        // Check for SQL errors
        const pageContent = await page.content();
        expect(pageContent).not.toMatch(/SQL syntax/i);
        expect(pageContent).not.toMatch(/mysql_/i);
        expect(pageContent).not.toMatch(/ORA-\d+/);
        expect(pageContent).not.toMatch(/PostgreSQL/i);
        
        // Should show generic error
        const errorMessage = await page.textContent('.error-message');
        expect(errorMessage).toContain('Invalid credentials');
        expect(errorMessage).not.toContain('SQL');
        expect(errorMessage).not.toContain('database');
        
        // Reset form
        await page.reload();
      }
    });
    
    test('should prevent time-based blind SQL injection', async ({ page }) => {
      await page.goto('/login');
      
      const timeBasedPayloads = SecurityPayloadGenerator.getSQLInjectionPayloads()
        .filter(p => p.category === 'time_based');
      
      for (const payload of timeBasedPayloads) {
        const startTime = Date.now();
        
        await page.fill('input[name="email"]', payload.payload);
        await page.fill('input[name="password"]', 'anypassword');
        await page.click('button[type="submit"]');
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should not take more than 2 seconds (no sleep injection)
        expect(duration).toBeLessThan(2000);
        
        // Check error is generic
        const errorMessage = await page.textContent('.error-message');
        expect(errorMessage).toContain('Invalid credentials');
      }
    });
  });
  
  test.describe('Search Functionality SQL Injection', () => {
    test('should prevent SQL injection in search queries', async ({ page }) => {
      await page.goto('/dashboard', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // Set auth cookie for subsequent requests
      await page.context().addCookies([{
        name: 'auth_token',
        value: authToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false
      }]);
      
      const searchPayloads = SecurityPayloadGenerator.getSQLInjectionPayloads();
      
      for (const payload of searchPayloads) {
        // Enter search query
        await page.fill('input[name="search"]', payload.payload);
        await page.keyboard.press('Enter');
        
        // Wait for results
        await page.waitForTimeout(500);
        
        // Check for SQL errors
        const pageContent = await page.content();
        expect(pageContent).not.toMatch(/SQL syntax/i);
        expect(pageContent).not.toMatch(/database error/i);
        
        // Results should be empty or show "no results"
        const resultsText = await page.textContent('.search-results');
        expect(resultsText).toMatch(/no results found|0 results/i);
      }
    });
  });
  
  test.describe('API Parameter SQL Injection', () => {
    test('should prevent SQL injection in API query parameters', async ({ request }) => {
      const payloads = SecurityPayloadGenerator.getSQLInjectionPayloads();
      
      for (const payload of payloads) {
        // Test various API endpoints with SQL injection attempts
        const endpoints = [
          `http://localhost/api/v1/prompts?search=${encodeURIComponent(payload.payload)}`,
          `http://localhost/api/v1/prompts?category=${encodeURIComponent(payload.payload)}`,
          `http://localhost/api/v1/prompts?sort=${encodeURIComponent(payload.payload)}`,
          `http://localhost/api/v1/users?filter=${encodeURIComponent(payload.payload)}`
        ];
        
        for (const endpoint of endpoints) {
          const response = await request.get(endpoint, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          // Should not return SQL errors
          expect(response.status()).not.toBe(500);
          
          if (response.ok()) {
            const data = await response.json();
            // Should return empty results or validation error
            if (Array.isArray(data)) {
              expect(data).toHaveLength(0);
            } else {
              expect(data.error).toBeDefined();
              expect(data.error).not.toContain('SQL');
            }
          } else {
            // Should be 400 Bad Request, not 500
            expect(response.status()).toBe(400);
            const error = await response.json();
            expect(error.error).not.toMatch(/SQL/i);
          }
        }
      }
    });
    
    test('should prevent SQL injection in API path parameters', async ({ request }) => {
      const payloads = SecurityPayloadGenerator.getSQLInjectionPayloads()
        .slice(0, 5); // Test subset to avoid rate limiting
      
      for (const payload of payloads) {
        // Try to inject in path parameters
        const response = await request.get(`http://localhost/api/v1/prompts/${encodeURIComponent(payload.payload)}`, {
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
        expect(data.error).not.toMatch(/database/i);
      }
    });
  });
  
  test.describe('Header-based SQL Injection', () => {
    test('should prevent SQL injection through headers', async ({ request }) => {
      const headerPayloads = SecurityPayloadGenerator.getSQLInjectionPayloads()
        .filter(p => p.category === 'headers' || p.severity === 'critical')
        .slice(0, 3);
      
      for (const payload of headerPayloads) {
        // Try injection in various headers
        const headersToTest = [
          { 'X-Forwarded-For': payload.payload },
          { 'User-Agent': payload.payload },
          { 'Referer': payload.payload },
          { 'X-Client-Id': payload.payload }
        ];
        
        for (const headers of headersToTest) {
          const response = await request.get('http://localhost/api/v1/prompts', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              ...headers
            },
            failOnStatusCode: false
          });
          
          // Should not cause SQL errors
          expect(response.status()).not.toBe(500);
          
          if (!response.ok()) {
            const error = await response.json();
            expect(error.error).not.toMatch(/SQL/i);
          }
        }
      }
    });
  });
  
  test.describe('Cookie-based SQL Injection', () => {
    test('should prevent SQL injection through cookies', async ({ context, page }) => {
      const cookiePayloads = SecurityPayloadGenerator.getSQLInjectionPayloads()
        .filter(p => p.category === 'cookies')
        .slice(0, 3);
      
      for (const payload of cookiePayloads) {
        // Set malicious cookie
        await context.addCookies([{
          name: 'session_id',
          value: payload.payload,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false
        }]);
        
        // Try to access protected endpoint
        const response = await page.goto('/dashboard', {
          waitUntil: 'networkidle',
          failOnStatusCode: false
        });
        
        // Should not expose SQL errors
        const content = await page.content();
        expect(content).not.toMatch(/SQL/i);
        expect(content).not.toMatch(/database error/i);
        
        // Clear cookies for next test
        await context.clearCookies();
      }
    });
  });
  
  test.describe('JSON Body SQL Injection', () => {
    test('should prevent SQL injection in JSON request bodies', async ({ request }) => {
      const jsonPayloads = SecurityPayloadGenerator.getSQLInjectionPayloads()
        .slice(0, 5);
      
      for (const payload of jsonPayloads) {
        // Test prompt enhancement endpoint
        const response = await request.post('http://localhost/api/v1/enhance', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            prompt: payload.payload,
            technique: 'auto'
          },
          failOnStatusCode: false
        });
        
        // Should not cause SQL errors
        expect(response.status()).not.toBe(500);
        
        if (!response.ok()) {
          const error = await response.json();
          expect(error.error).not.toMatch(/SQL/i);
          expect(error.error).not.toMatch(/database/i);
        }
      }
    });
    
    test('should prevent second-order SQL injection', async ({ request }) => {
      // Create a prompt with potential SQL injection that might be executed later
      const secondOrderPayload = "'; UPDATE users SET role='admin' WHERE email='attacker@evil.com'; --";
      
      // Store the payload
      const createResponse = await request.post('http://localhost/api/v1/prompts', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          title: 'Test Prompt',
          content: secondOrderPayload,
          category: 'test'
        }
      });
      
      expect(createResponse.ok()).toBeTruthy();
      const prompt = await createResponse.json();
      
      // Retrieve the prompt (might trigger stored SQL injection)
      const getResponse = await request.get(`http://localhost/api/v1/prompts/${prompt.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(getResponse.ok()).toBeTruthy();
      
      // Verify no privilege escalation occurred
      const userResponse = await request.get('http://localhost/api/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const userData = await userResponse.json();
      expect(userData.role).not.toBe('admin');
      
      // Clean up
      await request.delete(`http://localhost/api/v1/prompts/${prompt.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    });
  });
  
  test.describe('Vulnerability Scanning', () => {
    test('should pass comprehensive SQL injection vulnerability scan', async ({ page }) => {
      const scanner = new VulnerabilityScanner(page);
      
      // Login first
      await page.goto('/login');
      await page.fill('input[name="email"]', 'security_test_user@betterprompts.ai');
      await page.fill('input[name="password"]', 'SecureTest123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Run vulnerability scan
      const report = await scanner.runFullScan(page.url());
      
      // Filter for SQL injection vulnerabilities
      const sqlVulnerabilities = report.vulnerabilities.filter(v => 
        v.type.includes('sql') || v.owaspCategory.includes('A03:2021')
      );
      
      // Should have no SQL injection vulnerabilities
      expect(sqlVulnerabilities).toHaveLength(0);
      
      // Generate report for documentation
      if (sqlVulnerabilities.length > 0) {
        console.log('SQL Injection Vulnerabilities Found:');
        sqlVulnerabilities.forEach(v => {
          console.log(`- ${v.description} (${v.severity})`);
          console.log(`  Evidence: ${v.evidence}`);
          console.log(`  Remediation: ${v.remediation}`);
        });
      }
    });
  });
  
  test.describe('Parameterized Query Validation', () => {
    test('should use parameterized queries for all database operations', async ({ request }) => {
      // This test validates that the API properly uses parameterized queries
      // by attempting various encoding bypasses
      
      const encodingBypassPayloads = [
        "1' OR '1'='1",
        "1%27%20OR%20%271%27%3D%271",  // URL encoded
        "1\\' OR \\'1\\'=\\'1",         // Escaped quotes
        "1/**/OR/**/1=1",               // Comment bypass
        "1 OR 1=1--",                   // Comment termination
        "1' OR '1'='1' /*",             // Multi-line comment
      ];
      
      for (const payload of encodingBypassPayloads) {
        const response = await request.get(`http://localhost/api/v1/prompts?id=${payload}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          failOnStatusCode: false
        });
        
        // Should properly handle all encoding attempts
        expect([400, 404]).toContain(response.status());
        
        const data = await response.json();
        expect(data.error).toBeDefined();
        expect(data.error).not.toMatch(/SQL/i);
      }
    });
  });
});