/**
 * e2e/tests/smoke.spec.ts
 *
 * Smoke test — verifies the Angular web app boots and renders the shell.
 *
 * This is the most basic E2E test: it loads the root URL and checks that:
 *   - The page title contains "caregiver" (case-insensitive)
 *   - The <app-root> element renders (Angular bootstrapped successfully)
 *   - The app does not show the "Loading..." placeholder indefinitely
 *
 * If this fails, it means either:
 *   - The web app isn't running
 *   - The Angular build failed
 *   - nginx isn't serving the files correctly
 *
 * Phase 2 will add:
 *   - Login flow tests (per role)
 *   - Dashboard rendering tests (per role)
 *   - FHIR resource viewer tests
 *   - Real-time alert delivery tests (Socket.io)
 *
 * Phase 3 will add:
 *   - Visual regression snapshots (per role dashboard)
 *   - Cross-browser tests (Firefox, WebKit)
 *   - Performance budgets
 */
import { test, expect } from '@playwright/test';

// Smoke test — verifies the web app loads, has the expected title, and renders
// the Angular root component (replacing the "Loading..." placeholder).
test('health check — platform loads', async ({ page }) => {
  await page.goto('/');

  // The page title should contain "caregiver" (case-insensitive).
  await expect(page).toHaveTitle(/caregiver/i);

  // The <app-root> element should be present in the DOM.
  const appRoot = page.locator('app-root');
  await expect(appRoot).toBeVisible({ timeout: 15000 });

  // Angular replaces the "Loading Caregiver..." placeholder text on bootstrap.
  // Ensure the app did not get stuck on the loading state — the app-root should
  // no longer contain the loading text once the shell has rendered.
  await expect(appRoot).not.toHaveText(/loading/i, { timeout: 15000 });
});
