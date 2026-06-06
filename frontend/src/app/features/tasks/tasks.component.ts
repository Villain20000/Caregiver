import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvAvatarComponent } from '../../shared/components/cv-avatar/cv-avatar.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { TaskService } from '../../core/services/task.service';
import { AuthService } from '../../core/services/auth.service';
import { MOCK_USERS } from '../../core/models/user.model';
import { KanbanTask, TaskPriority, TaskStatus } from '../../core/models/task.model';

type FilterState = { assignee: string; priority: string; tag: string };

interface NewTaskForm {
  title: string;
  priority: TaskPriority;
  assignee: string;
  due: string;
  tagsStr: string;
  description: string;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; tone: 'danger' | 'warning' | 'info' | 'neutral'; order: number }> = {
  urgent: { label: 'Urgent', tone: 'danger', order: 0 },
  high: { label: 'High', tone: 'warning', order: 1 },
  med: { label: 'Med', tone: 'info', order: 2 },
  low: { label: 'Low', tone: 'neutral', order: 3 },
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  doing: 'In Progress',
  done: 'Done',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'border-t-indigo-500',
  doing: 'border-t-amber-500',
  done: 'border-t-emerald-500',
};

function makeEmptyForm(): NewTaskForm {
  return {
    title: '',
    priority: 'med',
    assignee: '',
    due: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    tagsStr: '',
    description: '',
  };
}

