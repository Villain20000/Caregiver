/**
 * apps/web/src/app/pages/vitals-trend-chart.component.ts
 *
 * Vitals Trend Chart — custom Canvas-based line chart.
 *
 * Features:
 *   - Smooth Bézier curve line with gradient area fill
 *   - Data point dots with hover tooltips
 *   - Y-axis grid lines and value labels
 *   - X-axis time labels (smart formatting)
 *   - Animated draw on data change
 *   - Responsive: redraws on container resize
 *   - Dark-mode aware (uses CSS custom properties)
 *
 * No external charting library needed — pure HTML5 Canvas API.
 */
import {
  Component,
  ElementRef,
  input,
  viewChild,
  signal,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { VitalsTrendResponse } from '@caregiver/contracts';

// ── Config ────────────────────────────────────────────────────────────────
interface DrawConfig {
  padding: { top: number; right: number; bottom: number; left: number };
  lineWidth: number;
  dotRadius: number;
  hoverDotRadius: number;
  gridLineCount: number;
}

const COLORS = {
  heartRate: { line: '#ef5350', fill: 'rgba(239,83,80,0.15)', dot: '#ef5350' },
  systolicBp: { line: '#1e88e5', fill: 'rgba(30,136,229,0.15)', dot: '#1e88e5' },
  diastolicBp: { line: '#43a047', fill: 'rgba(67,160,71,0.15)', dot: '#43a047' },
  temperature: { line: '#fb8c00', fill: 'rgba(251,140,0,0.15)', dot: '#fb8c00' },
  oxygenSaturation: { line: '#8e24aa', fill: 'rgba(142,36,170,0.15)', dot: '#8e24aa' },
  respiratoryRate: { line: '#00acc1', fill: 'rgba(0,172,193,0.15)', dot: '#00acc1' },
} as const;

@Component({
  selector: 'app-vitals-trend-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-wrapper" [style.height.px]="height()">
      <canvas
        #canvas
        (mousemove)="onMouseMove($event)"
        (mouseleave)="onMouseLeave()"
        (click)="onClick($event)"
      ></canvas>
      @if (tooltip()) {
        <div class="tooltip" [style.left.px]="tooltip()!.x" [style.top.px]="tooltip()!.y">
          <div class="tt-value">{{ tooltip()!.valueLabel }}</div>
          <div class="tt-time">{{ tooltip()!.timeLabel }}</div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chart-wrapper {
        position: relative;
        width: 100%;
        min-height: 200px;
      }
      canvas {
        width: 100%;
        height: 100%;
        display: block;
        border-radius: var(--radius-lg);
      }
      .tooltip {
        position: absolute;
        pointer-events: none;
        transform: translate(-50%, calc(-100% - 8px));
        background: var(--color-surface, #fff);
        border: 1px solid var(--color-border, #ddd);
        border-radius: var(--radius-md, 6px);
        padding: 0.4rem 0.65rem;
        box-shadow: var(--shadow-lg, 0 4px 12px rgba(0, 0, 0, 0.1));
        z-index: 20;
        white-space: nowrap;
        animation: fadeIn 100ms ease;
      }
      .tt-value {
        font-size: var(--text-sm, 0.75rem);
        font-weight: var(--font-semibold, 600);
        color: var(--color-text-primary, #212121);
      }
      .tt-time {
        font-size: var(--text-xs, 0.625rem);
        color: var(--color-text-muted, #9e9e9e);
        margin-top: 2px;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translate(-50%, calc(-100% - 4px));
        }
        to {
          opacity: 1;
          transform: translate(-50%, calc(-100% - 8px));
        }
      }
    `,
  ],
})
export class VitalsTrendChartComponent implements AfterViewInit, OnDestroy {
  // ── Inputs ────────────────────────────────────────────────────────────
  readonly data = input.required<VitalsTrendResponse>();
  readonly height = input(220);
  readonly animated = input(true);

  // ── View children ─────────────────────────────────────────────────────
  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  // ── State ─────────────────────────────────────────────────────────────
  tooltip = signal<{ x: number; y: number; valueLabel: string; timeLabel: string } | null>(null);
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private drawProgress = 1; // 0–1 for animation

  // ── Config ────────────────────────────────────────────────────────────
  private readonly config: DrawConfig = {
    padding: { top: 20, right: 16, bottom: 36, left: 52 },
    lineWidth: 2.5,
    dotRadius: 3.5,
    hoverDotRadius: 5,
    gridLineCount: 5,
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.setupResizeObserver();
    this.scheduleDraw();
  }

  ngOnDestroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.resizeObserver?.disconnect();
  }

  // ── Resize handling ───────────────────────────────────────────────────
  private setupResizeObserver(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    this.resizeObserver = new ResizeObserver(() => this.scheduleDraw());
    this.resizeObserver.observe(canvas.parentElement!);
  }

  // ── Draw scheduling ───────────────────────────────────────────────────
  private scheduleDraw(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(() => this.draw());
  }

  // ── Canvas interaction ────────────────────────────────────────────────
  onMouseMove(event: MouseEvent): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    this.updateTooltip(x);
  }

  onMouseLeave(): void {
    this.tooltip.set(null);
  }

  onClick(_event: MouseEvent): void {
    // If user clicks a data point, we could emit an event — placeholder for now.
  }

  private updateTooltip(mouseX: number): void {
    const dp = this.data();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !dp.dataPoints.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { padding } = this.config;
    const w = canvas.width;
    const h = canvas.height;

    const points = dp.dataPoints;
    const chartW = w - padding.left - padding.right;
    const values = points.map((p) => p.value);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const yRange = yMax - yMin || 1;
    const chartH = h - padding.top - padding.bottom;

    // Find nearest data point
    let minDist = Infinity;
    let nearestIdx = -1;
    for (let i = 0; i < points.length; i++) {
      const px = padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
      const dist = Math.abs(px - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx < 0 || minDist > (chartW / points.length) * 1.5) {
      this.tooltip.set(null);
      return;
    }

    const p = points[nearestIdx]!;
    const py = padding.top + chartH - ((p.value - yMin) / yRange) * chartH;
    const px = padding.left + (nearestIdx / Math.max(points.length - 1, 1)) * chartW;

    const metric = dp.metric;
    const unit =
      metric === 'heartRate'
        ? ' bpm'
        : metric === 'systolicBp' || metric === 'diastolicBp'
          ? ' mmHg'
          : metric === 'temperature'
            ? '°C'
            : metric === 'oxygenSaturation'
              ? '%'
              : metric === 'respiratoryRate'
                ? ' /min'
                : '';

    const date = new Date(p.timestamp);
    const timeLabel = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    this.tooltip.set({
      x: px,
      y: py,
      valueLabel: `${p.value}${unit}`,
      timeLabel,
    });
  }

  // ── Main draw routine ─────────────────────────────────────────────────
  private draw(): void {
    const dp = this.data();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !dp.dataPoints.length) return;

    const parent = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    const w = rect.width;
    const h = this.height();

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Resolve colors from CSS or use fallbacks
    const textColor =
      getComputedStyle(canvas).getPropertyValue('--color-text-secondary').trim() || '#616161';
    const gridColor =
      getComputedStyle(canvas).getPropertyValue('--color-border-light').trim() || '#eee';
    const bgColor = getComputedStyle(canvas).getPropertyValue('--color-surface').trim() || '#fff';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    const { padding, lineWidth, dotRadius, gridLineCount } = this.config;
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const points = dp.dataPoints;
    const values = points.map((p) => p.value);
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const yRange = yMax - yMin || 1;

    // --- Grid lines + Y-axis labels ---
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLineCount; i++) {
      const y = padding.top + (i / gridLineCount) * chartH;
      const val = yMax - (i / gridLineCount) * yRange;

      // Grid line
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = textColor;
      const label = val % 1 === 0 ? val.toString() : val.toFixed(1);
      ctx.fillText(label, padding.left - 6, y);
    }

    // --- X-axis labels (show a few evenly spaced) ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const maxLabels = Math.min(points.length, Math.floor(w / 80));
    const step = Math.max(1, Math.floor(points.length / maxLabels));

    for (let i = 0; i < points.length; i += step) {
      const pt = points[i]!;
      const x = padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
      const date = new Date(pt.timestamp);
      const label = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(dp.dataPoints.length > 30 ? {} : { hour: 'numeric' as const }),
      });
      ctx.fillStyle = textColor;
      ctx.fillText(label, x, h - padding.bottom + 8);
    }

    // --- Data line + area fill (with optional animation) ---
    const metricsColors = COLORS[dp.metric as keyof typeof COLORS];
    const color = metricsColors ?? {
      line: '#1a237e',
      fill: 'rgba(26,35,126,0.15)',
      dot: '#1a237e',
    };

    // Gradient area fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    gradient.addColorStop(0, color.fill);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    const progress = this.animated() ? this.drawProgress : 1;
    const visibleCount = Math.max(1, Math.floor(points.length * progress));

    ctx.beginPath();
    for (let i = 0; i < visibleCount; i++) {
      const pt = points[i]!;
      const x = padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
      const y = padding.top + chartH - ((pt.value - yMin) / yRange) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else {
        // Smooth curve via quadratic bezier
        const prevPt = points[i - 1]!;
        const prevX = padding.left + ((i - 1) / Math.max(points.length - 1, 1)) * chartW;
        const prevY = padding.top + chartH - ((prevPt.value - yMin) / yRange) * chartH;
        const cpx = (prevX + x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
    }
    ctx.strokeStyle = color.line;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Area fill (close path)
    const lastX =
      padding.left +
      ((Math.min(visibleCount, points.length) - 1) / Math.max(points.length - 1, 1)) * chartW;
    ctx.lineTo(lastX, h - padding.bottom);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // --- Data point dots ---
    for (let i = 0; i < visibleCount; i++) {
      const pt = points[i]!;
      const x = padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
      const y = padding.top + chartH - ((pt.value - yMin) / yRange) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = color.dot;
      ctx.fill();
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // --- Animate if needed ---
    if (this.animated() && this.drawProgress < 1) {
      this.drawProgress = Math.min(1, this.drawProgress + 0.04);
      this.animFrameId = requestAnimationFrame(() => this.draw());
    }

    // Draw hover highlight
    if (this.tooltip()) {
      const tt = this.tooltip()!;
      // Find the nearest point index
      let nearestIdx = -1;
      let minDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const px = padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
        const dist = Math.abs(px - tt.x);
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }
      if (nearestIdx >= 0) {
        const pt = points[nearestIdx]!;
        const x = padding.left + (nearestIdx / Math.max(points.length - 1, 1)) * chartW;
        const y = padding.top + chartH - ((pt.value - yMin) / yRange) * chartH;
        // Vertical crosshair line
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, h - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        // Highlight dot
        ctx.beginPath();
        ctx.arc(x, y, this.config.hoverDotRadius, 0, Math.PI * 2);
        ctx.fillStyle = color.dot;
        ctx.fill();
        ctx.strokeStyle = bgColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }
}
