import { Injectable, computed, signal } from '@angular/core';
import { KanbanTask, TaskStatus } from '../models/task.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly _tasks = signal<KanbanTask[]>([]);
  readonly tasks = this._tasks.asReadonly();

  readonly byStatus = computed<Record<TaskStatus, KanbanTask[]>>(() => {
    const out: Record<TaskStatus, KanbanTask[]> = { todo: [], doing: [], done: [] };
    for (const t of this._tasks()) out[t.status].push(t);
    return out;
  });

  readonly myTasks = computed<KanbanTask[]>(() => {
    const me = this.auth.currentUser();
    return this._tasks().filter((t) => t.assignee === me.id);
  });

  readonly overdue = computed<KanbanTask[]>(() =>
    this._tasks().filter((t) => t.status !== 'done' && new Date(t.due).getTime() < Date.now()),
  );

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {
    this.load();
  }

  load(): void {
    this.http.get<KanbanTask[]>(`${API_BASE_URL}/tasks`).subscribe({
      next: (data) => this._tasks.set(data),
      error: (err) => console.error('Failed to load tasks', err),
    });
  }

  setStatus(id: string, status: TaskStatus): void {
    const task = this._tasks().find(t => t.id === id);
    if (!task) return;

    // Optimistic Update
    this._tasks.update((l) => l.map((t) => (t.id === id ? { ...t, status } : t)));

    this.http.put<KanbanTask>(`${API_BASE_URL}/tasks/${id}`, { status }).subscribe({
      next: (updated) => {
        this._tasks.update((l) => l.map((t) => (t.id === id ? updated : t)));
      },
      error: (err) => {
        console.error('Failed to update task status', err);
        // Rollback
        this._tasks.update((l) => l.map((t) => (t.id === id ? { ...t, status: task.status } : t)));
      }
    });

    const user = this.auth.currentUser();
    this.audit.log('update', { id: user.id, name: user.name }, `task:${id}`, { status });
  }

  add(input: Omit<KanbanTask, 'id' | 'createdAt' | 'createdBy'>): KanbanTask {
    const user = this.auth.currentUser();
    const tempId = `tsk-${Date.now()}`;
    const task: KanbanTask = { ...input, id: tempId, createdAt: new Date().toISOString(), createdBy: user.id };

    // Optimistic Update
    this._tasks.update((l) => [task, ...l]);

    const payload = {
      ...input,
      createdBy: user.id
    };

    this.http.post<KanbanTask>(`${API_BASE_URL}/tasks`, payload).subscribe({
      next: (saved) => {
        this._tasks.update((l) => l.map((t) => (t.id === tempId ? saved : t)));
      },
      error: (err) => {
        console.error('Failed to create task', err);
        // Rollback
        this._tasks.update((l) => l.filter((t) => t.id !== tempId));
      }
    });

    this.audit.log('create', { id: user.id, name: user.name }, `task:${task.id}`, { title: task.title });
    return task;
  }

  remove(id: string): void {
    this._tasks.update((l) => l.filter((t) => t.id !== id));
    this.http.delete(`${API_BASE_URL}/tasks/${id}`).subscribe({
      error: (err) => console.error('Failed to delete task', err),
    });
  }
}
