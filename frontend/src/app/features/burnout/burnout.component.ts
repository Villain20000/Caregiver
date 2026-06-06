import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent, CvBadgeTone } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvProgressRingComponent } from '../../shared/components/cv-progress-ring/cv-progress-ring.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS } from '../../core/models/role.model';

interface BurnoutQuestion {
  id: string;
  text: string;
  category: 'emotional' | 'physical' | 'cognitive' | 'social';
  weight: number;
}

interface AssessmentResult {
  id: string;
  date: Date;
  score: number;
  maxScore: number;
  level: 'low' | 'moderate' | 'high' | 'critical';
  answers: Record<string, number>;
}

interface Resource {
  title: string;
  description: string;
  url: string;
  category: string;
  tone: CvBadgeTone;
}

const QUESTIONS: BurnoutQuestion[] = [
  { id: 'q1', text: 'I feel emotionally drained from my caregiving duties', category: 'emotional', weight: 1.5 },
  { id: 'q2', text: 'I feel physically exhausted at the end of the day', category: 'physical', weight: 1.2 },
  { id: 'q3', text: 'I find it difficult to concentrate on tasks', category: 'cognitive', weight: 1.3 },
  { id: 'q4', text: 'I feel isolated from others who don\'t understand my role', category: 'social', weight: 1.1 },
  { id: 'q5', text: 'I feel overwhelmed by the responsibilities I carry', category: 'emotional', weight: 1.5 },
  { id: 'q6', text: 'I have trouble sleeping due to worry or stress', category: 'physical', weight: 1.4 },
  { id: 'q7', text: 'I feel detached or numb when providing care', category: 'emotional', weight: 1.5 },
  { id: 'q8', text: 'I struggle to find time for my own needs', category: 'physical', weight: 1.2 },
  { id: 'q9', text: 'I feel resentful about my caregiving situation', category: 'emotional', weight: 1.3 },
  { id: 'q10', text: 'I have reduced interest in activities I used to enjoy', category: 'cognitive', weight: 1.1 },
  { id: 'q11', text: 'I feel my relationships are suffering', category: 'social', weight: 1.2 },
  { id: 'q12', text: 'I doubt my ability to provide adequate care', category: 'cognitive', weight: 1.4 },
];

const SCALE_LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];

const RESOURCES: Resource[] = [
  { title: 'National Caregiver Support Line', description: '24/7 confidential support for family caregivers', url: '#', category: 'Hotline', tone: 'danger' },
  { title: 'Mindfulness & Meditation Guide', description: 'Free guided meditation sessions designed for caregivers', url: '#', category: 'Self-Care', tone: 'success' },
  { title: 'Caregiver Support Groups', description: 'Connect with other caregivers in your area', url: '#', category: 'Community', tone: 'info' },
  { title: 'Respite Care Services', description: 'Find temporary relief care providers near you', url: '#', category: 'Respite', tone: 'warning' },
  { title: 'Professional Counseling Referral', description: 'Book a session with a licensed therapist', url: '#', category: 'Mental Health', tone: 'primary' },
  { title: 'Exercise & Movement Routines', description: 'Simple exercises to reduce stress and improve sleep', url: '#', category: 'Physical', tone: 'success' },
];

function getBurnoutLevel(score: number, maxScore: number): AssessmentResult['level'] {
  const pct = score / maxScore;
  if (pct <= 0.25) return 'low';
  if (pct <= 0.50) return 'moderate';
  if (pct <= 0.75) return 'high';
  return 'critical';
}

const LEVEL_CONFIG: Record<AssessmentResult['level'], { label: string; tone: CvBadgeTone; color: string; description: string }> = {
  low: { label: 'Low Risk', tone: 'success', color: 'text-emerald-600 dark:text-emerald-400', description: 'Your burnout levels are manageable. Continue practicing self-care and monitor your wellbeing.' },
  moderate: { label: 'Moderate Risk', tone: 'warning', color: 'text-amber-600 dark:text-amber-400', description: 'You\'re showing early signs of burnout. Consider increasing self-care activities and seeking support.' },
  high: { label: 'High Risk', tone: 'danger', color: 'text-rose-600 dark:text-rose-400', description: 'Significant burnout indicators detected. Please consider reaching out to a professional for support.' },
  critical: { label: 'Critical', tone: 'danger', color: 'text-rose-700 dark:text-rose-300', description: 'Your burnout levels are critical. Immediate professional support is strongly recommended.' },
};

const CATEGORY_CONFIG: Record<string, { icon: string; label: string }> = {
  emotional: { icon: '💜', label: 'Emotional' },
  physical: { icon: '🏃', label: 'Physical' },
  cognitive: { icon: '🧠', label: 'Cognitive' },
  social: { icon: '👥', label: 'Social' },
};

