/**
 * JWT Security Tests for BetterPrompts
 * Tests token security, expiration, tampering, and vulnerability scenarios
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { expect } = require('chai');

const API_BASE = process.env.API_BASE || 'http://localhost/api/v1';
const TEST_SECRET = 'test-secret-key-do-not-use-in-production';

describe('JWT Security Tests', () => {
  let validToken;
  let testUser;
  
  before(async () => {
    // Register and login test user
    testUser = {
      email: `security-test-${Date.now()}@example.com`,
      password: 'SecureP@ssw0rd123!',
      name: 'Security Test User'
    };
    
    await axios.post(`${API_BASE}/auth/register`, testUser);
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    validToken = loginRes.data.access_token;
  });
  
  describe('Token Validation', () => {
    it('should reject tokens with invalid signature', async () => {
      const [header, payload] = validToken.split('.').slice(0, 2);
      const tamperedSignature = crypto.randomBytes(32).toString('base64url');
      const tamperedToken = `${header}.${payload}.${tamperedSignature}`;
      
      try {
        await axios.get(`${API_BASE}/user/profile`, {
          headers: { Authorization: `Bearer ${tamperedToken}` }
        });
        expect.fail('Should have rejected tampered token');
      } catch (error) {
        expect(error.response.status).to.equal(401);
        expect(error.response.data.error).to.include('Invalid token');
      }
    });
    
    it('should reject tokens signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign(
        { user_id: 'test-user', email: testUser.email },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      
      try {
        await axios.get(`${API_BASE}/user/profile`, {
          headers: { Authorization: `Bearer ${wrongSecretToken}` }
        });
        expect.fail('Should have rejected token with wrong secret');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
    
    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { user_id: 'test-user', email: testUser.email },
        TEST_SECRET,
        { expiresIn: '-1h' } // Already expired
      );
      
      try {
        await axios.get(`${API_BASE}/user/profile`, {
          headers: { Authorization: `Bearer ${expiredToken}` }
        });
        expect.fail('Should have rejected expired token');
      } catch (error) {
        expect(error.response.status).to.equal(401);
        expect(error.response.data.error).to.include('expired');
      }
    });
    
    it('should reject tokens with invalid algorithm', async () => {
      // Try to use 'none' algorithm (security vulnerability)
      const noneAlgoToken = jwt.sign(
        { user_id: 'test-user', email: testUser.email },
        '',
        { algorithm: 'none' }
      );
      
      try {
        await axios.get(`${API_BASE}/user/profile`, {
          headers: { Authorization: `Bearer ${noneAlgoToken}` }
        });
        expect.fail('Should have rejected none algorithm token');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
    
    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        'not.a.token',
        'only.two',
        'extra.parts.here.four',
        btoa('{"typ":"JWT","alg":"HS256"}') + '.payload',
        ''
      ];
      
      for (const token of malformedTokens) {
        try {
          await axios.get(`${API_BASE}/user/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          expect.fail(`Should have rejected malformed token: ${token}`);
        } catch (error) {
          expect(error.response.status).to.equal(401);
        }
      }
    });
  });
  
  describe('Token Claims Security', () => {
    it('should validate required claims', async () => {
      const tokenMissingClaims = jwt.sign(
        { some_field: 'value' }, // Missing user_id and email
        TEST_SECRET,
        { expiresIn: '1h' }
      );
      
      try {
        await axios.get(`${API_BASE}/user/profile`, {
          headers: { Authorization: `Bearer ${tokenMissingClaims}` }
        });
        expect.fail('Should have rejected token missing required claims');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
    
    it('should prevent privilege escalation via token manipulation', async () => {
      // Decode valid token and try to add admin role
      const decoded = jwt.decode(validToken);
      const escalatedToken = jwt.sign(
        { ...decoded, role: 'admin', permissions: ['*'] },
        TEST_SECRET,
        { expiresIn: '1h' }
      );
      
      try {
        await axios.get(`${API_BASE}/admin/users`, {
          headers: { Authorization: `Bearer ${escalatedToken}` }
        });
        expect.fail('Should have prevented privilege escalation');
      } catch (error) {
        expect(error.response.status).to.be.oneOf([401, 403]);
      }
    });
    
    it('should validate token audience and issuer', async () => {
      const wrongAudienceToken = jwt.sign(
        { user_id: 'test-user', email: testUser.email },
        TEST_SECRET,
        { 
          expiresIn: '1h',
          audience: 'wrong-audience',
          issuer: 'wrong-issuer'
        }
      );
      
      try {
        await axios.get(`${API_BASE}/user/profile`, {
          headers: { Authorization: `Bearer ${wrongAudienceToken}` }
        });
        expect.fail('Should have rejected token with wrong audience/issuer');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
  });
  
  describe('Token Refresh Security', () => {
    it('should not allow access token as refresh token', async () => {
      try {
        await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: validToken // Using access token instead
        });
        expect.fail('Should not accept access token as refresh token');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
    
    it('should invalidate refresh tokens after use', async () => {
      // Get a fresh refresh token
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });
      const refreshToken = loginRes.data.refresh_token;
      
      // Use it once
      const firstRefresh = await axios.post(`${API_BASE}/auth/refresh`, {
        refresh_token: refreshToken
      });
      expect(firstRefresh.status).to.equal(200);
      
      // Try to use it again
      try {
        await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken
        });
        expect.fail('Should not allow refresh token reuse');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
    
    it('should detect refresh token rotation attacks', async () => {
      // Simulate stolen refresh token scenario
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testUser.email,
        password: testUser.password
      });
      const originalRefreshToken = loginRes.data.refresh_token;
      
      // Attacker uses the stolen token
      const attackerRefresh = await axios.post(`${API_BASE}/auth/refresh`, {
        refresh_token: originalRefreshToken
      });
      const attackerNewToken = attackerRefresh.data.refresh_token;
      
      // Original user tries to use their token
      try {
        await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: originalRefreshToken
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Both tokens should now be invalidated
      try {
        await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: attackerNewToken
        });
        expect.fail('Should have invalidated all tokens in the rotation');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
  });
  
  describe('Token Storage Security', () => {
    it('should set secure cookie flags', async () => {
      const loginRes = await axios.post(`${API_BASE}/auth/login`, 
        {
          email: testUser.email,
          password: testUser.password
        },
        {
          withCredentials: true,
          validateStatus: () => true
        }
      );
      
      const setCookieHeaders = loginRes.headers['set-cookie'];
      if (setCookieHeaders) {
        setCookieHeaders.forEach(cookie => {
          expect(cookie).to.include('HttpOnly');
          expect(cookie).to.include('SameSite=Strict');
          // Only check Secure flag in production
          if (process.env.NODE_ENV === 'production') {
            expect(cookie).to.include('Secure');
          }
        });
      }
    });
    
    it('should not expose sensitive data in tokens', async () => {
      const decoded = jwt.decode(validToken);
      
      // Check that sensitive data is not in the token
      expect(decoded).to.not.have.property('password');
      expect(decoded).to.not.have.property('password_hash');
      expect(decoded).to.not.have.property('credit_card');
      expect(decoded).to.not.have.property('ssn');
      expect(decoded).to.not.have.property('api_key');
    });
  });
  
  describe('Rate Limiting and Brute Force Protection', () => {
    it('should rate limit token generation attempts', async () => {
      const attempts = 20;
      const results = [];
      
      // Make rapid login attempts
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await axios.post(`${API_BASE}/auth/login`, {
            email: `nonexistent${i}@example.com`,
            password: 'wrong-password'
          }, { validateStatus: () => true });
          results.push(res.status);
        } catch (error) {
          results.push(error.response?.status || 500);
        }
      }
      
      // Should see 429 (rate limit) responses
      const rateLimited = results.filter(status => status === 429);
      expect(rateLimited.length).to.be.greaterThan(0);
    });
    
    it('should implement exponential backoff for failed attempts', async () => {
      const email = `backoff-test-${Date.now()}@example.com`;
      const startTime = Date.now();
      const attempts = [];
      
      // Make several failed attempts
      for (let i = 0; i < 5; i++) {
        const attemptStart = Date.now();
        try {
          await axios.post(`${API_BASE}/auth/login`, {
            email: email,
            password: 'wrong-password'
          });
        } catch (error) {
          attempts.push({
            attempt: i + 1,
            duration: Date.now() - attemptStart,
            status: error.response?.status
          });
        }
        
        // Wait a bit between attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Later attempts should take longer or be blocked
      const lastAttempt = attempts[attempts.length - 1];
      expect(lastAttempt.status).to.be.oneOf([401, 429]);
    });
  });
  
  describe('JWT Security Headers', () => {
    it('should not accept JWT in URL parameters', async () => {
      try {
        await axios.get(`${API_BASE}/user/profile?token=${validToken}`);
        expect.fail('Should not accept token in URL');
      } catch (error) {
        expect(error.response.status).to.equal(401);
      }
    });
    
    it('should validate Bearer scheme', async () => {
      const invalidSchemes = [
        `Basic ${validToken}`,
        `JWT ${validToken}`,
        `Token ${validToken}`,
        validToken // No scheme
      ];
      
      for (const authHeader of invalidSchemes) {
        try {
          await axios.get(`${API_BASE}/user/profile`, {
            headers: { Authorization: authHeader }
          });
          expect.fail(`Should have rejected auth header: ${authHeader}`);
        } catch (error) {
          expect(error.response.status).to.equal(401);
        }
      }
    });
  });
});

describe('RBAC Security Tests', () => {
  const users = {
    admin: { email: 'admin@test.com', password: 'Admin123!@#', role: 'admin' },
    user: { email: 'user@test.com', password: 'User123!@#', role: 'user' },
    moderator: { email: 'mod@test.com', password: 'Mod123!@#', role: 'moderator' }
  };
  
  const tokens = {};
  
  before(async () => {
    // Setup test users and get tokens
    for (const [role, userData] of Object.entries(users)) {
      try {
        await axios.post(`${API_BASE}/auth/register`, userData);
      } catch (e) {
        // User might already exist
      }
      
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: userData.email,
        password: userData.password
      });
      tokens[role] = loginRes.data.access_token;
    }
  });
  
  describe('Role-Based Access Control', () => {
    it('should enforce admin-only endpoints', async () => {
      const adminEndpoints = [
        '/admin/users',
        '/admin/metrics',
        '/admin/config',
        '/admin/logs'
      ];
      
      for (const endpoint of adminEndpoints) {
        // Admin should have access
        const adminRes = await axios.get(`${API_BASE}${endpoint}`, {
          headers: { Authorization: `Bearer ${tokens.admin}` },
          validateStatus: () => true
        });
        expect(adminRes.status).to.not.equal(403);
        
        // Regular user should not
        try {
          await axios.get(`${API_BASE}${endpoint}`, {
            headers: { Authorization: `Bearer ${tokens.user}` }
          });
          expect.fail(`User should not access ${endpoint}`);
        } catch (error) {
          expect(error.response.status).to.equal(403);
        }
      }
    });
    
    it('should validate permission-based access', async () => {
      // Test specific permissions
      const permissionTests = [
        { 
          endpoint: '/admin/users/delete/123',
          method: 'delete',
          requiredPermission: 'users:delete',
          allowedRoles: ['admin']
        },
        {
          endpoint: '/history/export',
          method: 'get',
          requiredPermission: 'history:export',
          allowedRoles: ['admin', 'user']
        },
        {
          endpoint: '/admin/reports/generate',
          method: 'post',
          requiredPermission: 'reports:generate',
          allowedRoles: ['admin', 'moderator']
        }
      ];
      
      for (const test of permissionTests) {
        for (const [role, token] of Object.entries(tokens)) {
          const res = await axios({
            method: test.method,
            url: `${API_BASE}${test.endpoint}`,
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: () => true
          });
          
          if (test.allowedRoles.includes(role)) {
            expect(res.status).to.not.equal(403);
          } else {
            expect(res.status).to.equal(403);
          }
        }
      }
    });
    
    it('should prevent horizontal privilege escalation', async () => {
      // Create two regular users
      const user1 = { 
        email: `user1-${Date.now()}@test.com`, 
        password: 'User1Pass123!' 
      };
      const user2 = { 
        email: `user2-${Date.now()}@test.com`, 
        password: 'User2Pass123!' 
      };
      
      await axios.post(`${API_BASE}/auth/register`, user1);
      await axios.post(`${API_BASE}/auth/register`, user2);
      
      const user1Login = await axios.post(`${API_BASE}/auth/login`, user1);
      const user1Token = user1Login.data.access_token;
      const user1Id = user1Login.data.user.id;
      
      const user2Login = await axios.post(`${API_BASE}/auth/login`, user2);
      const user2Token = user2Login.data.access_token;
      const user2Id = user2Login.data.user.id;
      
      // User1 should not be able to access User2's data
      try {
        await axios.get(`${API_BASE}/user/${user2Id}/private-data`, {
          headers: { Authorization: `Bearer ${user1Token}` }
        });
        expect.fail('Should prevent horizontal privilege escalation');
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
      
      // User1 should not be able to modify User2's data
      try {
        await axios.put(`${API_BASE}/user/${user2Id}/profile`, 
          { name: 'Hacked' },
          { headers: { Authorization: `Bearer ${user1Token}` } }
        );
        expect.fail('Should prevent horizontal privilege escalation');
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
    });
  });
  
  describe('Permission Inheritance and Hierarchy', () => {
    it('should properly handle role hierarchy', async () => {
      // Assuming: admin > moderator > user
      const hierarchyTests = [
        {
          resource: '/content/moderate',
          allowedRoles: ['admin', 'moderator'],
          deniedRoles: ['user']
        },
        {
          resource: '/enhance',
          allowedRoles: ['admin', 'moderator', 'user'],
          deniedRoles: []
        }
      ];
      
      for (const test of hierarchyTests) {
        for (const role of test.allowedRoles) {
          const res = await axios.post(`${API_BASE}${test.resource}`, 
            { test: 'data' },
            { 
              headers: { Authorization: `Bearer ${tokens[role]}` },
              validateStatus: () => true
            }
          );
          expect(res.status).to.not.equal(403);
        }
        
        for (const role of test.deniedRoles) {
          try {
            await axios.post(`${API_BASE}${test.resource}`,
              { test: 'data' },
              { headers: { Authorization: `Bearer ${tokens[role]}` } }
            );
            expect.fail(`${role} should not access ${test.resource}`);
          } catch (error) {
            expect(error.response.status).to.equal(403);
          }
        }
      }
    });
  });
});