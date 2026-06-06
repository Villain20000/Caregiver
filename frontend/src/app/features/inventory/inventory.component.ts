import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryItem, InventoryCategory } from '../../core/models/inventory.model';
import { InventoryService } from '../../core/services/inventory.service';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS } from '../../core/models/role.model';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent, CvBadgeTone } from '../../shared/components/cv-badge/cv-badge.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';

const CATEGORIES: InventoryCategory[] = ['PPE', 'Wound', 'Skin', 'Med', 'Equipment', 'Hygiene', 'Nutrition', 'Other'];

const CATEGORY_TONES: Record<InventoryCategory, CvBadgeTone> = {
  PPE: 'primary',
  Wound: 'danger',
  Skin: 'warning',
  Med: 'info',
  Equipment: 'neutral',
  Hygiene: 'success',
  Nutrition: 'warning',
  Other: 'neutral',
};

const CATEGORY_COLORS: Record<InventoryCategory, { bg: string; text: string; bar: string }> = {
  PPE: { bg: 'bg-indigo-50 dark:bg-indigo-500/5', text: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500' },
  Wound: { bg: 'bg-rose-50 dark:bg-rose-500/5', text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500' },
  Skin: { bg: 'bg-amber-50 dark:bg-amber-500/5', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  Med: { bg: 'bg-sky-50 dark:bg-sky-500/5', text: 'text-sky-600 dark:text-sky-400', bar: 'bg-sky-500' },
  Equipment: { bg: 'bg-slate-50 dark:bg-slate-500/5', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-500' },
  Hygiene: { bg: 'bg-emerald-50 dark:bg-emerald-500/5', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  Nutrition: { bg: 'bg-amber-50 dark:bg-amber-500/5', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  Other: { bg: 'bg-slate-50 dark:bg-slate-500/5', text: 'text-slate-600 dark:text-slate-400', bar: 'bg-slate-400' },
};

@Component({
  selector: 'cv-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvStatTileComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">inventory</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {{ title() }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Equipment, PPE, supplies and nutrition inventory tracking with reorder alerts.
        </p>
      </header>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <cv-stat-tile label="Total Items" [value]="items().length" tone="neutral" icon="📦"></cv-stat-tile>
        <cv-stat-tile label="Need Reorder" [value]="needReorder().length" tone="danger" icon="⚠️"></cv-stat-tile>
        <cv-stat-tile label="Below Par" [value]="belowPar().length" tone="warning" icon="📉"></cv-stat-tile>
        <cv-stat-tile label="Expiring Soon" [value]="expiring().length" tone="warning" icon="⏳"></cv-stat-tile>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <button
          *ngFor="let cat of categories"
          (click)="selectedCategory.set(cat)"
          class="rounded-xl px-4 py-2 text-sm font-medium transition-all border"
          [ngClass]="selectedCategory() === cat
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'"
        >
          {{ cat }}
        </button>
        <button
          (click)="selectedCategory.set('All')"
          class="rounded-xl px-4 py-2 text-sm font-medium transition-all border"
          [ngClass]="selectedCategory() === 'All'
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'"
        >
          All
        </button>
        <div class="flex-1 min-w-[200px]">
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Search by name or SKU..."
            class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </div>
      </div>

      <!-- Inventory Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          *ngFor="let item of filteredItems()"
          class="rounded-2xl border transition-all hover:shadow-soft"
          [ngClass]="getCardBorder(item)"
        >
          <div class="p-5">
            <!-- Header row -->
            <div class="flex items-start justify-between gap-2 mb-3">
              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{{ item.name }}</h3>
                <p class="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">SKU: {{ item.sku }}</p>
              </div>
              <cv-badge [tone]="getCategoryTone(item.category)">{{ item.category }}</cv-badge>
            </div>

            <!-- Stock level bar -->
            <div class="mb-3">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-slate-500 dark:text-slate-400">On Hand</span>
                <span class="font-semibold font-mono" [ngClass]="getStockColor(item)">{{ item.onHand }}</span>
              </div>
              <div class="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  [style.width.%]="getBarPercent(item)"
                  [ngClass]="getBarColor(item)"
                ></div>
              </div>
              <div class="flex items-center justify-between text-xs mt-1">
                <span class="text-slate-400 dark:text-slate-500">Par: {{ item.par }}</span>
                <span class="text-slate-400 dark:text-slate-500">Reorder: {{ item.reorderAt }}</span>
              </div>
            </div>

            <!-- Supplier & cost -->
            <div class="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
              <div class="flex items-center gap-1.5">
                <span class="font-medium">Supplier:</span>
                <span>{{ item.supplier }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="font-medium">Unit Cost:</span>
                <span>\${{ item.unitCost.toFixed(2) }}</span>
              </div>
              <div *ngIf="item.lot" class="flex items-center gap-1.5">
                <span class="font-medium">Lot:</span>
                <span class="font-mono">{{ item.lot }}</span>
              </div>
            </div>

            <!-- Badges row -->
            <div class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div
                *ngIf="item.onHand <= item.reorderAt"
                class="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                Reorder Now
              </div>
              <div
                *ngIf="isExpiring(item)"
                class="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                Expiring
              </div>
              <div
                *ngIf="item.onHand <= item.par && item.onHand > item.reorderAt"
                class="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300"
              >
                Below Par
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        *ngIf="filteredItems().length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <p class="text-lg font-medium text-slate-500 dark:text-slate-400">No items match your filters</p>
        <p class="text-sm text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search or category filter.</p>
      </div>
    </div>
  `,
})
export class InventoryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly role = inject(RoleService);
  private readonly inventoryService = inject(InventoryService);

  readonly categories = CATEGORIES;
  readonly CATEGORY_TONES = CATEGORY_TONES;

  readonly items = this.inventoryService.items;
  readonly needReorder = this.inventoryService.reorder;
  readonly expiring = this.inventoryService.expiring;

  readonly belowPar = computed<InventoryItem[]>(() =>
    this.items().filter((i) => i.onHand <= i.par && i.onHand > i.reorderAt)
  );

  readonly selectedCategory = signal<InventoryCategory | 'All'>('All');
  readonly searchQuery = signal<string>('');

  readonly filteredItems = computed<InventoryItem[]>(() => {
    const all = this.items();
    const cat = this.selectedCategory();
    const q = this.searchQuery().toLowerCase();

    return all.filter((item) => {
      if (cat !== 'All' && item.category !== cat) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Inventory';
  }

  getCategoryTone(category: InventoryCategory): CvBadgeTone {
    return CATEGORY_TONES[category] ?? 'neutral';
  }

  getBarPercent(item: InventoryItem): number {
    if (item.par === 0) return 0;
    return Math.min(100, Math.round((item.onHand / item.par) * 100));
  }

  getStockColor(item: InventoryItem): string {
    if (item.onHand <= item.reorderAt) return 'text-rose-600 dark:text-rose-400';
    if (item.onHand < item.par) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  }

  getBarColor(item: InventoryItem): string {
    if (item.onHand <= item.reorderAt) return 'bg-rose-500';
    if (item.onHand < item.par) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  getCardBorder(item: InventoryItem): string {
    if (item.onHand <= item.reorderAt) return 'border-rose-200 dark:border-rose-500/30 bg-rose-50/30 dark:bg-rose-500/5';
    if (item.onHand < item.par) return 'border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/5';
    return 'border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80';
  }

  isExpiring(item: InventoryItem): boolean {
    if (!item.expiresAt) return false;
    const horizon = Date.now() + 90 * 86_400_000;
    return new Date(item.expiresAt).getTime() < horizon;
  }
}