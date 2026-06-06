import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { Channel, Message } from '../../core/models/chat.model';
import { User } from '../../core/models/user.model';
import { ROLE_LABELS, Role } from '../../core/models/role.model';

@Component({
  selector: 'cv-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6 h-[calc(100vh-140px)]">
      <header class="flex flex-col gap-2 shrink-0">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">secure chat</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <span class="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold ml-auto">
            <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            HIPAA-Encrypted Socket Connected
          </span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          CareVibe Secure Conversations
        </h1>
      </header>

      <!-- Main Two-Pane Layout -->
      <div class="flex flex-grow bg-white/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden h-full shadow-xl">
        
        <!-- Left Pane: Channels Sidebar -->
        <div class="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/50 dark:bg-slate-950/20">
          <!-- Channel Type Filter Tabs -->
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search conversations..."
              class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div class="flex gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-center">
              <button
                (click)="filterKind.set('all')"
                class="flex-1 py-1 rounded-md transition-all"
                [ngClass]="filterKind() === 'all' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500'"
              >
                All
              </button>
              <button
                (click)="filterKind.set('channels')"
                class="flex-1 py-1 rounded-md transition-all"
                [ngClass]="filterKind() === 'channels' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500'"
              >
                Rooms
              </button>
              <button
                (click)="filterKind.set('direct')"
                class="flex-1 py-1 rounded-md transition-all"
                [ngClass]="filterKind() === 'direct' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-white' : 'text-slate-500'"
              >
                DMs
              </button>
            </div>
          </div>

          <!-- Channels List -->
          <div class="flex-grow overflow-y-auto p-2 space-y-1 cv-scrollbar">
            <button
              *ngFor="let channel of filteredChannels(); trackBy: trackChannelId"
              (click)="selectChannel(channel)"
              class="w-full text-left p-3 rounded-xl flex items-center justify-between transition-all group hover:bg-slate-100/80 dark:hover:bg-slate-800/40"
              [ngClass]="activeChannel()?.id === channel.id ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  [ngClass]="channel.kind === 'direct' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'"
                >
                  {{ channel.kind === 'direct' ? '@' : '#' }}
                </div>
                <div class="min-w-0">
                  <span class="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-slate-50">
                    {{ channel.name }}
                  </span>
                  <span class="block text-[10px] text-slate-400 truncate mt-0.5">
                    {{ channel.lastMessage?.text || 'No messages yet' }}
                  </span>
                </div>
              </div>
              <span *ngIf="channel.unread > 0" class="h-4 px-1.5 min-w-4 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black shrink-0 shadow-sm">
                {{ channel.unread }}
              </span>
            </button>
            
            <p *ngIf="filteredChannels().length === 0" class="text-xs text-slate-400 text-center py-6">
              No conversations found.
            </p>
          </div>
        </div>

        <!-- Right Pane: Message Feed window -->
        <div class="flex-grow flex flex-col bg-white dark:bg-slate-900/40">
          <ng-container *ngIf="activeChannel() as channel; else selectPlaceholder">
            <!-- Header bar -->
            <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/20 shrink-0">
              <div>
                <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>{{ channel.kind === 'direct' ? '@' : '#' }} {{ channel.name }}</span>
                  <cv-badge *ngIf="channel.encrypted" tone="success" size="sm">🔒 Encrypted</cv-badge>
                </h3>
                <p class="text-[10px] text-slate-400 mt-0.5">{{ channel.topic || 'Secure HIPAA group channel' }}</p>
              </div>
              
              <!-- Channel Members avatars -->
              <div class="flex -space-x-2">
                <div
                  *ngFor="let m of channel.members.slice(0, 4)"
                  [title]="getUserName(m.userId)"
                  class="h-7 w-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300"
                >
                  {{ getUserInitials(m.userId) }}
                </div>
                <div
                  *ngIf="channel.members.length > 4"
                  class="h-7 w-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400"
                >
                  +{{ channel.members.length - 4 }}
                </div>
              </div>
            </div>

            <!-- Messages Stream Area -->
            <div
              #scrollContainer
              class="flex-grow overflow-y-auto p-4 space-y-4 cv-scrollbar"
            >
              <div
                *ngFor="let msg of activeChannelMessages(); trackBy: trackMessageId"
                class="flex gap-3 max-w-[80%]"
                [ngClass]="isOwnMessage(msg) ? 'ml-auto flex-row-reverse' : ''"
              >
                <!-- Avatar -->
                <div
                  class="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold shrink-0 text-slate-700 dark:text-slate-300"
                >
                  {{ getUserInitials(msg.authorId) }}
                </div>

                <!-- Bubble Container -->
                <div class="space-y-1">
                  <!-- Name & Role -->
                  <div class="flex items-center gap-2 text-[10px] text-slate-400" [ngClass]="isOwnMessage(msg) ? 'justify-end' : ''">
                    <span class="font-bold text-slate-700 dark:text-slate-300">{{ getUserName(msg.authorId) }}</span>
                    <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 uppercase font-black tracking-wider text-[8px] scale-90">
                      {{ getUserRoleLabel(msg.authorId) }}
                    </span>
                    <span>·</span>
                    <span>{{ msg.timestamp | date:'shortTime' }}</span>
                  </div>

                  <!-- Text Bubble -->
                  <div
                    class="p-3.5 rounded-2xl text-xs leading-normal"
                    [ngClass]="isOwnMessage(msg) ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/30 dark:border-slate-700/30'"
                  >
                    <p class="whitespace-pre-wrap">{{ msg.text }}</p>

                    <!-- Render Attachments -->
                    <div *ngIf="msg.attachments && msg.attachments.length > 0" class="mt-2.5 space-y-1.5 border-t border-white/20 pt-2">
                      <div
                        *ngFor="let att of msg.attachments"
                        class="flex items-center gap-2 p-2 rounded-lg bg-black/10 text-[11px] font-semibold text-white/90"
                      >
                        <span class="text-sm">{{ getFileIcon(att.kind) }}</span>
                        <span class="truncate max-w-[150px]">{{ att.name }}</span>
                        <span class="text-[9px] text-white/60 ml-auto">({{ formatBytes(att.size) }})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Message Input panel -->
            <div class="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
              <input
                type="text"
                [(ngModel)]="newMessageText"
                (keydown.enter)="sendMessage()"
                placeholder="Type a secure HIPAA message..."
                class="flex-grow rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
              <cv-button variant="primary" (click)="sendMessage()">
                Send
              </cv-button>
            </div>
          </ng-container>

          <ng-template #selectPlaceholder>
            <div class="flex-grow flex flex-col items-center justify-center text-center p-6">
              <span class="text-5xl animate-bounce mb-3">💬</span>
              <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Select a Conversation</h4>
              <p class="text-xs text-slate-400 mt-1 max-w-xs">
                Select a channel or team chat from the sidebar to start secure messaging.
              </p>
            </div>
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
export class ChatComponent implements AfterViewChecked {
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef;

  // Search and Filters
  searchQuery = '';
  readonly filterKind = signal<'all' | 'channels' | 'direct'>('all');
  
  // Selected channel state
  readonly activeChannel = signal<Channel | null>(null);

  // New message text box input
  newMessageText = '';

  // Get filtered channels list
  readonly filteredChannels = computed(() => {
    const list = this.chatService.sortedChannels();
    const query = this.searchQuery.toLowerCase().trim();
    const kind = this.filterKind();

    return list.filter((c) => {
      const matchesQuery = c.name.toLowerCase().includes(query) || (c.topic && c.topic.toLowerCase().includes(query));
      
      if (!matchesQuery) return false;

      if (kind === 'channels') {
        return c.kind !== 'direct';
      }
      if (kind === 'direct') {
        return c.kind === 'direct';
      }
      return true;
    });
  });

  // Reactive message list for active channel
  readonly activeChannelMessages = computed(() => {
    const channel = this.activeChannel();
    return channel ? this.chatService.forChannel(channel.id) : [];
  });

  constructor() {
    // Auto-select first channel in list when it loads
    effect(() => {
      const chans = this.filteredChannels();
      if (chans.length > 0 && !this.activeChannel()) {
        this.selectChannel(chans[0]);
      }
    }, { allowSignalWrites: true });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  selectChannel(channel: Channel): void {
    this.activeChannel.set(channel);
    this.chatService.markRead(channel.id);
    setTimeout(() => this.scrollToBottom(), 50);
  }

  sendMessage(): void {
    const channel = this.activeChannel();
    if (!channel || !this.newMessageText.trim()) return;

    this.chatService.sendMessage(channel.id, this.newMessageText);
    this.newMessageText = '';
    setTimeout(() => this.scrollToBottom(), 50);
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      try {
        const el = this.scrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch (err) {
        // ignore
      }
    }
  }

  isOwnMessage(msg: Message): boolean {
    return msg.authorId === this.auth.currentUser()?.id;
  }

  // User details helper lookups
  getUserName(userId: string): string {
    return this.auth.getUserById(userId)?.name ?? 'Unknown User';
  }

  getUserInitials(userId: string): string {
    return this.auth.getUserById(userId)?.avatar ?? 'U';
  }

  getUserRoleLabel(userId: string): string {
    const user = this.auth.getUserById(userId);
    if (!user) return 'Staff';
    return ROLE_LABELS[user.role];
  }

  getFileIcon(kind: string): string {
    switch (kind) {
      case 'image': return '🖼️';
      case 'pdf': return '📄';
      case 'audio': return '🎵';
      default: return '📎';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  roleLabel(): string {
    return ROLE_LABELS[this.auth.currentUser().role];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Conversations';
  }

  trackChannelId = (_: number, item: Channel): string => item.id;
  trackMessageId = (_: number, item: Message): string => item.id;
}
