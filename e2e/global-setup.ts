import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');
  
  // Create a browser instance for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the dev server to be ready
    console.log('⏳ Waiting for dev server to be ready...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    console.log('✅ Dev server is ready');
    
    // Optional: Set up test data or clean up previous test data
    console.log('🧹 Cleaning up previous test data...');
    // Add any cleanup logic here if needed
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('✅ Global setup completed');
}

export default globalSetup;
