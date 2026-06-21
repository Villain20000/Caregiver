/**
 * e2e/tests/auth-flow.spec.ts
 *
 * Authentication flow E2E tests.
 *
 * Verifies the unauthenticated → login → dashboard redirect behavior and the
 * login page UI (form rendering, validation, and error handling on failed
 * submissions).
 *
 * These tests run against the Angular dev server only (localhost:4200). The
 * backend API is NOT required — the invalid-credentials test mocks the
 * /api/auth/login response so the assertion holds without a live API.
 */
import { test, expect } from '@playwright/test';

test.describe('Authentication flow', () => {
  test('unauthenticated user visiting /dashboard redirects to /login', async ({ page }) => {
    // Ensure no stale session is restored from localStorage.
    await page.addInitScript(() => {
      window.localStorage.removeItem('caregiver_access_token');
      window.localStorage.removeItem('caregiver_refresh_token');
      window.localStorage.removeItem('caregiver_user');
    });

    await page.goto('/dashboard');

    // The authGuard should redirect unauthenticated users to /login, with a
    // returnUrl query parameter pointing back to /dashboard.
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/returnUrl=.*dashboard/);
  });

  test('login page renders the login form (email, password, submit)', async ({ page }) => {
    await page.goto('/login');

    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // Sanity check the input types.
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('login page shows the "Caregiver" heading', async ({ page }) => {
    await page.goto('/login');

    const heading = page.locator('h1', { hasText: 'Caregiver' });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // The subtitle should also be present.
    await expect(page.locator('.login-subtitle')).toHaveText(/Healthcare Intelligence Platform/i);
  });

  test('submitting an empty form shows validation errors', async ({ page }) => {
    await page.goto('/login');

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // Click submit without entering anything.
    await submitButton.click();

    // Reactive form marks all controls as touched → field errors render.
    await expect(page.locator('.field-error', { hasText: /email is required/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.field-error', { hasText: /password is required/i })).toBeVisible({ timeout: 10000 });
  });

  test('submitting invalid credentials shows an error message (API mocked)', async ({ page }) => {
    // Mock the login API to return 401 Unauthorized — no real backend needed.
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, message: 'Invalid email or password' }),
      }),
    );

    await page.goto('/login');

    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });

    await emailInput.fill('wrong@hospital.com');
    await passwordInput.fill('badpassword');
    await submitButton.click();

    // The login component sets a generic error message on failure.
    await expect(page.locator('.login-error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.login-error')).toHaveText(/invalid email or password/i);
  });
});
