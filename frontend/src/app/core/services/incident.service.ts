import { Injectable, computed, signal } from '@angular/core';
import { Incident, IncidentStatus } from '../models/incident.model';
import { MockDataService } from './mock-data.service';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly _incidents = signal<Incident[]>([]);
  readonly incidents = this._incidents.asReadonly();

  readonly open = computed<Incident[]>(() => this._incidents().filter((i) => i.status !== 'closed'));
  readonly critical = computed<Incident[]>(() => this._incidents().filter((i) => i.severity === 'critical' || i.severity === 'high'));

  constructor(
    private readonly mock: MockDataService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {
    this._incidents.set(this.mock.incidents());
  }

  setStatus(id: string, status: IncidentStatus): void {
    this._incidents.update((l) =>
      l.map((i) => (i.id === id ? { ...i, status, closedAt: status === 'closed' ? new Date().toISOString() : undefined, closedBy: status === 'closed' ? this.auth.currentUser().id : undefined } : i)),
    );
    const user = this.auth.currentUser();
    this.audit.log('update', { id: user.id, name: user.name }, `incident:${id}`, { status });
  }

  add(input: Omit<Incident, 'id' | 'reportedAt' | 'reportedBy'>): Incident {
    const user = this.auth.currentUser();
    const inc: Incident = { ...input, id: `inc-${Date.now()}`, reportedAt: new Date().toISOString(), reportedBy: user.id };
    this._incidents.update((l) => [inc, ...l]);
    this.audit.log('create', { id: user.id, name: user.name }, `incident:${inc.id}`, { kind: inc.kind, severity: inc.severity });
    return inc;
  }
}
