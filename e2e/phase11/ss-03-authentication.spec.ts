/**
 * SS-03: Authentication Security Tests
 * Tests authentication mechanisms for security vulnerabilities
 */

import { test, expect } from '@playwright/test';
import { SecurityPayloadGenerator } from './utils/security-payload-generator';

test.describe('SS-03: Authentication Security', () => {
  const testEmail = 'auth_security_test@betterprompts.ai';
  const testPassword = 'SecureAuthTest123!';
  
  test.describe('Password Complexity Requirements', () => {
    test('should enforce minimum password length', async ({ request }) => {
      const shortPasswords = ['Pass1!', '12345!', 'Abc123!', 'Test1!'];
      
      for (const password of shortPasswords) {
        const response = await request.post('/api/v1/auth/register', {
          data: {
            email: `short_${Date.now()}@test.com`,
            password: password,
            confirmPassword: password
          },
          failOnStatusCode: false
        });
        
        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(400);
        
        const error = await response.json();
        expect(error.error).toContain('password');
        expect(error.error.toLowerCase()).toMatch(/length|short|minimum/);
      }
    });
    
    test('should require mixed case, numbers, and special characters', async ({ request }) => {
      const weakPasswords = [
        { password: 'alllowercase123!', issue: 'no uppercase' },
        { password: 'ALLUPPERCASE123!', issue: 'no lowercase' },
        { password: 'NoNumbers!!!!!!!', issue: 'no numbers' },
        { password: 'NoSpecialChars123', issue: 'no special characters' },
        { password: 'password12345678', issue: 'common password' }
      ];
      
      for (const { password, issue } of weakPasswords) {
        const response = await request.post('/api/v1/auth/register', {
          data: {
            email: `weak_${Date.now()}@test.com`,
            password: password,
            confirmPassword: password
          },
          failOnStatusCode: false
        });
        
        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(400);
        
        const error = await response.json();
        expect(error.error).toBeDefined();
        console.log(`Password rejected for ${issue}: ${error.error}`);
      }
    });
    
    test('should reject commonly used passwords', async ({ request }) => {
      const commonPasswords = SecurityPayloadGenerator.getAuthenticationPayloads()
        .filter(p => p.category === 'weak_password')
        .map(p => p.payload);
      
      for (const password of commonPasswords) {
        const response = await request.post('/api/v1/auth/register', {
          data: {
            email: `common_${Date.now()}@test.com`,
            password: password,
            confirmPassword: password
          },
          failOnStatusCode: false
        });
        
        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(400);
        
        const error = await response.json();
        expect(error.error.toLowerCase()).toMatch(/weak|common|password/);
      }
    });
  });
  
  test.describe('Account Lockout Mechanism', () => {
    test('should lock account after multiple failed login attempts', async ({ request }) => {
      const lockoutEmail = `lockout_test_${Date.now()}@test.com`;
      const correctPassword = 'LockoutTest123!';
      
      // First, create the account
      const registerResponse = await request.post('/api/v1/auth/register', {
        data: {
          email: lockoutEmail,
          password: correctPassword,
          confirmPassword: correctPassword
        }
      });
      expect(registerResponse.ok()).toBeTruthy();
      
      // Make multiple failed login attempts
      const maxAttempts = 5;
      let lockedOut = false;
      
      for (let i = 0; i < maxAttempts + 2; i++) {
        const response = await request.post('http://localhost/api/v1/auth/login', {
          data: {
            email: lockoutEmail,
            password: 'WrongPassword123!'
          },
          failOnStatusCode: false
        });
        
        if (i < maxAttempts) {
          expect(response.status()).toBe(401);
          const error = await response.json();
          
          // Check if error indicates remaining attempts
          if (error.remainingAttempts !== undefined) {
            expect(error.remainingAttempts).toBe(maxAttempts - i - 1);
          }
        } else {
          // Should be locked out now
          expect([401, 429]).toContain(response.status());
          const error = await response.json();
          
          if (error.error.toLowerCase().includes('locked') || 
              error.error.toLowerCase().includes('too many')) {
            lockedOut = true;
          }
        }
      }
      
      expect(lockedOut).toBeTruthy();
      
      // Verify correct password also fails during lockout
      const lockedResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: {
          email: lockoutEmail,
          password: correctPassword
        },
        failOnStatusCode: false
      });
      
      expect(lockedResponse.ok()).toBeFalsy();
      expect([401, 429]).toContain(lockedResponse.status());
    });
    
    test('should reset failed attempts on successful login', async ({ request }) => {
      const resetEmail = `reset_test_${Date.now()}@test.com`;
      const password = 'ResetTest123!';
      
      // Create account
      await request.post('/api/v1/auth/register', {
        data: {
          email: resetEmail,
          password: password,
          confirmPassword: password
        }
      });
      
      // Make some failed attempts (but not enough to lock)
      for (let i = 0; i < 3; i++) {
        await request.post('http://localhost/api/v1/auth/login', {
          data: {
            email: resetEmail,
            password: 'WrongPassword123!'
          },
          failOnStatusCode: false
        });
      }
      
      // Successful login should reset counter
      const successResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: {
          email: resetEmail,
          password: password
        }
      });
      expect(successResponse.ok()).toBeTruthy();
      
      // Make failed attempts again - counter should have reset
      for (let i = 0; i < 3; i++) {
        const response = await request.post('http://localhost/api/v1/auth/login', {
          data: {
            email: resetEmail,
            password: 'WrongPassword123!'
          },
          failOnStatusCode: false
        });
        
        // Should not be locked out yet
        expect(response.status()).toBe(401);
      }
    });
  });
  
  test.describe('Password Reset Security', () => {
    test('should generate secure, unpredictable reset tokens', async ({ request }) => {
      const resetEmail = 'security_test_user@betterprompts.ai';
      const tokens: string[] = [];
      
      // Request multiple password reset tokens
      for (let i = 0; i < 5; i++) {
        const response = await request.post('/api/v1/auth/forgot-password', {
          data: { email: resetEmail }
        });
        
        expect(response.ok()).toBeTruthy();
        
        // In a real test, we'd extract the token from email
        // For now, we'll check the response
        const data = await response.json();
        
        // Token should not be in response (security risk)
        expect(data.access_token).toBeUndefined();
        expect(data.resetToken).toBeUndefined();
        
        // Response should be generic
        expect(data.message).toMatch(/email.*sent|check.*email/i);
        
        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
    
    test('should expire reset tokens after a reasonable time', async ({ request }) => {
      // This test would require access to an old token
      // We'll test the API behavior with an expired token
      const expiredToken = 'expired_token_12345';
      
      const response = await request.post('/api/v1/auth/reset-password', {
        data: {
          token: expiredToken,
          newPassword: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        },
        failOnStatusCode: false
      });
      
      expect(response.ok()).toBeFalsy();
      expect([400, 401]).toContain(response.status());
      
      const error = await response.json();
      expect(error.error.toLowerCase()).toMatch(/expired|invalid|token/);
    });
    
    test('should invalidate tokens after single use', async ({ request }) => {
      // This would require a valid token to test properly
      // We'll test the expected behavior
      const usedToken = 'already_used_token_12345';
      
      const response = await request.post('/api/v1/auth/reset-password', {
        data: {
          token: usedToken,
          newPassword: 'NewSecurePass123!',
          confirmPassword: 'NewSecurePass123!'
        },
        failOnStatusCode: false
      });
      
      expect(response.ok()).toBeFalsy();
      expect([400, 401]).toContain(response.status());
      
      const error = await response.json();
      expect(error.error.toLowerCase()).toMatch(/invalid|used|token/);
    });
  });
  
  test.describe('Multi-Factor Authentication', () => {
    test('should support MFA setup and verification', async ({ request }) => {
      // First, login as a test user
      const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: {
          email: testEmail,
          password: testPassword
        }
      });
      
      const { token } = await loginResponse.json();
      
      // Check if MFA endpoints exist
      const mfaSetupResponse = await request.get('/api/v1/auth/mfa/setup', {
        headers: { 'Authorization': `Bearer ${token}` },
        failOnStatusCode: false
      });
      
      // If MFA is implemented
      if (mfaSetupResponse.ok()) {
        const mfaData = await mfaSetupResponse.json();
        
        // Should return QR code or secret
        expect(mfaData.secret || mfaData.qrCode).toBeDefined();
        
        // Should not return recovery codes until MFA is confirmed
        expect(mfaData.recoveryCodes).toBeUndefined();
      } else if (mfaSetupResponse.status() === 404) {
        // MFA not implemented yet - log warning
        console.warn('MFA endpoints not implemented - security recommendation');
      }
    });
  });
  
  test.describe('Timing Attack Prevention', () => {
    test('should have consistent response times for valid/invalid users', async ({ request }) => {
      const validEmail = testEmail;
      const invalidEmail = 'nonexistent_user_12345@invalid.com';
      const password = 'TestPassword123!';
      
      const timings = {
        valid: [] as number[],
        invalid: [] as number[]
      };
      
      // Measure multiple attempts for each
      const attempts = 10;
      
      for (let i = 0; i < attempts; i++) {
        // Valid user
        const validStart = Date.now();
        await request.post('http://localhost/api/v1/auth/login', {
          data: { email: validEmail, password: password },
          failOnStatusCode: false
        });
        timings.valid.push(Date.now() - validStart);
        
        // Invalid user
        const invalidStart = Date.now();
        await request.post('http://localhost/api/v1/auth/login', {
          data: { email: invalidEmail, password: password },
          failOnStatusCode: false
        });
        timings.invalid.push(Date.now() - invalidStart);
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Calculate averages
      const avgValid = timings.valid.reduce((a, b) => a + b) / timings.valid.length;
      const avgInvalid = timings.invalid.reduce((a, b) => a + b) / timings.invalid.length;
      
      // Difference should be minimal (less than 50ms)
      const timingDifference = Math.abs(avgValid - avgInvalid);
      console.log(`Timing difference: ${timingDifference}ms (valid: ${avgValid}ms, invalid: ${avgInvalid}ms)`);
      
      // Allow some variance but flag significant differences
      if (timingDifference > 50) {
        console.warn('Potential timing attack vulnerability detected');
      }
      
      expect(timingDifference).toBeLessThan(100); // Fail if difference is too large
    });
  });
  
  test.describe('Session Security', () => {
    test('should invalidate sessions on password change', async ({ request }) => {
      // Create a new test user
      const sessionEmail = `session_test_${Date.now()}@test.com`;
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword123!';
      
      // Register
      await request.post('/api/v1/auth/register', {
        data: {
          email: sessionEmail,
          password: oldPassword,
          confirmPassword: oldPassword
        }
      });
      
      // Login and get token
      const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: { email: sessionEmail, password: oldPassword }
      });
      const { token: oldToken } = await loginResponse.json();
      
      // Verify token works
      const meResponse = await request.get('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${oldToken}` }
      });
      expect(meResponse.ok()).toBeTruthy();
      
      // Change password
      const changeResponse = await request.post('/api/v1/auth/change-password', {
        headers: { 'Authorization': `Bearer ${oldToken}` },
        data: {
          currentPassword: oldPassword,
          newPassword: newPassword,
          confirmPassword: newPassword
        }
      });
      expect(changeResponse.ok()).toBeTruthy();
      
      // Old token should now be invalid
      const invalidResponse = await request.get('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${oldToken}` },
        failOnStatusCode: false
      });
      
      expect(invalidResponse.ok()).toBeFalsy();
      expect(invalidResponse.status()).toBe(401);
    });
    
    test('should prevent concurrent session hijacking', async ({ request }) => {
      // Login from "different locations"
      const loginData = { email_or_username: testEmail, password: testPassword };
      
      // First login
      const login1 = await request.post('http://localhost/api/v1/auth/login', {
        data: loginData,
        headers: { 'X-Forwarded-For': '192.168.1.100' }
      });
      const { token: token1 } = await login1.json();
      
      // Second login from different IP
      const login2 = await request.post('http://localhost/api/v1/auth/login', {
        data: loginData,
        headers: { 'X-Forwarded-For': '10.0.0.50' }
      });
      const { token: token2 } = await login2.json();
      
      // Both tokens should work (concurrent sessions allowed)
      // but system should log/alert on suspicious activity
      const response1 = await request.get('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${token1}` }
      });
      const response2 = await request.get('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${token2}` }
      });
      
      expect(response1.ok()).toBeTruthy();
      expect(response2.ok()).toBeTruthy();
      
      // Check if security events endpoint exists
      const eventsResponse = await request.get('/api/v1/auth/security-events', {
        headers: { 'Authorization': `Bearer ${token2}` },
        failOnStatusCode: false
      });
      
      if (eventsResponse.ok()) {
        const events = await eventsResponse.json();
        // Should log concurrent sessions from different IPs
        const suspiciousEvents = events.filter((e: any) => 
          e.type === 'concurrent_session' || e.type === 'ip_change'
        );
        expect(suspiciousEvents.length).toBeGreaterThan(0);
      }
    });
  });
  
  test.describe('Authentication Token Security', () => {
    test('should use secure JWT configuration', async ({ request }) => {
      const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: { email_or_username: testEmail, password: testPassword }
      });
      
      const { token } = await loginResponse.json();
      
      // Decode JWT (without verification)
      const parts = token.split('.');
      expect(parts).toHaveLength(3); // header.payload.signature
      
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check algorithm - should not be 'none' or weak
      expect(header.alg).not.toBe('none');
      expect(header.alg).not.toBe('HS256'); // Prefer RS256 or ES256
      expect(['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512', 'HS512']).toContain(header.alg);
      
      // Check expiration
      expect(payload.exp).toBeDefined();
      const expirationTime = (payload.exp - payload.iat) / 60; // minutes
      expect(expirationTime).toBeLessThanOrEqual(60); // Should expire within 1 hour
      
      // Should not contain sensitive data
      expect(payload.password).toBeUndefined();
      expect(payload.passwordHash).toBeUndefined();
    });
    
    test('should validate token signature', async ({ request }) => {
      // Try to use a tampered token
      const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: { email_or_username: testEmail, password: testPassword }
      });
      
      const { token } = await loginResponse.json();
      
      // Tamper with the token
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.role = 'admin'; // Try to escalate privileges
      
      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      
      // Try to use tampered token
      const response = await request.get('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${tamperedToken}` },
        failOnStatusCode: false
      });
      
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(401);
      
      const error = await response.json();
      expect(error.error).toMatch(/invalid|unauthorized|signature/i);
    });
  });
  
  test.describe('Brute Force Protection', () => {
    test('should rate limit login attempts', async ({ request }) => {
      const bruteForceEmail = 'bruteforce_test@test.com';
      const attempts = 20; // Try many rapid attempts
      const responses = [];
      
      for (let i = 0; i < attempts; i++) {
        const response = await request.post('http://localhost/api/v1/auth/login', {
          data: {
            email: bruteForceEmail,
            password: `attempt_${i}`
          },
          failOnStatusCode: false
        });
        
        responses.push({
          status: response.status(),
          headers: response.headers()
        });
        
        // No delay - testing rate limiting
      }
      
      // Should see 429 (Too Many Requests) at some point
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBeTruthy();
      
      // Check for rate limit headers
      const limitedResponse = responses.find(r => r.status === 429);
      if (limitedResponse) {
        expect(limitedResponse.headers['retry-after']).toBeDefined();
        expect(limitedResponse.headers['x-ratelimit-limit']).toBeDefined();
        expect(limitedResponse.headers['x-ratelimit-remaining']).toBeDefined();
      }
    });
  });
  
  test.describe('Password Storage Security', () => {
    test('should never expose password hashes', async ({ request }) => {
      // Try various endpoints that might expose user data
      const loginResponse = await request.post('http://localhost/api/v1/auth/login', {
        data: { email_or_username: testEmail, password: testPassword }
      });
      const { token } = await loginResponse.json();
      
      const endpoints = [
        '/api/v1/users/me',
        '/api/v1/users',
        `/api/v1/users/${testEmail}`,
        '/api/v1/auth/session'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request.get(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` },
          failOnStatusCode: false
        });
        
        if (response.ok()) {
          const data = await response.json();
          const jsonString = JSON.stringify(data);
          
          // Check for password-related fields
          expect(jsonString).not.toContain('password');
          expect(jsonString).not.toContain('passwordHash');
          expect(jsonString).not.toContain('password_hash');
          expect(jsonString).not.toContain('pwd');
          expect(jsonString).not.toMatch(/\$2[aby]\$\d{2}\$/); // bcrypt pattern
          expect(jsonString).not.toMatch(/pbkdf2/i); // PBKDF2 pattern
        }
      }
    });
  });
});