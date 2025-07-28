const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    
    console.log('2. Filling login form...');
    await page.fill('[data-testid="email-input"]', 'admin@betterprompts.ai');
    await page.fill('[data-testid="password-input"]', 'password123');
    
    console.log('3. Clicking login button...');
    await page.click('[data-testid="login-button"]');
    
    console.log('4. Waiting for navigation...');
    await page.waitForLoadState('networkidle');
    
    console.log('5. Current URL:', page.url());
    
    // Check if we have any error messages
    const errorElement = await page.$('.alert-destructive');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      console.log('ERROR:', errorText);
    }
    
    // Wait a bit to see what happens
    await page.waitForTimeout(3000);
    
    console.log('6. Final URL:', page.url());
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();