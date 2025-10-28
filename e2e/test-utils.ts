import { Page, expect } from '@playwright/test';

/**
 * Wait for authentication to complete and verify user is logged in
 */
export async function waitForAuth(page: Page) {
  // Wait for auth state to be determined
  await page.waitForFunction(() => {
    return window.localStorage.getItem('supabase.auth.token') !== null;
  }, { timeout: 10000 });
  
  // Verify user is logged in by checking for logout button
  await expect(page.locator('text=Logout')).toBeVisible();
}

/**
 * Take a debug screenshot with a descriptive name
 */
export async function debugScreenshot(page: Page, name: string) {
  await page.screenshot({ 
    path: `test-results/debug-${name}-${Date.now()}.png`,
    fullPage: true 
  });
}

/**
 * Log console messages for debugging
 */
export async function captureConsoleLogs(page: Page) {
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    console.log(`[${type.toUpperCase()}] ${text}`);
    if (location.url) {
      console.log(`  at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    }
  });
}

/**
 * Wait for network to be idle and capture any errors
 */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle');
  
  // Check for any unhandled errors
  const errors = await page.evaluate(() => {
    return (window as any).__testErrors || [];
  });
  
  if (errors.length > 0) {
    console.warn('⚠️ Unhandled errors detected:', errors);
  }
}

/**
 * Fill auth form with test data
 */
export async function fillAuthForm(page: Page, isLogin: boolean = true, email: string = 'test@example.com', password: string = 'password123', preferredName?: string) {
  if (!isLogin) {
    await page.waitForSelector('text=Sign Up', { state: 'visible' });
    await page.click('text=Sign Up');
  }
  
  // Wait for form elements to be visible
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  await page.waitForSelector('input[type="password"]', { state: 'visible' });
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  if (!isLogin && preferredName) {
    await page.waitForSelector('input[id="preferredName"]', { state: 'visible' });
    await page.fill('input[id="preferredName"]', preferredName);
  }
}

/**
 * Submit auth form and wait for completion
 */
export async function submitAuthForm(page: Page) {
  // Wait for submit button to be visible and click it
  await page.waitForSelector('button:has-text("Sign In"), button:has-text("Create Account")', { state: 'visible' });
  const submitButton = page.locator('button:has-text("Sign In"), button:has-text("Create Account")');
  await submitButton.click();
  
  // Wait for navigation or auth completion
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a page and wait for it to load completely
 */
export async function navigateAndWait(page: Page, url: string) {
  await page.goto(url);
  await waitForNetworkIdle(page);
  await debugScreenshot(page, `navigate-${url.replace(/\//g, '-')}`);
}

/**
 * Check if user has required role for moderation access
 */
export async function checkModerationAccess(page: Page) {
  try {
    await page.goto('/moderation');
    await page.waitForLoadState('networkidle');
    
    // Check if we see the moderation interface or auth form
    const isModerationPage = await page.locator('text=Moderation').isVisible();
    const isAuthPage = await page.locator('text=Login').isVisible();
    
    return { hasAccess: isModerationPage, needsAuth: isAuthPage };
  } catch (error) {
    console.error('Error checking moderation access:', error);
    return { hasAccess: false, needsAuth: true };
  }
}

/**
 * Generate test report data
 */
export async function generateTestReport(page: Page, testName: string) {
  const report = {
    testName,
    timestamp: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    localStorage: await page.evaluate(() => Object.fromEntries(
      Object.entries(localStorage).filter(([key]) => key.includes('supabase'))
    )),
    cookies: await page.context().cookies(),
    consoleErrors: await page.evaluate(() => {
      return (window as any).__consoleErrors || [];
    })
  };
  
  return report;
}
