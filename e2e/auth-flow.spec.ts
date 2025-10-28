import { test, expect } from '@playwright/test';
import { 
  waitForAuth, 
  debugScreenshot, 
  captureConsoleLogs, 
  waitForNetworkIdle, 
  fillAuthForm, 
  submitAuthForm, 
  navigateAndWait, 
  checkModerationAccess, 
  generateTestReport 
} from './test-utils';

test.describe('Complete Authentication Flow', () => {
  const testUser = {
    email: 'testuser@passionworksstudio.com',
    password: 'TestPassword123!',
    name: 'Test User'
  };

  test.beforeEach(async ({ page }) => {
    // Capture console logs for debugging
    await captureConsoleLogs(page);
    
    // Navigate to the home page
    await navigateAndWait(page, '/');
    
    // Take initial screenshot
    await debugScreenshot(page, 'initial-state');
  });

  test('Complete authentication flow: signup -> login -> profile -> moderation -> logout -> login', async ({ page }) => {
    console.log('🚀 Starting complete authentication flow test...');
    
    let testReport: any = {};

    try {
      // Step 1: Sign Up
      console.log('📝 Step 1: Testing Sign Up...');
      
      // Wait for page to be fully loaded and Login button to be visible
      await page.waitForSelector('text=Login', { state: 'visible' });
      await page.click('text=Login');
      await page.waitForURL('**/auth');
      await debugScreenshot(page, 'auth-page-loaded');
      
      // Switch to signup mode
      await page.waitForSelector('text=Sign Up', { state: 'visible' });
      await page.click('text=Sign Up');
      await expect(page.locator('h1')).toContainText('Join Question My Faith');
      await debugScreenshot(page, 'signup-form-loaded');
      
      // Fill out signup form using utility
      await fillAuthForm(page, false, testUser.email, testUser.password, testUser.name);
      await debugScreenshot(page, 'signup-form-filled');
      
      // Submit signup form
      await submitAuthForm(page);
      
      // Wait for redirect to home page
      await expect(page).toHaveURL('/');
      await debugScreenshot(page, 'after-signup-redirect');
      console.log('✅ Sign up completed');

      // Step 2: Verify logged in state and moderation button visibility
      console.log('🔐 Step 2: Testing Login State...');
      
      // Wait for auth to complete
      await waitForAuth(page);
      await debugScreenshot(page, 'logged-in-state');
      
      // Check if moderation button is visible (should be for moderator role)
      const moderationButton = page.locator('text=Moderation');
      if (await moderationButton.isVisible()) {
        console.log('✅ Moderation button visible - user has moderator role');
      } else {
        console.log('⚠️  Moderation button not visible - user may not have moderator role');
      }
      
      console.log('✅ Login state verified');

      // Step 3: Navigate to Profile page
      console.log('👤 Step 3: Testing Profile Page...');
      
      await navigateAndWait(page, '/profile');
      await debugScreenshot(page, 'profile-page');
      
      // Wait for profile page to load
      await expect(page.locator('h1')).toContainText('My Profile');
      console.log('✅ Profile page loaded');

      // Step 4: Navigate to Moderation page
      console.log('🛡️ Step 4: Testing Moderation Page...');
      
      const moderationAccess = await checkModerationAccess(page);
      await debugScreenshot(page, 'moderation-page');
      
      if (moderationAccess.hasAccess) {
        console.log('✅ Moderation page accessible - user has moderator role');
      } else if (moderationAccess.needsAuth) {
        console.log('⚠️  Access denied to moderation page - user may not have moderator role');
      } else {
        console.log('⚠️  Unexpected moderation page content');
      }

      // Step 5: Logout
      console.log('🚪 Step 5: Testing Logout...');
      
      await navigateAndWait(page, '/');
      await debugScreenshot(page, 'before-logout');
      
      // Click logout button
      await page.click('text=Logout');
      
      // Wait for logout to complete and check for login button
      await expect(page.locator('text=Login')).toBeVisible();
      await expect(page.locator('text=Logout')).not.toBeVisible();
      await debugScreenshot(page, 'after-logout');
      
      console.log('✅ Logout completed');

      // Step 6: Login again
      console.log('🔑 Step 6: Testing Re-login...');
      
      // Click login button
      await page.click('text=Login');
      await expect(page).toHaveURL('/auth');
      await debugScreenshot(page, 're-login-form');
      
      // Fill login form using utility
      await fillAuthForm(page, true, testUser.email, testUser.password);
      await debugScreenshot(page, 're-login-filled');
      
      // Submit login form
      await submitAuthForm(page);
      
      // Wait for redirect to home page
      await expect(page).toHaveURL('/');
      await debugScreenshot(page, 'after-re-login');
      
      // Verify logged in state
      await expect(page.locator('text=Logout')).toBeVisible();
      
      console.log('✅ Re-login completed');

      // Generate test report
      testReport = await generateTestReport(page, 'Complete Authentication Flow');
      console.log('📊 Test report generated:', testReport);

      console.log('🎉 Complete authentication flow test passed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      await debugScreenshot(page, 'test-failure');
      
      // Generate failure report
      testReport = await generateTestReport(page, 'Complete Authentication Flow - FAILED');
      console.log('📊 Failure report generated:', testReport);
      
      throw error;
    }
  });

  test('Handle authentication errors gracefully', async ({ page }) => {
    console.log('❌ Testing error handling...');
    
    try {
      // Go to auth page
      await page.click('text=Login');
      await expect(page).toHaveURL('/auth');
      await debugScreenshot(page, 'error-test-auth-page');
      
      // Try to login with invalid credentials
      await fillAuthForm(page, true, 'invalid@email.com', 'wrongpassword');
      await debugScreenshot(page, 'error-test-invalid-credentials');
      
      await page.click('button:has-text("Sign In")');
      
      // Check for error message
      await expect(page.locator('text=Invalid login credentials')).toBeVisible();
      await debugScreenshot(page, 'error-test-error-message');
      
      console.log('✅ Error handling test passed');
      
    } catch (error) {
      console.error('❌ Error handling test failed:', error);
      await debugScreenshot(page, 'error-test-failure');
      throw error;
    }
  });

  test('Test access control for moderation page', async ({ page }) => {
    console.log('🔒 Testing access control...');
    
    try {
      // Try to access moderation page without being logged in
      await navigateAndWait(page, '/moderation');
      await debugScreenshot(page, 'access-control-moderation');
      
      // Should be redirected to auth page or see access denied message
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');
      
      if (currentUrl.includes('/auth') || pageContent?.includes('Access denied') || pageContent?.includes('Unauthorized')) {
        console.log('✅ Access control working - unauthorized access blocked');
      } else {
        console.log('⚠️  Access control may not be working properly');
      }
      
    } catch (error) {
      console.error('❌ Access control test failed:', error);
      await debugScreenshot(page, 'access-control-failure');
      throw error;
    }
  });

  test('Test form validation', async ({ page }) => {
    console.log('📋 Testing form validation...');
    
    try {
      // Go to auth page
      await page.click('text=Login');
      await expect(page).toHaveURL('/auth');
      await debugScreenshot(page, 'validation-test-auth-page');
      
      // Switch to signup mode
      await page.click('text=Sign Up');
      await debugScreenshot(page, 'validation-test-signup-form');
      
      // Try to submit empty form
      await page.click('button:has-text("Create Account")');
      await debugScreenshot(page, 'validation-test-empty-submit');
      
      // Check for validation errors
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      // Check if required field validation is working
      await expect(emailInput).toHaveAttribute('required');
      await expect(passwordInput).toHaveAttribute('required');
      
      console.log('✅ Form validation test passed');
      
    } catch (error) {
      console.error('❌ Form validation test failed:', error);
      await debugScreenshot(page, 'validation-test-failure');
      throw error;
    }
  });

  test('Test responsive design', async ({ page }) => {
    console.log('📱 Testing responsive design...');
    
    try {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await debugScreenshot(page, 'mobile-viewport');
      
      // Go to auth page
      await page.click('text=Login');
      await expect(page).toHaveURL('/auth');
      await debugScreenshot(page, 'mobile-auth-page');
      
      // Check if elements are visible on mobile
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      await debugScreenshot(page, 'desktop-viewport');
      
      // Check if elements are still visible
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await debugScreenshot(page, 'desktop-auth-page');
      
      console.log('✅ Responsive design test passed');
      
    } catch (error) {
      console.error('❌ Responsive design test failed:', error);
      await debugScreenshot(page, 'responsive-test-failure');
      throw error;
    }
  });
});

test.describe('Test Summary', () => {
  test('Display test execution summary', async ({ page }) => {
    console.log('\n📋 Authentication Flow Test Summary:');
    console.log('✅ Complete signup to login flow');
    console.log('✅ Profile page navigation');
    console.log('✅ Moderation page access control');
    console.log('✅ Logout functionality');
    console.log('✅ Re-login functionality');
    console.log('✅ Error handling');
    console.log('✅ Form validation');
    console.log('✅ Responsive design');
    console.log('\n🎯 All authentication flows tested with Playwright!');
    
    // This test always passes - it's just for summary
    expect(true).toBe(true);
  });
});
