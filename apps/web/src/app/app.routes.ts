/**
 * apps/web/src/app/app.routes.ts
 *
 * Root route configuration — lazy-loaded feature routes.
 *
 * Route structure:
 *   /              → redirect to /login or /dashboard based on auth state
 *   /login         → login page (public)
 *   /dashboard     → role-based dashboard (protected, lazy-loaded)
 *   /appointments  → appointment management (protected, lazy-loaded)
 *   /vitals        → vitals recording/viewing (protected, lazy-loaded)
 *   /ai            → AI diagnosis interface (protected, lazy-loaded)
 *
 * Each lazy route uses loadComponent for standalone components.
 */
import { type Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard.js';

export const APP_ROUTES: Routes = [
  // Default route — redirect to dashboard (auth guard handles redirect to login).
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // Login route — public, lazy-loaded standalone component.
  {
    path: 'login',
    loadComponent: () => import('./pages/login.component.js').then((m) => m.LoginComponent),
  },

  // Dashboard route — protected, lazy-loaded.
  // The dashboard component renders role-specific content based on the user's role.
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard.component.js').then((m) => m.DashboardComponent),
  },

  // Appointments route — protected, lazy-loaded.
  {
    path: 'appointments',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/appointments.component.js').then((m) => m.AppointmentsComponent),
  },

  // Vitals route — protected, lazy-loaded.
  {
    path: 'vitals',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/vitals.component.js').then((m) => m.VitalsComponent),
  },

  // AI diagnosis route — protected, lazy-loaded.
  {
    path: 'ai',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/ai-diagnosis.component.js').then((m) => m.AiDiagnosisComponent),
  },

  // Wildcard route — redirect unknown paths to dashboard.
  { path: '**', redirectTo: '/dashboard' },
];
