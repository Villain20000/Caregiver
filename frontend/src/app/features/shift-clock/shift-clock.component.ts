import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { ScheduleService } from '../../core/services/schedule.service';
import { AuthService } from '../../core/services/auth.service';
import { PatientService } from '../../core/services/patient.service';
import { ToastService } from '../../core/services/toast.service';
import { ShiftEvent, ShiftStatus } from '../../core/models/schedule.model';

const STORAGE_KEY_PREFIX = 'carevibe.shift.active.';

@Component({
  selector: 'cv-shift-clock',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">shift tracking</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <span class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold ml-auto">
            Live GPS Geo-Fencing Active
          </span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Caregiver Shift Clock & Timesheet
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Clock in and out of home visits, record notes, and submit clinical timesheets securely.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Left Panel: Live Clock-In Control -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card title="Shift Controller" subtitle="Manage your active clinical shift session">
            <div class="flex flex-col items-center py-6 gap-6">
              
              <!-- Ticking Clock Display -->
              <div class="text-center">
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Current Time</span>
                <h2 class="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight font-mono mt-1">
                  {{ currentTime() | date:'hh:mm:ss a' }}
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  {{ currentTime() | date:'EEEE, MMMM d, y' }}
                </p>
              </div>

              <!-- Shift Status Badge & Duration -->
              <div *ngIf="isClockedIn()" class="text-center bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-2xl w-full max-w-md">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  <span class="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-ping"></span>
                  Currently Clocked In
                </span>
                
                <h3 class="text-4xl font-extrabold text-indigo-900 dark:text-indigo-100 mt-3 font-mono">
                  {{ formatDuration(elapsedSeconds()) }}
                </h3>
                
                <p class="text-xs text-slate-600 dark:text-slate-300 mt-2">
                  Visit: <strong>{{ activeShift()?.visitType | uppercase }}</strong> for <strong>{{ getPatientName(activeShift()?.patientId) }}</strong>
                </p>
                <p class="text-[10px] text-slate-400 mt-1">
                  GPS Check-In: {{ activeShift()?.geo?.label || 'Walter Mendes Residence' }}
                </p>
              </div>

              <div *ngIf="!isClockedIn()" class="text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/20 border border-slate-200/40 w-full max-w-md">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Clocked Out
                </span>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Please select a visit from your schedule below to Clock In.
                </p>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-3 w-full max-w-md justify-center">
                <cv-button
                  *ngIf="!isClockedIn() && isStaff()"
                  variant="primary"
                  size="lg"
                  [disabled]="!selectedShiftToStart()"
                  (click)="clockIn()"
                >
                  Clock In to Selected
                </cv-button>

                <cv-button
                  *ngIf="isClockedIn() && isStaff()"
                  variant="danger"
                  size="lg"
                  (click)="clockOut()"
                >
                  Clock Out & Log Visit
                </cv-button>
              </div>

              <!-- Note input for Clock Out -->
              <div *ngIf="isClockedIn() && isStaff()" class="w-full max-w-md">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Visit Summary & ADL Checklist</label>
                <textarea
                  [(ngModel)]="visitNotes"
                  rows="3"
                  placeholder="Record patient vitals checked, therapy completed, or medications administered..."
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                ></textarea>
              </div>
            </div>
          </cv-card>

          <!-- Today's Visits Schedule -->
          <cv-card title="Today's Visit Schedule" subtitle="Select a scheduled visit to begin your check-in">
            <div class="space-y-3">
              <div
                *ngFor="let shift of todayShifts(); trackBy: trackShiftId"
                class="p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                [ngClass]="{
                  'border-indigo-500 bg-indigo-50/20': selectedShiftToStart()?.id === shift.id,
                  'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800': selectedShiftToStart()?.id !== shift.id
                }"
              >
                <div class="flex-grow">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-400 font-mono">
                      {{ shift.start | date:'shortTime' }} - {{ shift.end | date:'shortTime' }}
                    </span>
                    <cv-badge [tone]="getBadgeTone(shift.status)">{{ shift.status }}</cv-badge>
                    <cv-badge tone="neutral">{{ shift.visitType | uppercase }}</cv-badge>
                  </div>
                  
                  <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 mt-1">
                    Care visit for {{ getPatientName(shift.patientId) }}
                  </h4>
                  
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    Location: {{ shift.geo?.label || 'Direct Home Visit' }}
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    *ngIf="shift.status === 'scheduled' && !isClockedIn() && isStaff()"
                    (click)="selectShift(shift)"
                    class="h-8 px-4 rounded-lg font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                  >
                    Select Visit
                  </button>
                  <span *ngIf="shift.status === 'completed'" class="text-emerald-500 font-bold text-xs flex items-center gap-1">
                    ✓ Visit Completed
                  </span>
                </div>
              </div>
              
              <p *ngIf="todayShifts().length === 0" class="text-sm text-slate-400 text-center py-6">
                No scheduled visits today.
              </p>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar: Timesheet Summary & History -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Timesheet Summary -->
          <cv-card title="Timesheet Summary" subtitle="Hours log for the current pay period">
            <div class="space-y-4">
              <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/30">
                <div>
                  <span class="block text-[10px] font-bold text-slate-400 uppercase">Total Scheduled Hours</span>
                  <span class="text-xl font-extrabold text-slate-800 dark:text-slate-200">24.5 hrs</span>
                </div>
                <div>
                  <span class="block text-[10px] font-bold text-slate-400 uppercase text-right">Logged Hours</span>
                  <span class="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 block text-right">18.2 hrs</span>
                </div>
              </div>

              <!-- Completion Gauge -->
              <div>
                <div class="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Weekly Target Met</span>
                  <span>74%</span>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div class="bg-indigo-600 h-full w-[74%]"></div>
                </div>
              </div>
            </div>
          </cv-card>

          <!-- Past Shift Log -->
          <cv-card title="Past Shift Logs" subtitle="Completed caregiver visits">
            <div class="space-y-3 max-h-[400px] overflow-y-auto pr-1 cv-scrollbar">
              <div
                *ngFor="let shift of completedShifts(); trackBy: trackShiftId"
                class="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-3"
              >
                <div class="flex justify-between items-start mb-2">
                  <h5 class="font-bold text-xs text-slate-800 dark:text-slate-200 leading-snug">
                    {{ shift.visitType | uppercase }} - {{ getPatientName(shift.patientId) }}
                  </h5>
                  <cv-badge tone="success">Logged</cv-badge>
                </div>
                <div class="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>{{ shift.start | date:'MMM d, shortTime' }}</span>
                  <span>Completed in 1 hr</span>
                </div>
                <p *ngIf="shift.notes" class="text-[11px] italic text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  "{{ shift.notes }}"
                </p>
              </div>
              
              <p *ngIf="completedShifts().length === 0" class="text-xs text-slate-400 text-center py-4">
                No completed shifts found.
              </p>
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
  `],
})
export class ShiftClockComponent implements OnDestroy {
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly patientService = inject(PatientService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  // States
  readonly currentTime = signal<Date>(new Date());
  readonly isClockedIn = signal<boolean>(false);
  readonly elapsedSeconds = signal<number>(0);
  readonly selectedShiftToStart = signal<ShiftEvent | null>(null);
  readonly activeShift = signal<ShiftEvent | null>(null);
  visitNotes = '';

  // Intervals
  private clockInterval: any = null;
  private durationInterval: any = null;

  // Compute shifts
  readonly isStaff = computed(() => this.auth.isStaff());
  
  readonly todayShifts = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    // Filter shifts for the active clinician
    return this.scheduleService.shifts().filter((s) => s.userId === user.id);
  });

  readonly completedShifts = computed(() => {
    return this.todayShifts().filter((s) => s.status === 'completed');
  });

  constructor() {
    // Start live clock ticker
    this.clockInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Sync clocked-in state from local storage on active clinician swap
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        const key = STORAGE_KEY_PREFIX + user.id;
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            this.isClockedIn.set(data.isClockedIn);
            this.elapsedSeconds.set(data.elapsedSeconds || 0);
            this.activeShift.set(data.activeShift);
            
            if (data.isClockedIn) {
              this.startDurationTimer();
            }
          } catch {
            this.resetClockState();
          }
        } else {
          this.resetClockState();
        }
      } else {
        this.resetClockState();
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.durationInterval) clearInterval(this.durationInterval);
  }

  private resetClockState(): void {
    this.isClockedIn.set(false);
    this.elapsedSeconds.set(0);
    this.activeShift.set(null);
    this.selectedShiftToStart.set(null);
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  selectShift(shift: ShiftEvent): void {
    this.selectedShiftToStart.set(shift);
  }

  clockIn(): void {
    const shift = this.selectedShiftToStart();
    const user = this.auth.currentUser();
    if (!shift || !user) return;

    this.isClockedIn.set(true);
    this.elapsedSeconds.set(0);
    this.activeShift.set(shift);
    this.selectedShiftToStart.set(null);

    // Update status in schedule service
    this.scheduleService.updateStatus(shift.id, 'in-progress');

    this.persistClockState();
    this.startDurationTimer();

    this.toastService.success(`Clocked in to visit for ${this.getPatientName(shift.patientId)}`);
  }

  clockOut(): void {
    const shift = this.activeShift();
    const user = this.auth.currentUser();
    if (!shift || !user) return;

    this.isClockedIn.set(false);
    
    // Complete the visit in schedule service with notes
    this.scheduleService.updateStatus(shift.id, 'completed');
    
    // Append clinical notes to the shifts database
    shift.notes = this.visitNotes.trim() || undefined;
    this.visitNotes = '';

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    this.toastService.success(`Visit completed for ${this.getPatientName(shift.patientId)}`);
    this.activeShift.set(null);
    this.persistClockState();
  }

  private startDurationTimer(): void {
    if (this.durationInterval) clearInterval(this.durationInterval);
    this.durationInterval = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
      this.persistClockState();
    }, 1000);
  }

  private persistClockState(): void {
    const user = this.auth.currentUser();
    if (!user) return;
    const key = STORAGE_KEY_PREFIX + user.id;
    localStorage.setItem(key, JSON.stringify({
      isClockedIn: this.isClockedIn(),
      elapsedSeconds: this.elapsedSeconds(),
      activeShift: this.activeShift()
    }));
  }

  getPatientName(id?: string): string {
    if (!id) return 'Unknown Patient';
    return this.patientService.byId(id)?.name ?? 'Unknown Patient';
  }

  formatDuration(totalSecs: number): string {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  getBadgeTone(status: ShiftStatus): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
    switch (status) {
      case 'scheduled': return 'neutral';
      case 'in-progress': return 'warning';
      case 'completed': return 'success';
      case 'cancelled': return 'danger';
      default: return 'neutral';
    }
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Shift-clock';
  }

  trackShiftId = (_: number, item: ShiftEvent): string => item.id;
}
