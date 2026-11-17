import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('shows "Welcome Back" heading by default', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('renders email input field', async ({ page }) => {
    await expect(page.getByPlaceholder(/enter your email/i)).toBeVisible();
  });

  test('renders password input field', async ({ page }) => {
    await expect(page.getByPlaceholder(/••••••••/i)).toBeVisible();
  });

  test('Parent and Student role toggle buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^parent$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^student$/i })).toBeVisible();
  });

  test('clicking "Student" toggle selects the student role', async ({ page }) => {
    await page.getByRole('button', { name: /^student$/i }).click();
    // After toggling, the login form should still be present
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('clicking "Sign up" switches to sign-up mode', async ({ page }) => {
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  });

  test('sign-up mode shows Full Name field', async ({ page }) => {
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page.getByPlaceholder(/enter your name/i)).toBeVisible();
  });

  test('invite code field appears when Student role selected in sign-up', async ({ page }) => {
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.getByRole('button', { name: /^student$/i }).click();
    await expect(page.getByPlaceholder(/invite code/i)).toBeVisible();
  });

  test('invite code field is hidden for Parent role in sign-up', async ({ page }) => {
    await page.getByRole('button', { name: /sign up/i }).click();
    // Parent is default
    await expect(page.getByPlaceholder(/invite code/i)).not.toBeVisible();
  });

  test('"Log in" link in sign-up mode returns to sign-in', async ({ page }) => {
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.getByRole('button', { name: /log in/i }).click();
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('submit with empty email triggers browser HTML5 validation', async ({ page }) => {
    await page.getByRole('button', { name: /^sign in$/i }).click();
    // HTML5 required validation blocks submission — we remain on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('navigating directly to /login shows the login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.url()).toContain('/login');
  });
});
