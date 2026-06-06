export type AuditAction =
  | 'login'
  | 'logout'
  | 'role-switch'
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'sign'
  | 'export'
  | 'sync';

export interface AuditEntry {
  id: string;
  ts: string;          // ISO
  action: AuditAction;
  userId: string;
  userName: string;
  resource: string;    // e.g. 'patient:pat-3'
  meta?: Record<string, string | number | boolean | null>;
  ip?: string;
}
