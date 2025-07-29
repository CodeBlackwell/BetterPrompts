/**
 * Simple authentication test to verify setup
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Test', () => {
  test('should authenticate successfully', async ({ request }) => {
    // Test user credentials
    const credentials = {
      email_or_username: 'security_test_user@betterprompts.ai',
      password: 'SecureTest123!'
    };
    
    // Login
    const response = await request.post('http://localhost/api/v1/auth/login', {
      data: credentials
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    console.log('Login response:', JSON.stringify(data, null, 2));
    
    expect(data).toHaveProperty('access_token');
    expect(data).toHaveProperty('user');
    expect(data.user.email).toBe('security_test_user@betterprompts.ai');
    
    // Test authenticated request
    const authResponse = await request.get('http://localhost/api/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`
      }
    });
    
    expect(authResponse.ok()).toBeTruthy();
    const userData = await authResponse.json();
    expect(userData.email).toBe('security_test_user@betterprompts.ai');
  });
});