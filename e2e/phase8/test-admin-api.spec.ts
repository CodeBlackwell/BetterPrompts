import { test, expect } from '@playwright/test';
import { unlockUser } from './utils/unlock-users';

test.describe('Admin API Login', () => {
  test('should return admin role in API response', async ({ request }) => {
    // Ensure admin is unlocked
    await unlockUser('admin@betterprompts.ai');
    
    // Test API directly
    const response = await request.post('http://localhost/api/v1/auth/login', {
      data: {
        email_or_username: 'admin@betterprompts.ai',
        password: 'password123'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    // Check user has admin role
    expect(data.user).toBeDefined();
    expect(data.user.roles).toContain('admin');
    expect(data.access_token).toBeDefined();
  });
  
  test('should fail with incorrect password', async ({ request }) => {
    // Ensure admin is unlocked
    await unlockUser('admin@betterprompts.ai');
    
    // Test API with wrong password
    const response = await request.post('http://localhost/api/v1/auth/login', {
      data: {
        email_or_username: 'admin@betterprompts.ai',
        password: 'wrongpassword'
      }
    });
    
    expect(response.status()).toBe(401);
  });
});