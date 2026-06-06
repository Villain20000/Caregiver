import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService, NotificationItem } from '../../../core/services/notification.service';
import { CvBadgeComponent } from '../cv-badge/cv-badge.component';
import { CvButtonComponent } from '../cv-button/cv-button.component';

@Component({
  selector: 'cv-notification-dropdown',
  standalone: true,
  imports: [CommonModule, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <!-- Notification Bell Trigger Button -->
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-haspopup="true"
        aria-label="Toggle notifications"
        class="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        [class.ring-2]="open()"
        [class.ring-indigo-500]="open()"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
        </svg>
        <span
          *ngIf="unreadCount() > 0"
          class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse-ring"
          aria-hidden="true"
        ></span>
      </button>

      <!-- Notifications Dropdown Overlay -->
      <div
        *ngIf="open()"
        class="absolute right-0 mt-2 w-80 md:w-96 origin-top-right rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft p-2 z-40 animate-scale-in"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800/70 mb-2">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-50">
              Notifications
            </span>
            <cv-badge tone="danger" *ngIf="unreadCount() > 0" size="sm" [dot]="true">
              {{ unreadCount() }} new
            </cv-badge>
          </div>
          <button
            *ngIf="unreadCount() > 0"
            (click)="markAllRead()"
            class="text-[10px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider"
          >
            Mark all read
          </button>
        </div>

        <!-- Notification List -->
        <ul class="flex flex-col gap-1 max-h-80 overflow-y-auto cv-scrollbar">
          <li *ngFor="let n of notifications()" class="relative">
            <button
              type="button"
              (click)="handleSelect(n)"
              class="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left border border-transparent transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50"
              [ngClass]="!n.read ? 'bg-indigo-50/20 dark:bg-indigo-500/5' : ''"
            >
              <!-- Indicator colored circle / icon -->
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs"
                [ngClass]="badgeTone(n.type)"
              >
                {{ iconFor(n.type) }}
              </span>

              <!-- Content details -->
              <div class="flex-1 min-w-0 leading-snug">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-slate-900 dark:text-slate-50 truncate">
                    {{ n.title }}
                  </span>
                  <span class="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 font-medium font-mono">
                    {{ n.timestamp | date:'shortTime' }}
                  </span>
                </div>
                <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2">
                  {{ n.message }}
                </p>
              </div>

              <!-- Unread blue pulse indicator -->
              <span
                *ngIf="!n.read"
                class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400"
                aria-hidden="true"
              ></span>
            </button>
          </li>

          <!-- Empty list template -->
          <div *ngIf="notifications().length === 0" class="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            No notifications yet.
          </div>
        </ul>
      </div>
    </div>
  `,
})
export class CvNotificationDropdownComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);
  readonly notifications = this.notificationService.notifications;
  readonly unreadCount = this.notificationService.unreadCount;

  toggle(): void {
    this.open.update((v) => !v);
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead();
  }

  handleSelect(n: NotificationItem): void {
    this.notificationService.markAsRead(n.id);
    this.open.set(false);
    if (n.link) {
      void this.router.navigate([n.link]);
    }
  }

  badgeTone(type: string): string {
    switch (type) {
      case 'vital':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400';
      case 'chat':
        return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400';
      case 'task':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
      case 'family':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  }

  iconFor(type: string): string {
    switch (type) {
      case 'vital':
        return '📈';
      case 'chat':
        return '💬';
      case 'task':
        return '📋';
      case 'family':
        return '❤️';
      default:
        return '🔔';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.open.set(false);
  }
}
