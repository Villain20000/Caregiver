/**
 * apps/web/karma.conf.cjs
 *
 * Karma configuration for the Angular CLI karma builder (`ng test`).
 *
 * Named `.cjs` (not `.js`) because this workspace's package.json declares
 * `"type": "module"` — Karma loads its config via CommonJS `require()`, and
 * the `.cjs` extension keeps it CommonJS regardless of the package type.
 *
 * Launchers:
 *   - `ChromeHeadless` — default, used by CI (GitHub Actions has Chrome).
 *   - `ChromeHeadlessNoSandbox` — fallback for container/root environments
 *     where Chrome's SUID sandbox is unavailable (`--no-sandbox`).
 *
 * IMPORTANT (spec authoring): spec files MUST use extensionless relative
 * imports (`import { Foo } from './foo'`), NOT `.js`-suffixed imports. The
 * karma webpack builder does not map `.js` imports to `.ts` sources the way
 * vitest/esbuild do, so `.js`-suffixed imports fail with "Can't resolve".
 * This only affects spec files — the app sources keep their `.js` suffixes.
 *
 * IMPORTANT (local dev): `ng test` needs a Chrome binary. CI has Chrome, but
 * on machines without it set CHROME_BIN (e.g. to a Playwright Chromium), or
 * run with --browsers=ChromeHeadlessNoSandbox where sandbox is unavailable.
 *
 * The `@angular-devkit/build-angular/plugins/karma` plugin is what lets the
 * Angular CLI compile the project (webpack/esbuild) before Karma runs.
 */
module.exports = function (config) {
  config.set({
    // Base path that will be used to resolve all patterns (eg. files, exclude).
    basePath: '',

    // Frameworks to use: Jasmine (Angular's default unit test framework) +
    // the Angular CLI plugin (compiles the app before running tests).
    frameworks: ['jasmine', '@angular-devkit/build-angular'],

    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],

    // Client-level settings.
    client: {
      jasmine: {},
      // Leave the Jasmine Spec Runner output visible in the browser.
      clearContext: false,
    },

    // Remove the duplicated traces shown in the HTML reporter.
    jasmineHtmlReporter: {
      suppressAll: true,
    },

    // Coverage reporter (requires `karma-coverage`).
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/caregiver-web'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },

    // Reporters to use. `progress` prints dots/lines; `kjhtml` renders the
    // Jasmine Spec Runner in the browser during watch mode.
    reporters: ['progress', 'kjhtml'],

    // Browser launchers. CI passes --browsers=ChromeHeadless explicitly;
    // ChromeHeadlessNoSandbox is provided for sandboxless environments.
    browsers: ['ChromeHeadless'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu'],
      },
    },

    // Karma watches source files for changes and re-runs tests.
    restartOnFileChange: true,
  });
};
