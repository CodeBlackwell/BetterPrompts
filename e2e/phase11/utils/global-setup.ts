/**
 * Global setup for security tests
 * Creates test users and prepares environment
 */

import { request } from '@playwright/test';

async function globalSetup() {
  console.log('🔒 Setting up security test environment...');
  
  const apiURL = process.env.API_URL || 'http://localhost/api/v1';
  const apiContext = await request.newContext({
    baseURL: apiURL,
    ignoreHTTPSErrors: true // For local development
  });
  
  // Create security test users
  const testUsers = [
    {
      email: 'security_test_user@betterprompts.ai',
      username: 'security_test_user',
      password: 'SecureTest123!',
      role: 'user'
    },
    {
      email: 'security_test_admin@betterprompts.ai',
      username: 'security_test_admin',
      password: 'AdminSecure123!',
      role: 'admin'
    },
    {
      email: 'auth_security_test@betterprompts.ai',
      username: 'auth_security_test',
      password: 'SecureAuthTest123!',
      role: 'user'
    },
    {
      email: 'session_test_user@betterprompts.ai',
      username: 'session_test_user',
      password: 'SessionTest123!',
      role: 'user'
    },
    {
      email: 'encryption_test@betterprompts.ai',
      username: 'encryption_test',
      password: 'EncryptTest123!',
      role: 'user'
    }
  ];
  
  // Register test users
  for (const user of testUsers) {
    try {
      await apiContext.post('/auth/register', {
        data: {
          email: user.email,
          username: user.username,
          password: user.password,
          confirm_password: user.password
        }
      });
      console.log(`✅ Created test user: ${user.email}`);
    } catch (error) {
      // User might already exist
      console.log(`ℹ️  Test user might already exist: ${user.email}`);
    }
  }
  
  // Verify API is accessible
  try {
    const healthResponse = await apiContext.get('/health');
    if (healthResponse.ok()) {
      console.log('✅ API health check passed');
    } else {
      console.warn('⚠️  API health check failed:', healthResponse.status());
    }
  } catch (error) {
    console.error('❌ API not accessible:', error);
  }
  
  await apiContext.dispose();
  
  console.log('🔒 Security test environment ready');
  
  // Store any global state if needed
  return {
    apiURL,
    testUsers
  };
}

export default globalSetup;