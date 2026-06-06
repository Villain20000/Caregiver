import { Injectable, computed, signal } from '@angular/core';
import { Channel, Message } from '../models/chat.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL, WS_BASE_URL } from './api.config';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly _channels = signal<Channel[]>([]);
  private readonly _messages = signal<Message[]>([]);
  readonly channels = this._channels.asReadonly();
  readonly messages = this._messages.asReadonly();

  readonly totalUnread = computed<number>(() => this._channels().reduce((sum, c) => sum + c.unread, 0));

  readonly sortedChannels = computed<Channel[]>(() =>
    [...this._channels()].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const aT = a.lastMessage?.timestamp ?? '';
      const bT = b.lastMessage?.timestamp ?? '';
      return bT.localeCompare(aT);
    }),
  );

  private ws?: WebSocket;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {
    this.load();
    this.connectWs();
  }

  load(): void {
    this.http.get<Channel[]>(`${API_BASE_URL}/channels`).subscribe({
      next: (channels) => {
        this.http.get<Message[]>(`${API_BASE_URL}/messages`).subscribe({
          next: (messages) => {
            const enriched: Channel[] = channels.map((c) => ({
              ...c,
              lastMessage: messages.filter((m) => m.channelId === c.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0],
            }));
            this._channels.set(enriched);
            this._messages.set(messages);
          },
          error: (err) => console.error('Failed to load messages', err)
        });
      },
      error: (err) => console.error('Failed to load channels', err)
    });
  }

  private connectWs(): void {
    try {
      this.ws = new WebSocket(WS_BASE_URL);

      this.ws.onopen = () => {
        console.log('Chat WebSocket connected');
        const user = this.auth.currentUser();
        if (user) {
          this.ws?.send(JSON.stringify({ type: 'auth', userId: user.id }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            const msg: Message = data.payload;
            if (!this._messages().some(m => m.id === msg.id)) {
              this._messages.update((list) => [...list, msg]);
              const user = this.auth.currentUser();
              this._channels.update((chans) => chans.map(c => {
                if (c.id === msg.channelId) {
                  const isOwn = msg.authorId === user.id;
                  return {
                    ...c,
                    lastMessage: msg,
                    unread: isOwn ? 0 : c.unread + 1
                  };
                }
                return c;
              }));
            }
          }
        } catch (e) {
          console.error('Error handling WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        console.log('Chat WebSocket disconnected, reconnecting in 5s...');
        setTimeout(() => this.connectWs(), 5000);
      };

      this.ws.onerror = (err) => {
        console.error('Chat WebSocket error', err);
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket client', e);
    }
  }

  forChannel(channelId: string): Message[] {
    return this._messages()
      .filter((m) => m.channelId === channelId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  sendMessage(channelId: string, text: string): Message | null {
    const channel = this._channels().find((c) => c.id === channelId);
    if (!channel || !text.trim()) return null;
    const user = this.auth.currentUser();

    const tempId = `msg-${Date.now()}`;
    const msg: Message = {
      id: tempId,
      channelId,
      authorId: user.id,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    // Optimistic Update
    this._messages.update((l) => [...l, msg]);
    this._channels.update((l) => l.map((c) => (c.id === channelId ? { ...c, lastMessage: msg, unread: 0 } : c)));

    const payload = {
      authorId: user.id,
      text: text.trim()
    };

    this.http.post<Message>(`${API_BASE_URL}/channels/${channelId}/messages`, payload).subscribe({
      next: (saved) => {
        this._messages.update((list) => list.map(m => m.id === tempId ? saved : m));
        this._channels.update((l) => l.map((c) => (c.id === channelId ? { ...c, lastMessage: saved, unread: 0 } : c)));
      },
      error: (err) => {
        console.error('Failed to send message', err);
        // Rollback
        this._messages.update((list) => list.filter(m => m.id !== tempId));
        this.load();
      }
    });

    return msg;
  }

  markRead(channelId: string): void {
    this._channels.update((l) => l.map((c) => (c.id === channelId ? { ...c, unread: 0 } : c)));
    this.http.post(`${API_BASE_URL}/channels/${channelId}/read`, {}).subscribe({
      error: (err) => console.error('Failed to mark read on server', err)
    });
  }
}
