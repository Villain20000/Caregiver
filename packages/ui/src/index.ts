/**
 * packages/ui/src/index.ts
 *
 * Shared Angular standalone component library for the Caregiver platform.
 *
 * This package provides reusable UI components consumed by apps/web:
 *   - RoleBadge — displays a user's healthcare role with color coding
 *   - StatusBadge — displays a status/state with semantic color coding
 *   - LoadingSpinner — animated spinner with optional label
 *   - EmptyState — placeholder for empty data states
 *   - MetricCard — single data point card with optional trend indicator
 *
 * All components are Angular 17+ standalone (no NgModules) and use
 * signals for reactive state management.
 */

/** Semantic version of the UI component library. */
export const UI_LIB_VERSION = '0.2.0';

// ── Components ──────────────────────────────────────────────
export { RoleBadgeComponent } from './role-badge.component.js';
export { StatusBadgeComponent, type BadgeSize } from './status-badge.component.js';
export { LoadingSpinnerComponent, type SpinnerSize } from './loading-spinner.component.js';
export { EmptyStateComponent } from './empty-state.component.js';
export { MetricCardComponent } from './metric-card.component.js';
