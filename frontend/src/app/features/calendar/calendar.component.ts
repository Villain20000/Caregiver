import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { User } from '../../core/models/user.model';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { PatientService } from '../../core/services/patient.service';
import { ScheduleService } from '../../core/services/schedule.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ShiftEvent } from '../../core/models/schedule.model';

const STORAGE_KEY_PREFIX = 'carevibe.calendar.events.';

@Component({
  selector: 'cv-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">scheduling</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="success">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Care Calendar & Visits Planner
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Coordinate clinician schedules, routings, and family visit events.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Calendar Grid Card -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card title="June 2026" subtitle="Select a date to inspect visits">
            <div class="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 uppercase mb-2">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>
            
            <div class="grid grid-cols-7 gap-1">
              <!-- Empty spacer slots for calendar starting day (June 1 2026 is Monday) -->
              <div class="aspect-square bg-slate-50/20 rounded-lg"></div>
              
              <!-- June Days -->
              <button
                *ngFor="let day of calendarDays"
                (click)="selectedDay.set(day)"
                class="aspect-square flex flex-col items-center justify-between p-1.5 rounded-lg border text-xs font-semibold relative transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                [ngClass]="{
                  'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500': selectedDay() === day,
                  'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900': selectedDay() !== day
                }"
              >
                <span>{{ day }}</span>
                <span class="flex gap-0.5 mt-auto">
                  <span *ngFor="let ev of getEventsForDay(day)" class="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                </span>
              </button>
            </div>
          </cv-card>

          <!-- Day details list -->
          <cv-card title="Visits for June {{ selectedDay() }}, 2026" subtitle="Scheduled care team tasks">
            <div class="space-y-3">
              <div
                *ngFor="let ev of activeDayEvents(); trackBy: trackEventId"
                class="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between gap-4"
              >
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-500 font-mono">{{ ev.start | date:'shortTime' }}</span>
                    <cv-badge tone="neutral">{{ ev.visitType | uppercase }}</cv-badge>
                    <cv-badge [tone]="ev.status === 'completed' ? 'success' : 'warning'">{{ ev.status }}</cv-badge>
                  </div>
                  <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 mt-1">
                    {{ ev.notes || 'Routine checkup and vitals capture' }}
                  </h4>
                  <p class="text-[11px] text-slate-400 mt-1">
                    Staff Assigned: {{ getStaffName(ev.userId) }}
                  </p>
                </div>
                
                <cv-button
                  *ngIf="isStaffRole()"
                  variant="ghost"
                  size="sm"
                  (click)="cancelVisit(ev.id)"
                >
                  Cancel
                </cv-button>
              </div>

              <p *ngIf="activeDayEvents().length === 0" class="text-xs text-slate-400 text-center py-6">
                No events scheduled for this date.
              </p>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar: Appointment Scheduler (Staff only) -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card *ngIf="isStaffRole(); else clientPlaceholder" title="Schedule Visit" subtitle="Assign care visits to staff members">
            <div class="space-y-4 py-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Visit Type</label>
                <select
                  [(ngModel)]="formVisitType"
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="routine">Routine Check</option>
                  <option value="adl">ADL Help</option>
                  <option value="wound">Wound Care</option>
                  <option value="therapy">Therapy Session</option>
                  <option value="assessment">Evaluation</option>
                </select>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Staff Assignment</label>
                <select
                  [(ngModel)]="formStaffId"
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option *ngFor="let u of staffUsers" [value]="u.id">{{ u.name }} ({{ u.credentials?.join(', ') || u.role }})</option>
                </select>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Visit Notes / Reason</label>
                <input
                  type="text"
                  [(ngModel)]="formNotes"
                  placeholder="E.g. Check blood sugar levels"
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <cv-button variant="primary" (click)="addVisit()">
                Book Appointment
              </cv-button>
            </div>
          </cv-card>

          <ng-template #clientPlaceholder>
            <cv-card title="Your Care Team" subtitle="Direct contact details">
              <div class="space-y-3">
                <div *ngFor="let staff of staffUsers.slice(0, 3)" class="flex items-center gap-3 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                  <div class="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
                    {{ staff.avatar }}
                  </div>
                  <div>
                    <span class="block text-xs font-semibold text-slate-800 dark:text-slate-200">{{ staff.name }}</span>
                    <span class="block text-[10px] text-slate-400">{{ staff.credentials?.join(', ') || staff.role }}</span>
                  </div>
                </div>
                <p class="text-[10px] text-slate-400 text-center border-t border-slate-100 dark:border-slate-850 pt-3">
                  Contact social worker Priya Shah for booking requests.
                </p>
              </div>
            </cv-card>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class CalendarComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly calendarDays = Array.from({ length: 30 }, (_, i) => i + 1);
  readonly selectedDay = signal<number>(new Date().getDate());

  // Form states
  formVisitType: 'routine' | 'adl' | 'wound' | 'therapy' | 'assessment' = 'routine';
  formStaffId = '';
  formNotes = '';

  // Context Computations
  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatientName = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id)?.name : 'Unknown Patient';
  });

  readonly isStaffRole = computed(() => this.auth.isStaff());

  // Staff users list for scheduling
  get staffUsers(): User[] {
    return this.auth.allUsers().filter((u) => u.role !== Role.PATIENT && u.role !== Role.FAMILY);
  }

  readonly activeDayEvents = computed(() => {
    const day = this.selectedDay();
    const patId = this.selectedPatientId();
    if (!patId) return [];

    return this.scheduleService.shifts().filter((s) => {
      const date = new Date(s.start);
      return date.getDate() === day && s.patientId === patId && s.status !== 'cancelled';
    });
  });

  constructor() {
    if (this.staffUsers.length > 0) {
      this.formStaffId = this.staffUsers[0].id;
    }
  }

  getEventsForDay(day: number): ShiftEvent[] {
    const patId = this.selectedPatientId();
    if (!patId) return [];
    return this.scheduleService.shifts().filter((s) => {
      const date = new Date(s.start);
      return date.getDate() === day && s.patientId === patId && s.status !== 'cancelled';
    });
  }

  getStaffName(userId: string): string {
    return this.auth.getUserById(userId)?.name ?? 'Assigned Caregiver';
  }

  addVisit(): void {
    const patId = this.selectedPatientId();
    if (!patId) return;

    const targetDate = new Date();
    targetDate.setDate(this.selectedDay());
    targetDate.setHours(10, 0, 0, 0); // 10:00 AM standard visit

    const end = new Date(targetDate);
    end.setHours(11, 0, 0, 0);

    const shift = {
      role: Role.NURSE,
      userId: this.formStaffId,
      patientId: patId,
      start: targetDate.toISOString(),
      end: end.toISOString(),
      status: 'scheduled' as const,
      visitType: this.formVisitType,
      notes: this.formNotes.trim() || undefined
    };

    this.scheduleService.add(shift);
    this.toast.success('Care visit scheduled successfully.');
    this.formNotes = '';
  }

  cancelVisit(id: string): void {
    this.scheduleService.cancel(id);
    this.toast.success('Appointment cancelled.');
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Calendar';
  }

  trackEventId = (_: number, item: ShiftEvent): string => item.id;
}
