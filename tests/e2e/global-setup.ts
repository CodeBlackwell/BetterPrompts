import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');
  
  const startTime = Date.now();
  
  // Create test results directories
  const dirs = [
    'test-results',
    'test-results/html-report',
    'test-results/artifacts',
    'test-results/videos',
    'test-results/screenshots',
    'test-results/performance',
  ];
  
  for (const dir of dirs) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
  
  // Wait for services to be healthy
  console.log('⏳ Waiting for services to be healthy...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Check API health
  let apiHealthy = false;
  let retries = 30; // 30 retries with 2 second delay = 1 minute
  
  while (!apiHealthy && retries > 0) {
    try {
      const response = await page.goto('http://localhost/api/v1/health', {
        timeout: 5000,
      });
      
      if (response && response.ok()) {
        const health = await response.json();
        if (health.status === 'healthy' || health.status === 'ok') {
          apiHealthy = true;
          console.log('✅ API Gateway is healthy');
        }
      }
    } catch (error) {
      // Service not ready yet
    }
    
    if (!apiHealthy) {
      retries--;
      console.log(`⏳ Waiting for API... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (!apiHealthy) {
    throw new Error('API Gateway failed to become healthy');
  }
  
  // Check Frontend health
  let frontendHealthy = false;
  retries = 30;
  
  while (!frontendHealthy && retries > 0) {
    try {
      const response = await page.goto('http://localhost:3000', {
        timeout: 5000,
      });
      
      if (response && response.ok()) {
        frontendHealthy = true;
        console.log('✅ Frontend is healthy');
      }
    } catch (error) {
      // Service not ready yet
    }
    
    if (!frontendHealthy) {
      retries--;
      console.log(`⏳ Waiting for Frontend... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (!frontendHealthy) {
    throw new Error('Frontend failed to become healthy');
  }
  
  // Check critical backend services
  const services = [
    { name: 'Intent Classifier', url: 'http://localhost/api/v1/intent-classifier/health' },
    { name: 'Prompt Generator', url: 'http://localhost/api/v1/prompt-generator/health' },
    { name: 'Technique Selector', url: 'http://localhost/api/v1/technique-selector/health' },
  ];
  
  for (const service of services) {
    let serviceHealthy = false;
    retries = 20;
    
    while (!serviceHealthy && retries > 0) {
      try {
        const response = await page.goto(service.url, { timeout: 5000 });
        if (response && response.ok()) {
          serviceHealthy = true;
          console.log(`✅ ${service.name} is healthy`);
        }
      } catch (error) {
        // Service not ready
      }
      
      if (!serviceHealthy) {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!serviceHealthy) {
      console.warn(`⚠️  ${service.name} is not healthy, but continuing...`);
    }
  }
  
  // Seed test data if needed
  if (process.env.SEED_TEST_DATA === 'true') {
    console.log('🌱 Seeding test data...');
    
    try {
      // Create admin user
      await page.goto('http://localhost/api/v1/auth/seed-admin', {
        method: 'POST',
        data: {
          email: 'admin@betterprompts.com',
          password: 'Admin123!@#'
        }
      });
      console.log('✅ Admin user seeded');
    } catch (error) {
      console.log('ℹ️  Admin user might already exist');
    }
  }
  
  await browser.close();
  
  const setupTime = Date.now() - startTime;
  console.log(`✅ Global setup completed in ${setupTime}ms`);
  
  // Store setup metadata
  const metadata = {
    setupTime,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test',
    baseUrl: config.use?.baseURL,
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'test-results', 'setup-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  return metadata;
}