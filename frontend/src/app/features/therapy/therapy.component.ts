import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { PatientService } from '../../core/services/patient.service';
import { ToastService } from '../../core/services/toast.service';

interface Exercise {
  name: string;
  defaultSets: number;
  defaultReps: number;
  description: string;
}

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  exercises: Exercise[];
}

interface LoggedExercise {
  name: string;
  sets: number;
  reps: number;
  completed: boolean;
}

interface PtSessionLog {
  id: string;
  workoutName: string;
  date: Date;
  rpe: number; // 1-10
  painLevel: number; // 0-10
  notes: string;
  exercises: LoggedExercise[];
}

const TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'knee-rehab',
    name: 'Knee Post-Op Rehabilitation',
    description: 'Focuses on regaining knee flexion, extension, and quad reactivation.',
    durationMinutes: 20,
    difficulty: 'Beginner',
    exercises: [
      { name: 'Straight Leg Raises', defaultSets: 3, defaultReps: 10, description: 'Tighten thigh muscle and lift leg 12 inches.' },
      { name: 'Quad Sets (Towel Roll)', defaultSets: 3, defaultReps: 10, description: 'Press back of knee down into a rolled towel.' },
      { name: 'Heel Slides', defaultSets: 3, defaultReps: 12, description: 'Slide heel toward buttocks using a strap if needed.' },
    ]
  },
  {
    id: 'back-strength',
    name: 'Lower Back Core Stability',
    description: 'Stabilizes the lumbar spine and strengthens supporting core muscle groups.',
    durationMinutes: 15,
    difficulty: 'Intermediate',
    exercises: [
      { name: 'Pelvic Tilts', defaultSets: 3, defaultReps: 15, description: 'Flatten back against floor by tightening abdominal muscles.' },
      { name: 'Glute Bridges', defaultSets: 3, defaultReps: 10, description: 'Lift hips off floor while keeping shoulders grounded.' },
      { name: 'Bird-Dog', defaultSets: 3, defaultReps: 10, description: 'Extend opposite arm and leg parallel to floor.' },
    ]
  },
  {
    id: 'shoulder-mobility',
    name: 'Shoulder Range of Motion & Rotator Cuff',
    description: 'Improves active range of motion and strengthens internal/external rotators.',
    durationMinutes: 18,
    difficulty: 'Intermediate',
    exercises: [
      { name: 'Wall Crawls (Front & Side)', defaultSets: 3, defaultReps: 5, description: 'Slowly walk fingers up wall as high as tolerated.' },
      { name: 'External Rotation with Band', defaultSets: 3, defaultReps: 12, description: 'Rotate forearm outward against resistance band.' },
      { name: 'Scapular Squeezes', defaultSets: 3, defaultReps: 15, description: 'Pinch shoulder blades together as if holding a pencil.' },
    ]
  }
];

const STORAGE_KEY_PREFIX = 'carevibe.therapy.sessions.';

