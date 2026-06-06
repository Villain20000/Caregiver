import { Injectable, effect, inject } from '@angular/core';
import { RoleService } from './role.service';
import { DashboardFacadeService } from './dashboard-facade.service';
import { Role } from '../models/role.model';

/**
 * Demo-only “state binder” that establishes a consistent cross-feature context
 * for the role simulator.
 *
 * Current feature KPIs seed themselves from MockDataService in each feature
 * service constructor. This binder instead provides a single coordinated
 * workspace context (selected patient) across feature pages.
 */
@Injectable({ providedIn: 'root' })
export class DashboardMockStateService {
  private readonly roleService = inject(RoleService);
  private readonly facade = inject(DashboardFacadeService);

  constructor() {
    effect(() => {
      const role = this.roleService.activeRole();
      this.facade.setSelectedPatientId(this.defaultPatientForRole(role));
    }, { allowSignalWrites: true });
  }

  private defaultPatientForRole(role: Role): string {
    switch (role) {
      case Role.PATIENT:
      case Role.FAMILY:
        return 'pat-1';
      case Role.SOCIAL_WORKER:
        return 'pat-6';
      case Role.DISPATCHER:
        return 'pat-3';
      case Role.ADMIN:
        return 'pat-4';
      case Role.BILLING:
        return 'pat-2';
      case Role.NUTRITIONIST:
      case Role.NURSE:
      case Role.DOCTOR:
      case Role.THERAPIST:
        return 'pat-2';
      default:
        return 'pat-1';
    }
  }
}
