#!/usr/bin/env node

/**
 * Comprehensive Authentication Test Suite Runner
 * 
 * This script runs all authentication-related tests including:
 * - Login/Logout functionality
 * - Signup and profile creation
 * - Moderation access control
 * - API endpoint testing
 * - Integration testing
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Comprehensive Authentication Test Suite\n');

const testFiles = [
  'auth-simple.test.tsx',
  'auth-comprehensive.test.tsx', 
  'auth-integration-real.test.tsx',
  'moderation-api.test.ts',
  'supabase-client.test.ts'
];

const testResults = [];

async function runTestFile(filename) {
  console.log(`\n📋 Running ${filename}...`);
  console.log('=' .repeat(50));
  
  try {
    const startTime = Date.now();
    
    // Run the specific test file
    const command = `npx jest ${path.join(__dirname, filename)} --verbose --no-coverage`;
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ ${filename} completed successfully in ${duration}ms`);
    console.log(output);
    
    testResults.push({
      file: filename,
      status: 'PASSED',
      duration: duration,
      output: output
    });
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - Date.now();
    
    console.log(`❌ ${filename} failed`);
    console.log(error.stdout || error.message);
    
    testResults.push({
      file: filename,
      status: 'FAILED',
      duration: duration,
      error: error.stdout || error.message
    });
  }
}

async function runAllTests() {
  console.log('🔍 Authentication Test Coverage:');
  console.log('• Login Flow - Email/password authentication');
  console.log('• Logout Flow - Session termination and state cleanup');
  console.log('• Signup Flow - Account creation with profile setup');
  console.log('• Profile Creation - User profile management');
  console.log('• Moderation Access - Role-based access control');
  console.log('• API Endpoints - Moderation API testing');
  console.log('• Integration - End-to-end authentication flows');
  console.log('• Error Handling - Graceful error management');
  console.log('• Hydration - SSR/CSR state consistency');
  console.log('• State Management - Auth state synchronization\n');

  for (const testFile of testFiles) {
    await runTestFile(testFile);
  }
  
  // Generate summary report
  generateSummaryReport();
}

function generateSummaryReport() {
  console.log('\n📊 TEST SUITE SUMMARY REPORT');
  console.log('=' .repeat(60));
  
  const passed = testResults.filter(r => r.status === 'PASSED').length;
  const failed = testResults.filter(r => r.status === 'FAILED').length;
  const total = testResults.length;
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\n📈 Results: ${passed}/${total} test files passed`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`🎯 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  console.log('\n📋 Individual Test Results:');
  testResults.forEach(result => {
    const status = result.status === 'PASSED' ? '✅' : '❌';
    console.log(`  ${status} ${result.file} (${result.duration}ms)`);
  });
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests Details:');
    testResults
      .filter(r => r.status === 'FAILED')
      .forEach(result => {
        console.log(`\n🔍 ${result.file}:`);
        console.log(result.error);
      });
  }
  
  console.log('\n🎉 Authentication Test Suite Complete!');
  
  if (failed === 0) {
    console.log('✨ All authentication tests passed! The auth system is working correctly.');
  } else {
    console.log(`⚠️  ${failed} test file(s) failed. Please review the errors above.`);
    process.exit(1);
  }
}

// Test scenarios covered
const testScenarios = {
  'Login Tests': [
    'Valid credentials login',
    'Invalid credentials handling',
    'Network error handling',
    'Redirect after successful login',
    'State management during login'
  ],
  'Logout Tests': [
    'Successful logout',
    'Session termination',
    'State cleanup',
    'Redirect after logout',
    'Error handling during logout'
  ],
  'Signup Tests': [
    'Account creation with profile',
    'Account creation without profile',
    'Duplicate email handling',
    'Password validation',
    'Profile data validation'
  ],
  'Profile Management': [
    'Profile creation during signup',
    'Profile data persistence',
    'Profile update functionality',
    'Profile validation'
  ],
  'Moderation Access': [
    'Admin access to moderation page',
    'Moderator access to moderation page',
    'Regular user access denial',
    'Unauthenticated user redirect',
    'Role-based UI elements'
  ],
  'API Security': [
    'Authentication requirement',
    'Authorization checks',
    'Role-based access control',
    'Input validation',
    'Error handling'
  ],
  'Integration Tests': [
    'End-to-end login flow',
    'End-to-end signup flow',
    'Cross-page state consistency',
    'Auth state synchronization',
    'Hydration handling'
  ]
};

console.log('📚 Test Scenarios Covered:');
Object.entries(testScenarios).forEach(([category, scenarios]) => {
  console.log(`\n${category}:`);
  scenarios.forEach(scenario => {
    console.log(`  • ${scenario}`);
  });
});

// Run the test suite
runAllTests().catch(error => {
  console.error('💥 Test suite failed to run:', error);
  process.exit(1);
});
