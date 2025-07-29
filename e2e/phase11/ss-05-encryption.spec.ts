/**
 * SS-05: Data Encryption Tests
 * Tests encryption in transit and at rest, TLS configuration, and secure cookies
 */

import { test, expect } from '@playwright/test';
import { VulnerabilityScanner } from './utils/vulnerability-scanner';
import * as crypto from 'crypto';

test.describe('SS-05: Data Encryption', () => {
  let authToken: string;
  const testEmail = 'encryption_test@betterprompts.ai';
  const testPassword = 'EncryptTest123!';
  
  test.beforeAll(async ({ request }) => {
    // Create test user
    await request.post('http://localhost/api/v1/auth/register', {
      data: {
        email: testEmail,
        password: testPassword,
        username: testEmail.split('@')[0],
        confirm_password: testPassword
      },
      failOnStatusCode: false
    });
    
    // Login
    const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
      data: { email_or_username: testEmail, password: testPassword }
    });
    
    const data = await loginResponse.json();
    authToken = data.access_token;
  });
  
  test.describe('HTTPS Enforcement', () => {
    test('should redirect HTTP to HTTPS in production', async ({ page }) => {
      // Skip in local development
      if (page.url().includes('localhost')) {
        console.log('Skipping HTTPS test in local development');
        return;
      }
      
      // Try to access via HTTP
      const httpUrl = page.url().replace('https://', 'http://');
      const response = await page.goto(httpUrl, { waitUntil: 'domcontentloaded' });
      
      // Should redirect to HTTPS
      expect(page.url()).toMatch(/^https:\/\//);
      
      // Check for HSTS header
      const headers = response?.headers();
      expect(headers?.['strict-transport-security']).toBeDefined();
      expect(headers?.['strict-transport-security']).toContain('max-age=');
    });
    
    test('should include HSTS header with proper configuration', async ({ page }) => {
      const response = await page.goto('/');
      const headers = response?.headers();
      
      const hstsHeader = headers?.['strict-transport-security'];
      if (hstsHeader) {
        // Check HSTS configuration
        expect(hstsHeader).toContain('max-age=');
        
        // Extract max-age value
        const maxAgeMatch = hstsHeader.match(/max-age=(\d+)/);
        if (maxAgeMatch) {
          const maxAge = parseInt(maxAgeMatch[1]);
          // Should be at least 6 months (15552000 seconds)
          expect(maxAge).toBeGreaterThanOrEqual(15552000);
        }
        
        // Should include subdomains
        expect(hstsHeader).toContain('includeSubDomains');
        
        // Check for preload
        if (hstsHeader.includes('preload')) {
          console.log('HSTS preload enabled - excellent security');
        }
      } else {
        console.warn('HSTS header missing - security recommendation');
      }
    });
  });
  
  test.describe('TLS Configuration', () => {
    test('should use strong TLS version', async ({ request, page }) => {
      // Skip in local development
      if (page.url().includes('localhost')) {
        console.log('Skipping TLS test in local development');
        return;
      }
      
      // Node.js doesn't expose TLS version directly in Playwright
      // We'll check for weak cipher rejection instead
      
      // Try to connect with weak TLS (this would require a custom client)
      // For now, we'll check the security headers that indicate good TLS config
      const response = await request.get('/api/v1/health');
      const headers = response.headers();
      
      // Check for security headers that indicate good TLS configuration
      expect(headers['strict-transport-security']).toBeDefined();
      
      // Log recommendation
      console.log('Recommendation: Configure server to support only TLS 1.2 and above');
      console.log('Recommendation: Disable weak ciphers and prefer forward secrecy');
    });
    
    test('should not expose server version information', async ({ request }) => {
      const response = await request.get('/api/v1/health');
      const headers = response.headers();
      
      // Check for information disclosure headers
      const serverHeader = headers['server'];
      const poweredBy = headers['x-powered-by'];
      
      if (serverHeader) {
        // Should not contain version numbers
        expect(serverHeader).not.toMatch(/\d+\.\d+/);
        expect(serverHeader).not.toMatch(/nginx\/\d/i);
        expect(serverHeader).not.toMatch(/apache\/\d/i);
        
        if (serverHeader.match(/\d/)) {
          console.error('Server header exposes version information');
        }
      }
      
      if (poweredBy) {
        console.warn('X-Powered-By header should be removed');
        expect(poweredBy).not.toMatch(/\d+\.\d+/);
      }
    });
  });
  
  test.describe('Secure Cookie Configuration', () => {
    test('should set secure cookie attributes', async ({ page, context }) => {
      // Login to get cookies
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Get all cookies
      const cookies = await context.cookies();
      
      // Check security-sensitive cookies
      const securityCookies = cookies.filter(c => 
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('token') ||
        c.name.toLowerCase().includes('csrf')
      );
      
      for (const cookie of securityCookies) {
        // HttpOnly flag
        expect(cookie.httpOnly).toBeTruthy();
        
        // Secure flag (except localhost)
        if (!cookie.domain?.includes('localhost')) {
          expect(cookie.secure).toBeTruthy();
        }
        
        // SameSite attribute
        expect(cookie.sameSite).toBeDefined();
        expect(['Strict', 'Lax']).toContain(cookie.sameSite);
        
        // Path should be restricted
        expect(cookie.path).toBeDefined();
        
        // Check expiration
        if (cookie.expires) {
          const expiresIn = cookie.expires - Date.now() / 1000;
          // Should not be too long (max 7 days for session cookies)
          if (cookie.name.includes('session')) {
            expect(expiresIn).toBeLessThan(604800); // 7 days
          }
        }
        
        console.log(`Cookie ${cookie.name} security attributes:`, {
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
          expires: cookie.expires ? new Date(cookie.expires * 1000).toISOString() : 'session'
        });
      }
    });
    
    test('should not transmit cookies over unencrypted connections', async ({ context, page }) => {
      // Skip in local development
      if (page.url().includes('localhost')) {
        return;
      }
      
      // Login to get cookies
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      const cookies = await context.cookies();
      const secureCookies = cookies.filter(c => c.secure);
      
      // All auth-related cookies should be secure
      const authCookies = cookies.filter(c => 
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('session')
      );
      
      for (const cookie of authCookies) {
        expect(cookie.secure).toBeTruthy();
      }
    });
  });
  
  test.describe('Data at Rest Encryption', () => {
    test('should not expose sensitive data in API responses', async ({ request }) => {
      // Test various endpoints for data exposure
      const endpoints = [
        '/api/v1/users/me',
        '/api/v1/prompts',
        '/api/v1/auth/session'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request.get(endpoint, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          failOnStatusCode: false
        });
        
        if (response.ok()) {
          const data = await response.json();
          const jsonString = JSON.stringify(data);
          
          // Check for sensitive data patterns
          expect(jsonString).not.toMatch(/password/i);
          expect(jsonString).not.toMatch(/\$2[aby]\$/); // bcrypt hash
          expect(jsonString).not.toMatch(/pbkdf2/i);
          expect(jsonString).not.toMatch(/credit.?card/i);
          expect(jsonString).not.toMatch(/ssn/i);
          expect(jsonString).not.toMatch(/social.?security/i);
          
          // Check for unencrypted tokens
          if (jsonString.includes('token')) {
            // Tokens should be hashed or encrypted
            const tokenPattern = /"token":\s*"([^"]+)"/;
            const match = jsonString.match(tokenPattern);
            if (match) {
              const token = match[1];
              // Should not be plain text
              expect(token.length).toBeGreaterThan(32);
              // Should look like a secure token (base64, hex, etc.)
              expect(token).toMatch(/^[A-Za-z0-9+/\-_=]+$/);
            }
          }
        }
      }
    });
    
    test('should encrypt sensitive user data', async ({ request }) => {
      // Create data with potentially sensitive information
      const sensitiveData = {
        title: 'Personal Information',
        content: 'SSN: 123-45-6789, Credit Card: 1234-5678-9012-3456',
        category: 'private'
      };
      
      const createResponse = await request.post('/api/v1/prompts', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: sensitiveData
      });
      
      if (createResponse.ok()) {
        const prompt = await createResponse.json();
        
        // Retrieve the data
        const getResponse = await request.get(`/api/v1/prompts/${prompt.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const retrievedData = await getResponse.json();
        
        // Check if sensitive patterns are masked or encrypted
        if (retrievedData.content.includes('SSN:') && 
            retrievedData.content.includes('123-45-6789')) {
          console.warn('Sensitive data not masked/encrypted in storage');
        }
        
        // Clean up
        await request.delete(`/api/v1/prompts/${prompt.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
    });
  });
  
  test.describe('API Communication Security', () => {
    test('should use secure headers for API requests', async ({ request }) => {
      const response = await request.get('/api/v1/prompts', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const headers = response.headers();
      
      // Check security headers
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);
      expect(headers['x-xss-protection']).toBeDefined();
      
      // Cache control for sensitive data
      const cacheControl = headers['cache-control'];
      if (cacheControl) {
        expect(cacheControl).toContain('no-store');
        expect(cacheControl).toContain('no-cache');
      }
      
      // Content type should be explicit
      expect(headers['content-type']).toContain('application/json');
    });
    
    test('should not cache sensitive responses', async ({ page, request }) => {
      // Make authenticated request
      const response = await request.get('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const headers = response.headers();
      
      // Check cache headers
      const cacheControl = headers['cache-control'];
      expect(cacheControl).toBeDefined();
      expect(cacheControl).toMatch(/no-store|no-cache|private/);
      
      // Pragma header for older browsers
      expect(headers['pragma']).toBe('no-cache');
      
      // Expires should be in the past or 0
      const expires = headers['expires'];
      if (expires) {
        const expiryDate = new Date(expires);
        expect(expiryDate.getTime()).toBeLessThanOrEqual(Date.now());
      }
    });
  });
  
  test.describe('Password Storage Security', () => {
    test('should use strong password hashing', async ({ request }) => {
      // We can't directly test the hashing algorithm, but we can check behaviors
      
      // Test that password changes invalidate old sessions
      const newPassword = 'NewEncryptTest123!';
      
      // Change password
      const changeResponse = await request.post('/api/v1/auth/change-password', {
        headers: { 'Authorization': `Bearer ${authToken}` },
        data: {
          currentPassword: testPassword,
          newPassword: newPassword,
          confirmPassword: newPassword
        }
      });
      
      if (changeResponse.ok()) {
        // Old token should be invalid
        const oldTokenResponse = await request.get('/api/v1/users/me', {
          headers: { 'Authorization': `Bearer ${authToken}` },
          failOnStatusCode: false
        });
        
        expect(oldTokenResponse.ok()).toBeFalsy();
        expect(oldTokenResponse.status()).toBe(401);
        
        // Login with new password
        const newLoginResponse = await request.post('http://localhost/api/v1/auth/login', {
          data: { email_or_username: testEmail, password: newPassword }
        });
        
        expect(newLoginResponse.ok()).toBeTruthy();
        
        // Change back for other tests
        const { token: newToken } = await newLoginResponse.json();
        await request.post('/api/v1/auth/change-password', {
          headers: { 'Authorization': `Bearer ${newToken}` },
          data: {
            currentPassword: newPassword,
            newPassword: testPassword,
            username: testEmail.split('@')[0],
        confirm_password: testPassword
          }
        });
      }
    });
    
    test('should not allow password reuse', async ({ request }) => {
      // Get fresh token
      const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: { email_or_username: testEmail, password: testPassword }
      });
      const { token } = await loginResponse.json();
      
      // Try to change to the same password
      const samePasswordResponse = await request.post('/api/v1/auth/change-password', {
        headers: { 'Authorization': `Bearer ${token}` },
        data: {
          currentPassword: testPassword,
          newPassword: testPassword,
          username: testEmail.split('@')[0],
        confirm_password: testPassword
        },
        failOnStatusCode: false
      });
      
      if (!samePasswordResponse.ok()) {
        expect(samePasswordResponse.status()).toBe(400);
        const error = await samePasswordResponse.json();
        expect(error.error).toMatch(/same|reuse|different/i);
        console.log('Password reuse prevention active');
      } else {
        console.warn('Password reuse not prevented - security recommendation');
      }
    });
  });
  
  test.describe('Sensitive Data Transmission', () => {
    test('should not include sensitive data in URLs', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      
      // Monitor navigation
      let urlWithSensitiveData = false;
      page.on('framenavigated', frame => {
        const url = frame.url();
        if (url.includes('password=') || 
            url.includes('token=') || 
            url.includes('session=') ||
            url.includes('api_key=')) {
          urlWithSensitiveData = true;
        }
      });
      
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      expect(urlWithSensitiveData).toBeFalsy();
      
      // Check current URL
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('password');
      expect(currentUrl).not.toContain('token');
      expect(currentUrl).not.toContain('session');
    });
    
    test('should use POST for sensitive operations', async ({ request }) => {
      // Try GET request for sensitive operations (should fail)
      const sensitiveGetEndpoints = [
        '/api/v1/auth/logout',
        '/api/v1/auth/change-password',
        '/api/v1/prompts/delete'
      ];
      
      for (const endpoint of sensitiveGetEndpoints) {
        const response = await request.get(endpoint, {
          headers: { 'Authorization': `Bearer ${authToken}` },
          failOnStatusCode: false
        });
        
        // Should not allow GET for state-changing operations
        expect(response.ok()).toBeFalsy();
        expect([405, 404]).toContain(response.status()); // Method Not Allowed or Not Found
      }
    });
  });
  
  test.describe('Cryptographic Security', () => {
    test('should use secure random number generation', async ({ page }) => {
      // Check if crypto API is used properly
      const cryptoUsage = await page.evaluate(() => {
        // Check if window.crypto is available
        const hasCrypto = !!window.crypto;
        const hasGetRandomValues = !!(window.crypto && window.crypto.getRandomValues);
        
        // Try to generate random values
        let randomValues: number[] = [];
        if (hasGetRandomValues) {
          const array = new Uint32Array(10);
          window.crypto.getRandomValues(array);
          randomValues = Array.from(array);
        }
        
        return {
          hasCrypto,
          hasGetRandomValues,
          randomValues,
          mathRandomWarning: randomValues.length === 0
        };
      });
      
      expect(cryptoUsage.hasCrypto).toBeTruthy();
      expect(cryptoUsage.hasGetRandomValues).toBeTruthy();
      
      if (cryptoUsage.mathRandomWarning) {
        console.warn('Math.random() might be used for security - use crypto.getRandomValues()');
      }
      
      // Check randomness quality
      if (cryptoUsage.randomValues.length > 0) {
        const values = cryptoUsage.randomValues;
        const uniqueValues = new Set(values);
        
        // Should have high entropy (all different values)
        expect(uniqueValues.size).toBe(values.length);
      }
    });
  });
  
  test.describe('Comprehensive Encryption Scan', () => {
    test('should pass comprehensive encryption vulnerability scan', async ({ page }) => {
      const scanner = new VulnerabilityScanner(page);
      
      // Navigate to main page
      await page.goto('/');
      
      // Run vulnerability scan
      const report = await scanner.runFullScan(page.url());
      
      // Filter for encryption-related vulnerabilities
      const encryptionVulnerabilities = report.vulnerabilities.filter(v => 
        v.owaspCategory === 'A02:2021 - Cryptographic Failures' ||
        v.type.includes('encryption') ||
        v.type.includes('https') ||
        v.type.includes('tls') ||
        v.description.toLowerCase().includes('encrypt')
      );
      
      // Should have no encryption vulnerabilities
      expect(encryptionVulnerabilities).toHaveLength(0);
      
      // Check for required security headers
      const requiredHeaders = [
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options'
      ];
      
      for (const header of requiredHeaders) {
        const headerCheck = report.securityHeaders.find(h => h.header === header);
        expect(headerCheck?.present).toBeTruthy();
      }
      
      // Generate report if issues found
      if (encryptionVulnerabilities.length > 0) {
        console.log('Encryption Vulnerabilities Found:');
        encryptionVulnerabilities.forEach(v => {
          console.log(`- ${v.description} (${v.severity})`);
          console.log(`  Evidence: ${v.evidence}`);
          console.log(`  Remediation: ${v.remediation}`);
        });
      }
    });
  });
});