#!/usr/bin/env node

/**
 * Auth System Test Runner
 * 
 * This script runs all authentication-related tests and provides
 * a comprehensive report of the auth system functionality.
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔐 Question My Faith - Auth System Test Suite');
console.log('==============================================\n');

const testFiles = [
  'auth-simple.test.tsx',
  'supabase-client.test.ts',
  'auth-integration-real.test.tsx'
];

const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

async function runTests() {
  for (const testFile of testFiles) {
    console.log(`📋 Running ${testFile}...`);
    
    try {
      const result = execSync(
        `npx jest __tests__/${testFile} --verbose --no-coverage`,
        { 
          encoding: 'utf8',
          cwd: process.cwd(),
          stdio: 'pipe'
        }
      );
      
      console.log(`✅ ${testFile} - PASSED\n`);
      testResults.passed++;
      testResults.details.push({ file: testFile, status: 'PASSED' });
      
    } catch (error) {
      console.log(`❌ ${testFile} - FAILED`);
      console.log(error.stdout || error.message);
      console.log('');
      testResults.failed++;
      testResults.details.push({ file: testFile, status: 'FAILED', error: error.message });
    }
    
    testResults.total++;
  }
  
  // Print summary
  console.log('📊 Test Summary');
  console.log('================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%\n`);
  
  // Print detailed results
  console.log('📝 Detailed Results');
  console.log('===================');
  testResults.details.forEach(detail => {
    const status = detail.status === 'PASSED' ? '✅' : '❌';
    console.log(`${status} ${detail.file} - ${detail.status}`);
  });
  
  if (testResults.failed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All auth system tests passed!');
    process.exit(0);
  }
}

// Auth system test coverage areas
console.log('🧪 Test Coverage Areas:');
console.log('• Component rendering and user interactions');
console.log('• Form validation and error handling');
console.log('• Authentication flows (login/signup)');
console.log('• Supabase client configuration');
console.log('• API endpoint integration');
console.log('• User profile management');
console.log('• State management and UI updates');
console.log('• Error handling and edge cases');
console.log('• Real account creation with "Test User" and cleanup\n');

runTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});
