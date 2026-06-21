/**
 * e2e/playwright.config.ts
 *
 * Playwright test configuration for the Caregiver Healthcare Intelligence Platform.
 *
 * Defines:
 *   - Test directory (e2e/tests/)
 *   - Parallel execution settings
 *   - Reporter (HTML + list for CI readability)
 *   - Browser projects (Chromium for now; add Firefox/WebKit in Phase 3)
 *   - Base URL (configurable via E2E_BASE_URL env var for CI vs local)
 *   - Trace/screenshot/video capture settings for debugging failures
 *
 * In local dev, this assumes `npm run dev` is already running.
 * In CI, the e2e workflow brings up infra containers separately.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // All E2E test files live under e2e/tests/.
  testDir: './tests',

  // Run tests in parallel for speed (independent tests only).
  fullyParallel: true,

  // Fail fast on CI if a test uses test.only (prevents accidental skip).
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI (flaky test mitigation).
  retries: process.env.CI ? 2 : 0,

  // Limit workers on CI to avoid resource exhaustion.
  workers: process.env.CI ? 1 : undefined,

  // Reporters: HTML for artifact upload, list for console output.
  reporter: [['html'], ['list']],

  use: {
    // Base URL — defaults to local dev server, override for CI/staging.
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',

    // Capture traces on first retry for debugging.
    trace: 'on-first-retry',

    // Screenshots only on failure (saves disk space on passing runs).
    screenshot: 'only-on-failure',

    // Retain video only on failure.
    video: 'retain-on-failure',
  },

  // Browser projects — Chromium only for now.
  // Phase 3 will add Firefox + WebKit for cross-browser visual regression.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer config — in local dev, `npm run dev` is run manually.
  // In CI, the e2e workflow starts infra + app separately.
});
