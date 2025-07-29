/**
 * SS-02: XSS Protection Tests
 * Tests cross-site scripting prevention across all output contexts
 */

import { test, expect, Page } from '@playwright/test';
import { SecurityPayloadGenerator } from './utils/security-payload-generator';
import { VulnerabilityScanner } from './utils/vulnerability-scanner';

test.describe('SS-02: XSS Protection', () => {
  let authToken: string;
  let page: Page;
  
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
  
  test.beforeEach(async ({ context }) => {
    page = await context.newPage();
    
    // Set up XSS detection
    let xssDetected = false;
    page.on('dialog', async dialog => {
      xssDetected = true;
      console.log(`XSS Alert detected: ${dialog.message()}`);
      await dialog.dismiss();
    });
    
    // Store XSS detection flag on page
    (page as any).xssDetected = () => xssDetected;
    (page as any).resetXssDetection = () => { xssDetected = false; };
  });
  
  test.describe('Reflected XSS Prevention', () => {
    test('should prevent reflected XSS in search functionality', async () => {
      await page.goto('/dashboard', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      // Set auth cookie
      await page.context().addCookies([{
        name: 'auth_token',
        value: authToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false
      }]);
      
      const xssPayloads = SecurityPayloadGenerator.getXSSPayloads()
        .filter(p => p.category === 'script_tags' || p.category === 'event_handlers');
      
      for (const payload of xssPayloads) {
        (page as any).resetXssDetection();
        
        // Enter XSS payload in search
        await page.fill('input[name="search"]', payload.payload);
        await page.keyboard.press('Enter');
        
        // Wait for potential XSS execution
        await page.waitForTimeout(1000);
        
        // Check if XSS executed
        const xssTriggered = (page as any).xssDetected();
        expect(xssTriggered).toBeFalsy();
        
        // Check if payload is properly encoded in output
        const searchResults = await page.textContent('.search-results');
        if (searchResults && searchResults.includes(payload.payload)) {
          // If payload is displayed, it should be encoded
          expect(searchResults).not.toContain('<script>');
          expect(searchResults).not.toContain('onerror=');
          expect(searchResults).not.toContain('onload=');
        }
      }
    });
    
    test('should prevent reflected XSS in URL parameters', async () => {
      const xssPayloads = SecurityPayloadGenerator.getXSSPayloads()
        .filter(p => p.category === 'javascript_urls')
        .slice(0, 3);
      
      for (const payload of xssPayloads) {
        (page as any).resetXssDetection();
        
        // Visit page with XSS in URL parameter
        await page.goto(`/dashboard?message=${encodeURIComponent(payload.payload)}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        await page.waitForTimeout(1000);
        
        // Check if XSS executed
        const xssTriggered = (page as any).xssDetected();
        expect(xssTriggered).toBeFalsy();
        
        // Check page content
        const content = await page.content();
        expect(content).not.toContain(payload.payload);
      }
    });
  });
  
  test.describe('Stored XSS Prevention', () => {
    test('should prevent stored XSS in prompt content', async ({ request }) => {
      const storedXSSPayloads = SecurityPayloadGenerator.getXSSPayloads()
        .filter(p => p.severity === 'critical')
        .slice(0, 5);
      
      for (const payload of storedXSSPayloads) {
        // Create prompt with XSS payload
        const createResponse = await request.post('/api/v1/prompts', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            title: 'Test XSS Prompt',
            content: payload.payload,
            category: 'test'
          }
        });
        
        expect(createResponse.ok()).toBeTruthy();
        const prompt = await createResponse.json();
        
        // Visit page that displays the prompt
        (page as any).resetXssDetection();
        await page.goto(`/prompts/${prompt.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        await page.waitForTimeout(1000);
        
        // Check if XSS executed
        const xssTriggered = (page as any).xssDetected();
        expect(xssTriggered).toBeFalsy();
        
        // Verify content is properly encoded
        const promptContent = await page.textContent('.prompt-content');
        if (promptContent) {
          expect(promptContent).not.toContain('<script>');
          expect(promptContent).not.toContain('javascript:');
          expect(promptContent).not.toContain('onerror=');
        }
        
        // Clean up
        await request.delete(`/api/v1/prompts/${prompt.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
    });
    
    test('should prevent stored XSS in user profile fields', async ({ request }) => {
      const profileXSSPayloads = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '"><script>alert(1)</script>'
      ];
      
      for (const payload of profileXSSPayloads) {
        // Update user profile with XSS payload
        const updateResponse = await request.patch('/api/v1/users/me', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            displayName: payload,
            bio: payload
          }
        });
        
        expect(updateResponse.ok()).toBeTruthy();
        
        // Visit profile page
        (page as any).resetXssDetection();
        await page.goto('/profile', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        await page.waitForTimeout(1000);
        
        // Check if XSS executed
        const xssTriggered = (page as any).xssDetected();
        expect(xssTriggered).toBeFalsy();
        
        // Verify fields are properly encoded
        const displayName = await page.textContent('.user-display-name');
        const bio = await page.textContent('.user-bio');
        
        expect(displayName).not.toContain('<script>');
        expect(displayName).not.toContain('onerror=');
        expect(bio).not.toContain('<script>');
        expect(bio).not.toContain('onerror=');
      }
    });
  });
  
  test.describe('DOM-based XSS Prevention', () => {
    test('should prevent DOM XSS through hash fragments', async () => {
      const domXSSPayloads = SecurityPayloadGenerator.getXSSPayloads()
        .filter(p => p.category === 'dom_based_xss');
      
      for (const payload of domXSSPayloads) {
        (page as any).resetXssDetection();
        
        // Navigate with XSS in hash
        await page.goto(`/dashboard#${payload.payload}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        await page.waitForTimeout(1000);
        
        // Check if XSS executed
        const xssTriggered = (page as any).xssDetected();
        expect(xssTriggered).toBeFalsy();
        
        // Check if hash is safely handled
        const hashValue = await page.evaluate(() => window.location.hash);
        if (hashValue) {
          // Hash should not be directly inserted into DOM
          const content = await page.content();
          expect(content).not.toContain(payload.payload);
        }
      }
    });
    
    test('should prevent DOM XSS through client-side templates', async () => {
      await page.goto('/dashboard', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      // Try to inject into client-side template contexts
      const templatePayloads = [
        '{{constructor.constructor("alert(1)")()}}',
        '${alert(1)}',
        '<%= alert(1) %>'
      ];
      
      for (const payload of templatePayloads) {
        (page as any).resetXssDetection();
        
        // Try to inject via various client-side operations
        await page.evaluate((p) => {
          // Simulate template rendering with user input
          const div = document.createElement('div');
          div.innerHTML = `<span>${p}</span>`;
          document.body.appendChild(div);
        }, payload);
        
        await page.waitForTimeout(500);
        
        // Check if XSS executed
        const xssTriggered = (page as any).xssDetected();
        expect(xssTriggered).toBeFalsy();
      }
    });
  });
  
  test.describe('Content Security Policy', () => {
    test('should have proper CSP headers', async () => {
      const response = await page.goto('/dashboard', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const cspHeader = response?.headers()['content-security-policy'];
      expect(cspHeader).toBeDefined();
      
      // Verify CSP directives
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain("script-src");
      expect(cspHeader).toContain("style-src");
      expect(cspHeader).toContain("img-src");
      expect(cspHeader).toContain("frame-ancestors 'none'");
      
      // Should not allow unsafe-eval by default
      expect(cspHeader).not.toContain("'unsafe-eval'");
    });
    
    test('should prevent inline script execution without nonce', async () => {
      await page.goto('/dashboard', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      (page as any).resetXssDetection();
      
      // Try to inject inline script
      const scriptExecuted = await page.evaluate(() => {
        try {
          const script = document.createElement('script');
          script.textContent = 'window.xssTest = true;';
          document.head.appendChild(script);
          return (window as any).xssTest === true;
        } catch (e) {
          return false;
        }
      });
      
      // Inline script should be blocked by CSP
      expect(scriptExecuted).toBeFalsy();
      
      // Check console for CSP violations
      const consoleMessages: string[] = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      
      await page.waitForTimeout(500);
      
      const cspViolation = consoleMessages.some(msg => 
        msg.includes('Content Security Policy') || msg.includes('CSP')
      );
      expect(cspViolation).toBeTruthy();
    });
  });
  
  test.describe('SVG XSS Prevention', () => {
    test('should prevent XSS through SVG uploads', async ({ request }) => {
      const svgPayloads = SecurityPayloadGenerator.getXSSPayloads()
        .filter(p => p.category === 'svg_payloads');
      
      for (const payload of svgPayloads) {
        // Create malicious SVG content
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg">
  ${payload.payload}
</svg>`;
        
        // Try to upload SVG (if file upload is supported)
        const formData = new FormData();
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        formData.append('file', blob, 'test.svg');
        
        const response = await request.post('/api/v1/upload', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          multipart: formData,
          failOnStatusCode: false
        });
        
        // If upload is allowed, verify SVG is sanitized
        if (response.ok()) {
          const data = await response.json();
          const fileUrl = data.url;
          
          // Access the uploaded file
          (page as any).resetXssDetection();
          await page.goto(fileUrl);
          
          await page.waitForTimeout(1000);
          
          // Check if XSS executed
          const xssTriggered = (page as any).xssDetected();
          expect(xssTriggered).toBeFalsy();
        } else {
          // SVG upload might be blocked entirely (which is good)
          expect([400, 415]).toContain(response.status());
        }
      }
    });
  });
  
  test.describe('JSON Response XSS Prevention', () => {
    test('should prevent XSS in JSON responses', async ({ request }) => {
      // Create content with potential XSS
      const jsonXSSPayload = '</script><script>alert(1)</script>';
      
      const createResponse = await request.post('/api/v1/prompts', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          title: 'JSON XSS Test',
          content: jsonXSSPayload,
          category: 'test'
        }
      });
      
      expect(createResponse.ok()).toBeTruthy();
      const prompt = await createResponse.json();
      
      // Fetch via API and check response
      const response = await request.get(`/api/v1/prompts/${prompt.id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // Verify correct Content-Type
      expect(response.headers()['content-type']).toContain('application/json');
      
      // Content should be properly escaped in JSON
      const data = await response.json();
      expect(data.content).toBe(jsonXSSPayload);
      
      // Raw response should have escaped content
      const rawText = await response.text();
      expect(rawText).not.toContain('<script>alert(1)</script>');
      expect(rawText).toContain('\\u003c/script\\u003e'); // Unicode escaped
      
      // Clean up
      await request.delete(`/api/v1/prompts/${prompt.id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    });
  });
  
  test.describe('Output Encoding Validation', () => {
    test('should properly encode output in different contexts', async () => {
      await page.goto('/dashboard', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const encodingTestPayloads = [
        { context: 'HTML', payload: '<div>test</div>' },
        { context: 'Attribute', payload: '" onmouseover="alert(1)' },
        { context: 'JavaScript', payload: "'; alert(1); //'" },
        { context: 'URL', payload: 'javascript:alert(1)' },
        { context: 'CSS', payload: 'expression(alert(1))' }
      ];
      
      for (const test of encodingTestPayloads) {
        (page as any).resetXssDetection();
        
        // Test encoding in different contexts
        const encoded = await page.evaluate((payload) => {
          // Get encoding functions if available
          const win = window as any;
          
          const results: any = {};
          
          // HTML encoding
          const div = document.createElement('div');
          div.textContent = payload;
          results.html = div.innerHTML;
          
          // Attribute encoding
          const input = document.createElement('input');
          input.setAttribute('value', payload);
          results.attribute = input.outerHTML;
          
          return results;
        }, test.payload);
        
        // Verify proper encoding
        expect(encoded.html).not.toContain('<div>');
        expect(encoded.attribute).not.toContain('onmouseover=');
        
        await page.waitForTimeout(500);
        const xssTriggered = (page as any).xssDetected();
        expect(xssTriggered).toBeFalsy();
      }
    });
  });
  
  test.describe('Comprehensive XSS Scan', () => {
    test('should pass comprehensive XSS vulnerability scan', async () => {
      const scanner = new VulnerabilityScanner(page);
      
      // Login and navigate to main page
      await page.goto('/login');
      await page.fill('input[name="email"]', 'security_test_user@betterprompts.ai');
      await page.fill('input[name="password"]', 'SecureTest123!');
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Run vulnerability scan
      const report = await scanner.runFullScan(page.url());
      
      // Filter for XSS vulnerabilities
      const xssVulnerabilities = report.vulnerabilities.filter(v => 
        v.type.includes('xss') || v.description.toLowerCase().includes('script')
      );
      
      // Should have no XSS vulnerabilities
      expect(xssVulnerabilities).toHaveLength(0);
      
      // Check for proper security headers
      const cspHeader = report.securityHeaders.find(h => 
        h.header === 'content-security-policy'
      );
      expect(cspHeader?.present).toBeTruthy();
      
      // Generate report if vulnerabilities found
      if (xssVulnerabilities.length > 0) {
        console.log('XSS Vulnerabilities Found:');
        xssVulnerabilities.forEach(v => {
          console.log(`- ${v.description} (${v.severity})`);
          console.log(`  Evidence: ${v.evidence}`);
          console.log(`  Remediation: ${v.remediation}`);
        });
      }
    });
  });
});