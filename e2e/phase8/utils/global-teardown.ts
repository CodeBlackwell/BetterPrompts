import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');
  
  try {
    // Generate consolidated test report
    const reportDir = path.join(__dirname, '..', 'reports');
    
    if (fs.existsSync(reportDir)) {
      console.log('📊 Generating consolidated performance report...');
      
      // Collect all test results
      const testResults = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'test',
        baseUrl: process.env.BASE_URL || 'http://localhost:3000',
        summary: {
          e2e_tests: {},
          load_tests: {},
          sla_compliance: {}
        }
      };
      
      // Read E2E test results
      const e2eResultsPath = path.join(reportDir, 'test-results.json');
      if (fs.existsSync(e2eResultsPath)) {
        const e2eResults = JSON.parse(fs.readFileSync(e2eResultsPath, 'utf-8'));
        testResults.summary.e2e_tests = {
          total: e2eResults.stats?.expected || 0,
          passed: e2eResults.stats?.expected - e2eResults.stats?.unexpected || 0,
          failed: e2eResults.stats?.unexpected || 0,
          skipped: e2eResults.stats?.skipped || 0
        };
      }
      
      // Read k6 load test results
      const k6ResultsPath = path.join(reportDir, 'performance-summary.json');
      if (fs.existsSync(k6ResultsPath)) {
        const k6Results = JSON.parse(fs.readFileSync(k6ResultsPath, 'utf-8'));
        testResults.summary.load_tests = k6Results;
      }
      
      // Generate final summary
      const summaryPath = path.join(reportDir, 'final-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(testResults, null, 2));
      
      console.log('📄 Final test summary written to:', summaryPath);
      
      // Display summary in console
      console.log('\n' + '='.repeat(60));
      console.log('         PERFORMANCE TEST SUMMARY');
      console.log('='.repeat(60));
      console.log(`Timestamp: ${testResults.timestamp}`);
      console.log(`Environment: ${testResults.environment}`);
      console.log('\nE2E Tests:');
      console.log(`  Total: ${testResults.summary.e2e_tests.total || 0}`);
      console.log(`  Passed: ${testResults.summary.e2e_tests.passed || 0}`);
      console.log(`  Failed: ${testResults.summary.e2e_tests.failed || 0}`);
      
      if (testResults.summary.load_tests.overall_passed !== undefined) {
        console.log('\nLoad Tests:');
        console.log(`  Overall: ${testResults.summary.load_tests.overall_passed ? '✅ PASSED' : '❌ FAILED'}`);
      }
      
      console.log('='.repeat(60) + '\n');
    }
    
    // Clean up any temporary files
    const tempDir = path.join(__dirname, '..', 'temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('🗑️  Cleaned up temporary files');
    }
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw - we want tests to complete even if teardown has issues
  }
}

export default globalTeardown;