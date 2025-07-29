async function globalTeardown() {
  console.log('Phase 10: Rate Limiting Tests - Global Teardown');
  
  // Calculate test duration
  const testStart = parseInt(process.env.PHASE10_TEST_START || '0');
  const testDuration = Date.now() - testStart;
  console.log(`Total test duration: ${(testDuration / 1000).toFixed(2)}s`);
  
  // Note: Test data cleanup can be done manually using: node test-data-setup.js teardown
  // We'll leave the data for potential debugging
  
  console.log('Phase 10 tests completed');
}

export default globalTeardown;