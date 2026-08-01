/**
 * apps/web/src/app/services/theme.service.ts
 *
 * Theme service — manages light/dark mode using CSS custom properties.
 *
 * The global stylesheet (`styles.css`) defines `--color-*` variables for
 * light mode. This service toggles a `data-theme="dark"` attribute on
 * the document root, and the stylesheet swaps the variable values via
 * `[data-theme="dark"] { --color-primary: ... }`.
 *
 * The user's preference is persisted in localStorage and restored on
 * page load. The service also respects the OS-level `prefers-color-scheme`
 * media query as the default when no saved preference exists.
 */
import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'caregiver_theme';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Current theme signal ('light' or 'dark'). */
  private readonly _theme = signal<Theme>('light');

  /** Read-only signal for the current theme. */
  readonly theme = this._theme.asReadonly();

  /** Computed: whether dark mode is active. */
  readonly isDark = computed(() => this._theme() === 'dark');

  constructor() {
    // Restore saved preference, or detect OS preference.
    this._theme.set(this.loadSavedTheme());
    this.applyTheme(this._theme());
  }

  /** Toggle between light and dark modes. */
  toggle(): void {
    const next: Theme = this._theme() === 'light' ? 'dark' : 'light';
    this._theme.set(next);
    this.applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  /** Set a specific theme. */
  setTheme(theme: Theme): void {
    this._theme.set(theme);
    this.applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  /** Apply the theme by setting the `data-theme` attribute on `<html>`. */
  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /** Load the saved theme, or detect OS preference, defaulting to light. */
  private loadSavedTheme(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;

    // No saved preference — respect OS setting.
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }
}
