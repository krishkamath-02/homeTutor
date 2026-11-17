import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the page title containing "TutorFlow"', async ({ page }) => {
    await expect(page).toHaveTitle(/TutorFlow/i);
  });

  test('renders the hero heading with "AI-Powered"', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('AI-Powered');
  });

  test('renders "Home Tutor" in the heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Home Tutor');
  });

  test('"Start for Free" link is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /start for free/i })).toBeVisible();
  });

  test('"Start for Free" navigates to /login', async ({ page }) => {
    await page.getByRole('link', { name: /start for free/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('renders the "Effortless Uploads" feature card', async ({ page }) => {
    await expect(page.getByText(/Effortless Uploads/i)).toBeVisible();
  });

  test('renders the "AI Test Generation" feature card', async ({ page }) => {
    await expect(page.getByText(/AI Test Generation/i)).toBeVisible();
  });

  test('renders the "Track Progress" feature card', async ({ page }) => {
    await expect(page.getByText(/Track Progress/i)).toBeVisible();
  });

  test('header logo "TutorFlow" is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /TutorFlow/i }).first()).toBeVisible();
  });

  test('"Get Started" button is visible in the header (unauthenticated)', async ({ page }) => {
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });
});