@Component({
  selector: 'cv-therapy',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">therapy</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="warning">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Physical Therapy Workout Builder & Tracker
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Build, view, and log physical therapy workouts to track functional rehabilitation milestones.
        </p>
      </header>

      <!-- Streak and Milestones Row -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">Total Workouts Completed</span>
            <h2 class="text-3xl font-black text-indigo-900 dark:text-indigo-100 mt-1">{{ totalSessions() }}</h2>
          </div>
          <span class="text-3xl">🏋️‍♂️</span>
        </div>
        <div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">Current Streak</span>
            <h2 class="text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1">{{ currentStreak() }} days</h2>
          </div>
          <span class="text-3xl">🔥</span>
        </div>
        <div class="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400">Pain Trend Avg</span>
            <h2 class="text-3xl font-black text-amber-900 dark:text-amber-100 mt-1">{{ avgPain() }}/10</h2>
          </div>
          <span class="text-3xl">🩹</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Panel: Workout Selection & Builder -->
        <div class="lg:col-span-2 space-y-6">
          
          <!-- Template Selection -->
          <cv-card title="Select a Workout Plan" subtitle="Choose from prescribed therapy programs">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                *ngFor="let tmpl of templates"
                (click)="selectTemplate(tmpl)"
                class="flex flex-col text-left p-4 rounded-xl border transition-all hover:shadow-md"
                [ngClass]="activeTemplate()?.id === tmpl.id ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'"
              >
                <div class="flex items-center justify-between gap-1 w-full mb-1">
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{{ tmpl.difficulty }}</span>
                  <cv-badge tone="neutral">{{ tmpl.durationMinutes }}m</cv-badge>
                </div>
                <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1 leading-snug">{{ tmpl.name }}</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{{ tmpl.description }}</p>
              </button>
            </div>
          </cv-card>

          <!-- Active Workout Details -->
          <div *ngIf="activeTemplate() as tmpl" class="space-y-6">
            
            <!-- Video Simulation Player -->
            <cv-card title="Instructional Video" subtitle="Simulated guided execution">
              <div class="flex flex-col gap-4">
                <div class="relative w-full aspect-video rounded-xl bg-slate-900 dark:bg-black overflow-hidden flex items-center justify-center border border-slate-800">
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <span class="text-4xl animate-bounce">📽️</span>
                    <p class="text-white font-semibold text-lg mt-2">{{ tmpl.name }} - Guided Video</p>
                    <p class="text-slate-400 text-xs mt-1">Exercise: {{ activeExerciseName() }}</p>
                    
                    <div class="flex items-center gap-4 mt-6">
                      <button
                        (click)="toggleVideo()"
                        class="h-12 w-12 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold text-lg hover:scale-105 active:scale-95 transition-transform"
                      >
                        {{ isPlaying() ? '⏸' : '▶' }}
                      </button>
                    </div>
                  </div>
                  
                  <!-- Playback status bar -->
                  <div class="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur-sm flex items-center gap-3">
                    <span class="text-[11px] text-white font-mono">{{ formatTime(videoTime()) }}</span>
                    <input
                      type="range"
                      min="0"
                      [max]="videoDuration()"
                      [value]="videoTime()"
                      (input)="onSeek($event)"
                      class="flex-grow accent-indigo-500 h-1 rounded bg-slate-700"
                    />
                    <span class="text-[11px] text-white font-mono">{{ formatTime(videoDuration()) }}</span>
                  </div>
                </div>
              </div>
            </cv-card>

            <!-- Workout Logger -->
            <cv-card title="Exercise Log" subtitle="Log repetitions and sets completed">
              <div class="space-y-4">
                <div
                  *ngFor="let ex of loggedExercises(); let idx = index"
                  class="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div class="flex-grow">
                    <div class="flex items-center gap-2">
                      <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100">{{ ex.name }}</h4>
                      <cv-badge *ngIf="ex.completed" tone="success">Logged</cv-badge>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                      {{ getExerciseDescription(ex.name) }}
                    </p>
                  </div>

                  <!-- Log Inputs -->
                  <div class="flex items-center gap-3 shrink-0">
                    <div class="flex flex-col items-center">
                      <label class="text-[10px] text-slate-400 font-bold uppercase">Sets</label>
                      <input
                        type="number"
                        [(ngModel)]="ex.sets"
                        min="1"
                        max="10"
                        class="w-14 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        [disabled]="!isPatientRole()"
                      />
                    </div>
                    <div class="flex flex-col items-center">
                      <label class="text-[10px] text-slate-400 font-bold uppercase">Reps</label>
                      <input
                        type="number"
                        [(ngModel)]="ex.reps"
                        min="1"
                        max="50"
                        class="w-14 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        [disabled]="!isPatientRole()"
                      />
                    </div>
                    <button
                      *ngIf="isPatientRole()"
                      (click)="toggleExerciseLogged(idx)"
                      class="h-8 px-3 rounded-lg font-bold text-xs transition-colors"
                      [ngClass]="ex.completed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'"
                    >
                      {{ ex.completed ? '✓ Done' : 'Complete' }}
                    </button>
                  </div>
                </div>

                <!-- Form validation notice -->
                <p *ngIf="isPatientRole() && !canSubmit()" class="text-xs text-amber-500 text-right">
                  * Complete all exercises to finish workout
                </p>

                <!-- Outcomes and Submit (Only visible to patient) -->
                <div *ngIf="isPatientRole()" class="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Pain Level (0 to 10): {{ painLevel() }}</label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        [(ngModel)]="painLevel"
                        class="w-full accent-indigo-500"
                      />
                      <div class="flex justify-between text-[10px] text-slate-400">
                        <span>No Pain</span>
                        <span>Severe Pain</span>
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Perceived Exertion (RPE 1-10): {{ rpe() }}</label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        [(ngModel)]="rpe"
                        class="w-full accent-indigo-500"
                      />
                      <div class="flex justify-between text-[10px] text-slate-400">
                        <span>Very Easy</span>
                        <span>Max Effort</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1.5">Therapy Notes</label>
                    <textarea
                      [(ngModel)]="notes"
                      rows="2"
                      placeholder="Report clicking sounds, excessive fatigue, or how you felt..."
                      class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    ></textarea>
                  </div>

                  <div class="flex justify-end pt-2">
                    <cv-button
                      variant="primary"
                      [disabled]="!canSubmit()"
                      (click)="saveWorkoutSession()"
                    >
                      Submit Completed Workout
                    </cv-button>
                  </div>
                </div>

                <div *ngIf="!isPatientRole()" class="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200/30">
                  * Read-only view. Workout builder submission is restricted to the Care Receiver.
                </div>
              </div>
            </cv-card>
          </div>
        </div>

        <!-- Sidebar: History & Milestones -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card title="Milestones" subtitle="Functional progress achievements">
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <span class="text-2xl shrink-0">🎓</span>
                <div>
                  <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300">Graduation Readiness</h4>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">Complete 10 sessions total</p>
                  <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      class="bg-indigo-600 h-full transition-all duration-300"
                      [style.width.%]="graduationProgress()"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <span class="text-2xl shrink-0">🎯</span>
                <div>
                  <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300">Consistency Master</h4>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">Reach a 5-day workout streak</p>
                  <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      class="bg-emerald-500 h-full transition-all duration-300"
                      [style.width.%]="streakProgress()"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </cv-card>

          <cv-card title="Rehab Logs" subtitle="Past physical therapy logs">
            <div class="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              <div
                *ngFor="let s of sortedSessions(); trackBy: trackSessionId"
                class="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-3"
              >
                <div class="flex justify-between items-start mb-2">
                  <h5 class="font-bold text-xs text-slate-800 dark:text-slate-200 leading-snug">{{ s.workoutName }}</h5>
                  <cv-badge tone="neutral">{{ s.date | date:'shortDate' }}</cv-badge>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                  <div>Pain: <span class="font-bold text-slate-700 dark:text-slate-300">{{ s.painLevel }}/10</span></div>
                  <div>RPE: <span class="font-bold text-slate-700 dark:text-slate-300">{{ s.rpe }}/10</span></div>
                </div>
                <p *ngIf="s.notes" class="text-[11px] italic text-slate-600 dark:text-slate-400">
                  "{{ s.notes }}"
                </p>
              </div>
              <p *ngIf="sortedSessions().length === 0" class="text-xs text-slate-400 text-center py-4">No workout sessions logged yet.</p>
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
export class TherapyComponent implements OnDestroy {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);
  private readonly toastService = inject(ToastService);

  readonly templates = TEMPLATES;

  // Selected Patient context
  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatientName = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id)?.name : 'Unknown Patient';
  });

  readonly isPatientRole = computed(() => this.roleService.activeRole() === Role.PATIENT);

  // States
  readonly activeTemplate = signal<WorkoutTemplate | null>(null);
  readonly loggedExercises = signal<LoggedExercise[]>([]);
  readonly painLevel = signal(2);
  readonly rpe = signal(3);
  notes = '';

  // Video Simulator
  readonly isPlaying = signal(false);
  readonly videoTime = signal(0);
  readonly videoDuration = signal(120); // 2 minutes simulated
  private videoInterval: any = null;

  // Past sessions
  readonly sessionsSignal = signal<PtSessionLog[]>([]);
  readonly sessions = this.sessionsSignal.asReadonly();

  readonly sortedSessions = computed(() => {
    return [...this.sessions()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  readonly totalSessions = computed(() => this.sessions().length);
  
  readonly avgPain = computed(() => {
    const s = this.sessions();
    if (s.length === 0) return 0;
    const sum = s.reduce((acc, val) => acc + val.painLevel, 0);
    return Math.round((sum / s.length) * 10) / 10;
  });

  readonly currentStreak = computed(() => {
    const count = this.sessions().length;
    return count > 0 ? Math.min(count, 4) + 1 : 0;
  });

  readonly graduationProgress = computed(() => {
    return Math.min((this.totalSessions() / 10) * 100, 100);
  });

  readonly streakProgress = computed(() => {
    return Math.min((this.currentStreak() / 5) * 100, 100);
  });

  readonly activeExerciseName = computed(() => {
    const exList = this.loggedExercises();
    if (exList.length === 0) return 'Intro';
    const uncompleted = exList.find((e) => !e.completed);
    return uncompleted ? uncompleted.name : 'Finished!';
  });

  constructor() {
    // Select default template if none selected
    this.selectTemplate(TEMPLATES[0]);

    // Load persisted workouts on patient change
    effect(() => {
      const patId = this.selectedPatientId();
      if (patId) {
        const key = STORAGE_KEY_PREFIX + patId;
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const parsed: PtSessionLog[] = JSON.parse(saved);
            this.sessionsSignal.set(parsed.map((item) => ({ ...item, date: new Date(item.date) })));
          } catch {
            this.sessionsSignal.set([]);
          }
        } else {
          this.sessionsSignal.set([]);
        }
      } else {
        this.sessionsSignal.set([]);
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    this.clearVideoTimer();
  }

  selectTemplate(tmpl: WorkoutTemplate): void {
    this.activeTemplate.set(tmpl);
    this.loggedExercises.set(
      tmpl.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.defaultSets,
        reps: ex.defaultReps,
        completed: false
      }))
    );
    this.videoTime.set(0);
    this.isPlaying.set(false);
    this.clearVideoTimer();
  }

  getExerciseDescription(name: string): string {
    const tmpl = this.activeTemplate();
    if (!tmpl) return '';
    const ex = tmpl.exercises.find((e) => e.name === name);
    return ex ? ex.description : '';
  }

  toggleExerciseLogged(idx: number): void {
    this.loggedExercises.update((list) => {
      const copy = [...list];
      copy[idx] = { ...copy[idx], completed: !copy[idx].completed };
      return copy;
    });
  }

  canSubmit(): boolean {
    const list = this.loggedExercises();
    if (list.length === 0) return false;
    return list.every((ex) => ex.completed);
  }

  saveWorkoutSession(): void {
    const patId = this.selectedPatientId();
    const tmpl = this.activeTemplate();
    if (!patId || !tmpl || !this.canSubmit()) return;

    const newSession: PtSessionLog = {
      id: Date.now().toString(),
      workoutName: tmpl.name,
      date: new Date(),
      rpe: Number(this.rpe()),
      painLevel: Number(this.painLevel()),
      notes: this.notes.trim(),
      exercises: [...this.loggedExercises()]
    };

    const updated = [newSession, ...this.sessionsSignal()];
    this.sessionsSignal.set(updated);
    localStorage.setItem(STORAGE_KEY_PREFIX + patId, JSON.stringify(updated));

    this.toastService.success(`Workout "${tmpl.name}" logged successfully! Keep up the recovery.`);
    
    // Reset inputs
    this.painLevel.set(2);
    this.rpe.set(3);
    this.notes = '';
    
    // De-select exercise logs completion to reset builder form
    this.loggedExercises.update((list) => list.map((e) => ({ ...e, completed: false })));
  }

  toggleVideo(): void {
    if (this.isPlaying()) {
      this.isPlaying.set(false);
      this.clearVideoTimer();
    } else {
      this.isPlaying.set(true);
      this.videoInterval = setInterval(() => {
        const current = this.videoTime();
        if (current >= this.videoDuration()) {
          this.isPlaying.set(false);
          this.clearVideoTimer();
        } else {
          this.videoTime.set(current + 1);
        }
      }, 1000);
    }
  }

  onSeek(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.videoTime.set(Number(target.value));
  }

  private clearVideoTimer(): void {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
  }

  formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Physical Therapy';
  }

  trackSessionId = (_: number, item: PtSessionLog): string => item.id;
}
