import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent, CvBadgeTone } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvProgressRingComponent } from '../../shared/components/cv-progress-ring/cv-progress-ring.component';
import { SyncService, SyncState } from '../../core/services/sync.service';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS } from '../../core/models/role.model';

interface SyncLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  entity: string;
  status: 'synced' | 'pending' | 'failed';
  data?: string;
}

interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  timestamp: Date;
  retries: number;
}

const STATE_CONFIG: Record<SyncState, { label: string; tone: CvBadgeTone; icon: string; description: string; color: string }> = {
  online: {
    label: 'Online',
    tone: 'success',
    icon: '✓',
    description: 'All data is synchronized with the server. Changes are saved in real-time.',
    color: 'bg-emerald-500',
  },
  syncing: {
    label: 'Syncing',
    tone: 'warning',
    icon: '⟳',
    description: 'Currently uploading pending changes to the server. Please wait...',
    color: 'bg-amber-500',
  },
  offline: {
    label: 'Offline',
    tone: 'danger',
    icon: '✕',
    description: 'Network connection lost. Changes are being saved locally and will sync when back online.',
    color: 'bg-rose-500',
  },
};

const MOCK_SYNC_LOG: SyncLogEntry[] = [
  { id: 'log-1', timestamp: new Date(Date.now() - 300000), action: 'Update', entity: 'Vitals Record', status: 'synced' },
  { id: 'log-2', timestamp: new Date(Date.now() - 600000), action: 'Create', entity: 'Medication MAR', status: 'synced' },
  { id: 'log-3', timestamp: new Date(Date.now() - 900000), action: 'Update', entity: 'Task Assignment', status: 'synced' },
  { id: 'log-4', timestamp: new Date(Date.now() - 1200000), action: 'Delete', entity: 'Incident Report', status: 'synced' },
  { id: 'log-5', timestamp: new Date(Date.now() - 1800000), action: 'Create', entity: 'Chat Message', status: 'synced' },
  { id: 'log-6', timestamp: new Date(Date.now() - 2400000), action: 'Update', entity: 'Patient Profile', status: 'synced' },
  { id: 'log-7', timestamp: new Date(Date.now() - 3600000), action: 'Create', entity: 'Handover Note', status: 'synced' },
  { id: 'log-8', timestamp: new Date(Date.now() - 5400000), action: 'Update', entity: 'Shift Clock', status: 'synced' },
];

