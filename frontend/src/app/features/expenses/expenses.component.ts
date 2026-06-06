import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent, CvBadgeTone } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvAvatarComponent } from '../../shared/components/cv-avatar/cv-avatar.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS } from '../../core/models/role.model';
import { AuthService } from '../../core/services/auth.service';
import { MOCK_USERS, User } from '../../core/models/user.model';

// -- Data Models --
export interface ExpenseEntry {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  paidBy: string; // userId
  splitWith: string[]; // userIds
}

export type ExpenseCategory = 'Medical Supplies' | 'Medication' | 'Transportation' | 'Equipment' | 'Food' | 'Other';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Medical Supplies', 'Medication', 'Transportation', 'Equipment', 'Food', 'Other',
];

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  'Medical Supplies': '🏥',
  'Medication': '💊',
  'Transportation': '🚗',
  'Equipment': '🔧',
  'Food': '🍽️',
  'Other': '📦',
};

const CATEGORY_TONE: Record<ExpenseCategory, CvBadgeTone> = {
  'Medical Supplies': 'info',
  'Medication': 'danger',
  'Transportation': 'warning',
  'Equipment': 'neutral',
  'Food': 'success',
  'Other': 'primary',
};

// -- Seed Data --
function seedExpenses(): ExpenseEntry[] {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
  const members = ['u-fam1', 'u-nurse1', 'u-admin', 'u-nurse2'];
  return [
    { id: 'exp-1', description: 'Blood pressure monitor', amount: 89.99, category: 'Equipment', date: daysAgo(2), paidBy: 'u-fam1', splitWith: ['u-fam1'] },
    { id: 'exp-2', description: 'Prescription co-pay', amount: 35.00, category: 'Medication', date: daysAgo(3), paidBy: 'u-fam1', splitWith: ['u-fam1', 'u-admin'] },
    { id: 'exp-3', description: 'Uber to appointment', amount: 24.50, category: 'Transportation', date: daysAgo(4), paidBy: 'u-nurse1', splitWith: ['u-fam1', 'u-admin'] },
    { id: 'exp-4', description: 'Gauze pads (box)', amount: 12.99, category: 'Medical Supplies', date: daysAgo(5), paidBy: 'u-admin', splitWith: ['u-admin'] },
    { id: 'exp-5', description: 'Grocery delivery', amount: 67.30, category: 'Food', date: daysAgo(6), paidBy: 'u-fam1', splitWith: ['u-fam1', 'u-nurse1', 'u-admin'] },
    { id: 'exp-6', description: 'Wheelchair cushion', amount: 45.00, category: 'Equipment', date: daysAgo(8), paidBy: 'u-nurse2', splitWith: ['u-fam1', 'u-admin'] },
    { id: 'exp-7', description: 'Latex gloves (case)', amount: 28.50, category: 'Medical Supplies', date: daysAgo(9), paidBy: 'u-admin', splitWith: ['u-admin'] },
    { id: 'exp-8', description: 'Prescription ointment', amount: 55.00, category: 'Medication', date: daysAgo(10), paidBy: 'u-fam1', splitWith: ['u-fam1', 'u-admin', 'u-nurse1'] },
    { id: 'exp-9', description: 'Gas reimbursement', amount: 18.75, category: 'Transportation', date: daysAgo(11), paidBy: 'u-nurse1', splitWith: ['u-fam1', 'u-admin'] },
    { id: 'exp-10', description: 'Meal prep containers', amount: 22.00, category: 'Food', date: daysAgo(13), paidBy: 'u-fam1', splitWith: ['u-fam1'] },
  ];
}

export interface Settlement {
  id: string;
  expenseId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  settledAt: string;
}

function seedSettlements(): Settlement[] {
  return [
    { id: 'stl-1', expenseId: 'exp-2', fromUserId: 'u-admin', toUserId: 'u-fam1', amount: 17.50, settledAt: new Date(Date.now() - 1 * 86_400_000).toISOString() },
  ];
}

