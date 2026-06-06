export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'low' | 'med' | 'high' | 'urgent';

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee: string;          // userId
  patientId?: string;
  due: string;               // ISO
  priority: TaskPriority;
  tags: string[];
  estimateMin?: number;
  actualMin?: number;
  createdBy: string;
  createdAt: string;
  subtasks?: { id: string; title: string; done: boolean }[];
}
