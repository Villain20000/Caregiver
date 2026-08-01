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
import { getRolePermissions, ROLE_DISPLAY_NAMES, type Role, type Feature } from '@caregiver/rbac';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard">
      <!-- Welcome header — shows user name + role. -->
      <div class="dashboard-header">
        <div>
          <h1>Welcome, {{ user()?.fullName }}</h1>
          <p class="dashboard-greeting">Healthcare Intelligence Platform</p>
        </div>
        <span class="role-badge">{{ displayName() }}</span>
      </div>

      <!-- Feature navigation cards — rendered based on RBAC permissions. -->
      <div class="feature-grid">
        @for (card of featureCards(); track card.link) {
          <a [routerLink]="card.link" class="feature-card">
            <div class="feature-icon-wrap">
              <span class="feature-icon">{{ card.icon }}</span>
            </div>
            <h3>{{ card.title }}</h3>
            <p>{{ card.description }}</p>
            <span class="card-action">Open {{ card.title }} &rarr;</span>
          </a>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .dashboard {
        max-width: var(--page-max-width);
        margin: 0 auto;
        animation: fadeIn 200ms ease;
      }
      .dashboard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        margin-bottom: var(--space-8);
        flex-wrap: wrap;
      }
      .dashboard-header h1 {
        margin: 0;
        color: var(--color-primary);
        font-size: var(--text-2xl);
      }
      .dashboard-greeting {
        margin: var(--space-1) 0 0;
        color: var(--color-text-muted);
        font-size: var(--text-base);
      }
      .role-badge {
        padding: var(--space-1) var(--space-3);
        background: var(--color-primary-bg);
        color: var(--color-primary);
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }
      .feature-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: var(--space-5);
      }
      .feature-card {
        display: flex;
        flex-direction: column;
        padding: var(--space-6);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        text-decoration: none;
        color: inherit;
        transition: all var(--transition-base);
        position: relative;
        overflow: hidden;
      }
      .feature-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--color-primary);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform var(--transition-slow);
      }
      .feature-card:hover {
        box-shadow: var(--shadow-lg);
        transform: translateY(-3px);
        border-color: var(--color-primary-light);
      }
      .feature-card:hover::before {
        transform: scaleX(1);
      }
      .feature-icon-wrap {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-primary-bg);
        border-radius: var(--radius-lg);
        margin-bottom: var(--space-4);
        transition: background var(--transition-fast);
      }
      .feature-card:hover .feature-icon-wrap {
        background: var(--color-primary-surface);
      }
      .feature-icon {
        font-size: 1.5rem;
      }
      .feature-card h3 {
        margin: 0 0 var(--space-2);
        color: var(--color-primary);
        font-size: var(--text-md);
        font-weight: var(--font-semibold);
      }
      .feature-card p {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        flex: 1;
      }
      .card-action {
        margin-top: var(--space-4);
        font-size: var(--text-xs);
        color: var(--color-primary);
        font-weight: var(--font-medium);
        opacity: 0;
        transform: translateX(-8px);
        transition: all var(--transition-base);
      }
      .feature-card:hover .card-action {
        opacity: 1;
        transform: translateX(0);
      }

      @media (max-width: 768px) {
        .feature-grid {
          grid-template-columns: 1fr;
        }
        .dashboard-header {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
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
   * Shows cards for ALL 7 feature domains. Cards appear only when
   * the user's role has at least one non-denied permission in that domain.
   */
  readonly featureCards = computed(() => {
    const role = this.user()?.role as Role | undefined;
    if (!role) return [];

    const perms = getRolePermissions(role);
    const hasAny = (...features: Feature[]) => features.some((f) => perms[f] !== 'deny');
    const cards: Array<{ link: string; icon: string; title: string; description: string }> = [];

    // 1. Appointments card.
    if (
      hasAny(
        'appointment.schedule',
        'appointment.view_by_patient',
        'appointment.reschedule',
        'appointment.cancel',
        'appointment.view_by_clinic',
      )
    ) {
      cards.push({
        link: '/appointments',
        icon: '📅',
        title: 'Appointments',
        description: 'Schedule, view, and manage patient appointments.',
      });
    }

    // 2. Vitals card.
    if (hasAny('vitals.record', 'vitals.view', 'vitals.trend')) {
      cards.push({
        link: '/vitals',
        icon: '❤️',
        title: 'Vital Signs',
        description: 'Record and monitor patient vital signs and trends.',
      });
    }

    // 3. AI Diagnostics card.
    if (hasAny('ai.request_diagnosis', 'ai.view_diagnosis', 'ai.approve_diagnosis')) {
      cards.push({
        link: '/ai',
        icon: '🤖',
        title: 'AI Diagnostics',
        description: 'Request AI-assisted diagnoses and review results.',
      });
    }

    // 4. FHIR Resources card.
    if (hasAny('fhir.view', 'fhir.search', 'fhir.ingest', 'fhir.export')) {
      cards.push({
        link: '/fhir',
        icon: '📋',
        title: 'FHIR Resources',
        description: 'Browse, search, and ingest FHIR R4 healthcare resources.',
      });
    }

    // 5. Orders card.
    if (
      hasAny(
        'order.lab_create',
        'order.imaging_create',
        'order.medication_create',
        'order.fill',
        'order.dispense',
      )
    ) {
      cards.push({
        link: '/orders',
        icon: '💊',
        title: 'Clinical Orders',
        description: 'Create and manage lab, imaging, and medication orders.',
      });
    }

    // 6. Billing card.
    if (
      hasAny(
        'billing.claim_create',
        'billing.claim_submit',
        'billing.adjudicate',
        'billing.post_payment',
        'billing.denial_report',
      )
    ) {
      cards.push({
        link: '/billing',
        icon: '💰',
        title: 'Billing & Claims',
        description: 'Manage insurance claims, adjudication, and payments.',
      });
    }

    // 7. Audit Trail card.
    if (hasAny('audit.read_log', 'audit.export_log')) {
      cards.push({
        link: '/audit',
        icon: '🔍',
        title: 'Audit Trail',
        description: 'View system activity and compliance audit logs.',
      });
    }

    return cards;
  });
}
