/**
 * apps/web/src/app/app.component.ts
 *
 * Root component — the application shell.
 *
 * Uses Angular 17+ standalone components (no NgModule).
 * Renders the <router-outlet> for route-based navigation.
 * Shows a top bar with the app name and user info when authenticated.
 */
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service.js';
import { AlertService } from './services/alert.service.js';
import { getRolePermissions, type Role, type Feature } from '@caregiver/rbac';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="app-header">
        <div class="app-brand">
          <a routerLink="/">Caregiver</a>
          <span class="app-subtitle">Healthcare Intelligence Platform</span>
        </div>

        @if (authService.currentUser()) {
          <nav class="app-nav">
            @if (navLinks().appointments) {
              <a routerLink="/appointments" routerLinkActive="active-link">Appointments</a>
            }
            @if (navLinks().vitals) {
              <a routerLink="/vitals" routerLinkActive="active-link">Vitals</a>
            }
            @if (navLinks().ai) {
              <a routerLink="/ai" routerLinkActive="active-link">AI Diagnostics</a>
            }
            @if (navLinks().fhir) {
              <a routerLink="/fhir" routerLinkActive="active-link">FHIR</a>
            }
            @if (navLinks().orders) {
              <a routerLink="/orders" routerLinkActive="active-link">Orders</a>
            }
            @if (navLinks().billing) {
              <a routerLink="/billing" routerLinkActive="active-link">Billing</a>
            }
            @if (navLinks().audit) {
              <a routerLink="/audit" routerLinkActive="active-link">Audit</a>
            }
          </nav>
        }

        @if (authService.currentUser()) {
          <div class="app-user">
            <span class="user-name">{{ authService.currentUser()?.fullName }}</span>
            <span class="user-role">{{ authService.currentUser()?.role }}</span>
            <button (click)="logout()" class="logout-btn">Logout</button>
          </div>
        }
      </header>

      @if (authService.currentUser() && alertService.alerts().length > 0) {
        <div class="alert-bar">
          <div class="alert-scroll">
            @for (alert of alertService.alerts(); track alert.alertId) {
              <div class="alert-item" [class]="'severity-' + alert.severity">
                <span class="alert-msg">{{ alert.message }}</span>
                <button (click)="alertService.acknowledge(alert.alertId)" class="alert-dismiss">&times;</button>
              </div>
            }
          </div>
          @if (alertService.alerts().length > 3) {
            <button (click)="alertService.clear()" class="alert-clear-all">Clear all</button>
          }
        </div>
      }

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
      box-shadow: 0 2px 4px rgba(0,0,0,0.1); gap: 1.5rem;
    }
    .app-brand a { color: white; text-decoration: none; font-size: 1.25rem; font-weight: 600; }
    .app-subtitle { display: none; }
    .app-nav { display: flex; gap: 0.25rem; flex: 1; justify-content: center; }
    .app-nav a {
      color: rgba(255,255,255,0.8); text-decoration: none; padding: 0.4rem 0.8rem;
      border-radius: 4px; font-size: 0.875rem; transition: all 0.2s;
    }
    .app-nav a:hover { background: rgba(255,255,255,0.15); color: white; }
    .app-nav a.active-link { background: rgba(255,255,255,0.2); color: white; font-weight: 600; }
    .app-user { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
    .user-name { font-weight: 500; font-size: 0.875rem; }
    .user-role {
      padding: 0.25rem 0.5rem; border-radius: 4px;
      background: rgba(255,255,255,0.2); font-size: 0.7rem; text-transform: uppercase;
    }
    .logout-btn {
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
      color: white; padding: 0.35rem 0.7rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
    }
    .logout-btn:hover { background: rgba(255,255,255,0.25); }
    .alert-bar {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 1.5rem;
      background: #fff8e1; border-bottom: 1px solid #ffe082; overflow: hidden;
    }
    .alert-scroll { display: flex; gap: 0.5rem; overflow-x: auto; flex: 1; padding: 0.25rem 0; }
    .alert-item {
      display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0.6rem;
      border-radius: 4px; font-size: 0.75rem; white-space: nowrap; flex-shrink: 0;
    }
    .alert-item.severity-critical { background: #ffebee; color: #c62828; }
    .alert-item.severity-warning { background: #fff3e0; color: #e65100; }
    .alert-item.severity-info { background: #e3f2fd; color: #1565c0; }
    .alert-item.severity-emergency { background: #fce4ec; color: #880e4f; }
    .alert-dismiss {
      background: none; border: none; cursor: pointer; font-size: 1rem;
      line-height: 1; padding: 0; color: inherit; opacity: 0.6;
    }
    .alert-dismiss:hover { opacity: 1; }
    .alert-clear-all {
      background: none; border: none; cursor: pointer; font-size: 0.7rem;
      color: #666; white-space: nowrap; padding: 0.2rem 0.4rem;
    }
    .alert-clear-all:hover { color: #333; }
    .app-content { flex: 1; padding: 1.5rem; }
  `],
})
export class AppComponent {
  readonly authService = inject(AuthService);
  readonly alertService = inject(AlertService);

  /**
   * Map of top-level navigation links that should be visible to the current user.
   *
   * A link is enabled when the user's role has at least one non-denied permission
   * in the corresponding feature domain. This keeps the UI aligned with the
   * RBAC matrix in `packages/rbac` without hard-coding per-role checks.
   */
  readonly navLinks = computed(() => {
    const role = this.authService.currentUser()?.role as Role | undefined;
    if (!role) return { appointments: false, vitals: false, ai: false, fhir: false, orders: false, billing: false, audit: false };
    const perms = getRolePermissions(role);
    const hasAny = (...features: Feature[]) => features.some((f) => perms[f] !== 'deny');
    return {
      appointments: hasAny('appointment.schedule', 'appointment.view_by_patient'),
      vitals: hasAny('vitals.record', 'vitals.view'),
      ai: hasAny('ai.request_diagnosis', 'ai.view_diagnosis'),
      fhir: hasAny('fhir.view', 'fhir.search'),
      orders: hasAny('order.lab_create', 'order.imaging_create', 'order.medication_create', 'order.fill', 'order.dispense'),
      billing: hasAny('billing.claim_create', 'billing.claim_submit', 'billing.adjudicate', 'billing.post_payment', 'billing.denial_report'),
      audit: hasAny('audit.read_log'),
    };
  });

  /** Signs the current user out and clears any active session state. */
  logout(): void {
    this.authService.logout();
  }
}
