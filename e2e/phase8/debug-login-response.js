const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('1. Testing login API directly...');
    
    const response = await page.request.post('http://localhost/api/v1/auth/login', {
      data: {
        email_or_username: 'admin@betterprompts.ai',
        password: 'password123'
      }
    });
    
    console.log('2. Response status:', response.status());
    
    if (response.ok()) {
      const body = await response.json();
      console.log('3. Response body:', JSON.stringify(body, null, 2));
      
      // Check if user has roles
      if (body.user && body.user.roles) {
        console.log('4. User roles:', body.user.roles);
      } else {
        console.log('4. NO ROLES FOUND IN RESPONSE!');
      }
    } else {
      const error = await response.json();
      console.log('3. Error response:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();