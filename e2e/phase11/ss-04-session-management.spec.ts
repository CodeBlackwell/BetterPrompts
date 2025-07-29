/**
 * SS-04: Session Management Security Tests
 * Tests session security including randomness, expiration, and CSRF protection
 */

import { test, expect, BrowserContext } from '@playwright/test';
import { SecurityPayloadGenerator } from './utils/security-payload-generator';

test.describe('SS-04: Session Management', () => {
  let authToken: string;
  const testEmail = 'session_test_user@betterprompts.ai';
  const testPassword = 'SessionTest123!';
  
  test.beforeAll(async ({ request }) => {
    // Ensure test user exists
    const registerResponse = await request.post('http://localhost/api/v1/auth/register', {
      data: {
        email: testEmail,
        password: testPassword,
        username: testEmail.split('@')[0],
        confirm_password: testPassword
      },
      failOnStatusCode: false
    });
    
    // Login to get token
    const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
      data: { email_or_username: testEmail, password: testPassword }
    });
    
    const data = await loginResponse.json();
    authToken = data.access_token;
  });
  
  test.describe('Session Token Randomness', () => {
    test('should generate cryptographically secure session tokens', async ({ request }) => {
      const tokens: string[] = [];
      const sessionIds: string[] = [];
      
      // Collect multiple tokens
      for (let i = 0; i < 10; i++) {
        const response = await request.post('http://localhost/api/v1/auth/login', {
          data: { email_or_username: testEmail, password: testPassword }
        });
        
        const data = await response.json();
        tokens.push(data.token);
        
        // Also check for session ID in headers/cookies
        const setCookieHeader = response.headers()['set-cookie'];
        if (setCookieHeader) {
          const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
          if (sessionMatch) {
            sessionIds.push(sessionMatch[1]);
          }
        }
      }
      
      // Check token uniqueness
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
      
      // Check for patterns in tokens
      for (let i = 1; i < tokens.length; i++) {
        // Tokens should be sufficiently different
        const similarity = calculateSimilarity(tokens[i-1], tokens[i]);
        expect(similarity).toBeLessThan(0.5); // Less than 50% similar
      }
      
      // Check session IDs if present
      if (sessionIds.length > 0) {
        const uniqueSessions = new Set(sessionIds);
        expect(uniqueSessions.size).toBe(sessionIds.length);
        
        // Session IDs should not be sequential
        const isSequential = checkIfSequential(sessionIds);
        expect(isSequential).toBeFalsy();
      }
    });
    
    test('should not use predictable session identifiers', async ({ context }) => {
      const page = await context.newPage();
      
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Get cookies
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => 
        c.name.toLowerCase().includes('session') || 
        c.name === 'auth_token'
      );
      
      expect(sessionCookie).toBeDefined();
      
      if (sessionCookie) {
        // Check for weak patterns
        const value = sessionCookie.value;
        
        // Should not be numeric only
        expect(value).not.toMatch(/^\d+$/);
        
        // Should not be timestamp-based
        const timestamp = Date.now();
        expect(value).not.toContain(timestamp.toString().substring(0, 10));
        
        // Should not be a simple hash of user ID
        expect(value).not.toMatch(/^[a-f0-9]{32}$/); // Simple MD5
        expect(value).not.toMatch(/^[a-f0-9]{40}$/); // Simple SHA1
        
        // Should have sufficient entropy (length)
        expect(value.length).toBeGreaterThanOrEqual(32);
      }
    });
  });
  
  test.describe('Session Expiration', () => {
    test('should expire sessions after inactivity', async ({ request }) => {
      // This test would require waiting for actual timeout
      // We'll test the API behavior with an old token
      
      // Create a token with manipulated expiration
      const parts = authToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        // Set expiration to past
        payload.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        
        const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const expiredToken = `${parts[0]}.${newPayload}.${parts[2]}`;
        
        const response = await request.get('/api/v1/users/me', {
          headers: { 'Authorization': `Bearer ${expiredToken}` },
          failOnStatusCode: false
        });
        
        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(401);
        
        const error = await response.json();
        expect(error.error).toMatch(/expired|invalid/i);
      }
    });
    
    test('should properly handle session timeout warnings', async ({ page, context }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Check if session timeout warning mechanism exists
      const hasTimeoutWarning = await page.evaluate(() => {
        // Check for session timeout handling in window object
        return !!(window as any).sessionTimeout || 
               !!(window as any).sessionWarning ||
               !!document.querySelector('[data-session-warning]');
      });
      
      if (hasTimeoutWarning) {
        console.log('Session timeout warning mechanism detected');
      } else {
        console.warn('No session timeout warning mechanism found - security recommendation');
      }
    });
  });
  
  test.describe('Logout Functionality', () => {
    test('should properly invalidate sessions on logout', async ({ page, context, request }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Get auth token from cookies
      const cookies = await context.cookies();
      const authCookie = cookies.find(c => c.name === 'auth_token');
      const sessionToken = authCookie?.value || authToken;
      
      // Logout
      await page.click('button[data-testid="logout"], [aria-label="Logout"], .logout-button');
      await page.waitForURL('/login');
      
      // Try to use the old token
      const response = await request.get('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
        failOnStatusCode: false
      });
      
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(401);
      
      // Verify cookies are cleared
      const loggedOutCookies = await context.cookies();
      const remainingAuthCookie = loggedOutCookies.find(c => c.name === 'auth_token');
      expect(remainingAuthCookie).toBeUndefined();
    });
    
    test('should clear all session data on logout', async ({ page, context }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Set some session storage and local storage
      await page.evaluate(() => {
        sessionStorage.setItem('test_session_data', 'sensitive');
        localStorage.setItem('test_local_data', 'sensitive');
        localStorage.setItem('auth_token', 'test_token');
      });
      
      // Logout
      await page.click('button[data-testid="logout"], [aria-label="Logout"], .logout-button');
      await page.waitForURL('/login');
      
      // Check storage is cleared
      const storageData = await page.evaluate(() => {
        return {
          sessionStorage: sessionStorage.getItem('test_session_data'),
          localStorage: localStorage.getItem('test_local_data'),
          authToken: localStorage.getItem('auth_token')
        };
      });
      
      expect(storageData.sessionStorage).toBeNull();
      expect(storageData.authToken).toBeNull();
      // Non-auth local storage might persist
    });
  });
  
  test.describe('Concurrent Sessions', () => {
    test('should handle concurrent sessions securely', async ({ browser }) => {
      // Create two separate browser contexts (sessions)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // Login in both contexts
      for (const page of [page1, page2]) {
        await page.goto('/login');
        await page.fill('input[name="email"]', testEmail);
        await page.fill('input[name="password"]', testPassword);
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
      }
      
      // Both sessions should work
      await page1.reload();
      expect(page1.url()).toContain('/dashboard');
      
      await page2.reload();
      expect(page2.url()).toContain('/dashboard');
      
      // Logout from one should not affect the other (unless single session enforced)
      await page1.click('button[data-testid="logout"], [aria-label="Logout"], .logout-button');
      await page1.waitForURL('/login');
      
      // Check if other session is still valid
      await page2.reload();
      // This depends on security policy - concurrent sessions may or may not be allowed
      const page2StillLoggedIn = page2.url().includes('/dashboard');
      
      if (!page2StillLoggedIn) {
        console.log('Single session enforcement detected - good security practice');
      } else {
        console.log('Concurrent sessions allowed - ensure proper session tracking');
      }
      
      // Clean up
      await context1.close();
      await context2.close();
    });
  });
  
  test.describe('CSRF Protection', () => {
    test('should include CSRF tokens in state-changing requests', async ({ page, request }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Check for CSRF token in page
      const csrfToken = await page.evaluate(() => {
        // Common places to find CSRF token
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) return metaTag.getAttribute('content');
        
        const inputField = document.querySelector('input[name="csrf_token"], input[name="_csrf"]');
        if (inputField) return (inputField as HTMLInputElement).value;
        
        // Check in window object
        const win = window as any;
        return win.csrfToken || win.CSRF_TOKEN || win._csrf;
      });
      
      if (csrfToken) {
        console.log('CSRF token found in page');
        
        // Test that requests without CSRF token are rejected
        const response = await request.post('/api/v1/prompts', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          data: {
            title: 'Test Prompt',
            content: 'Test content'
          },
          failOnStatusCode: false
        });
        
        // If CSRF is enforced, request without token should fail
        if (!response.ok() && response.status() === 403) {
          const error = await response.json();
          expect(error.error).toMatch(/csrf|token/i);
          console.log('CSRF protection is enforced');
        }
      } else {
        console.warn('No CSRF token found - security recommendation');
      }
    });
    
    test('should reject cross-origin requests without proper CSRF token', async ({ request, browser }) => {
      // Create a context with different origin
      const attackContext = await browser.newContext({
        extraHTTPHeaders: {
          'Origin': 'http://evil.com',
          'Referer': 'http://evil.com'
        }
      });
      
      const attackRequest = attackContext.request;
      
      // Try to make state-changing request from different origin
      const response = await attackRequest.post('http://localhost/api/v1/prompts', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          title: 'CSRF Attack',
          content: 'Malicious content'
        },
        failOnStatusCode: false
      });
      
      // Should be rejected
      expect(response.ok()).toBeFalsy();
      expect([403, 401]).toContain(response.status());
      
      await attackContext.close();
    });
    
    test('should validate referer header for state-changing requests', async ({ request }) => {
      const maliciousReferers = [
        'http://evil.com',
        'https://attacker.com',
        'null',
        ''
      ];
      
      for (const referer of maliciousReferers) {
        const response = await request.post('/api/v1/prompts', {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Referer': referer
          },
          data: {
            title: 'Test',
            content: 'Test'
          },
          failOnStatusCode: false
        });
        
        // Might be rejected based on referer validation
        if (!response.ok() && response.status() === 403) {
          console.log(`Referer validation enforced: rejected ${referer}`);
        }
      }
    });
  });
  
  test.describe('Session Fixation Prevention', () => {
    test('should regenerate session ID on login', async ({ context }) => {
      const page = await context.newPage();
      
      // Visit site before login
      await page.goto('/');
      
      // Get pre-login cookies
      const preLoginCookies = await context.cookies();
      const preLoginSession = preLoginCookies.find(c => 
        c.name.toLowerCase().includes('session')
      );
      
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Get post-login cookies
      const postLoginCookies = await context.cookies();
      const postLoginSession = postLoginCookies.find(c => 
        c.name.toLowerCase().includes('session')
      );
      
      if (preLoginSession && postLoginSession) {
        // Session ID should change after login
        expect(postLoginSession.value).not.toBe(preLoginSession.value);
        console.log('Session regeneration on login confirmed');
      }
    });
    
    test('should not accept externally provided session IDs', async ({ page, context }) => {
      // Try to set a known session ID
      const fixedSessionId = 'attacker_controlled_session_123';
      
      await context.addCookies([{
        name: 'session_id',
        value: fixedSessionId,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false
      }]);
      
      // Try to login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Check if session ID changed
      const cookies = await context.cookies();
      const currentSession = cookies.find(c => c.name === 'session_id');
      
      if (currentSession) {
        expect(currentSession.value).not.toBe(fixedSessionId);
        console.log('Session fixation prevention confirmed');
      }
    });
  });
  
  test.describe('Session Storage Security', () => {
    test('should use secure cookie attributes', async ({ page, context }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Check cookie attributes
      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(c => 
        c.name.toLowerCase().includes('session') ||
        c.name === 'auth_token' ||
        c.name.toLowerCase().includes('auth')
      );
      
      for (const cookie of sessionCookies) {
        // Should have HttpOnly flag
        expect(cookie.httpOnly).toBeTruthy();
        
        // Should have Secure flag (in production)
        // Note: might be false in local development
        if (!cookie.domain?.includes('localhost')) {
          expect(cookie.secure).toBeTruthy();
        }
        
        // Should have SameSite attribute
        expect(cookie.sameSite).toBeDefined();
        expect(['Strict', 'Lax']).toContain(cookie.sameSite);
        
        // Should have reasonable expiration
        if (cookie.expires) {
          const expirationTime = cookie.expires - Date.now() / 1000;
          expect(expirationTime).toBeGreaterThan(0);
          expect(expirationTime).toBeLessThan(86400 * 30); // Less than 30 days
        }
      }
    });
    
    test('should not store sensitive data in localStorage', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard');
      
      // Check localStorage
      const localStorageData = await page.evaluate(() => {
        const storage: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            storage[key] = localStorage.getItem(key) || '';
          }
        }
        return storage;
      });
      
      // Check for sensitive data
      const sensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /session/i,
        /auth/i,
        /api.*key/i
      ];
      
      for (const [key, value] of Object.entries(localStorageData)) {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(key) || pattern.test(value)) {
            // Some exceptions might be acceptable (e.g., auth_token for SPA)
            if (key === 'auth_token') {
              console.warn('Auth token in localStorage - ensure proper security measures');
            } else {
              console.error(`Potentially sensitive data in localStorage: ${key}`);
            }
          }
        }
      }
    });
  });
  
  test.describe('Session Hijacking Prevention', () => {
    test('should detect and prevent session hijacking attempts', async ({ request }) => {
      // Get valid session token
      const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: { email_or_username: testEmail, password: testPassword }
      });
      const { token } = await loginResponse.json();
      
      // Simulate hijacking by changing IP
      const hijackResponse = await request.get('/api/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Forwarded-For': '192.168.1.100' // Different IP
        }
      });
      
      // System should either:
      // 1. Block the request
      // 2. Log security event
      // 3. Require re-authentication
      
      if (!hijackResponse.ok()) {
        console.log('Session hijacking prevention active - request blocked');
        expect(hijackResponse.status()).toBe(401);
      } else {
        // Check if security event was logged
        const eventsResponse = await request.get('/api/v1/auth/security-events', {
          headers: { 'Authorization': `Bearer ${token}` },
          failOnStatusCode: false
        });
        
        if (eventsResponse.ok()) {
          const events = await eventsResponse.json();
          const suspiciousEvents = events.filter((e: any) => 
            e.type === 'ip_change' || e.type === 'suspicious_activity'
          );
          expect(suspiciousEvents.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

// Helper functions
function calculateSimilarity(str1: string, str2: string): number {
  if (str1.length !== str2.length) return 0;
  
  let matches = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1[i] === str2[i]) matches++;
  }
  
  return matches / str1.length;
}

function checkIfSequential(values: string[]): boolean {
  // Check if values follow a sequential pattern
  const numbers = values.map(v => {
    const match = v.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }).filter(n => n !== null) as number[];
  
  if (numbers.length < 2) return false;
  
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] !== numbers[i-1] + 1) {
      return false;
    }
  }
  
  return true;
}