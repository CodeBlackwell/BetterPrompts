import { chromium, FullConfig } from '@playwright/test';
import { unlockUsers, clearAuthLocks } from './unlock-users';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for performance tests...');
  
  // First, unlock any locked accounts and clear auth caches
  await unlockUsers(['admin@betterprompts.ai']);
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Create test users for load testing
    const apiUrl = process.env.API_URL || 'http://localhost/api/v1';
    const testUsers = require('./test-users.json');
    
    console.log('📝 Creating test users...');
    
    for (const user of testUsers) {
      try {
        await page.request.post(`${apiUrl}/auth/register`, {
          data: {
            email: user.email,
            password: user.password,
            name: user.name
          }
        });
      } catch (error) {
        // User might already exist, ignore error
      }
    }
    
    // Warm up the system
    console.log('🔥 Warming up the system...');
    
    // Login as admin to warm up auth system
    const loginResponse = await page.request.post(`${apiUrl}/auth/login`, {
      data: {
        email_or_username: process.env.ADMIN_EMAIL || 'admin@betterprompts.ai',
        password: process.env.ADMIN_PASSWORD || 'password123'
      }
    });
    
    if (loginResponse.ok()) {
      const { access_token } = await loginResponse.json();
      
      // Make a few warm-up requests
      for (let i = 0; i < 10; i++) {
        await page.request.post(`${apiUrl}/enhance`, {
          data: {
            prompt: `Warm-up request ${i}`,
            techniques: ['auto']
          },
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
      }
    }
    
    console.log('✅ Global setup completed successfully');
    
    // Store admin token for tests
    process.env.TEST_ADMIN_TOKEN = (await loginResponse.json()).access_token;
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;