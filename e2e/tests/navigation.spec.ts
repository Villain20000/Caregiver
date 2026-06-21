/**
 * e2e/tests/navigation.spec.ts
 *
 * App-shell navigation E2E tests.
 *
 * Verifies the application shell renders correctly:
 *   - The login page exposes an authentication entry point (form)
 *   - The header brand text reads "Caregiver"
 *   - The app shell renders a <router-outlet> content area for routed views
 *
 * These tests run against the Angular dev server (localhost:4200) and do not
 * require the backend API to be running.
 */
import { test, expect } from '@playwright/test';

test.describe('App shell navigation', () => {
  test('login page has an authentication input (email field)', async ({ page }) => {
    await page.goto('/login');

    // The login form is the authentication entry point — the email input
    // confirms the page is ready to accept credentials.
    const emailInput = page.locator('input#email');
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    // The submit button is the action used to authenticate.
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
  });

  test('header shows the "Caregiver" brand text after the app loads', async ({ page }) => {
    await page.goto('/login');

    // The app shell header is rendered on every route, including /login.
    const brandLink = page.locator('.app-brand a', { hasText: 'Caregiver' });
    await expect(brandLink).toBeVisible({ timeout: 15000 });
    await expect(brandLink).toHaveText('Caregiver');
  });

  test('app shell renders a router-outlet content area', async ({ page }) => {
    await page.goto('/login');

    // The <router-outlet> element is where Angular injects routed components.
    // It should be present within the .app-content main element.
    const appContent = page.locator('.app-content');
    await expect(appContent).toBeVisible({ timeout: 15000 });

    // router-outlet is a real custom element in the DOM once the shell boots.
    await expect(page.locator('router-outlet')).toBeAttached({ timeout: 15000 });
  });
});
