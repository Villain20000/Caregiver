import { Routes } from '@angular/router';
import { Role } from './core/models/role.model';
import { roleGuard } from './core/guards/role.guard';

/**
 * CareVibe routes — 23 feature areas wrapped in the MainShell layout.
 *
 * Each route is RBAC-gated by `roleGuard(allowed)` and carries its allowed
 * roles in `data.roles` for the sidebar / nav to consume. The guard
 * redirects to /dashboard when the active role is not allowed.
 *
 * NOTE: `loadComponent` is intentionally untyped; the feature components are
 * created by other subagents. At runtime the dynamic import resolves to
 * the real component class.
 */
const ALL_STAFF: Role[] = [Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.DISPATCHER, Role.SOCIAL_WORKER, Role.THERAPIST, Role.NUTRITIONIST, Role.BILLING];
const CLINICAL:  Role[] = [Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST];
const ALL_ROLES: Role[] = [Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.DISPATCHER, Role.SOCIAL_WORKER, Role.THERAPIST, Role.NUTRITIONIST, Role.BILLING, Role.FAMILY, Role.PATIENT];

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shared/layout/main-shell/main-shell.component').then((m) => m.MainShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'Dashboard' },
      },
      {
        path: 'sos',
        loadComponent: () => import('./features/sos/sos.component').then((m) => m.SosComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'SOS Center' },
      },
      {
        path: 'mood',
        loadComponent: () => import('./features/mood/mood.component').then((m) => m.MoodComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'Mood & Wellbeing' },
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/chat.component').then((m) => m.ChatComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'Conversations' },
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/calendar/calendar.component').then((m) => m.CalendarComponent),
        canActivate: [roleGuard(ALL_STAFF.concat([Role.FAMILY, Role.PATIENT]))],
        data: { roles: ALL_STAFF.concat([Role.FAMILY, Role.PATIENT]), title: 'Calendar' },
      },
      {
        path: 'tasks',
        loadComponent: () => import('./features/tasks/tasks.component').then((m) => m.TasksComponent),
        canActivate: [roleGuard([Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.ADMIN, Role.DOCTOR])],
        data: { roles: [Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.ADMIN, Role.DOCTOR], title: 'Tasks' },
      },
      {
        path: 'expenses',
        loadComponent: () => import('./features/expenses/expenses.component').then((m) => m.ExpensesComponent),
        canActivate: [roleGuard([Role.ADMIN, Role.BILLING, Role.DISPATCHER, Role.NURSE, Role.THERAPIST])],
        data: { roles: [Role.ADMIN, Role.BILLING, Role.DISPATCHER, Role.NURSE, Role.THERAPIST], title: 'Expenses' },
      },
      {
        path: 'notice-board',
        loadComponent: () => import('./features/notice-board/notice-board.component').then((m) => m.NoticeBoardComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'Notice Board' },
      },
      {
        path: 'vitals',
        loadComponent: () => import('./features/vitals/vitals.component').then((m) => m.VitalsComponent),
        canActivate: [roleGuard([Role.NURSE, Role.DOCTOR, Role.PATIENT, Role.FAMILY])],
        data: { roles: [Role.NURSE, Role.DOCTOR, Role.PATIENT, Role.FAMILY], title: 'Vitals' },
      },
      {
        path: 'medication',
        loadComponent: () => import('./features/medication/medication.component').then((m) => m.MedicationComponent),
        canActivate: [roleGuard([Role.NURSE, Role.DOCTOR, Role.FAMILY])],
        data: { roles: [Role.NURSE, Role.DOCTOR, Role.FAMILY], title: 'Medication' },
      },
      {
        path: 'shift-clock',
        loadComponent: () => import('./features/shift-clock/shift-clock.component').then((m) => m.ShiftClockComponent),
        canActivate: [roleGuard([Role.NURSE, Role.THERAPIST, Role.DISPATCHER, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.ADMIN])],
        data: { roles: [Role.NURSE, Role.THERAPIST, Role.DISPATCHER, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.ADMIN], title: 'Shift Clock' },
      },
      {
        path: 'handover',
        loadComponent: () => import('./features/handover/handover.component').then((m) => m.HandoverComponent),
        canActivate: [roleGuard([Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.DISPATCHER, Role.ADMIN, Role.DOCTOR])],
        data: { roles: [Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.DISPATCHER, Role.ADMIN, Role.DOCTOR], title: 'Handover' },
      },
      {
        path: 'therapy',
        loadComponent: () => import('./features/therapy/therapy.component').then((m) => m.TherapyComponent),
        canActivate: [roleGuard([Role.THERAPIST, Role.DOCTOR, Role.NURSE, Role.PATIENT, Role.FAMILY, Role.ADMIN])],
        data: { roles: [Role.THERAPIST, Role.DOCTOR, Role.NURSE, Role.PATIENT, Role.FAMILY, Role.ADMIN], title: 'Therapy Sessions' },
      },
      {
        path: 'prescription',
        loadComponent: () => import('./features/prescription/prescription.component').then((m) => m.PrescriptionComponent),
        canActivate: [roleGuard([Role.DOCTOR])],
        data: { roles: [Role.DOCTOR], title: 'Prescriptions' },
      },
      {
        path: 'welfare',
        loadComponent: () => import('./features/welfare/welfare.component').then((m) => m.WelfareComponent),
        canActivate: [roleGuard([Role.SOCIAL_WORKER, Role.ADMIN, Role.FAMILY, Role.PATIENT, Role.DISPATCHER, Role.NURSE])],
        data: { roles: [Role.SOCIAL_WORKER, Role.ADMIN, Role.FAMILY, Role.PATIENT, Role.DISPATCHER, Role.NURSE], title: 'Welfare' },
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/audit/audit.component').then((m) => m.AuditComponent),
        canActivate: [roleGuard([Role.ADMIN, Role.BILLING, Role.DOCTOR])],
        data: { roles: [Role.ADMIN, Role.BILLING, Role.DOCTOR], title: 'Audit Log' },
      },
      {
        path: 'map',
        loadComponent: () => import('./features/map/map.component').then((m) => m.MapComponent),
        canActivate: [roleGuard([Role.DISPATCHER, Role.ADMIN, Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST])],
        data: { roles: [Role.DISPATCHER, Role.ADMIN, Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST], title: 'Live Map' },
      },
      {
        path: 'diet',
        loadComponent: () => import('./features/diet/diet.component').then((m) => m.DietComponent),
        canActivate: [roleGuard([Role.NUTRITIONIST, Role.NURSE, Role.DOCTOR, Role.PATIENT, Role.FAMILY, Role.ADMIN])],
        data: { roles: [Role.NUTRITIONIST, Role.NURSE, Role.DOCTOR, Role.PATIENT, Role.FAMILY, Role.ADMIN], title: 'Diet Plans' },
      },
      {
        path: 'matching',
        loadComponent: () => import('./features/matching/matching.component').then((m) => m.MatchingComponent),
        canActivate: [roleGuard([Role.ADMIN, Role.SOCIAL_WORKER, Role.DISPATCHER])],
        data: { roles: [Role.ADMIN, Role.SOCIAL_WORKER, Role.DISPATCHER], title: 'Caregiver Matching' },
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/inventory/inventory.component').then((m) => m.InventoryComponent),
        canActivate: [roleGuard([Role.NURSE, Role.DISPATCHER, Role.ADMIN])],
        data: { roles: [Role.NURSE, Role.DISPATCHER, Role.ADMIN], title: 'Inventory' },
      },
      {
        path: 'timesheet',
        loadComponent: () => import('./features/timesheet/timesheet.component').then((m) => m.TimesheetComponent),
        canActivate: [roleGuard([Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.DISPATCHER, Role.BILLING, Role.ADMIN])],
        data: { roles: [Role.NURSE, Role.THERAPIST, Role.SOCIAL_WORKER, Role.NUTRITIONIST, Role.DISPATCHER, Role.BILLING, Role.ADMIN], title: 'Timesheets' },
      },
      {
        path: 'insurance',
        loadComponent: () => import('./features/insurance/insurance.component').then((m) => m.InsuranceComponent),
        canActivate: [roleGuard([Role.ADMIN, Role.BILLING, Role.SOCIAL_WORKER])],
        data: { roles: [Role.ADMIN, Role.BILLING, Role.SOCIAL_WORKER], title: 'Insurance' },
      },
      {
        path: 'consent',
        loadComponent: () => import('./features/consent/consent.component').then((m) => m.ConsentComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'Consent & NDA' },
      },
      {
        path: 'burnout',
        loadComponent: () => import('./features/burnout/burnout.component').then((m) => m.BurnoutComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'Burnout Assessment' },
      },
      {
        path: 'sync',
        loadComponent: () => import('./features/sync/sync.component').then((m) => m.SyncComponent),
        canActivate: [roleGuard(ALL_ROLES)],
        data: { roles: ALL_ROLES, title: 'Data Sync' },
      },

      // Catch-all
      {
        path: 'forbidden',
        loadComponent: () => import('./shared/components/forbidden.component').then((m) => m.ForbiddenComponent),
        data: { title: 'Forbidden' },
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

/** Backwards-compat alias used by app.config. */
export const APP_ROUTES = routes;
