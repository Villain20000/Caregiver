/**
 * packages/ui/src/role-badge.component.ts
 *
 * RoleBadge — displays a user's healthcare role with color coding.
 *
 * Usage:
 *   <app-role-badge [role]="'doctor'" />
 *
 * The badge color maps to the role type via CSS variables defined in
 * the global stylesheet (--color-role-*).
 */
import { Component, computed, input } from '@angular/core';
import { ROLE_DISPLAY_NAMES, type Role } from '@caregiver/rbac';

/**
 * Maps a role string to its hex color from the global design tokens.
 * These values match the --color-role-* variables in styles.css.
 */
const ROLE_COLORS: Record<string, string> = {
  admin: '#1a237e',
  doctor: '#1565c0',
  nurse: '#00897b',
  patient: '#6a1b9a',
  radiologist: '#ef6c00',
  pharmacist: '#2e7d32',
  billing_specialist: '#c62828',
  lab_tech: '#00695c',
  auditor: '#4e342e',
  medical_director: '#b71c1c',
};

@Component({
  selector: 'app-role-badge',
  standalone: true,
  template: `
    <span class="role-badge" [style.background-color]="roleColor()">
      <span class="role-dot"></span>
      <span class="role-label">{{ displayName() }}</span>
    </span>
  `,
  styles: [
    `
      .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.7rem;
        border-radius: 9999px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
        color: white;
      }
      .role-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.8);
      }
    `,
  ],
})
export class RoleBadgeComponent {
  /** The healthcare role to display. */
  readonly role = input.required<string>();

  /** Hex color for the role badge. */
  readonly roleColor = computed(() => ROLE_COLORS[this.role()] ?? '#666');

  /** Human-readable display name from the RBAC package. */
  readonly displayName = computed(() => {
    const r = this.role() as Role;
    return ROLE_DISPLAY_NAMES[r] ?? r;
  });
}
