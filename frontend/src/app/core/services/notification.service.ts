import { Injectable, computed, inject, signal } from '@angular/core';
import { WS_BASE_URL } from './api.config';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'vital' | 'chat' | 'task' | 'family' | 'system';
  timestamp: string;
  read: boolean;
  link?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  private readonly _notifications = signal<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Controlled Substance Alert',
      message: 'Insulin pass for pat-1 requires double verification co-sign.',
      type: 'vital',
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(), // 15 mins ago
      read: false,
    },
    {
      id: 'notif-2',
      title: 'New chat message',
      message: 'Jordan Hale: "We added a puzzle book to the rotation."',
      type: 'chat',
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(), // 45 mins ago
      read: false,
      link: '/chat'
    },
    {
      id: 'notif-3',
      title: 'Wound dressing kit restocked',
      message: 'Admins restocked WC-DRS-2x2 gauze. Par levels healthy.',
      type: 'system',
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      read: true,
    }
  ]);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter((n) => !n.read).length);

  private ws?: WebSocket;

  constructor() {
    this.connectWs();
  }

  private connectWs(): void {
    try {
      this.ws = new WebSocket(WS_BASE_URL);

      this.ws.onopen = () => {
        console.log('Notification WebSocket connected');
        const user = this.auth.currentUser();
        if (user) {
          this.ws?.send(JSON.stringify({ type: 'auth', userId: user.id }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
        } catch (e) {
          console.error('Error handling WebSocket notification event', e);
        }
      };

      this.ws.onclose = () => {
        console.log('Notification WebSocket disconnected, reconnecting in 5s...');
        setTimeout(() => this.connectWs(), 5000);
      };

      this.ws.onerror = (err) => {
        console.error('Notification WebSocket error', err);
      };
    } catch (e) {
      console.error('Failed to initialize notification WebSocket client', e);
    }
  }

  private handleIncomingEvent(event: any): void {
    const user = this.auth.currentUser();
    
    if (event.type === 'new_message') {
      const msg = event.payload;
      // Skip if own message
      if (msg.authorId === user?.id) return;

      this.add({
        title: 'New chat message',
        message: msg.text.length > 50 ? `${msg.text.substring(0, 50)}...` : msg.text,
        type: 'chat',
        link: '/chat'
      });
    } else if (event.type === 'new_vital') {
      const vital = event.payload;
      if (vital.flag !== 'normal') {
        this.add({
          title: `Vital Flag: ${vital.flag.toUpperCase()}`,
          message: `Patient ${vital.patientId} has abnormal vital: HR ${vital.hr}, BP ${vital.systolic}/${vital.diastolic}.`,
          type: 'vital'
        });
        this.toast.warning(`Critical Vitals alert for ${vital.patientId}!`);
      }
    } else if (event.type === 'task_updated') {
      const task = event.payload;
      // Notify if assigned to active user or created by active user
      if (task.assignee === user?.id || task.createdBy === user?.id) {
        this.add({
          title: 'Task Status Updated',
          message: `Task "${task.title}" updated to status ${task.status.toUpperCase()}.`,
          type: 'task'
        });
      }
    } else if (event.type === 'new_family_update') {
      const update = event.payload;
      this.add({
        title: 'New Family Update Logged',
        message: `${update.author} logged a mood update: "${update.note.substring(0, 40)}..."`,
        type: 'family'
      });
    }
  }

  add(item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): void {
    const newItem: NotificationItem = {
      ...item,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      read: false
    };

    this._notifications.update((list) => [newItem, ...list]);
  }

  markAllAsRead(): void {
    this._notifications.update((list) => list.map((n) => ({ ...n, read: true })));
  }

  markAsRead(id: string): void {
    this._notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  clear(id: string): void {
    this._notifications.update((list) => list.filter((n) => n.id !== id));
  }
}
