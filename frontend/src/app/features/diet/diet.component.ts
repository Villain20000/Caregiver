import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
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

interface Meal {
  id: string;
  name: string;
  description: string;
  completed: boolean;
  calories: number;
}

interface DietPlan {
  meals: Meal[];
  waterGoalMl: number;
  waterIntakeMl: number;
  restrictions: string[];
}

const STORAGE_KEY_PREFIX = 'carevibe.diet.plan.';

@Component({
  selector: 'cv-diet',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">dietary</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="success">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Nutrition & Meal Intake Tracker
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Log food meals, monitor water intake target, and review clinical dietary instructions.
        </p>
      </header>

      <!-- Nutrient summary header cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">Calories Target</span>
            <h2 class="text-3xl font-black text-indigo-900 dark:text-indigo-100 mt-1">{{ completedCalories() }} / {{ totalTargetCalories() }} kcal</h2>
          </div>
          <span class="text-3xl">🍲</span>
        </div>
        <div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">Water Logged</span>
            <h2 class="text-3xl font-black text-emerald-900 dark:text-emerald-100 mt-1">{{ currentWaterIntake() }} / {{ targetWater() }} ml</h2>
          </div>
          <span class="text-3xl">🥛</span>
        </div>
        <div class="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-rose-500 dark:text-rose-400">Diet Restrictions</span>
            <div class="flex flex-wrap gap-1 mt-1">
              <span *ngFor="let res of activePlan().restrictions" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200/40 text-rose-700 uppercase">
                {{ res }}
              </span>
            </div>
          </div>
          <span class="text-3xl">🚫</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Panel: Meals list -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card title="Daily Meal Plan" subtitle="Check off completed meals">
            <div class="space-y-3">
              <div
                *ngFor="let meal of activePlan().meals"
                class="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/10 flex items-center justify-between gap-4"
              >
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-400 uppercase">{{ meal.id }}</span>
                    <cv-badge tone="neutral">{{ meal.calories }} kcal</cv-badge>
                  </div>
                  <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 mt-1">{{ meal.name }}</h4>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{{ meal.description }}</p>
                </div>
                
                <button
                  *ngIf="isPatientRole()"
                  (click)="toggleMeal(meal.id)"
                  class="h-8 px-4 rounded-lg font-bold text-xs transition-colors shrink-0"
                  [ngClass]="meal.completed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'"
                >
                  {{ meal.completed ? '✓ Logged' : 'Log Meal' }}
                </button>
              </div>
            </div>
          </cv-card>

          <!-- Water tracker -->
          <cv-card title="Hydration Station" subtitle="Log water intake throughout the day">
            <div class="flex flex-col items-center py-4 gap-4">
              <div class="flex items-center gap-3">
                <cv-button variant="ghost" (click)="addWater(-250)">- 250ml</cv-button>
                <span class="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{{ currentWaterIntake() }} ml</span>
                <cv-button variant="primary" (click)="addWater(250)">+ 250ml</cv-button>
              </div>
              <p class="text-xs text-slate-400">Target water goal: {{ targetWater() }} ml</p>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar: Dietary plan customizer (Nutritionist / Clinical roles) -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card *ngIf="isClinicalRole(); else patientInfo" title="Configure Plan" subtitle="Dietitian prescription options">
            <div class="space-y-4 py-2">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Dietary Restriction</label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    [(ngModel)]="newRestriction"
                    placeholder="E.g. Low Sodium"
                    class="flex-grow rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <cv-button variant="primary" (click)="addRestriction()">Add</cv-button>
                </div>
              </div>

              <div class="border-t border-slate-100 dark:border-slate-850 pt-3">
                <span class="block text-xs font-semibold text-slate-500 mb-2">Meal Modifications</span>
                <p class="text-[10px] text-slate-400">Modify meals directly by editing patient plans on file.</p>
              </div>
            </div>
          </cv-card>

          <ng-template #patientInfo>
            <cv-card title="Dietary Guidelines" subtitle="Tips for your health plan">
              <div class="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p>🥗 Ensure low carbohydrate meals to regulate blood sugar swings.</p>
                <p>🥑 Prioritize healthy fats (avocado, olive oil) over high sodium snacks.</p>
                <p>💧 Drink at least 8 glasses of water to maintain active hydration.</p>
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
export class DietComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);
  private readonly toast = inject(ToastService);

  readonly activePlan = signal<DietPlan>(this.getDefaultPlan());
  newRestriction = '';

  // Context Computations
  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatientName = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id)?.name : 'Unknown Patient';
  });

  readonly isPatientRole = computed(() => this.roleService.activeRole() === Role.PATIENT);
  readonly isClinicalRole = computed(() => {
    const role = this.roleService.activeRole();
    return role === Role.NUTRITIONIST || role === Role.NURSE || role === Role.DOCTOR;
  });

  readonly completedCalories = computed(() => {
    return this.activePlan().meals.filter((m) => m.completed).reduce((acc, m) => acc + m.calories, 0);
  });

  readonly totalTargetCalories = computed(() => {
    return this.activePlan().meals.reduce((acc, m) => acc + m.calories, 0);
  });

  readonly currentWaterIntake = computed(() => this.activePlan().waterIntakeMl);
  readonly targetWater = computed(() => this.activePlan().waterGoalMl);

  constructor() {
    effect(() => {
      const patId = this.selectedPatientId();
      if (patId) {
        const key = STORAGE_KEY_PREFIX + patId;
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            this.activePlan.set(JSON.parse(saved));
          } catch {
            this.activePlan.set(this.getDefaultPlan());
          }
        } else {
          this.activePlan.set(this.getDefaultPlan());
        }
      }
    }, { allowSignalWrites: true });
  }

  private getDefaultPlan(): DietPlan {
    return {
      meals: [
        { id: 'breakfast', name: 'Oatmeal & Fresh Berries', description: 'Steel-cut oats with almonds, blueberries, and honey.', completed: false, calories: 350 },
        { id: 'lunch', name: 'Grilled Salmon & Quinoa Salad', description: 'Rich omega-3 salmon fillet with broccoli and fresh lemon dress.', completed: false, calories: 600 },
        { id: 'dinner', name: 'Turkey Roast & Sweet Potatoes', description: 'Skinless turkey breast with baked sweet potatoes and peas.', completed: false, calories: 450 },
      ],
      waterGoalMl: 2000,
      waterIntakeMl: 750,
      restrictions: ['Low Sodium', 'Diabetic friendly']
    };
  }

  private persist(): void {
    const patId = this.selectedPatientId();
    if (!patId) return;
    localStorage.setItem(STORAGE_KEY_PREFIX + patId, JSON.stringify(this.activePlan()));
  }

  toggleMeal(mealId: string): void {
    this.activePlan.update((plan) => {
      const updatedMeals = plan.meals.map((m) => m.id === mealId ? { ...m, completed: !m.completed } : m);
      return { ...plan, meals: updatedMeals };
    });
    this.persist();
  }

  addWater(amountMl: number): void {
    this.activePlan.update((plan) => {
      const intake = Math.max(0, plan.waterIntakeMl + amountMl);
      return { ...plan, waterIntakeMl: intake };
    });
    this.persist();
  }

  addRestriction(): void {
    if (!this.newRestriction.trim()) return;
    this.activePlan.update((plan) => {
      const rest = [...plan.restrictions, this.newRestriction.trim()];
      return { ...plan, restrictions: rest };
    });
    this.newRestriction = '';
    this.persist();
    this.toast.success('Dietary restriction updated.');
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Diet';
  }
}
