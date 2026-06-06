import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvEmojiSliderComponent } from '../../shared/components/cv-emoji-slider/cv-emoji-slider.component';
import { ToastService } from '../../core/services/toast.service';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { PatientService } from '../../core/services/patient.service';

export interface MoodEntry {
  id: number;
  date: Date;
  moodScore: number; // 0-4
  sleepScore: number; // 0-4
  appetiteScore: number; // 0-4
  note?: string;
  patientId: string;
}

const EMOJIS = ['😭', '😢', '😐', '🙂', '😄'];
const EMOJI_LABELS = ['Awful', 'Bad', 'Okay', 'Good', 'Great'];

const SLEEP_EMOJIS = ['😫', '😩', '😐', '😌', '😴'];
const SLEEP_LABELS = ['Terrible', 'Poor', 'Fair', 'Good', 'Amazing'];

const APPETITE_EMOJIS = ['🤢', '😣', '😐', '😋', '🤤'];
const APPETITE_LABELS = ['None', 'Little', 'Moderate', 'Good', 'Excellent'];

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STORAGE_KEY_PREFIX = 'carevibe.mood.entries.';

@Component({
  selector: 'cv-mood',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent, CvEmojiSliderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">mood</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="success">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Daily Mood & Wellness Journal
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Track wellness trends and journal daily feelings.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Today's Check-in / Read-only Summary -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card
            [title]="isPatientRole() ? 'Journal Entry Check-in' : 'Patient Wellness Status'"
            [subtitle]="isPatientRole() ? 'Log your symptoms for today or yesterday' : 'Daily mood and symptom metrics (Read-only)'"
          >
            <!-- Check-in Form for PATIENT -->
            <div *ngIf="isPatientRole(); else readOnlyView" class="space-y-6 py-2">
              <!-- Day navigation -->
              <div class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl w-fit">
                <button
                  type="button"
                  (click)="selectedDay.set('today')"
                  class="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  [ngClass]="selectedDay() === 'today' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
                >
                  Today
                </button>
                <button
                  type="button"
                  (click)="selectedDay.set('yesterday')"
                  class="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all"
                  [ngClass]="selectedDay() === 'yesterday' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
                >
                  Yesterday
                </button>
              </div>

              <!-- Mood Question -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  How are you feeling {{ selectedDay() }}?
                </label>
                <cv-emoji-slider
                  [emojis]="moodEmojis"
                  [labels]="moodLabels"
                  [value]="currentMood()"
                  (valueChange)="currentMood.set($event)"
                  ariaLabel="Rate your mood"
                ></cv-emoji-slider>
              </div>

              <!-- Sleep Question -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Did you sleep well?
                </label>
                <cv-emoji-slider
                  [emojis]="sleepEmojis"
                  [labels]="sleepLabels"
                  [value]="currentSleep()"
                  (valueChange)="currentSleep.set($event)"
                  ariaLabel="Rate your sleep quality"
                ></cv-emoji-slider>
              </div>

              <!-- Appetite Question -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Appetite level?
                </label>
                <cv-emoji-slider
                  [emojis]="appetiteEmojis"
                  [labels]="appetiteLabels"
                  [value]="currentAppetite()"
                  (valueChange)="currentAppetite.set($event)"
                  ariaLabel="Rate your appetite"
                ></cv-emoji-slider>
              </div>

              <!-- Note -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Journal Notes (optional)
                </label>
                <textarea
                  [(ngModel)]="currentNote"
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-shadow"
                  rows="3"
                  placeholder="Any details on symptoms, mental state, or activities..."
                ></textarea>
              </div>

              <!-- Save Button -->
              <div class="flex items-center justify-between pt-2">
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  {{ entries().length }} total entries logged for {{ currentPatientName() }}
                </p>
                <cv-button variant="primary" (click)="saveEntry()">
                  <span cv-btn-icon-left>
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                  </span>
                  Save Entry
                </cv-button>
              </div>
            </div>

            <!-- Read-only view for Professionals / Family -->
            <ng-template #readOnlyView>
              <div class="space-y-6 py-2">
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
                  <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Latest Entry Overview</h3>
                  <div *ngIf="latestEntry(); else noEntries" class="space-y-4">
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-slate-500 dark:text-slate-400">Date Logged:</span>
                      <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {{ latestEntry()?.date | date:'medium' }}
                      </span>
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                      <div class="text-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <span class="block text-2xl mb-1">{{ moodEmojis[latestEntry()!.moodScore] }}</span>
                        <span class="block text-[10px] uppercase font-bold text-slate-400">Mood</span>
                        <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ moodLabels[latestEntry()!.moodScore] }}</span>
                      </div>
                      <div class="text-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <span class="block text-2xl mb-1">{{ sleepEmojis[latestEntry()!.sleepScore] }}</span>
                        <span class="block text-[10px] uppercase font-bold text-slate-400">Sleep</span>
                        <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ sleepLabels[latestEntry()!.sleepScore] }}</span>
                      </div>
                      <div class="text-center p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <span class="block text-2xl mb-1">{{ appetiteEmojis[latestEntry()!.appetiteScore] }}</span>
                        <span class="block text-[10px] uppercase font-bold text-slate-400">Appetite</span>
                        <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ appetiteLabels[latestEntry()!.appetiteScore] }}</span>
                      </div>
                    </div>
                    <div *ngIf="latestEntry()?.note" class="text-sm italic text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                      "{{ latestEntry()?.note }}"
                    </div>
                  </div>
                  <ng-template #noEntries>
                    <p class="text-xs text-slate-400 text-center py-4">No mood journal logged for this patient yet.</p>
                  </ng-template>
                </div>
                <div class="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <p class="text-xs text-slate-400 dark:text-slate-500">
                    * As a {{ roleLabel() }}, you have read-only access to view logs. Check-in submission is restricted to the Care Receiver.
                  </p>
                </div>
              </div>
            </ng-template>
          </cv-card>

          <!-- Weekly Mood Trend Chart -->
          <cv-card title="Weekly Trend" subtitle="Patient mood over the past 7 days">
            <div class="py-4">
              <div class="relative h-48 w-full">
                <!-- SVG Line Chart -->
                <svg class="w-full h-full" viewBox="0 0 700 240" preserveAspectRatio="xMidYMid meet">
                  <!-- Grid lines -->
                  <line x1="60" y1="40" x2="660" y2="40" stroke="currentColor" stroke-opacity="0.06" stroke-width="1"/>
                  <line x1="60" y1="80" x2="660" y2="80" stroke="currentColor" stroke-opacity="0.06" stroke-width="1"/>
                  <line x1="60" y1="120" x2="660" y2="120" stroke="currentColor" stroke-opacity="0.06" stroke-width="1"/>
                  <line x1="60" y1="160" x2="660" y2="160" stroke="currentColor" stroke-opacity="0.06" stroke-width="1"/>
                  <line x1="60" y1="200" x2="660" y2="200" stroke="currentColor" stroke-opacity="0.06" stroke-width="1"/>

                  <!-- Y-axis labels -->
                  <text x="50" y="44" text-anchor="end" class="text-[10px] fill-slate-400 dark:fill-slate-500">Great (5)</text>
                  <text x="50" y="84" text-anchor="end" class="text-[10px] fill-slate-400 dark:fill-slate-500">Good (4)</text>
                  <text x="50" y="124" text-anchor="end" class="text-[10px] fill-slate-400 dark:fill-slate-500">Okay (3)</text>
                  <text x="50" y="164" text-anchor="end" class="text-[10px] fill-slate-400 dark:fill-slate-500">Bad (2)</text>
                  <text x="50" y="204" text-anchor="end" class="text-[10px] fill-slate-400 dark:fill-slate-500">Awful (1)</text>

                  <!-- Mood line -->
                  <ng-container *ngIf="chartPoints().length > 0">
                    <!-- Area fill -->
                    <path
                      [attr.d]="areaPath()"
                      fill="url(#moodGradient)"
                      opacity="0.25"
                    />
                    <!-- Line -->
                    <path
                      [attr.d]="linePath()"
                      fill="none"
                      stroke="rgb(99,102,241)"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <!-- Data points -->
                    <circle
                      *ngFor="let pt of chartPoints(); trackBy: trackPtIndex"
                      [attr.cx]="pt.x"
                      [attr.cy]="pt.y"
                      r="5"
                      class="fill-indigo-500 stroke-white dark:stroke-slate-900"
                      stroke-width="2.5"
                    >
                      <title>{{ pt.label }}: {{ pt.value }}/5</title>
                    </circle>
                  </ng-container>

                  <defs>
                    <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="rgb(99,102,241)" stop-opacity="0.5"/>
                      <stop offset="100%" stop-color="rgb(99,102,241)" stop-opacity="0"/>
                    </linearGradient>
                  </defs>

                  <!-- X-axis labels -->
                  <ng-container *ngIf="chartPoints().length > 0">
                    <text
                      *ngFor="let pt of chartPoints(); trackBy: trackPtIndex"
                      [attr.x]="pt.x"
                      y="228"
                      text-anchor="middle"
                      class="text-[10px] fill-slate-400 dark:fill-slate-500"
                    >{{ pt.dayLabel }}</text>
                  </ng-container>
                </svg>
              </div>

              <!-- Legend -->
              <div class="flex items-center justify-center gap-6 mt-4">
                <div class="flex items-center gap-2">
                  <span class="h-3 w-6 rounded-full bg-indigo-500"></span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">Mood score</span>
                </div>
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Right Column: History -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card title="Journal History" subtitle="Recent entries for {{ currentPatientName() }}">
            <div class="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              <div
                *ngFor="let entry of sortedEntries(); trackBy: trackEntryId"
                class="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-3 transition-all hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {{ entry.date | date:'MMM d, h:mm a' }}
                  </span>
                  <span class="text-sm">{{ moodEmojis[entry.moodScore] }}</span>
                </div>
                <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span class="flex items-center gap-1">
                    <span>Sleep:</span>
                    <span>{{ sleepEmojis[entry.sleepScore] }}</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <span>Appetite:</span>
                    <span>{{ appetiteEmojis[entry.appetiteScore] }}</span>
                  </span>
                </div>
                <p *ngIf="entry.note" class="text-xs text-slate-600 dark:text-slate-300 mt-1.5 italic">
                  "{{ entry.note }}"
                </p>
              </div>
              <p *ngIf="sortedEntries().length === 0" class="text-sm text-slate-400 text-center py-6">No journal history.</p>
            </div>
          </cv-card>
        </div>
      </div>
    </div>
  `,
})
export class MoodComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);

  readonly moodEmojis = EMOJIS;
  readonly moodLabels = EMOJI_LABELS;
  readonly sleepEmojis = SLEEP_EMOJIS;
  readonly sleepLabels = SLEEP_LABELS;
  readonly appetiteEmojis = APPETITE_EMOJIS;
  readonly appetiteLabels = APPETITE_LABELS;

  // Form selections
  readonly selectedDay = signal<'today' | 'yesterday'>('today');
  readonly currentMood = signal(2);
  readonly currentSleep = signal(2);
  readonly currentAppetite = signal(2);
  currentNote = '';

  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatient = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id) : null;
  });
  readonly currentPatientName = computed(() => this.currentPatient()?.name ?? 'Unknown Patient');

  readonly isPatientRole = computed(() => this.roleService.activeRole() === Role.PATIENT);

  readonly entriesSignal = signal<MoodEntry[]>([]);
  readonly entries = this.entriesSignal.asReadonly();

  readonly sortedEntries = computed(() =>
    [...this.entries()].sort((a, b) => b.date.getTime() - a.date.getTime())
  );

  readonly latestEntry = computed(() => {
    const sorted = this.sortedEntries();
    return sorted.length > 0 ? sorted[0] : null;
  });

  readonly chartPoints = computed(() => {
    const entries = this.entries();
    if (entries.length === 0) return [];

    const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
    const recent = sorted.slice(-7);

    const chartWidth = 600; // 660 - 60 margins
    const chartHeight = 160; // 200 - 40 top margin
    const stepX = recent.length > 1 ? chartWidth / (recent.length - 1) : chartWidth / 2;
    const scaleY = chartHeight / 4; // values 1-5

    return recent.map((entry, i) => ({
      x: 60 + i * stepX,
      y: 200 - (entry.moodScore / 4) * scaleY,
      value: entry.moodScore + 1,
      label: WEEKDAY[entry.date.getDay()],
      dayLabel: WEEKDAY[entry.date.getDay()],
    }));
  });

  readonly linePath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  });

  readonly areaPath = computed(() => {
    const pts = this.chartPoints();
    if (pts.length === 0) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    const top = 200;
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    return `${line} L${last.x},${top} L${first.x},${top} Z`;
  });

  private entryIdCounter = 1000;

  constructor() {
    // Reload entries whenever active patient ID changes
    effect(() => {
      const patId = this.selectedPatientId();
      if (patId) {
        const key = STORAGE_KEY_PREFIX + patId;
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed: MoodEntry[] = JSON.parse(raw);
            this.entriesSignal.set(parsed.map((e) => ({ ...e, date: new Date(e.date) })));
          } catch {
            this.entriesSignal.set(this.getPreseededEntriesForPatient(patId));
          }
        } else {
          const preseeded = this.getPreseededEntriesForPatient(patId);
          this.entriesSignal.set(preseeded);
          localStorage.setItem(key, JSON.stringify(preseeded));
        }
      } else {
        this.entriesSignal.set([]);
      }
    }, { allowSignalWrites: true });
  }

  private getPreseededEntriesForPatient(patientId: string): MoodEntry[] {
    // Create plausible seed records for patient
    const mockNotes = [
      'Feel great today, went for a short stroll.',
      'Slight knee discomfort but slept ok.',
      'Appetite low, feeling a bit sluggish.',
      'Wonderful day with family visiting!',
      'Doing well, completed exercises.',
      'Relaxed and rested.'
    ];

    return [
      { id: 1, patientId, date: new Date(Date.now() - 86400000 * 5), moodScore: 3, sleepScore: 3, appetiteScore: 3, note: mockNotes[0] },
      { id: 2, patientId, date: new Date(Date.now() - 86400000 * 4), moodScore: 2, sleepScore: 2, appetiteScore: 2, note: mockNotes[1] },
      { id: 3, patientId, date: new Date(Date.now() - 86400000 * 3), moodScore: 1, sleepScore: 1, appetiteScore: 2, note: mockNotes[2] },
      { id: 4, patientId, date: new Date(Date.now() - 86400000 * 2), moodScore: 4, sleepScore: 4, appetiteScore: 4, note: mockNotes[3] },
      { id: 5, patientId, date: new Date(Date.now() - 86400000 * 1), moodScore: 3, sleepScore: 3, appetiteScore: 3, note: mockNotes[4] },
    ];
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Mood';
  }

  saveEntry(): void {
    const patId = this.selectedPatientId();
    if (!patId) return;

    const baseDate = new Date();
    if (this.selectedDay() === 'yesterday') {
      baseDate.setDate(baseDate.getDate() - 1);
    }

    const entry: MoodEntry = {
      id: ++this.entryIdCounter,
      patientId: patId,
      date: baseDate,
      moodScore: this.currentMood(),
      sleepScore: this.currentSleep(),
      appetiteScore: this.currentAppetite(),
      note: this.currentNote.trim() || undefined,
    };

    this.entriesSignal.update((entries) => [entry, ...entries]);
    localStorage.setItem(STORAGE_KEY_PREFIX + patId, JSON.stringify(this.entriesSignal()));

    this.toastService.success('Your mood entry has been saved! Keep up the great self-care. 💪');

    // Reset form
    this.currentMood.set(2);
    this.currentSleep.set(2);
    this.currentAppetite.set(2);
    this.currentNote = '';
  }

  trackEntryId = (_: number, entry: MoodEntry): number => entry.id;
  trackPtIndex = (i: number): number => i;
}