@Component({
  selector: 'cv-burnout',
  standalone: true,
  imports: [
    CommonModule, CvCardComponent, CvBadgeComponent, CvButtonComponent,
    CvStatTileComponent, CvProgressRingComponent, CvModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">burnout</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Caregiver Burnout Assessment
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          A psychological self-care check-in to help identify burnout early and connect you with the right resources.
        </p>
      </header>

      <!-- Previous Assessment Summary -->
      @if (latestAssessment()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <cv-stat-tile
            label="Last Score"
            [value]="latestAssessment()!.score + '/' + latestAssessment()!.maxScore"
            [tone]="levelConfig().tone"
            icon="📊"
          ></cv-stat-tile>
          <cv-stat-tile
            label="Risk Level"
            [value]="levelConfig().label"
            [tone]="levelConfig().tone"
            icon="🎯"
          ></cv-stat-tile>
          <cv-stat-tile
            label="Assessments Taken"
            [value]="assessmentHistory().length"
            tone="info"
            icon="📝"
          ></cv-stat-tile>
        </div>

        <!-- Progress Ring -->
        <cv-card title="Burnout Score" subtitle="Your current risk assessment">
          <div class="flex items-center gap-8">
            <div class="shrink-0">
              <cv-progress-ring
                [percent]="scorePercent()"
                [size]="120"
                [strokeWidth]="10"
                [color]="scoreColor()"
                [label]="latestAssessment()!.score.toString()"
              ></cv-progress-ring>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold" [ngClass]="levelConfig().color">
                {{ levelConfig().label }}
              </h3>
              <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">{{ levelConfig().description }}</p>
              <div class="flex gap-2 mt-3">
                @for (cat of categories; track cat) {
                  <cv-badge [tone]="getCategoryScore(cat) > 60 ? 'danger' : getCategoryScore(cat) > 30 ? 'warning' : 'success'">
                    {{ categoryConfig[cat].icon }} {{ categoryConfig[cat].label }}
                  </cv-badge>
                }
              </div>
            </div>
          </div>
        </cv-card>
      }

      <!-- Assessment History -->
      @if (assessmentHistory().length > 1) {
        <cv-card title="Assessment History" subtitle="Track your burnout trends over time">
          <div class="space-y-3">
            @for (assessment of assessmentHistory(); track assessment.id) {
              @let level = getLevel(assessment.score, assessment.maxScore);
              <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div class="flex items-center gap-3">
                  <cv-badge [tone]="LEVEL_CONFIG[level].tone">{{ LEVEL_CONFIG[level].label }}</cv-badge>
                  <span class="text-sm text-slate-700 dark:text-slate-200">
                    {{ assessment.score }}/{{ assessment.maxScore }} points
                  </span>
                </div>
                <span class="text-xs text-slate-500 dark:text-slate-400">
                  {{ assessment.date | date:'MMM d, y' }}
                </span>
              </div>
            }
          </div>
        </cv-card>
      }

      <!-- New Assessment -->
      <cv-card title="Take Assessment" subtitle="Answer these questions honestly for the best results">
        <div class="space-y-6">
          <!-- Category Filter -->
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              (click)="selectedCategory.set(null)"
              class="rounded-full px-4 py-1.5 text-xs font-medium transition-all border"
              [ngClass]="!selectedCategory()
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'"
            >
              All Questions
            </button>
            @for (cat of categories; track cat) {
              <button
                type="button"
                (click)="selectedCategory.set(cat)"
                class="rounded-full px-4 py-1.5 text-xs font-medium transition-all border"
                [ngClass]="selectedCategory() === cat
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'"
              >
                {{ categoryConfig[cat].icon }} {{ categoryConfig[cat].label }}
              </button>
            }
          </div>

          <!-- Questions -->
          @for (question of filteredQuestions(); track question.id) {
            <div class="rounded-xl border border-slate-200/60 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div class="flex items-start justify-between gap-3 mb-3">
                <p class="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {{ question.text }}
                </p>
                <cv-badge tone="neutral">{{ categoryConfig[question.category].label }}</cv-badge>
              </div>
              <div class="flex gap-2">
                @for (label of scaleLabels; track $index) {
                  <button
                    type="button"
                    (click)="setAnswer(question.id, $index)"
                    class="flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all border text-center"
                    [ngClass]="answers()[question.id] === $index
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'"
                  >
                    {{ label }}
                  </button>
                }
              </div>
              <div class="flex justify-between mt-1.5 px-1">
                <span class="text-[10px] text-slate-400">Never</span>
                <span class="text-[10px] text-slate-400">Always</span>
              </div>
            </div>
          }

          <!-- Progress -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-500 dark:text-slate-400">
              {{ answeredCount() }}/{{ questions.length }} questions answered
            </span>
            <div class="flex gap-2">
              <cv-button variant="ghost" size="sm" (click)="resetAssessment()">Reset</cv-button>
              <cv-button
                variant="primary"
                size="sm"
                [disabled]="answeredCount() < questions.length"
                (click)="submitAssessment()"
              >
                Submit Assessment
              </cv-button>
            </div>
          </div>
        </div>
      </cv-card>

      <!-- Recommended Resources -->
      <cv-card title="Therapeutic Resources" subtitle="Personalized recommendations based on your assessment">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (resource of resources; track resource.title) {
            <div class="rounded-xl border border-slate-200/60 dark:border-slate-800 p-4 hover:shadow-soft transition-all bg-white/80 dark:bg-slate-900/80">
              <div class="flex items-center gap-2 mb-2">
                <cv-badge [tone]="resource.tone">{{ resource.category }}</cv-badge>
              </div>
              <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ resource.title }}</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ resource.description }}</p>
              <button class="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                Learn more →
              </button>
            </div>
          }
        </div>
      </cv-card>
    </div>
  `,
})
export class BurnoutComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly role = inject(RoleService);

  readonly questions = QUESTIONS;
  readonly scaleLabels = SCALE_LABELS;
  readonly resources = RESOURCES;
  readonly categoryConfig = CATEGORY_CONFIG;
  readonly LEVEL_CONFIG = LEVEL_CONFIG;
  readonly categories: string[] = ['emotional', 'physical', 'cognitive', 'social'];

  readonly selectedCategory = signal<string | null>(null);
  readonly answers = signal<Record<string, number>>({});

  readonly assessmentHistory = signal<AssessmentResult[]>([
    {
      id: 'prev-1',
      date: new Date(Date.now() - 14 * 86_400_000),
      score: 18,
      maxScore: 48,
      level: 'moderate',
      answers: {},
    },
    {
      id: 'prev-2',
      date: new Date(Date.now() - 30 * 86_400_000),
      score: 12,
      maxScore: 48,
      level: 'low',
      answers: {},
    },
  ]);

  readonly latestAssessment = computed(() => {
    const history = this.assessmentHistory();
    return history.length > 0 ? history[0] : null;
  });

  readonly filteredQuestions = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) return this.questions;
    return this.questions.filter((q) => q.category === cat);
  });

  readonly answeredCount = computed(() => {
    const ans = this.answers();
    return Object.keys(ans).length;
  });

  readonly scorePercent = computed(() => {
    const latest = this.latestAssessment();
    if (!latest) return 0;
    return Math.round((latest.score / latest.maxScore) * 100);
  });

  readonly scoreColor = computed(() => {
    const pct = this.scorePercent();
    if (pct <= 25) return '#10b981';
    if (pct <= 50) return '#f59e0b';
    if (pct <= 75) return '#f43f5e';
    return '#dc2626';
  });

  readonly levelConfig = computed(() => {
    const latest = this.latestAssessment();
    if (!latest) return LEVEL_CONFIG['low'];
    const level = getBurnoutLevel(latest.score, latest.maxScore);
    return LEVEL_CONFIG[level];
  });

  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Burnout Assessment';
  }

  setAnswer(questionId: string, value: number): void {
    this.answers.update((ans) => ({ ...ans, [questionId]: value }));
  }

  getCategoryScore(category: string): number {
    const ans = this.answers();
    const catQuestions = this.questions.filter((q) => q.category === category);
    if (catQuestions.length === 0) return 0;
    let total = 0;
    for (const q of catQuestions) {
      total += (ans[q.id] ?? 0) * q.weight;
    }
    const maxPossible = catQuestions.length * 4;
    return Math.round((total / maxPossible) * 100);
  }

  getLevel(score: number, maxScore: number): AssessmentResult['level'] {
    return getBurnoutLevel(score, maxScore);
  }

  submitAssessment(): void {
    const ans = this.answers();
    let totalScore = 0;
    let maxScore = 0;
    for (const q of this.questions) {
      totalScore += (ans[q.id] ?? 0) * q.weight;
      maxScore += 4 * q.weight;
    }
    maxScore = Math.round(maxScore);
    totalScore = Math.round(totalScore);

    const result: AssessmentResult = {
      id: `assess-${Date.now()}`,
      date: new Date(),
      score: totalScore,
      maxScore,
      level: getBurnoutLevel(totalScore, maxScore),
      answers: { ...ans },
    };

    this.assessmentHistory.update((h) => [result, ...h]);
  }

  resetAssessment(): void {
    this.answers.set({});
  }
}