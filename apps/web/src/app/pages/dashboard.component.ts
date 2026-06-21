/**
 * apps/web/src/app/pages/dashboard.component.ts
 *
 * Dashboard page — role-based dashboard that renders different content
 * based on the authenticated user's role.
 *
 * Uses the @caregiver/rbac package to determine which features the user
 * can access, and renders appropriate widgets/links.
 *
 * For Phase 2, the dashboard shows:
 *   - A welcome message with the user's name and role
 *   - Navigation cards for features the user has access to
 *   - Role-specific quick actions
 */
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service.js';
import { getRolePermissions, ROLE_DISPLAY_NAMES, type Role } from '@caregiver/rbac';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard">
      <!-- Welcome header — shows user name + role. -->
      <div class="dashboard-header">
        <h1>Welcome, {{ user()?.fullName }}</h1>
        <span class="role-badge">{{ displayName() }}</span>
      </div>

      <!-- Feature navigation cards — rendered based on RBAC permissions. -->
      <div class="feature-grid">
        @for (card of featureCards(); track card.link) {
          <a [routerLink]="card.link" class="feature-card">
            <div class="feature-icon">{{ card.icon }}</div>
            <h3>{{ card.title }}</h3>
            <p>{{ card.description }}</p>
          </a>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .dashboard-header {
      display: flex; align-items: center; gap: 1rem;
      margin-bottom: 2rem;
    }
    .dashboard-header h1 { margin: 0; color: #1a237e; }
    .role-badge {
      padding: 0.3rem 0.7rem; background: #e8eaf6; color: #1a237e;
      border-radius: 4px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;
    }
    .feature-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
    }
    .feature-card {
      display: block; padding: 1.5rem; background: white; border: 1px solid #e0e0e0;
      border-radius: 8px; text-decoration: none; color: inherit;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .feature-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px);
    }
    .feature-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .feature-card h3 { margin: 0 0 0.5rem; color: #1a237e; }
    .feature-card p { margin: 0; color: #666; font-size: 0.875rem; }
  `],
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);

  /** Current user signal (readonly). */
  readonly user = this.authService.currentUser;

  /** Human-readable role display name. */
  readonly displayName = computed(() => {
    const role = this.user()?.role as Role | undefined;
    return role ? ROLE_DISPLAY_NAMES[role] : '';
  });

  /**
   * Feature cards — computed based on the user's RBAC permissions.
   * Only shows cards for features the user has 'allow' or 'conditional' access to.
   */
  readonly featureCards = computed(() => {
    const role = this.user()?.role as Role | undefined;
    if (!role) return [];

    const perms = getRolePermissions(role);
    const cards: Array<{ link: string; icon: string; title: string; description: string }> = [];

    // Appointments card.
    if (perms['appointment.schedule'] !== 'deny' || perms['appointment.view_by_patient'] !== 'deny') {
      cards.push({
        link: '/appointments',
        icon: '📅',
        title: 'Appointments',
        description: 'Schedule, view, and manage patient appointments.',
      });
    }

    // Vitals card.
    if (perms['vitals.record'] !== 'deny' || perms['vitals.view'] !== 'deny') {
      cards.push({
        link: '/vitals',
        icon: '❤️',
        title: 'Vital Signs',
        description: 'Record and monitor patient vital signs and trends.',
      });
    }

    // AI Diagnostics card.
    if (perms['ai.request_diagnosis'] !== 'deny' || perms['ai.view_diagnosis'] !== 'deny') {
      cards.push({
        link: '/ai',
        icon: '🤖',
        title: 'AI Diagnostics',
        description: 'Request AI-assisted diagnoses and review results.',
      });
    }

    return cards;
  });
}