@Component({
  selector: 'cv-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent, CvAvatarComponent, CvModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">tasks</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Tasks</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Manage and track care team tasks</p>
      </header>

      <!-- Filters row -->
      <div class="flex flex-wrap items-center gap-3">
        <select
          [ngModel]="filters().assignee"
          (ngModelChange)="onFilterChange('assignee', $event)"
          class="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5"
        >
          <option value="">All assignees</option>
          <option *ngFor="let u of users" [value]="u.id">{{ u.name }}</option>
        </select>

        <select
          [ngModel]="filters().priority"
          (ngModelChange)="onFilterChange('priority', $event)"
          class="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5"
        >
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="med">Med</option>
          <option value="low">Low</option>
        </select>

        <select
          [ngModel]="filters().tag"
          (ngModelChange)="onFilterChange('tag', $event)"
          class="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5"
        >
          <option value="">All tags</option>
          <option *ngFor="let t of allTags()" [value]="t">{{ t }}</option>
        </select>

        <button
          *ngIf="hasActiveFilters()"
          (click)="resetFilters()"
          class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Clear filters
        </button>

        <div class="ml-auto">
          <cv-button variant="primary" size="sm" (click)="openAddModal()">
            <span cv-btn-icon-left>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </span>
            Add Task
          </cv-button>
        </div>
      </div>

      <!-- Kanban columns -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ng-container *ngFor="let col of columns()">
          <section
            class="rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 flex flex-col"
            [ngClass]="'border-t-2 ' + col.border"
          >
            <div class="flex items-center justify-between px-4 pt-3 pb-2">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ col.label }}</h3>
                <cv-badge tone="neutral">{{ col.tasks.length }}</cv-badge>
              </div>
            </div>

            <div class="flex-1 p-3 space-y-3 min-h-[200px]">
              <div *ngIf="col.tasks.length === 0" class="flex flex-col items-center justify-center h-full py-12 text-center">
                <svg class="h-12 w-12 text-slate-300 dark:text-slate-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 8h6M9 12h6M9 16h4"/>
                </svg>
                <p class="text-sm text-slate-400 dark:text-slate-500">No tasks</p>
              </div>

              <div
                *ngFor="let task of col.tasks; trackBy: trackById"
                (click)="openDetail(task)"
                class="bg-white dark:bg-slate-800/80 rounded-xl p-3 shadow-sm border border-slate-200/60 dark:border-slate-700/60 cursor-pointer hover:shadow-md transition-all duration-150 hover:-translate-y-0.5"
              >
                <div *ngIf="isOverdue(task)" class="mb-1.5">
                  <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    OVERDUE
                  </span>
                </div>

                <p class="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2 line-clamp-2">{{ task.title }}</p>

                <div class="flex flex-wrap items-center gap-1.5 mb-2">
                  <cv-badge [tone]="priorityConfig[task.priority].tone">{{ priorityConfig[task.priority].label }}</cv-badge>
                  <span
                    *ngFor="let tag of task.tags"
                    class="inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  >
                    {{ tag }}
                  </span>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <cv-avatar [name]="userName(task.assignee)" size="xs"></cv-avatar>
                    <span class="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[80px]">{{ userName(task.assignee) }}</span>
                  </div>
                  <span class="text-[11px] text-slate-400 dark:text-slate-500" [ngClass]="isOverdue(task) ? 'text-rose-500 dark:text-rose-400 font-medium' : ''">
                    {{ task.due | date:'MMM d' }}
                  </span>
                </div>

                <div *ngIf="task.status !== 'done'" class="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                  <button
                    *ngIf="task.status !== 'todo'"
                    (click)="$event.stopPropagation(); moveTask(task, prevStatus(task.status))"
                    class="flex-1 text-[11px] py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    ← {{ STATUS_LABELS[prevStatus(task.status)] }}
                  </button>
                  <button
                    *ngIf="task.status !== 'doing'"
                    (click)="$event.stopPropagation(); moveTask(task, 'doing')"
                    class="flex-1 text-[11px] py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                  >
                    → In Progress
                  </button>
                  <button
                    (click)="$event.stopPropagation(); moveTask(task, 'done')"
                    class="flex-1 text-[11px] py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                  >
                    → Done
                  </button>
                </div>
              </div>
            </div>
          </section>
        </ng-container>
      </div>
    </div>

    <!-- Detail modal -->
    <cv-modal [open]="detailOpen()" title="Task Detail" size="lg" (closed)="closeDetail()" [hasFooter]="true">
      <ng-container *ngIf="selectedTask() as t">
        <div class="space-y-4">
          <div class="flex items-center gap-2 flex-wrap">
            <cv-badge [tone]="priorityConfig[t.priority].tone">{{ priorityConfig[t.priority].label }}</cv-badge>
            <cv-badge [tone]="t.status === 'done' ? 'success' : t.status === 'doing' ? 'warning' : 'neutral'">
              {{ STATUS_LABELS[t.status] }}
            </cv-badge>
            <span *ngIf="isOverdue(t)" class="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
              ⚠ OVERDUE
            </span>
          </div>

          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ t.title }}</h3>

          <p *ngIf="t.description" class="text-sm text-slate-600 dark:text-slate-300">{{ t.description }}</p>

          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="block text-xs text-slate-400 dark:text-slate-500 mb-0.5">Assignee</span>
              <div class="flex items-center gap-2">
                <cv-avatar [name]="userName(t.assignee)" size="sm"></cv-avatar>
                <span class="text-slate-700 dark:text-slate-200">{{ userName(t.assignee) }}</span>
              </div>
            </div>
            <div>
              <span class="block text-xs text-slate-400 dark:text-slate-500 mb-0.5">Due</span>
              <span class="text-slate-700 dark:text-slate-200">{{ t.due | date:'MMM d, yyyy h:mm a' }}</span>
            </div>
            <div *ngIf="t.patientId">
              <span class="block text-xs text-slate-400 dark:text-slate-500 mb-0.5">Patient</span>
              <span class="text-slate-700 dark:text-slate-200">{{ t.patientId }}</span>
            </div>
            <div *ngIf="t.estimateMin">
              <span class="block text-xs text-slate-400 dark:text-slate-500 mb-0.5">Est. time</span>
              <span class="text-slate-700 dark:text-slate-200">{{ t.estimateMin }} min</span>
            </div>
          </div>

          <div *ngIf="t.tags.length">
            <span class="block text-xs text-slate-400 dark:text-slate-500 mb-1.5">Tags</span>
            <div class="flex flex-wrap gap-1.5">
              <span
                *ngFor="let tag of t.tags"
                class="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >{{ tag }}</span>
            </div>
          </div>

          <div class="text-[11px] text-slate-400 dark:text-slate-500">
            Created {{ t.createdAt | date:'MMM d, yyyy' }} by {{ userName(t.createdBy) }}
          </div>
        </div>
      </ng-container>

      <ng-container cv-modal-footer>
        <div class="flex justify-between w-full">
          <cv-button variant="danger" size="sm" (click)="deleteTask(t.id)">Delete</cv-button>
          <cv-button variant="ghost" size="sm" (click)="closeDetail()">Close</cv-button>
        </div>
      </ng-container>
    </cv-modal>

    <!-- Add Task modal -->
    <cv-modal [open]="addOpen()" title="Add Task" size="md" (closed)="closeAdd()" [hasFooter]="true">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Title *</label>
          <input
            [ngModel]="form.title"
            (ngModelChange)="form.title = $event"
            class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            placeholder="Task title"
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Priority</label>
            <select
              [ngModel]="form.priority"
              (ngModelChange)="form.priority = $event"
              class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="med">Med</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Assignee</label>
            <select
              [ngModel]="form.assignee"
              (ngModelChange)="form.assignee = $event"
              class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2"
            >
              <option value="">Select...</option>
              <option *ngFor="let u of users" [value]="u.id">{{ u.name }}</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Due date</label>
          <input
            type="datetime-local"
            [ngModel]="form.due"
            (ngModelChange)="form.due = $event"
            class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Tags (comma-separated)</label>
          <input
            [ngModel]="form.tagsStr"
            (ngModelChange)="form.tagsStr = $event"
            class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2"
            placeholder="e.g. medication, safety"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Notes</label>
          <textarea
            [ngModel]="form.description"
            (ngModelChange)="form.description = $event"
            rows="3"
            class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 resize-none"
            placeholder="Optional description"
          ></textarea>
        </div>
      </div>

      <ng-container cv-modal-footer>
        <cv-button variant="ghost" size="sm" (click)="closeAdd()">Cancel</cv-button>
        <cv-button variant="primary" size="sm" [disabled]="!form.title.trim() || !form.assignee" (click)="submitAdd()">Create Task</cv-button>
      </ng-container>
    </cv-modal>
  `,
})
export class TasksComponent {
  private readonly taskService = inject(TaskService);
  private readonly auth = inject(AuthService);

  readonly priorityConfig = PRIORITY_CONFIG;
  readonly STATUS_LABELS = STATUS_LABELS;

  readonly filters = signal<FilterState>({ assignee: '', priority: '', tag: '' });
  readonly detailOpen = signal(false);
  readonly selectedTask = signal<KanbanTask | null>(null);
  readonly addOpen = signal(false);

  readonly users = MOCK_USERS.filter((u) => !['pat-1', 'u-fam1'].includes(u.id));

  form: NewTaskForm = makeEmptyForm();

  readonly allTags = computed<string[]>(() => {
    const set = new Set<string>();
    for (const t of this.taskService.tasks()) {
      for (const tag of t.tags) set.add(tag);
    }
    return [...set].sort();
  });

  readonly hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.assignee !== '' || f.priority !== '' || f.tag !== '';
  });

  readonly filteredTasks = computed(() => {
    const f = this.filters();
    let list = this.taskService.tasks();
    if (f.assignee) list = list.filter((t) => t.assignee === f.assignee);
    if (f.priority) list = list.filter((t) => t.priority === f.priority);
    if (f.tag) list = list.filter((t) => t.tags.includes(f.tag));
    return list;
  });

  readonly columns = computed(() => {
    const tasks = this.filteredTasks();
    return (['todo', 'doing', 'done'] as TaskStatus[]).map((status) => ({
      status,
      label: STATUS_LABELS[status],
      border: STATUS_COLORS[status],
      tasks: tasks
        .filter((t) => t.status === status)
        .sort((a, b) => PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order),
    }));
  });

  onFilterChange(key: keyof FilterState, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
  }

  isOverdue(task: KanbanTask): boolean {
    return task.status !== 'done' && new Date(task.due).getTime() < Date.now();
  }

  userName(userId: string): string {
    return MOCK_USERS.find((u) => u.id === userId)?.name ?? userId;
  }

  prevStatus(s: TaskStatus): TaskStatus {
    return s === 'done' ? 'doing' : 'todo';
  }

  moveTask(task: KanbanTask, status: TaskStatus): void {
    this.taskService.setStatus(task.id, status);
  }

  openDetail(task: KanbanTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.selectedTask.set(null);
  }

  deleteTask(id: string): void {
    if (confirm('Are you sure you want to delete this task?')) {
      this.taskService.remove(id);
      this.closeDetail();
    }
  }

  openAddModal(): void {
    this.form = makeEmptyForm();
    this.form.assignee = this.auth.currentUser()?.id ?? '';
    this.addOpen.set(true);
  }

  closeAdd(): void {
    this.addOpen.set(false);
  }

  submitAdd(): void {
    const f = this.form;
    if (!f.title.trim() || !f.assignee) return;
    this.taskService.add({
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      status: 'todo',
      assignee: f.assignee,
      due: new Date(f.due).toISOString(),
      priority: f.priority,
      tags: f.tagsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    this.closeAdd();
  }

  resetFilters(): void {
    this.filters.set({ assignee: '', priority: '', tag: '' });
  }

  trackById(_i: number, t: KanbanTask): string {
    return t.id;
  }
}
