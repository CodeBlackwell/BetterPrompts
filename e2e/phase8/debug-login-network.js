const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Log all network requests
  page.on('request', request => {
    if (request.url().includes('api')) {
      console.log('Request:', request.method(), request.url());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('api')) {
      console.log('Response:', response.status(), response.url());
    }
  });
  
  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    
    console.log('2. Filling login form...');
    await page.fill('[data-testid="email-input"]', 'admin@betterprompts.ai');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    console.log('3. Clicking login button...');
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/auth/login'), 
      { timeout: 5000 }
    ).catch(() => null);
    
    await page.click('[data-testid="login-button"]');
    
    const response = await responsePromise;
    if (response) {
      console.log('4. Login response status:', response.status());
      const body = await response.json().catch(() => null);
      console.log('   Response body:', body);
    } else {
      console.log('4. No login API call detected!');
    }
    
    await page.waitForTimeout(2000);
    console.log('5. Current URL:', page.url());
    
    // Check for errors
    const errorElement = await page.$('[role="alert"]');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      console.log('ERROR ALERT:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();