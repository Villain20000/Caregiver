import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { PatientService } from '../../core/services/patient.service';
import { ScheduleService } from '../../core/services/schedule.service';
import { AuthService } from '../../core/services/auth.service';

interface CaregiverLocation {
  name: string;
  roleLabel: string;
  lat: number;
  lng: number;
  status: 'driving' | 'at-visit' | 'off-duty';
  etaMinutes?: number;
}

@Component({
  selector: 'cv-map',
  standalone: true,
  imports: [CommonModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">live tracking</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="success">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Caregiver Live GPS Route Tracker
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Monitor caregiver transit positions, expected time of arrival (ETA), and dispatch route logs.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Live Map Container Simulator -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card title="San Francisco - Live Coverage" subtitle="Caregiver vehicle transits and geo-fences">
            <div class="relative w-full aspect-video rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 overflow-hidden flex flex-col justify-between p-4">
              
              <!-- Simulated Tech grid & Map markers -->
              <div class="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
              
              <!-- Patient Marker -->
              <div class="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10">
                <div class="relative flex h-5 w-5 justify-center items-center">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 border border-white"></span>
                </div>
                <span class="block text-[9px] font-bold text-slate-700 bg-white/90 px-1 py-0.5 rounded shadow mt-1">
                  {{ currentPatientName() }}
                </span>
              </div>

              <!-- Caregiver transiting marker -->
              <div class="absolute left-2/3 top-1/3 -translate-x-1/2 -translate-y-1/2 text-center z-10">
                <div class="relative flex h-5 w-5 justify-center items-center">
                  <span class="relative inline-flex rounded-full h-4 w-4 bg-indigo-600 border border-white text-[10px] font-black text-white items-center justify-center">🚗</span>
                </div>
                <span class="block text-[9px] font-bold text-indigo-700 bg-white/90 px-1 py-0.5 rounded shadow mt-1">
                  Maya Patel, RN
                </span>
              </div>

              <!-- Route Path Overlay line simulated -->
              <svg class="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M 33,50 L 50,42 L 66,33" fill="none" stroke="rgb(99, 102, 241)" stroke-width="0.8" stroke-dasharray="1.5" />
              </svg>

              <!-- Live compass controls -->
              <div class="flex flex-col gap-1.5 ml-auto bg-white/95 dark:bg-slate-900/90 backdrop-blur border border-slate-200/50 p-1.5 rounded-lg shadow w-fit z-10 text-[10px] font-bold">
                <button class="hover:text-indigo-500">＋ Zoom</button>
                <button class="hover:text-indigo-500">－ Min</button>
              </div>

              <div class="z-10 bg-white/90 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200/50 max-w-sm mt-auto text-xs">
                <span class="block font-bold text-slate-800 dark:text-slate-100">Care Route: Maya Patel → Walter Mendes</span>
                <span class="block text-[10px] text-slate-400 mt-0.5">Distance: 1.8 miles · Route Speed: 24 mph</span>
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar: Transit statuses -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card title="Transit Coverage" subtitle="Caregiver ETA and dispatch metrics">
            <div class="space-y-4">
              
              <!-- Patient / Family view: ETA -->
              <div *ngIf="!isDispatcherRole(); else dispatcherMetrics" class="space-y-4">
                <div class="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-between">
                  <div>
                    <span class="block text-[10px] font-bold text-indigo-500 uppercase">Caregiver Transit ETA</span>
                    <span class="text-2xl font-black text-indigo-900 dark:text-indigo-100">12 Minutes away</span>
                    <span class="block text-[10px] text-slate-400 mt-1">Nurse Maya Patel scheduled for 10:45 AM check-up.</span>
                  </div>
                  <span class="text-3xl">⏱️</span>
                </div>
              </div>

              <!-- Dispatcher view: metrics -->
              <ng-template #dispatcherMetrics>
                <div class="space-y-3">
                  <div
                    *ngFor="let loc of caregiverLocs"
                    class="p-3 rounded-xl border border-slate-200/40 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span class="block font-bold text-slate-800 dark:text-slate-100">{{ loc.name }}</span>
                      <span class="block text-[10px] text-slate-400">{{ loc.roleLabel }}</span>
                    </div>
                    <div class="text-right">
                      <cv-badge [tone]="loc.status === 'driving' ? 'warning' : loc.status === 'at-visit' ? 'success' : 'neutral'">
                        {{ loc.status }}
                      </cv-badge>
                      <span *ngIf="loc.etaMinutes" class="block text-[10px] font-bold text-indigo-500 mt-1">
                        ETA {{ loc.etaMinutes }}m
                      </span>
                    </div>
                  </div>
                </div>
              </ng-template>
            </div>
          </cv-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .bg-grid-pattern {
      background-size: 20px 20px;
      background-image: 
        linear-gradient(to right, rgb(148, 163, 184) 1px, transparent 1px),
        linear-gradient(to bottom, rgb(148, 163, 184) 1px, transparent 1px);
    }
  `],
})
export class MapComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);
  private readonly auth = inject(AuthService);

  // Context Computations
  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatientName = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id)?.name : 'Unknown Patient';
  });

  readonly isDispatcherRole = computed(() => {
    const role = this.roleService.activeRole();
    return role === Role.DISPATCHER || role === Role.ADMIN;
  });

  readonly caregiverLocs: CaregiverLocation[] = [
    { name: 'Maya Patel', roleLabel: 'Registered Nurse', lat: 37.7749, lng: -122.4194, status: 'driving', etaMinutes: 12 },
    { name: 'Tomás Reyes', roleLabel: 'Medic Helper', lat: 37.7849, lng: -122.4094, status: 'at-visit' },
    { name: 'Ines Costa', roleLabel: 'Therapist', lat: 37.7649, lng: -122.4294, status: 'off-duty' },
  ];

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Transit Tracker';
  }
}
