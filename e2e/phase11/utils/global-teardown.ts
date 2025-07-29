/**
 * Global teardown for security tests
 * Cleans up test data and generates reports
 */

import { request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown() {
  console.log('🧹 Cleaning up security test environment...');
  
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  
  // Generate security report summary
  const reportPath = path.join(__dirname, '../reports/test-summary.json');
  const testResultsPath = path.join(__dirname, '../test-results.json');
  
  if (fs.existsSync(testResultsPath)) {
    try {
      const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf-8'));
      
      // Calculate summary statistics
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        vulnerabilities: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        categories: {
          sqlInjection: { total: 0, passed: 0 },
          xss: { total: 0, passed: 0 },
          authentication: { total: 0, passed: 0 },
          sessionManagement: { total: 0, passed: 0 },
          encryption: { total: 0, passed: 0 }
        }
      };
      
      // Process test results
      if (testResults.suites) {
        testResults.suites.forEach((suite: any) => {
          const category = getCategoryFromFile(suite.file);
          
          suite.specs.forEach((spec: any) => {
            summary.totalTests++;
            
            if (spec.ok) {
              summary.passed++;
              if (category) {
                summary.categories[category].passed++;
              }
            } else {
              summary.failed++;
              // Log vulnerability based on test failure
              if (spec.title.toLowerCase().includes('critical')) {
                summary.vulnerabilities.critical++;
              } else if (spec.title.toLowerCase().includes('high')) {
                summary.vulnerabilities.high++;
              } else {
                summary.vulnerabilities.medium++;
              }
            }
            
            if (category) {
              summary.categories[category].total++;
            }
          });
        });
      }
      
      // Write summary report
      fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
      
      // Print summary to console
      console.log('\n📊 Security Test Summary:');
      console.log(`Total Tests: ${summary.totalTests}`);
      console.log(`Passed: ${summary.passed} (${((summary.passed / summary.totalTests) * 100).toFixed(1)}%)`);
      console.log(`Failed: ${summary.failed}`);
      
      if (summary.failed > 0) {
        console.log('\n⚠️  Vulnerabilities Found:');
        console.log(`Critical: ${summary.vulnerabilities.critical}`);
        console.log(`High: ${summary.vulnerabilities.high}`);
        console.log(`Medium: ${summary.vulnerabilities.medium}`);
        console.log(`Low: ${summary.vulnerabilities.low}`);
      }
      
      console.log('\n📈 Category Results:');
      Object.entries(summary.categories).forEach(([category, stats]: [string, any]) => {
        if (stats.total > 0) {
          const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
          console.log(`${category}: ${stats.passed}/${stats.total} passed (${passRate}%)`);
        }
      });
      
    } catch (error) {
      console.error('Error generating summary report:', error);
    }
  }
  
  // Optional: Clean up test data from database
  if (process.env.CLEANUP_TEST_DATA === 'true') {
    console.log('🗑️  Cleaning up test data...');
    // Implementation would depend on your database access
  }
  
  console.log('✅ Security test cleanup complete');
}

function getCategoryFromFile(filename: string): string | null {
  if (filename.includes('ss-01')) return 'sqlInjection';
  if (filename.includes('ss-02')) return 'xss';
  if (filename.includes('ss-03')) return 'authentication';
  if (filename.includes('ss-04')) return 'sessionManagement';
  if (filename.includes('ss-05')) return 'encryption';
  return null;
}

export default globalTeardown;