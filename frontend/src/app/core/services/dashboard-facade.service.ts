import { Injectable, computed, signal } from '@angular/core';
import { RoleService } from './role.service';
import { PatientService } from './patient.service';
import { VitalsService } from './vitals.service';
import { TaskService } from './task.service';
import { IncidentService } from './incident.service';
import { InventoryService } from './inventory.service';
import { ChatService } from './chat.service';
import { SyncService } from './sync.service';
import { Role } from '../models/role.model';

export interface DashboardKPIs {
  role: Role;
  roleLabel: string;

  patientCount: number;
  activePatientCount: number;

  // Vitals
  vitalsLatestText: string;
  vitalsCriticalCount: number;
  vitalsWatchCount: number;

  // Tasks
  taskTodo: number;
  taskDoing: number;
  taskDone: number;
  taskOverdue: number;

  // Incidents
  openIncidents: number;
  criticalIncidents: number;

  // Inventory
  lowStockCount: number;
  expiringCount: number;

  // Chat
  chatUnreadTotal: number;

  // Sync/offline
  syncLabel: string;
  syncState: ReturnType<SyncService['state']>;
}

@Injectable({ providedIn: 'root' })
export class DashboardFacadeService {
  private readonly _selectedPatientId = signal<string | null>(null);

  readonly selectedPatientId = this._selectedPatientId.asReadonly();

  readonly kpis = computed<DashboardKPIs>(() => {
    const role = this.roleService.activeRole();

    const vitals = this.vitalsService.stats();
    const tasksByStatus = this.taskService.byStatus();
    const overdue = this.taskService.overdue().length;

    const incidentsOpen = this.incidentService.open().length;
    const incidentsCritical = this.incidentService.critical().length;

    const lowStock = this.inventoryService.reorder().length;
    const expiring = this.inventoryService.expiring().length;

    const syncLabel = this.syncService.label();
    const syncState = this.syncService.state();

    const patientCount = this.patientService.count();
    const activePatientCount = this.patientService.active().length;

    return {
      role,
      roleLabel: this.roleLabel(role),

      patientCount,
      activePatientCount,

      vitalsLatestText: vitals.latest
        ? `BP ${vitals.latest.systolic}/${vitals.latest.diastolic} · HR ${vitals.latest.hr}`
        : 'No recent vitals',
      vitalsCriticalCount: vitals.criticalCount,
      vitalsWatchCount: vitals.watchCount,

      taskTodo: tasksByStatus.todo.length,
      taskDoing: tasksByStatus.doing.length,
      taskDone: tasksByStatus.done.length,
      taskOverdue: overdue,

      openIncidents: incidentsOpen,
      criticalIncidents: incidentsCritical,

      lowStockCount: lowStock,
      expiringCount: expiring,

      chatUnreadTotal: this.chatService.totalUnread(),

      syncLabel,
      syncState,
    };
  });

  constructor(
    private readonly roleService: RoleService,
    private readonly patientService: PatientService,
    private readonly vitalsService: VitalsService,
    private readonly taskService: TaskService,
    private readonly incidentService: IncidentService,
    private readonly inventoryService: InventoryService,
    private readonly chatService: ChatService,
    private readonly syncService: SyncService,
  ) {}

  setSelectedPatientId(id: string | null): void {
    this._selectedPatientId.set(id);
  }

  private roleLabel(role: Role): string {
    // avoid pulling extra model constants here; use RoleService currentLabel semantics
    // but keep deterministic label generation for KPIs.
    // RoleService.currentUser already includes label, yet we need just label without user.
    // RoleService.currentLabel includes user name; use it only for display elsewhere.
    // In this codebase, Role model exports ROLE_LABELS; we use a lightweight local mapping.
    switch (role) {
      case Role.PATIENT:
        return 'Patient';
      case Role.FAMILY:
        return 'Family Caregiver';
      case Role.NURSE:
        return 'Nurse';
      case Role.THERAPIST:
        return 'Therapist';
      case Role.DOCTOR:
        return 'Doctor';
      case Role.SOCIAL_WORKER:
        return 'Social Worker';
      case Role.DISPATCHER:
        return 'Emergency Dispatcher';
      case Role.NUTRITIONIST:
        return 'Nutritionist';
      case Role.ADMIN:
        return 'Agency Admin';
      case Role.BILLING:
        return 'Billing & Insurance';
      default:
        return role;
    }
  }
}
