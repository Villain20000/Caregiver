/**
 * apps/web/src/app/app.component.ts
 *
 * Root component — the application shell.
 *
 * Uses Angular 17+ standalone components (no NgModule).
 * Renders the <router-outlet> for route-based navigation.
 * Shows a top bar with the app name and user info when authenticated.
 */
import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service.js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <!-- Top navigation bar — shown on all routes. -->
      <header class="app-header">
        <div class="app-brand">
          <a routerLink="/">Caregiver</a>
          <span class="app-subtitle">Healthcare Intelligence Platform</span>
        </div>

        <!-- User info + logout — shown only when authenticated. -->
        @if (authService.currentUser()) {
          <div class="app-user">
            <span class="user-name">{{ authService.currentUser()?.fullName }}</span>
            <span class="user-role">{{ authService.currentUser()?.role }}</span>
            <button (click)="logout()" class="logout-btn">Logout</button>
          </div>
        }
      </header>

      <!-- Routed content — lazy-loaded feature components render here. -->
      <main class="app-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-shell { display: flex; flex-direction: column; min-height: 100vh; }
    .app-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0 1.5rem; height: 64px;
      background: #1a237e; color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .app-brand a { color: white; text-decoration: none; font-size: 1.25rem; font-weight: 600; }
    .app-subtitle { margin-left: 0.5rem; font-size: 0.875rem; opacity: 0.7; }
    .app-user { display: flex; align-items: center; gap: 1rem; }
    .user-name { font-weight: 500; }
    .user-role {
      padding: 0.25rem 0.5rem; border-radius: 4px;
      background: rgba(255,255,255,0.2); font-size: 0.75rem; text-transform: uppercase;
    }
    .logout-btn {
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
      color: white; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer;
    }
    .logout-btn:hover { background: rgba(255,255,255,0.25); }
    .app-content { flex: 1; padding: 1.5rem; }
  `],
})
export class AppComponent {
  // Inject the auth service — uses Angular's inject() function (modern API).
  readonly authService = inject(AuthService);

  /** Logout the current user and redirect to login. */
  logout(): void {
    this.authService.logout();
  }
}
