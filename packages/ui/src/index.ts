/**
 * packages/ui/src/index.ts
 *
 * Shared Angular standalone component library for the Caregiver platform.
 *
 * This package provides reusable UI components consumed by apps/web:
 *   - Dashboard cards (metric, alert, trend)
 *   - Data tables (FHIR resource lists, appointment grids)
 *   - Charts (vitals trends, lab results over time)
 *   - Role badge (displays the user's healthcare role with color coding)
 *   - FHIR resource viewer (renders FHIR JSON in a human-readable tree)
 *   - Alert toast (real-time notification popups via Socket.io)
 *
 * All components are Angular 17+ standalone (no NgModules) and use
 * signals for reactive state management.
 *
 * Phase 1: placeholder. Phase 2 will populate with the first components.
 */

/** Semantic version of the UI component library. */
export const UI_LIB_VERSION = '0.1.0';
