import { test, expect } from '@playwright/test';

test.describe('Clean Authentication System', () => {
  test('Home page loads for anonymous users', async ({ page }) => {
    await page.goto('/');
    
    // Should see the main question form
    await expect(page.locator('textarea[placeholder="Ask about your faith..."]')).toBeVisible();
    
    // Should see login button for anonymous users
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
    
    // Should see note about anonymous sessions
    await expect(page.locator('text=If you answer the above question without logging in')).toBeVisible();
  });

  test('Login page loads and works', async ({ page }) => {
    await page.goto('/login');
    
    // Should see login form
    await expect(page.locator('h2:has-text("Sign in to your account")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Should have link to signup
    await expect(page.locator('text=Don\'t have an account? Sign up')).toBeVisible();
  });

  test('Signup page loads and works', async ({ page }) => {
    await page.goto('/signup');
    
    // Should see signup form
    await expect(page.locator('h2:has-text("Create your account")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[name="preferredName"]')).toBeVisible();
    
    // Should have link to login
    await expect(page.locator('text=Already have an account? Sign in')).toBeVisible();
    
    // Should have link to continue without account
    await expect(page.locator('text=Continue without account')).toBeVisible();
  });

  test('Navigation between pages works', async ({ page }) => {
    await page.goto('/');
    
    // Click login button
    await page.click('button:has-text("Login")');
    await expect(page).toHaveURL('/login');
    
    // Click signup link
    await page.click('text=Don\'t have an account? Sign up');
    await expect(page).toHaveURL('/signup');
    
    // Click continue without account
    await page.click('text=Continue without account');
    await expect(page).toHaveURL('/');
  });

  test('Form validation works', async ({ page }) => {
    await page.goto('/login');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('input[type="email"]')).toHaveAttribute('required');
    await expect(page.locator('input[type="password"]')).toHaveAttribute('required');
  });
});
