import { request } from '@playwright/test';

async function globalSetup() {
  console.log('Phase 10: Rate Limiting Tests - Global Setup');
  
  // Note: Test data should be set up manually using: node test-data-setup.js setup
  // The setup has already been done, so we can proceed
  
  const baseURL = process.env.API_BASE_URL || 'http://localhost/api/v1';
  
  // Create API context for warmup
  const apiContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  });
  
  try {
    // Warm up the API
    console.log('Warming up API...');
    const warmupRequests = 10;
    const warmupPromises = [];
    
    for (let i = 0; i < warmupRequests; i++) {
      warmupPromises.push(
        apiContext.post('/enhance', {
          data: {
            text: `Warmup request ${i}`,
          },
          headers: {
            'X-API-Key': 'test-key-user1-primary', // Use a test key we know exists
          },
          failOnStatusCode: false,
        })
      );
    }
    
    await Promise.all(warmupPromises);
    console.log('API warmup complete');
    
  } catch (error) {
    console.error('Warmup error:', error);
  } finally {
    await apiContext.dispose();
  }
  
  // Store test start time for metrics
  process.env.PHASE10_TEST_START = Date.now().toString();
}

export default globalSetup;