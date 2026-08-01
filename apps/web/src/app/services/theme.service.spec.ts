/**
 * apps/web/src/app/services/theme.service.spec.ts
 *
 * Unit tests for ThemeService — light/dark mode using CSS custom properties.
 *
 * These tests prove the karma/jasmine setup works end-to-end: TestBed
 * initializes the ThemeService (providedIn: 'root') in a real headless
 * browser, and each test exercises the localStorage persistence and the
 * `data-theme` attribute applied to <html>.
 */
import { TestBed } from '@angular/core/testing';
// Imported without the `.js` extension. Both styles work in the karma build:
// extensionless imports resolve via webpack's resolve.extensions, and `.js`
// imports resolve via resolve.extensionAlias (see karma.webpack.config.cjs).
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  it('defaults to the light theme', () => {
    expect(service.theme()).toBe('light');
    expect(service.isDark()).toBe(false);
  });

  it('toggles between light and dark', () => {
    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);

    service.toggle();
    expect(service.theme()).toBe('light');
    expect(service.isDark()).toBe(false);
  });

  it('persists the selected theme to localStorage', () => {
    service.setTheme('dark');

    expect(localStorage.getItem('caregiver_theme')).toBe('dark');
    expect(service.theme()).toBe('dark');
  });

  it('applies the data-theme attribute to the document root', () => {
    service.setTheme('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores a saved theme on creation', () => {
    localStorage.setItem('caregiver_theme', 'dark');

    // Construct a fresh instance directly — TestBed.inject would return the
    // singleton already created in beforeEach, so its constructor (which
    // reads the saved theme) would not re-run.
    const restored = new ThemeService();

    expect(restored.theme()).toBe('dark');
    expect(restored.isDark()).toBe(true);
  });
});