@Component({
  selector: 'cv-expenses',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, CurrencyPipe,
    CvCardComponent, CvBadgeComponent, CvButtonComponent,
    CvModalComponent, CvStatTileComponent, CvAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">expenses</cv-badge>
          <cv-badge [tone]="'neutral'">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {{ title() }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Expense splitting ledger — track shared expenses, split costs, and settle balances.
        </p>
      </header>

      <!-- Ledger Summary -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <cv-stat-tile
          label="Total Expenses"
          [value]="(totalExpenses() | currency:'USD':'symbol':'1.2-2') ?? ''"
          tone="primary"
          icon="💰"
        ></cv-stat-tile>
        <cv-stat-tile
          label="Your Share"
          [value]="(myShare() | currency:'USD':'symbol':'1.2-2') ?? ''"
          tone="warning"
          icon="💳"
        ></cv-stat-tile>
        <cv-stat-tile
          label="You Owe"
          [value]="(youOwe() | currency:'USD':'symbol':'1.2-2') ?? ''"
          tone="danger"
          icon="📤"
        ></cv-stat-tile>
        <cv-stat-tile
          label="You Are Owed"
          [value]="(youAreOwed() | currency:'USD':'symbol':'1.2-2') ?? ''"
          tone="success"
          icon="📥"
        ></cv-stat-tile>
      </div>

      <!-- Settled Amount -->
      <div class="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/60 dark:border-slate-800 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg class="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <div>
              <p class="text-sm font-medium text-slate-900 dark:text-slate-50">Settled Amount</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ settlements().length }} settlements completed</p>
            </div>
          </div>
          <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {{ settledAmount() | currency:'USD':'symbol':'1.2-2' }}
          </p>
        </div>
      </div>

      <!-- Split Calculator -->
      <cv-card title="Split Calculator" subtitle="Calculate fair shares for a new expense">
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
              <input
                type="text"
                [ngModel]="splitDesc()"
                (ngModelChange)="splitDesc.set($event)"
                placeholder="e.g. Grocery run"
                class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amount ($)</label>
              <input
                type="number"
                [ngModel]="splitAmount()"
                (ngModelChange)="splitAmount.set($event)"
                placeholder="0.00"
                min="0"
                step="0.01"
                class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <!-- Select Family Members -->
          <div>
            <label class="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Split with</label>
            <div class="flex flex-wrap gap-2">
              @for (member of familyMembers(); track member.id) {
                <button
                  type="button"
                  (click)="toggleSplitMember(member.id)"
                  class="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all border"
                  [ngClass]="splitMembers().includes(member.id)
                    ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'"
                >
                  <cv-avatar [name]="member.name" [size]="'xs'" [role]="member.role"></cv-avatar>
                  {{ member.name }}
                </button>
              }
            </div>
          </div>

          <!-- Split Result -->
          @if (splitMembers().length > 0 && splitAmount() > 0) {
            <div class="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2">
              <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Split Breakdown</p>
              @let perPerson = splitAmount() / splitMembers().length;
              @for (memberId of splitMembers(); track memberId) {
                @let member = getMemberById(memberId);
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <cv-avatar [name]="member?.name ?? memberId" [size]="'xs'" [role]="member?.role"></cv-avatar>
                    <span class="text-slate-700 dark:text-slate-200">{{ member?.name ?? memberId }}</span>
                    @if (memberId === currentUserId()) {
                      <cv-badge tone="primary">You</cv-badge>
                    }
                  </div>
                  <span class="font-mono font-semibold text-slate-900 dark:text-slate-50">
                    {{ perPerson | currency:'USD':'symbol':'1.2-2' }}
                  </span>
                </div>
              }
            </div>
          }

          <div class="flex justify-end gap-2">
            <cv-button variant="ghost" size="sm" (click)="resetSplit()">Reset</cv-button>
            <cv-button variant="primary" size="sm" (click)="addExpense()" [disabled]="splitDesc().length === 0 || splitAmount() <= 0 || splitMembers().length === 0">
              Add Expense
            </cv-button>
          </div>
        </div>
      </cv-card>

      <!-- Expense Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        @for (expense of expenses(); track expense.id) {
          <cv-card [title]="expense.description" [subtitle]="(expense.date | date:'MMM d, y') ?? ''" padding="md">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-lg">{{ categoryIcon(expense.category) }}</span>
                  <cv-badge [tone]="categoryTone(expense.category)">{{ expense.category }}</cv-badge>
                </div>
                <p class="text-lg font-bold text-slate-900 dark:text-slate-50">
                  {{ expense.amount | currency:'USD':'symbol':'1.2-2' }}
                </p>
              </div>

              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <span class="text-slate-500 dark:text-slate-400">Paid by</span>
                  @let payer = getMemberById(expense.paidBy);
                  <div class="flex items-center gap-1.5">
                    <cv-avatar [name]="payer?.name ?? expense.paidBy" [size]="'xs'" [role]="payer?.role"></cv-avatar>
                    <span class="text-slate-700 dark:text-slate-200 font-medium">{{ payer?.name ?? expense.paidBy }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-slate-500 dark:text-slate-400">Split {{ expense.splitWith.length }} ways</span>
                  <div class="flex -space-x-1">
                    @for (sid of expense.splitWith.slice(0, 3); track sid) {
                      @let sm = getMemberById(sid);
                      <cv-avatar [name]="sm?.name ?? sid" [size]="'xs'" [role]="sm?.role"></cv-avatar>
                    }
                    @if (expense.splitWith.length > 3) {
                      <div class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-medium text-slate-500 dark:text-slate-400 ring-2 ring-white dark:ring-slate-900">
                        +{{ expense.splitWith.length - 3 }}
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Balance Info -->
              @if (expense.splitWith.length > 1) {
                @let share = expense.amount / expense.splitWith.length;
                @let isPayer = expense.paidBy === currentUserId();
                @let myShareVal = isPayer ? expense.amount - share : 0;
                @let iOwe = !isPayer && expense.splitWith.includes(currentUserId()) ? share : 0;
                <div class="flex items-center gap-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                  @if (isPayer) {
                    <span class="text-emerald-600 dark:text-emerald-400">
                      Owed {{ myShareVal | currency:'USD':'symbol':'1.2-2' }} from others
                    </span>
                  } @else if (expense.splitWith.includes(currentUserId())) {
                    <span class="text-amber-600 dark:text-amber-400">
                      You owe {{ iOwe | currency:'USD':'symbol':'1.2-2' }}
                    </span>
                  }
                  <span class="text-slate-400">·</span>
                  <span class="text-slate-500 dark:text-slate-400">per person: {{ share | currency:'USD':'symbol':'1.2-2' }}</span>
                </div>
              }
            </div>
          </cv-card>
        } @empty {
          <div class="col-span-2 text-center py-12 text-slate-500 dark:text-slate-400">
            No expenses recorded.
          </div>
        }
      </div>

      <!-- Settlement History -->
      @if (settlements().length > 0) {
        <cv-card title="Settlement History" subtitle="Past settled payments">
          <div class="space-y-3">
            @for (stl of settlements(); track stl.id) {
              @let from = getMemberById(stl.fromUserId);
              @let to = getMemberById(stl.toUserId);
              <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div class="flex items-center gap-2 text-sm">
                  <cv-avatar [name]="from?.name ?? stl.fromUserId" [size]="'xs'" [role]="from?.role"></cv-avatar>
                  <span class="text-slate-700 dark:text-slate-200">{{ from?.name ?? stl.fromUserId }}</span>
                  <svg class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                  <cv-avatar [name]="to?.name ?? stl.toUserId" [size]="'xs'" [role]="to?.role"></cv-avatar>
                  <span class="text-slate-700 dark:text-slate-200">{{ to?.name ?? stl.toUserId }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-semibold text-emerald-600 dark:text-emerald-400">
                    {{ stl.amount | currency:'USD':'symbol':'1.2-2' }}
                  </span>
                  <span class="text-xs text-slate-400">{{ stl.settledAt | date:'MMM d' }}</span>
                </div>
              </div>
            }
          </div>
        </cv-card>
      }

      <!-- Mark as Settled -->
      <cv-card title="Settle Up" subtitle="Mark balances as settled">
        <div class="flex flex-wrap gap-3">
          @for (debt of debts(); track debt.toUserId) {
            @let toUser = getMemberById(debt.toUserId);
            <div class="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
              <cv-avatar [name]="toUser?.name ?? debt.toUserId" [size]="'sm'" [role]="toUser?.role"></cv-avatar>
              <div>
                <p class="text-sm font-medium text-slate-900 dark:text-slate-50">Pay {{ toUser?.name ?? debt.toUserId }}</p>
                <p class="text-xs font-mono text-slate-500 dark:text-slate-400">{{ debt.amount | currency:'USD':'symbol':'1.2-2' }}</p>
              </div>
              <cv-button variant="success" size="sm" (click)="settleDebt(debt.toUserId)">
                Settle
              </cv-button>
            </div>
          } @empty {
            <p class="text-sm text-slate-500 dark:text-slate-400">No outstanding debts — all settled up!</p>
          }
        </div>
      </cv-card>

      <!-- Settle Confirmation -->
      <cv-modal
        [open]="showSettleModal()"
        title="Confirm Settlement"
        size="sm"
        [hasFooter]="true"
        (closed)="showSettleModal.set(false)"
      >
        @if (settleTarget(); as targetId) {
          @let target = getMemberById(targetId);
          @let debt = getDebtTo(targetId);
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Mark <strong>{{ debt | currency:'USD':'symbol':'1.2-2' }}</strong> as settled with
            <strong>{{ target?.name ?? targetId }}</strong>?
          </p>
        }
        <ng-container cv-modal-footer>
          <cv-button variant="ghost" size="sm" (click)="showSettleModal.set(false)">Cancel</cv-button>
          <cv-button variant="success" size="sm" (click)="confirmSettle(); showSettleModal.set(false)">
            Confirm Settlement
          </cv-button>
        </ng-container>
      </cv-modal>

      <!-- Toast Notification -->
      @if (showToast()) {
        <div class="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div class="rounded-xl bg-emerald-600 text-white px-5 py-3 shadow-lg flex items-center gap-3 text-sm">
            <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>{{ toastMessage() }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @keyframes slide-up {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-slide-up {
        animation: slide-up 300ms ease-out;
      }
    `,
  ],
})
export class ExpensesComponent {
  private readonly role = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  // -- State --
  readonly currentUser = this.auth.currentUser;
  readonly currentUserId = computed(() => this.currentUser().id);

  readonly expenses = signal<ExpenseEntry[]>(seedExpenses());
  readonly settlements = signal<Settlement[]>(seedSettlements());

  readonly showSettleModal = signal(false);
  readonly settleTarget = signal<string | null>(null);
  readonly showToast = signal(false);
  readonly toastMessage = signal('');

  // Split calculator form
  readonly splitDesc = signal('');
  readonly splitAmount = signal<number>(0);
  readonly splitMembers = signal<string[]>([]);

  // -- Computed --
  readonly familyMembers = computed(() => {
    return MOCK_USERS.filter((u) => u.role === 'family' || u.role === 'admin' || u.role === 'nurse' || u.role === 'billing');
  });

  readonly totalExpenses = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount, 0)
  );

  readonly myShare = computed(() => {
    return this.expenses().reduce((sum, e) => {
      if (e.splitWith.includes(this.currentUserId())) {
        return sum + e.amount / e.splitWith.length;
      }
      return sum;
    }, 0);
  });

  readonly youOwe = computed(() => {
    return this.expenses()
      .filter((e) => e.splitWith.includes(this.currentUserId()) && e.paidBy !== this.currentUserId())
      .reduce((sum, e) => sum + e.amount / e.splitWith.length, 0);
  });

  readonly youAreOwed = computed(() => {
    return this.expenses()
      .filter((e) => e.paidBy === this.currentUserId() && e.splitWith.length > 1)
      .reduce((sum, e) => sum + (e.amount - e.amount / e.splitWith.length), 0);
  });

  readonly settledAmount = computed(() =>
    this.settlements()
      .filter((s) => s.fromUserId === this.currentUserId() || s.toUserId === this.currentUserId())
      .reduce((sum, s) => sum + s.amount, 0)
  );

  readonly debts = computed(() => {
    const debtsMap = new Map<string, number>();
    for (const expense of this.expenses()) {
      if (expense.paidBy === this.currentUserId()) continue;
      if (!expense.splitWith.includes(this.currentUserId())) continue;
      const share = expense.amount / expense.splitWith.length;
      // Check if already settled
      const alreadySettled = this.settlements().some(
        (s) => s.fromUserId === this.currentUserId() && s.toUserId === expense.paidBy && Math.abs(s.amount - share) < 0.01
      );
      if (!alreadySettled) {
        debtsMap.set(expense.paidBy, (debtsMap.get(expense.paidBy) ?? 0) + share);
      }
    }
    return Array.from(debtsMap.entries()).map(([toUserId, amount]) => ({ toUserId, amount }));
  });

  // -- Methods --
  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Expenses';
  }

  getMemberById(id: string): User | undefined {
    return MOCK_USERS.find((u) => u.id === id);
  }

  categoryIcon(cat: ExpenseCategory): string {
    return CATEGORY_ICONS[cat] ?? '📦';
  }

  categoryTone(cat: ExpenseCategory): CvBadgeTone {
    return CATEGORY_TONE[cat] ?? 'neutral';
  }

  toggleSplitMember(id: string): void {
    this.splitMembers.update((list) => {
      if (list.includes(id)) return list.filter((m) => m !== id);
      return [...list, id];
    });
  }

  resetSplit(): void {
    this.splitDesc.set('');
    this.splitAmount.set(0);
    this.splitMembers.set([]);
  }

  addExpense(): void {
    if (!this.splitDesc().trim() || this.splitAmount() <= 0 || this.splitMembers().length === 0) return;

    const newExpense: ExpenseEntry = {
      id: `exp-${Date.now()}`,
      description: this.splitDesc().trim(),
      amount: this.splitAmount(),
      category: 'Other',
      date: new Date().toISOString(),
      paidBy: this.currentUserId(),
      splitWith: [...this.splitMembers()],
    };

    this.expenses.update((list) => [newExpense, ...list]);
    this.showToastMessage('Expense added successfully!');
    this.resetSplit();
  }

  settleDebt(toUserId: string): void {
    this.settleTarget.set(toUserId);
    this.showSettleModal.set(true);
  }

  getDebtTo(toUserId: string): number {
    return this.debts().find((d) => d.toUserId === toUserId)?.amount ?? 0;
  }

  confirmSettle(): void {
    const targetId = this.settleTarget();
    if (!targetId) return;

    const amount = this.getDebtTo(targetId);
    if (amount <= 0) return;

    const settlement: Settlement = {
      id: `stl-${Date.now()}`,
      expenseId: '',
      fromUserId: this.currentUserId(),
      toUserId: targetId,
      amount,
      settledAt: new Date().toISOString(),
    };

    this.settlements.update((list) => [...list, settlement]);
    this.settleTarget.set(null);
    this.showToastMessage(`Settled ${amount.toFixed(2)} with ${this.getMemberById(targetId)?.name ?? targetId}`);
  }

  private showToastMessage(msg: string): void {
    this.toastMessage.set(msg);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3000);
  }
}
