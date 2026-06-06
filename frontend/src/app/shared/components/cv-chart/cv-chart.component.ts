import {
  ChangeDetectionStrategy, Component, EventEmitter, Input, Output,
  computed, signal, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  unit?: string;
  /** Optional fixed y-domain for this series (otherwise auto). */
  yDomain?: [number, number];
  data: { x: number; y: number; anomaly?: boolean; anomalyReason?: string }[];
}

interface RenderPoint { x: number; y: number; raw: { x: number; y: number; anomaly?: boolean; anomalyReason?: string }; }
interface HoverPayload { t: number; vx: number; vy: number; points: { seriesKey: string; label: string; color: string; value: number; vx: number; vy: number }[]; }

@Component({
  selector: 'cv-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full">
      <!-- Legend -->
      @if (showLegend) {
        <div class="flex flex-wrap items-center gap-1.5 px-1 pb-2">
          @for (s of visibleSeries(); track s.key) {
            <button type="button"
                    (click)="toggleKey(s.key)"
                    [ngClass]="legendClass(s.key)"
                    class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border transition">
              <span class="h-2.5 w-2.5 rounded-full" [style.background]="s.color"></span>
              <span>{{ s.label }}</span>
              @if (s.unit) { <span class="text-slate-400">·</span><span class="text-slate-500 dark:text-slate-400">{{ s.unit }}</span> }
            </button>
          }
          @if (hiddenKeys().size) {
            <button type="button" (click)="resetVisibility()" class="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 ml-1 underline">Show all</button>
          }
        </div>
      }

      <div class="relative w-full" [style.height.px]="height" #wrap
           (mousemove)="onMove($event)"
           (mouseleave)="hover.set(null)">
        <svg [attr.viewBox]="viewBox" preserveAspectRatio="none" class="w-full h-full overflow-visible">
          <defs>
            @for (s of visibleSeries(); track s.key) {
              <linearGradient [attr.id]="gradId(s.key)" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%"   [attr.stop-color]="s.color" stop-opacity="0.25"/>
                <stop offset="100%" [attr.stop-color]="s.color" stop-opacity="0"/>
              </linearGradient>
            }
          </defs>

          <!-- gridlines -->
          @for (g of gridLines(); track g.y) {
            <line [attr.x1]="padX" [attr.x2]="viewW - 4" [attr.y1]="g.y" [attr.y2]="g.y" stroke="currentColor" class="text-slate-200 dark:text-slate-800" stroke-dasharray="2 4" stroke-width="1"/>
            <text [attr.x]="padX - 6" [attr.y]="g.y + 3" text-anchor="end" class="fill-slate-400 text-[10px]">{{ g.label }}</text>
          }
          <!-- x-axis ticks -->
          @for (t of xTicks(); track t.x) {
            <text [attr.x]="t.x" [attr.y]="innerH() + 14" text-anchor="middle" class="fill-slate-400 text-[10px]">{{ t.label }}</text>
          }

          @for (s of visibleSeries(); track s.key) {
            <path [attr.d]="areaFor(s)" [attr.fill]="'url(#' + gradId(s.key) + ')'" />
            <path [attr.d]="lineFor(s)" fill="none" [attr.stroke]="s.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          }

          <!-- Anomaly dots -->
          @for (a of anomalyDots(); track a.id) {
            <g [attr.transform]="'translate(' + a.x + ',' + a.y + ')'">
              <circle r="9" [attr.fill]="a.color" opacity="0.18" class="animate-pulse"/>
              <circle r="4" [attr.fill]="a.color" stroke="white" stroke-width="1.5"/>
            </g>
          }

          <!-- Hover guide -->
          @if (hoverPoint(); as h) {
            <line [attr.x1]="h.vx" [attr.x2]="h.vx" [attr.y1]="padY" [attr.y2]="innerH()" stroke="currentColor" class="text-slate-400 dark:text-slate-500" stroke-dasharray="3 3"/>
            @for (p of h.points; track p.seriesKey) {
              <circle [attr.cx]="p.vx" [attr.cy]="p.vy" r="3.5" [attr.fill]="p.color" stroke="white" stroke-width="1.5"/>
            }
          }
        </svg>

        @if (hoverPoint(); as h) {
          <div class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
               [style.left.px]="h.vx" [style.top.px]="h.vy - 8">
            <div class="rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs min-w-[160px]">
              <div class="font-semibold text-slate-700 dark:text-slate-200 mb-1 tabular-nums">{{ formatTs(h.t) }}</div>
              <div class="space-y-0.5">
                @for (p of h.points; track p.seriesKey) {
                  <div class="flex items-center justify-between gap-3">
                    <span class="flex items-center gap-1.5">
                      <span class="h-2 w-2 rounded-full" [style.background]="p.color"></span>
                      <span class="text-slate-600 dark:text-slate-300">{{ p.label }}</span>
                    </span>
                    <span class="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{{ p.value }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class CvChartComponent {
  @Input() showLegend = true;
  @Input() height = 280;
  @Input() set series(v: ChartSeries[]) { this._series.set(v || []); }
  @Input() set xFormat(v: (ts: number) => string) { this._xFormat.set(v); }
  @Output() seriesToggle = new EventEmitter<string>();

  readonly padX = 36;
  readonly padY = 12;
  readonly viewW = 600;
  readonly viewH = 280;
  readonly viewBox = `0 0 ${this.viewW} ${this.viewH}`;

  private readonly _series = signal<ChartSeries[]>([]);
  private readonly _xFormat = signal<(ts: number) => string>((ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );
  private readonly _hidden = signal<Set<string>>(new Set());
  readonly hiddenKeys = this._hidden.asReadonly();

  readonly hover = signal<number | null>(null);

  innerH = computed<number>(() => this.viewH - this.padY - 22);

  readonly gridLines = computed<{ y: number; label: string }[]>(() => {
    const h = this.innerH();
    return [
      { y: this.padY + 4,                    label: '100%' },
      { y: this.padY + (h * 0.25),           label: '75%'  },
      { y: this.padY + (h * 0.5),            label: '50%'  },
      { y: this.padY + (h * 0.75),           label: '25%'  },
      { y: this.padY + h,                    label: '0%'   },
    ];
  });

  readonly visibleSeries = computed<ChartSeries[]>(() =>
    this._series().filter((s) => !this._hidden().has(s.key)),
  );

  readonly xDomain = computed<[number, number]>(() => {
    let min = Infinity, max = -Infinity;
    for (const s of this._series()) for (const p of s.data) {
      if (p.x < min) min = p.x;
      if (p.x > max) max = p.x;
    }
    if (!isFinite(min) || !isFinite(max) || min === max) return [0, 1];
    return [min, max];
  });

  readonly yDomain = computed<[number, number]>(() => {
    let min = Infinity, max = -Infinity;
    for (const s of this.visibleSeries()) {
      if (s.yDomain) {
        if (s.yDomain[0] < min) min = s.yDomain[0];
        if (s.yDomain[1] > max) max = s.yDomain[1];
        continue;
      }
      for (const p of s.data) {
        if (p.y < min) min = p.y;
        if (p.y > max) max = p.y;
      }
    }
    if (!isFinite(min) || !isFinite(max) || min === max) return [0, 1];
    const pad = (max - min) * 0.08;
    return [min - pad, max + pad];
  });

  readonly xTicks = computed<{ x: number; label: string }[]>(() => {
    const [a, b] = this.xDomain();
    const fmt = this._xFormat();
    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const t = a + (i / (count - 1)) * (b - a);
      return { x: this.scaleX(t), label: fmt(t) };
    });
  });

  toggleKey(key: string): void {
    this._hidden.update((set) => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    this.seriesToggle.emit(key);
  }

  resetVisibility(): void { this._hidden.set(new Set()); }

  legendClass(key: string): string {
    const hidden = this._hidden().has(key);
    return hidden
      ? 'border-slate-200 text-slate-400 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 line-through opacity-60'
      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200';
  }

  gradId(key: string): string { return 'cv-' + key.replace(/[^a-z0-9]/gi, '') + '-g'; }

  /* ---- mapping ---- */

  private scaleX(t: number): number {
    const [a, b] = this.xDomain();
    return this.padX + ((t - a) / (b - a || 1)) * (this.viewW - this.padX - 4);
  }
  private scaleY(v: number): number {
    const [a, b] = this.yDomain();
    return this.padY + (1 - (v - a) / (b - a || 1)) * this.innerH();
  }

  lineFor(s: ChartSeries): string {
    if (!s.data.length) return '';
    return s.data
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${this.scaleX(p.x).toFixed(2)} ${this.scaleY(p.y).toFixed(2)}`)
      .join(' ');
  }

  areaFor(s: ChartSeries): string {
    if (!s.data.length) return '';
    const top = s.data
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${this.scaleX(p.x).toFixed(2)} ${this.scaleY(p.y).toFixed(2)}`)
      .join(' ');
    const lastX = this.scaleX(s.data[s.data.length - 1].x);
    const firstX = this.scaleX(s.data[0].x);
    const baseY = this.padY + this.innerH();
    return `${top} L${lastX.toFixed(2)} ${baseY.toFixed(2)} L${firstX.toFixed(2)} ${baseY.toFixed(2)} Z`;
  }

  /* ---- anomaly dots ---- */

  readonly anomalyDots = computed<{ id: string; x: number; y: number; color: string }[]>(() => {
    const out: { id: string; x: number; y: number; color: string }[] = [];
    for (const s of this.visibleSeries()) {
      for (const p of s.data) {
        if (p.anomaly) {
          out.push({
            id: s.key + '-' + p.x,
            x: this.scaleX(p.x),
            y: this.scaleY(p.y),
            color: s.color,
          });
        }
      }
    }
    return out;
  });

  /* ---- hover ---- */

  readonly hoverPoint = computed<HoverPayload | null>(() => {
    const h = this.hover();
    if (h == null) return null;
    const visible = this.visibleSeries();
    if (!visible.length) return null;

    // Use first visible series as the time-axis reference
    const ref = visible[0].data;
    let nearest = ref[0];
    let dist = Math.abs(ref[0].x - h);
    for (const p of ref) {
      const d = Math.abs(p.x - h);
      if (d < dist) { dist = d; nearest = p; }
    }
    if (!nearest) return null;
    const vx = this.scaleX(nearest.x);

    const points: HoverPayload['points'] = [];
    for (const s of visible) {
      const dp = s.data.find((p) => p.x === nearest.x);
      if (dp) {
        points.push({
          seriesKey: s.key,
          label: s.label,
          color: s.color,
          value: dp.y,
          vx,
          vy: this.scaleY(dp.y),
        });
      }
    }
    return { t: nearest.x, vx, vy: points[0]?.vy ?? 0, points };
  });

  onMove(ev: MouseEvent): void {
    const el = ev.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const vx = (x / rect.width) * this.viewW;
    if (vx < this.padX || vx > this.padX + (this.viewW - this.padX - 4)) { this.hover.set(null); return; }
    const [a, b] = this.xDomain();
    const t = a + ((vx - this.padX) / (this.viewW - this.padX - 4)) * (b - a);
    this.hover.set(t);
  }

  formatTs(t: number): string { return this._xFormat()(t); }
}
