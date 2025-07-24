import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');
  
  const startTime = Date.now();
  
  // Generate test summary
  try {
    const resultsPath = path.join(__dirname, 'test-results', 'results.json');
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      
      const summary = {
        totalTests: results.tests?.length || 0,
        passed: results.tests?.filter((t: any) => t.status === 'passed').length || 0,
        failed: results.tests?.filter((t: any) => t.status === 'failed').length || 0,
        skipped: results.tests?.filter((t: any) => t.status === 'skipped').length || 0,
        duration: results.duration || 0,
        timestamp: new Date().toISOString(),
      };
      
      console.log('\n📊 Test Summary:');
      console.log(`   Total: ${summary.totalTests}`);
      console.log(`   ✅ Passed: ${summary.passed}`);
      console.log(`   ❌ Failed: ${summary.failed}`);
      console.log(`   ⏭️  Skipped: ${summary.skipped}`);
      console.log(`   ⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
      
      fs.writeFileSync(
        path.join(__dirname, 'test-results', 'summary.json'),
        JSON.stringify(summary, null, 2)
      );
    }
  } catch (error) {
    console.warn('Could not generate test summary:', error);
  }
  
  // Collect performance metrics
  try {
    const performanceDir = path.join(__dirname, 'test-results', 'performance');
    if (fs.existsSync(performanceDir)) {
      const files = fs.readdirSync(performanceDir);
      const allMetrics: any[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(performanceDir, file), 'utf-8');
          allMetrics.push(JSON.parse(content));
        }
      }
      
      if (allMetrics.length > 0) {
        // Calculate aggregate metrics
        const aggregateMetrics = {
          averageEnhancementTime: 0,
          p95EnhancementTime: 0,
          totalEnhancements: allMetrics.length,
          timestamp: new Date().toISOString(),
        };
        
        const times = allMetrics.map(m => m.enhancementTime).filter(Boolean).sort((a, b) => a - b);
        if (times.length > 0) {
          aggregateMetrics.averageEnhancementTime = times.reduce((a, b) => a + b, 0) / times.length;
          aggregateMetrics.p95EnhancementTime = times[Math.floor(times.length * 0.95)];
        }
        
        console.log('\n⚡ Performance Metrics:');
        console.log(`   Average Enhancement Time: ${aggregateMetrics.averageEnhancementTime.toFixed(0)}ms`);
        console.log(`   P95 Enhancement Time: ${aggregateMetrics.p95EnhancementTime.toFixed(0)}ms`);
        
        fs.writeFileSync(
          path.join(__dirname, 'test-results', 'performance-summary.json'),
          JSON.stringify(aggregateMetrics, null, 2)
        );
      }
    }
  } catch (error) {
    console.warn('Could not collect performance metrics:', error);
  }
  
  // Clean up old test artifacts if needed
  if (process.env.CLEANUP_OLD_RESULTS === 'true') {
    console.log('🗑️  Cleaning up old test results...');
    
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    
    const cleanupDirs = ['videos', 'screenshots', 'artifacts'];
    
    for (const dir of cleanupDirs) {
      const fullPath = path.join(__dirname, 'test-results', dir);
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        
        for (const file of files) {
          const filePath = path.join(fullPath, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`   Deleted old file: ${file}`);
          }
        }
      }
    }
  }
  
  // Stop services if running in CI
  if (process.env.CI && process.env.STOP_SERVICES_AFTER_TESTS === 'true') {
    console.log('🛑 Stopping services...');
    
    const { execSync } = require('child_process');
    try {
      execSync('cd ../.. && docker compose down', { stdio: 'inherit' });
      console.log('✅ Services stopped');
    } catch (error) {
      console.warn('Could not stop services:', error);
    }
  }
  
  const teardownTime = Date.now() - startTime;
  console.log(`\n✅ Global teardown completed in ${teardownTime}ms`);
}

export default globalTeardown;