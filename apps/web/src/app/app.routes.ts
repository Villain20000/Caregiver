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
import { rbacGuard } from './guards/rbac.guard.js';

/**
 * Application route configuration consumed by the Angular router.
 *
 * Each protected route has:
 *   - `canActivate: [authGuard, rbacGuard]` — checks auth THEN RBAC
 *   - `data.requiredPermission` — the RBAC feature required to access the route
 *
 * The rbacGuard reads the required permission from route.data and checks it
 * against the user's role using the @caregiver/rbac permission matrix.
 * If the user's role has 'deny' for the required feature, they are redirected
 * to /dashboard.
 */
export const APP_ROUTES: Routes = [
  // Default route — redirect to dashboard (auth guard handles redirect to login).
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // Login route — public, lazy-loaded standalone component.
  {
    path: 'login',
    loadComponent: () => import('./pages/login.component.js').then((m) => m.LoginComponent),
  },

  // Dashboard route — protected, lazy-loaded.
  {
    path: 'dashboard',
    canActivate: [authGuard, rbacGuard],
    loadComponent: () => import('./pages/dashboard.component.js').then((m) => m.DashboardComponent),
  },

  // Appointments route — protected, requires appointment scheduling permissions.
  {
    path: 'appointments',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'appointment.schedule' },
    loadComponent: () =>
      import('./pages/appointments.component.js').then((m) => m.AppointmentsComponent),
  },

  // Vitals route — protected, requires vitals viewing permissions.
  {
    path: 'vitals',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'vitals.view' },
    loadComponent: () => import('./pages/vitals.component.js').then((m) => m.VitalsComponent),
  },

  // AI diagnosis route — protected, requires AI diagnosis viewing.
  {
    path: 'ai',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'ai.view_diagnosis' },
    loadComponent: () =>
      import('./pages/ai-diagnosis.component.js').then((m) => m.AiDiagnosisComponent),
  },

  // FHIR resource viewer — protected, requires FHIR viewing permissions.
  {
    path: 'fhir',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'fhir.view' },
    loadComponent: () => import('./pages/fhir/fhir.component.js').then((m) => m.FhirComponent),
  },

  // Lab Results — protected, requires FHIR view (reads Observation resources).
  {
    path: 'lab-results',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'fhir.view' },
    loadComponent: () =>
      import('./pages/lab-results.component.js').then((m) => m.LabResultsComponent),
  },

  // Orders management — protected, requires order creation permission.
  {
    path: 'orders',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'order.lab_create' },
    loadComponent: () =>
      import('./pages/orders/orders.component.js').then((m) => m.OrdersComponent),
  },

  // Billing & claims — protected, requires claim creation permission.
  {
    path: 'billing',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'billing.claim_create' },
    loadComponent: () =>
      import('./pages/billing/billing.component.js').then((m) => m.BillingComponent),
  },

  // Audit trail — protected, requires audit log reading permission.
  {
    path: 'audit',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'audit.read_log' },
    loadComponent: () => import('./pages/audit.component.js').then((m) => m.AuditComponent),
  },

  // Settings — protected (auth only, no RBAC needed for basic settings).
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings.component.js').then((m) => m.SettingsComponent),
  },

  // Forgot password — public.
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password.component.js').then((m) => m.ForgotPasswordComponent),
  },

  // Reset password — public (token in query param).
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password.component.js').then((m) => m.ResetPasswordComponent),
  },

  // Patient summary — protected, requires at least vitals.view.
  {
    path: 'patient/:id',
    canActivate: [authGuard, rbacGuard],
    data: { requiredPermission: 'vitals.view' },
    loadComponent: () =>
      import('./pages/patient-summary.component.js').then((m) => m.PatientSummaryComponent),
  },

  // Wildcard route — redirect unknown paths to dashboard.
  { path: '**', redirectTo: '/dashboard' },
];
