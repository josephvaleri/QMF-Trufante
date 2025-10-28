import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');
  
  try {
    // Clean up any test data or resources
    console.log('🗑️ Cleaning up test data...');
    // Add any cleanup logic here if needed
    
    // Optional: Generate summary report
    console.log('📊 Generating test summary...');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here to avoid masking test failures
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;
