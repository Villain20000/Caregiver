import { Injectable, computed, signal } from '@angular/core';
import { InventoryItem } from '../models/inventory.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly _items = signal<InventoryItem[]>([]);
  readonly items = this._items.asReadonly();

  readonly reorder = computed<InventoryItem[]>(() => this._items().filter((i) => i.onHand <= i.reorderAt));
  readonly expiring = computed<InventoryItem[]>(() => {
    const horizon = Date.now() + 90 * 86_400_000;
    return this._items().filter((i) => i.expiresAt && new Date(i.expiresAt).getTime() < horizon);
  });

  readonly byCategory = computed<Record<string, InventoryItem[]>>(() => {
    const out: Record<string, InventoryItem[]> = {};
    for (const i of this._items()) (out[i.category] ??= []).push(i);
    return out;
  });

  constructor(private readonly http: HttpClient) {
    this.load();
  }

  load(): void {
    this.http.get<InventoryItem[]>(`${API_BASE_URL}/inventory`).subscribe({
      next: (data) => this._items.set(data),
      error: (err) => console.error('Failed to load inventory', err),
    });
  }

  adjust(sku: string, delta: number): void {
    const item = this._items().find((i) => i.sku === sku);
    if (!item) return;
    const newQty = Math.max(0, item.onHand + delta);

    // Optimistic Update
    this._items.update((l) => l.map((i) => (i.sku === sku ? { ...i, onHand: newQty } : i)));

    this.http.put<InventoryItem>(`${API_BASE_URL}/inventory/${sku}`, { onHand: newQty }).subscribe({
      error: (err) => {
        console.error('Failed to update inventory', err);
        this.load();
      }
    });
  }
}