@Component({
  selector: 'cv-sync',
  standalone: true,
  imports: [
    CommonModule, CvCardComponent, CvBadgeComponent, CvButtonComponent,
    CvStatTileComponent, CvProgressRingComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Offline Banner -->
    @if (syncService.state() === 'offline') {
      <div class="fixed top-0 left-0 right-0 z-50 bg-rose-600 text-white px-4 py-2 text-center text-sm font-medium shadow-lg animate-pulse">
        ⚠️ You are currently offline. Changes are being saved locally.
      </div>
    }

    <div class="flex flex-col gap-6" [class.pt-12]="syncService.state() === 'offline'">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">sync</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Data Sync & Offline Mode
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Monitor sync status, manage offline data, and simulate network conditions for safe-mode testing.
        </p>
      </header>

      <!-- Status Banner -->
      <div
        class="relative overflow-hidden rounded-2xl border p-6"
        [ngClass]="{
          'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10': syncService.state() === 'online',
          'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10': syncService.state() === 'syncing',
          'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10': syncService.state() === 'offline'
        }"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white text-xl font-bold"
            [ngClass]="stateConfig().color"
          >
            {{ stateConfig().icon }}
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {{ stateConfig().label }}
              </h2>
              <cv-badge [tone]="stateConfig().tone" [dot]="true">{{ stateConfig().label }}</cv-badge>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">{{ stateConfig().description }}</p>
          </div>
        </div>

        <!-- Connection quality indicator -->
        <div class="mt-4 flex items-center gap-3">
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Signal:</span>
          <div class="flex gap-1">
            @for (bar of [1,2,3,4,5]; track bar) {
              <div
                class="w-2 rounded-full transition-all"
                [style.height.px]="4 + bar * 2"
                [ngClass]="signalBars() >= bar ? stateConfig().color : 'bg-slate-200 dark:bg-slate-700'"
              ></div>
            }
          </div>
          <span class="text-xs text-slate-500 dark:text-slate-400">{{ signalLabel() }}</span>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <cv-stat-tile
          label="Pending Changes"
          [value]="pendingChanges().length"
          [tone]="pendingChanges().length > 0 ? 'warning' : 'success'"
          icon="📤"
        ></cv-stat-tile>
        <cv-stat-tile
          label="Failed Syncs"
          [value]="failedCount()"
          [tone]="failedCount() > 0 ? 'danger' : 'success'"
          icon="❌"
        ></cv-stat-tile>
        <cv-stat-tile
          label="Last Sync"
          [value]="lastSyncLabel()"
          tone="info"
          icon="🕐"
        ></cv-stat-tile>
        <cv-stat-tile
          label="Storage Used"
          [value]="storageUsed()"
          tone="primary"
          icon="💾"
        ></cv-stat-tile>
      </div>

      <!-- Controls -->
      <cv-card title="Network Simulator" subtitle="Toggle network conditions to test offline safe-mode">
        <div class="space-y-4">
          <div class="flex flex-wrap gap-3">
            <cv-button
              variant="primary"
              size="sm"
              [disabled]="syncService.state() === 'offline'"
              (click)="syncService.toggleOffline()"
            >
              <span class="mr-1">📴</span> Go Offline
            </cv-button>
            <cv-button
              variant="success"
              size="sm"
              [disabled]="syncService.state() !== 'offline'"
              (click)="syncService.toggleOffline()"
            >
              <span class="mr-1">📶</span> Go Online
            </cv-button>
            <cv-button
              variant="ghost"
              size="sm"
              [disabled]="syncService.state() !== 'syncing'"
              (click)="syncService.cycle()"
            >
              <span class="mr-1">⟳</span> Complete Sync
            </cv-button>
            <cv-button
              variant="ghost"
              size="sm"
              (click)="simulateNetworkLoss()"
            >
              <span class="mr-1">⚡</span> Simulate Outage (3s)
            </cv-button>
          </div>

          <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300">
            <svg class="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Toggle offline mode to see how CareVibe stores data locally. Pending changes will appear below and sync automatically when you reconnect.</span>
          </div>
        </div>
      </cv-card>

      <!-- Pending Changes Queue -->
      <cv-card title="Pending Changes Queue" [subtitle]="pendingChanges().length + ' items waiting to sync'">
        @if (pendingChanges().length > 0) {
          <div class="space-y-2">
            @for (change of pendingChanges(); track change.id) {
              <div class="flex items-center justify-between p-3 rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-500/5">
                <div class="flex items-center gap-3">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    [ngClass]="{
                      'bg-emerald-500': change.type === 'create',
                      'bg-amber-500': change.type === 'update',
                      'bg-rose-500': change.type === 'delete'
                    }"
                  >
                    {{ change.type === 'create' ? '+' : change.type === 'update' ? '✎' : '−' }}
                  </span>
                  <div>
                    <p class="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {{ change.type | titlecase }} {{ change.entity }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      ID: {{ change.entityId }} · {{ formatTime(change.timestamp) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  @if (change.retries > 0) {
                    <cv-badge tone="warning">Retry {{ change.retries }}</cv-badge>
                  }
                  <cv-badge tone="warning" [dot]="true">Pending</cv-badge>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="flex flex-col items-center justify-center py-8 text-center">
            <div class="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mb-3">
              <svg class="h-6 w-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <p class="text-sm font-medium text-slate-700 dark:text-slate-200">All caught up!</p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">No pending changes to sync.</p>
          </div>
        }
      </cv-card>

      <!-- Local Storage Safety -->
      <cv-card title="Local Storage Safe-mode" subtitle="Data stored locally when offline">
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-xl border border-slate-200/60 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">📋</span>
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Vitals Cache</span>
              </div>
              <p class="text-2xl font-bold text-slate-900 dark:text-slate-50">12</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">records cached</p>
            </div>
            <div class="rounded-xl border border-slate-200/60 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">💬</span>
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Messages</span>
              </div>
              <p class="text-2xl font-bold text-slate-900 dark:text-slate-50">5</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">unsent messages</p>
            </div>
            <div class="rounded-xl border border-slate-200/60 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">✅</span>
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Task Updates</span>
              </div>
              <p class="text-2xl font-bold text-slate-900 dark:text-slate-50">3</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">pending updates</p>
            </div>
          </div>

          <div class="rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-500/5 p-4">
            <div class="flex items-start gap-3">
              <svg class="h-5 w-5 mt-0.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <div>
                <p class="text-sm font-medium text-emerald-700 dark:text-emerald-300">Data Integrity Protected</p>
                <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  All locally stored data is encrypted and versioned. When connectivity is restored, changes merge conflict-free using operational transformation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </cv-card>

      <!-- Sync Log -->
      <cv-card title="Recent Sync Activity" subtitle="History of synced operations">
        <div class="space-y-2">
          @for (entry of syncLog; track entry.id) {
            <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div class="flex items-center gap-3">
                <span
                  class="h-2 w-2 rounded-full shrink-0"
                  [ngClass]="{
                    'bg-emerald-500': entry.status === 'synced',
                    'bg-amber-500': entry.status === 'pending',
                    'bg-rose-500': entry.status === 'failed'
                  }"
                ></span>
                <span class="text-sm text-slate-700 dark:text-slate-200">
                  <span class="font-medium">{{ entry.action }}</span> {{ entry.entity }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <cv-badge
                  [tone]="entry.status === 'synced' ? 'success' : entry.status === 'pending' ? 'warning' : 'danger'"
                >{{ entry.status }}</cv-badge>
                <span class="text-xs text-slate-400 dark:text-slate-500">{{ formatTime(entry.timestamp) }}</span>
              </div>
            </div>
          }
        </div>
      </cv-card>
    </div>
  `,
})
export class SyncComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly role = inject(RoleService);
  readonly syncService = inject(SyncService);

  readonly syncLog = MOCK_SYNC_LOG;

  private readonly _pendingChanges = signal<PendingChange[]>([]);
  readonly pendingChanges = this._pendingChanges.asReadonly();

  readonly stateConfig = computed(() => STATE_CONFIG[this.syncService.state()]);

  readonly signalBars = computed(() => {
    const state = this.syncService.state();
    if (state === 'online') return 5;
    if (state === 'syncing') return 3;
    return 1;
  });

  readonly signalLabel = computed(() => {
    const state = this.syncService.state();
    if (state === 'online') return 'Strong';
    if (state === 'syncing') return 'Weak';
    return 'No signal';
  });

  readonly failedCount = signal(0);

  readonly lastSyncLabel = computed(() => {
    const last = this.syncService.lastSync();
    if (!last) return 'Never';
    const diff = Date.now() - new Date(last).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    return Math.floor(diff / 3600000) + 'h ago';
  });

  readonly storageUsed = computed(() => {
    const pending = this.syncService.pendingChanges();
    const baseKB = 142;
    return (baseKB + pending * 12) + ' KB';
  });

  constructor() {
    // When toggling to offline, generate pending changes
    effect(() => {
      const state = this.syncService.state();
      if (state === 'offline') {
        this.generatePendingChanges();
      } else {
        this._pendingChanges.set([]);
      }
    });
  }

  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  formatTime(date: Date): string {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    return Math.floor(diff / 3600000) + 'h ago';
  }

  simulateNetworkLoss(): void {
    this.syncService.toggleOffline();
    setTimeout(() => {
      this.syncService.toggleOffline();
    }, 3000);
  }

  private generatePendingChanges(): void {
    const types: PendingChange['type'][] = ['create', 'update', 'delete'];
    const entities = ['Vitals Record', 'Chat Message', 'Task Update', 'Medication Log', 'Incident Report'];
    const changes: PendingChange[] = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, (_, i) => ({
      id: `pc-${Date.now()}-${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      entity: entities[Math.floor(Math.random() * entities.length)],
      entityId: `entity-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date(),
      retries: 0,
    }));
    this._pendingChanges.set(changes);
    for (let i = 0; i < changes.length; i++) {
      this.syncService.enqueue();
    }
  }
}