import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { PatientService } from '../../core/services/patient.service';

interface Dispatcher {
  name: string;
  title: string;
  badge: string;
}

interface SosActivation {
  id: number;
  timestamp: Date;
  responder: string;
  eta: number;
  status: 'dispatched' | 'arrived' | 'resolved';
  patientId: string;
  patientName: string;
}

interface IncomingAlert {
  id: number;
  patientId: string;
  patientName: string;
  room: string;
  timestamp: Date;
  urgency: 'high' | 'medium';
  status: 'pending' | 'dispatched' | 'resolved';
  responder?: string;
}

const DISPATCHERS: Dispatcher[] = [
  { name: 'Priya Shah', title: 'Lead Dispatcher', badge: 'PS' },
  { name: 'Marcus Johnson', title: 'Emergency Coordinator', badge: 'MJ' },
  { name: 'Elena Kowalski', title: 'Crisis Response Lead', badge: 'EK' },
  { name: 'James Carter', title: 'Senior Dispatcher', badge: 'JC' },
  { name: 'Lisa Thompson', title: 'Emergency Medical Dispatcher', badge: 'LT' },
];

const STORAGE_KEY_PREFIX = 'carevibe.sos.state.';

@Component({
  selector: 'cv-sos',
  standalone: true,
  imports: [CommonModule, CvCardComponent, CvBadgeComponent, CvButtonComponent, CvModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Floating SOS Button -->
    <button
      *ngIf="!isTriggered() && !isDispatcher()"
      (click)="triggerSos()"
      class="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-lg shadow-2xl shadow-rose-500/40 hover:bg-rose-500 active:bg-rose-700 hover:scale-110 active:scale-95 transition-all duration-200 animate-pulse-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-400"
      aria-label="Activate SOS emergency"
    >
      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    </button>

    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="danger" [dot]="true">sos</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="primary">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {{ isDispatcher() ? 'Incoming Emergency Alerts' : 'Emergency SOS Dispatch' }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          {{ isDispatcher() ? 'Live emergency alerts requiring dispatch coordination.' : 'One-tap emergency alert that immediately notifies the dispatch team.' }}
        </p>
      </header>

      <!-- Dispatcher View: Incoming Alerts -->
      <ng-container *ngIf="isDispatcher()">
        <div class="grid grid-cols-1 gap-4">
          <cv-card title="Active Alerts" subtitle="{{ pendingAlertsCount() }} pending">
            <div class="space-y-3">
              <div
                *ngFor="let alert of incomingAlerts(); trackBy: trackAlertId"
                class="rounded-xl border border-rose-200/60 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-500/5 p-4 transition-all hover:shadow-md"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      [ngClass]="alert.urgency === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'"
                    >
                      {{ alert.patientName.charAt(0) }}{{ alert.patientName.split(' ').pop()?.charAt(0) }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-slate-900 dark:text-slate-50">{{ alert.patientName }}</span>
                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          [ngClass]="alert.urgency === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'"
                        >{{ alert.urgency }}</span>
                        <cv-badge [tone]="alert.status === 'dispatched' ? 'success' : alert.status === 'resolved' ? 'neutral' : 'warning'" [dot]="true">{{ alert.status }}</cv-badge>
                      </div>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Room {{ alert.room }} · {{ alert.timestamp | date:'short' }}</p>
                      <p *ngIf="alert.responder" class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        Dispatched: {{ alert.responder }}
                      </p>
                    </div>
                  </div>
                  <div class="flex shrink-0 gap-2">
                    <cv-button
                      *ngIf="alert.status === 'pending'"
                      variant="danger"
                      size="sm"
                      (click)="dispatchAlert(alert)"
                    >
                      Dispatch
                    </cv-button>
                    <cv-button
                      *ngIf="alert.status === 'dispatched'"
                      variant="success"
                      size="sm"
                      (click)="resolveAlert(alert)"
                    >
                      Resolve
                    </cv-button>
                  </div>
                </div>
              </div>
            </div>
          </cv-card>

          <cv-card title="Dispatcher Log" subtitle="Recent actions">
            <div class="space-y-2">
              <div *ngFor="let activation of sosLog().slice().reverse()" class="flex items-start gap-3 text-sm py-2 border-b border-slate-100 dark:border-slate-800/70 last:border-0">
                <span class="h-2 w-2 mt-1.5 rounded-full shrink-0"
                  [ngClass]="activation.status === 'dispatched' ? 'bg-amber-400' : activation.status === 'arrived' ? 'bg-emerald-400' : 'bg-slate-400'"
                ></span>
                <div>
                  <span class="font-medium text-slate-800 dark:text-slate-200">{{ activation.responder }}</span>
                  <span class="text-slate-500 dark:text-slate-400"> dispatched to </span>
                  <span class="font-medium text-slate-800 dark:text-slate-200">{{ activation.patientName }}</span>
                  <span class="text-slate-500 dark:text-slate-400"> (ETA {{ activation.eta }} min)</span>
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ activation.timestamp | date:'medium' }}</p>
                </div>
              </div>
              <p *ngIf="sosLog().length === 0" class="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No dispatches yet today.</p>
            </div>
          </cv-card>
        </div>
      </ng-container>

      <!-- Non-Dispatcher View: SOS Controls -->
      <ng-container *ngIf="!isDispatcher()">
        <!-- Main SOS Panel -->
        <cv-card title="Emergency Alert System" subtitle="One-tap emergency dispatch">
          <div class="flex flex-col items-center gap-6 py-6">
            <!-- Large Panic Button (Idle state) -->
            <button
              *ngIf="sosState() === 'idle'"
              (click)="triggerSos()"
              class="relative flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-700 text-white font-black text-6xl tracking-widest shadow-2xl shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-400"
              aria-label="Press for emergency dispatch"
            >
              <span class="relative z-10">SOS</span>
              <span class="absolute inset-0 rounded-full bg-rose-400/20 animate-ping-slow"></span>
            </button>

            <!-- Fullscreen Countdown Overlay (Counting state) -->
            <div
              *ngIf="sosState() === 'counting'"
              class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
            >
              <div class="flex flex-col items-center gap-8">
                <div class="relative flex h-40 w-40 items-center justify-center">
                  <svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
                    <circle
                      cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"
                      class="text-rose-500"
                      [attr.stroke-dasharray]="339.292"
                      [attr.stroke-dashoffset]="339.292 * (1 - countdownProgress())"
                    />
                  </svg>
                  <span
                    class="text-7xl font-black tracking-tight text-white animate-pulse"
                    [ngClass]="countdown() <= 3 ? 'text-rose-400 animate-pulse' : ''"
                  >{{ countdown() }}</span>
                </div>
                <div class="text-center">
                  <p class="text-2xl font-bold text-white">Emergency Alert in Progress</p>
                  <p class="text-sm text-slate-400 mt-2">Notifying dispatcher for patient: <strong>{{ currentPatientName() }}</strong></p>
                </div>
                <cv-button variant="ghost" size="lg" (click)="cancelSos()">
                  Cancel Emergency
                </cv-button>
              </div>
            </div>

            <!-- Dispatch Confirmed (Dispatched or Acknowledged state) -->
            <div *ngIf="sosState() === 'dispatched' || sosState() === 'acknowledged'" class="flex flex-col items-center gap-4 text-center">
              <div class="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                <svg class="h-10 w-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-slate-50">Alert Sent to Dispatcher</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Emergency personnel are being notified for {{ currentPatientName() }}</p>
              </div>
              <div class="w-full max-w-sm rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-4">
                <div class="flex items-center gap-3">
                  <div class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                    {{ dispatchedResponder().badge }}
                  </div>
                  <div class="text-left">
                    <p class="font-semibold text-slate-900 dark:text-slate-50">{{ dispatchedResponder().name }}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ dispatchedResponder().title }}</p>
                    <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">ETA: {{ currentEta() }} minutes</p>
                    <p class="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">
                      Status: {{ sosState() }}
                    </p>
                  </div>
                </div>
              </div>
              <div class="flex gap-2">
                <cv-button *ngIf="sosState() === 'dispatched'" variant="primary" size="md" (click)="acknowledgeSos()">
                  Acknowledge Responder
                </cv-button>
                <cv-button variant="ghost" size="md" (click)="resetSos()">Dismiss</cv-button>
              </div>
            </div>
          </div>
        </cv-card>

        <!-- Recent Activations Timeline -->
        <cv-card title="Recent Activations" subtitle="Past emergency dispatches for {{ currentPatientName() }}">
          <div class="relative pl-6 space-y-0">
            <div *ngFor="let activation of currentPatientLog(); trackBy: trackActivationId; let last = last" class="relative pb-6">
              <span class="absolute -left-2 top-1.5 h-4 w-4 rounded-full border-2"
                [ngClass]="{
                  'border-amber-400 bg-amber-100 dark:bg-amber-500/20': activation.status === 'dispatched',
                  'border-emerald-400 bg-emerald-100 dark:bg-emerald-500/20': activation.status === 'arrived',
                  'border-slate-400 bg-slate-100 dark:bg-slate-500/20': activation.status === 'resolved',
                }"
              ></span>
              <span *ngIf="!last" class="absolute left-0 top-5 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></span>
              <div class="ml-4">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm text-slate-900 dark:text-slate-50">{{ activation.responder }}</span>
                  <cv-badge
                    [tone]="activation.status === 'dispatched' ? 'warning' : activation.status === 'arrived' ? 'success' : 'neutral'"
                    [dot]="true"
                  >{{ activation.status }}</cv-badge>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Responding to {{ activation.patientName }} · ETA {{ activation.eta }} min
                </p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{{ activation.timestamp | date:'medium' }}</p>
              </div>
            </div>
            <p *ngIf="currentPatientLog().length === 0" class="text-sm text-slate-400 dark:text-slate-500 text-center py-4">No recent activations.</p>
          </div>
        </cv-card>
      </ng-container>
    </div>
  `,
  styles: [`
    @keyframes ping-slow {
      0%, 100% { transform: scale(1); opacity: 0.4; }
      50% { transform: scale(1.15); opacity: 0; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.5); }
      50% { box-shadow: 0 0 0 20px rgba(225, 29, 72, 0); }
    }
    :host {
      display: block;
    }
    .animate-ping-slow {
      animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
    }
    .animate-pulse-glow {
      animation: pulse-glow 2s ease-in-out infinite;
    }
  `],
})
export class SosComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);

  readonly isDispatcher = computed(() => this.roleService.activeRole() === Role.DISPATCHER);

  // Patient context selection
  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatient = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id) : null;
  });
  readonly currentPatientName = computed(() => this.currentPatient()?.name ?? 'Unknown Patient');

  // State Machine (idle -> counting -> dispatched -> acknowledged)
  readonly sosState = signal<'idle' | 'counting' | 'dispatched' | 'acknowledged'>('idle');
  readonly countdown = signal(10);
  readonly currentEta = signal(0);
  readonly dispatchedResponder = signal<Dispatcher>(DISPATCHERS[0]);
  readonly sosLog = signal<SosActivation[]>([]);

  readonly currentPatientLog = computed(() => {
    const patId = this.selectedPatientId();
    return this.sosLog().filter((log) => log.patientId === patId);
  });

  readonly incomingAlerts = signal<IncomingAlert[]>([
    {
      id: 1, patientId: 'pat-1', patientName: 'Walter Mendes', room: 'A-214',
      timestamp: new Date(Date.now() - 120000), urgency: 'high',
      status: 'pending',
    },
    {
      id: 2, patientId: 'pat-2', patientName: 'Eleanor Rigby', room: 'B-107',
      timestamp: new Date(Date.now() - 300000), urgency: 'medium',
      status: 'pending',
    },
    {
      id: 3, patientId: 'pat-3', patientName: 'George Kaplan', room: 'C-312',
      timestamp: new Date(Date.now() - 600000), urgency: 'high',
      status: 'dispatched', responder: 'Priya Shah',
    },
    {
      id: 4, patientId: 'pat-4', patientName: 'Martha Wayne', room: 'A-101',
      timestamp: new Date(Date.now() - 900000), urgency: 'medium',
      status: 'dispatched', responder: 'Marcus Johnson',
    },
  ]);

  readonly pendingAlertsCount = computed(() => {
    return this.incomingAlerts().filter((a) => a.status === 'pending').length;
  });

  private sosIdCounter = 0;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Load persisted logs
    const savedLogs = localStorage.getItem('carevibe.sos.logs');
    if (savedLogs) {
      try {
        const parsed = JSON.parse(savedLogs);
        this.sosLog.set(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (e) {
        console.error('Error loading SOS logs', e);
      }
    }

    // Effect to update patient specific UI state on patient context switch
    effect(() => {
      const patId = this.selectedPatientId();
      if (patId) {
        const key = STORAGE_KEY_PREFIX + patId;
        const savedState = localStorage.getItem(key);
        if (savedState) {
          try {
            const data = JSON.parse(savedState);
            this.sosState.set(data.state || 'idle');
            this.currentEta.set(data.eta || 0);
            const resp = DISPATCHERS.find((d) => d.name === data.responderName);
            if (resp) this.dispatchedResponder.set(resp);
          } catch (e) {
            this.sosState.set('idle');
          }
        } else {
          this.sosState.set('idle');
        }
      }
    }, { allowSignalWrites: true });
  }

  private persistPatientSosState(): void {
    const patId = this.selectedPatientId();
    if (!patId) return;
    const key = STORAGE_KEY_PREFIX + patId;
    localStorage.setItem(key, JSON.stringify({
      state: this.sosState(),
      eta: this.currentEta(),
      responderName: this.dispatchedResponder().name
    }));
  }

  private persistLogs(): void {
    localStorage.setItem('carevibe.sos.logs', JSON.stringify(this.sosLog()));
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Sos';
  }

  countdownProgress(): number {
    return this.countdown() / 10;
  }

  isTriggered(): boolean {
    return this.sosState() !== 'idle';
  }

  triggerSos(): void {
    if (this.sosState() !== 'idle') return;
    this.sosState.set('counting');
    this.countdown.set(10);
    this.persistPatientSosState();

    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.executeDispatch();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private executeDispatch(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    const responder = DISPATCHERS[Math.floor(Math.random() * DISPATCHERS.length)];
    const eta = Math.floor(Math.random() * 7) + 2;

    this.dispatchedResponder.set(responder);
    this.currentEta.set(eta);
    this.sosState.set('dispatched');
    this.persistPatientSosState();

    const patId = this.selectedPatientId() || 'unknown';
    const patName = this.currentPatientName();

    const activation: SosActivation = {
      id: ++this.sosIdCounter,
      timestamp: new Date(),
      responder: responder.name,
      eta,
      status: 'dispatched',
      patientId: patId,
      patientName: patName,
    };

    this.sosLog.update((log) => [...log, activation]);
    this.persistLogs();

    // Add alert to dispatcher dashboard
    this.incomingAlerts.update((alerts) => [
      {
        id: Date.now(),
        patientId: patId,
        patientName: patName,
        room: 'A-214',
        timestamp: new Date(),
        urgency: 'high',
        status: 'pending',
      },
      ...alerts
    ]);
  }

  acknowledgeSos(): void {
    this.sosState.set('acknowledged');
    this.persistPatientSosState();
  }

  cancelSos(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.sosState.set('idle');
    this.countdown.set(10);
    this.persistPatientSosState();
  }

  resetSos(): void {
    this.sosState.set('idle');
    this.countdown.set(10);
    this.persistPatientSosState();
  }

  dispatchAlert(alert: IncomingAlert): void {
    const responder = DISPATCHERS[Math.floor(Math.random() * DISPATCHERS.length)];
    this.incomingAlerts.update((alerts) =>
      alerts.map((a) =>
        a.id === alert.id ? { ...a, status: 'dispatched' as const, responder: responder.name } : a
      )
    );

    const activation: SosActivation = {
      id: ++this.sosIdCounter,
      timestamp: new Date(),
      responder: responder.name,
      eta: Math.floor(Math.random() * 7) + 2,
      status: 'dispatched',
      patientId: alert.patientId,
      patientName: alert.patientName,
    };
    this.sosLog.update((log) => [...log, activation]);
    this.persistLogs();

    // Check if the current selected patient was dispatched
    if (alert.patientId === this.selectedPatientId()) {
      this.sosState.set('dispatched');
      this.currentEta.set(activation.eta);
      this.dispatchedResponder.set(responder);
      this.persistPatientSosState();
    }
  }

  resolveAlert(alert: IncomingAlert): void {
    this.incomingAlerts.update((alerts) =>
      alerts.map((a) =>
        a.id === alert.id ? { ...a, status: 'resolved' as const } : a
      )
    );
    this.sosLog.update((log) =>
      log.map((a) =>
        a.patientId === alert.patientId ? { ...a, status: 'resolved' as const } : a
      )
    );
    this.persistLogs();

    if (alert.patientId === this.selectedPatientId()) {
      this.sosState.set('idle');
      this.persistPatientSosState();
    }
  }

  trackAlertId = (_: number, alert: IncomingAlert): number => alert.id;
  trackActivationId = (_: number, activation: SosActivation): number => activation.id;
}

