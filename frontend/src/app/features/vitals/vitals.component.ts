import {
  ChangeDetectionStrategy, Component, OnDestroy, OnInit,
  computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';

import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvChartComponent, ChartSeries } from '../../shared/components/cv-chart/cv-chart.component';

import { VitalsService } from '../../core/services/vitals.service';
import { VitalsReading } from '../../core/models/vitals.model';

type Range = '1h' | '6h' | '24h' | '7d';

interface Metric { key: 'hr' | 'systolic' | 'glucose'; label: string; unit: string; color: string; icon: string; }

@Component({
  selector: 'cv-vitals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, DecimalPipe,
    CvCardComponent, CvButtonComponent, CvBadgeComponent, CvStatTileComponent, CvChartComponent,
  ],
  templateUrl: './vitals.component.html',
})
export class VitalsComponent implements OnInit, OnDestroy {
  private readonly vitals = inject(VitalsService);

  readonly ranges: Range[] = ['1h', '6h', '24h', '7d'];
  readonly range = signal<Range>('1h');
  readonly now = signal<number>(Date.now());

  readonly metrics: Metric[] = [
    { key: 'hr',       label: 'Heart Rate', unit: 'bpm',   color: '#ef4444', icon: '❤️' },
    { key: 'systolic', label: 'Systolic BP', unit: 'mmHg',  color: '#f59e0b', icon: '🩸' },
    { key: 'glucose',  label: 'Glucose',    unit: 'mg/dL', color: '#3381ff', icon: '🧪' },
  ];

  readonly windowMs = computed<number>(() => {
    switch (this.range()) {
      case '1h':  return 60 * 60 * 1000;
      case '6h':  return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d':  return 7 * 24 * 60 * 60 * 1000;
    }
  });

  readonly readings = computed<VitalsReading[]>(() => {
    const all = [...this.vitals.readings()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (!all.length) return [];
    const last = new Date(all[all.length - 1].timestamp).getTime();
    const cutoff = last - this.windowMs();
    return all.filter((r) => new Date(r.timestamp).getTime() >= cutoff);
  });

  readonly latest = computed<VitalsReading | null>(() => this.vitals.latest());

  readonly updatedAgo = computed<number>(() => {
    const l = this.latest();
    if (!l) return 0;
    return Math.max(0, Math.floor((this.now() - new Date(l.timestamp).getTime()) / 1000));
  });

  readonly totalPoints = computed<number>(() => this.readings().length);

  readonly series = computed<ChartSeries[]>(() => {
    const data = this.readings();
    const out: ChartSeries[] = [];
    out.push(this.toSeries('hr', 'Heart Rate', '#ef4444', 'bpm', data, (r) => r.hr, [40, 140]));
    out.push(this.toSeries('systolic', 'Systolic', '#f59e0b', 'mmHg', data, (r) => r.systolic, [80, 180]));
    out.push(this.toSeries('diastolic', 'Diastolic', '#a855f7', 'mmHg', data, (r) => r.diastolic, [50, 110]));
    out.push(this.toSeries('glucose', 'Glucose', '#3381ff', 'mg/dL', data, (r) => r.glucose, [60, 200]));
    return out;
  });

  readonly anomalies = computed<{ ts: number; metric: string; value: number; unit: string; reason: string }[]>(() => {
    const out: { ts: number; metric: string; value: number; unit: string; reason: string }[] = [];
    for (const r of this.readings()) {
      if (r.flag === 'normal') continue;
      const reason = r.note ?? (r.flag === 'critical' ? 'Out of safe range' : 'Slightly out of range');
      if (r.hr > 110 || r.hr < 50)          out.push({ ts: new Date(r.timestamp).getTime(), metric: 'Heart Rate', value: r.hr,        unit: 'bpm',   reason });
      if (r.systolic > 160 || r.systolic < 90) out.push({ ts: new Date(r.timestamp).getTime(), metric: 'Systolic',  value: r.systolic,  unit: 'mmHg',  reason });
      if (r.diastolic > 100 || r.diastolic < 55) out.push({ ts: new Date(r.timestamp).getTime(), metric: 'Diastolic', value: r.diastolic, unit: 'mmHg', reason });
      if (r.glucose > 180 || r.glucose < 70) out.push({ ts: new Date(r.timestamp).getTime(), metric: 'Glucose',    value: r.glucose,   unit: 'mg/dL', reason });
    }
    return out.sort((a, b) => b.ts - a.ts);
  });

  private clockId?: ReturnType<typeof setInterval>;
  private refreshId?: ReturnType<typeof setInterval>;

  constructor() { effect(() => { this.updatedAgo(); }); }

  ngOnInit(): void {
    this.clockId = setInterval(() => this.now.set(Date.now()), 1000);
    this.refreshId = setInterval(() => this.addLiveReading(), 5000);
  }
  ngOnDestroy(): void {
    if (this.clockId)  clearInterval(this.clockId);
    if (this.refreshId) clearInterval(this.refreshId);
  }

  setRange(r: Range): void { this.range.set(r); }

  rangeBtnClass(r: Range): string {
    return r === this.range()
      ? 'bg-white dark:bg-slate-800 shadow text-indigo-700 dark:text-indigo-300'
      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100';
  }

  currentValue(metric: 'hr' | 'systolic' | 'glucose'): number {
    const l = this.latest();
    return l ? l[metric] : 0;
  }

  sparkFor(metric: 'hr' | 'systolic' | 'glucose'): number[] {
    const r = this.readings();
    if (!r.length) return [];
    const target = 24;
    const step = Math.max(1, Math.floor(r.length / target));
    const out: number[] = [];
    for (let i = 0; i < r.length; i += step) out.push(r[i][metric]);
    if (out[out.length - 1] !== r[r.length - 1][metric]) out.push(r[r.length - 1][metric]);
    return out;
  }

  sparkPath(metric: 'hr' | 'systolic' | 'glucose'): { line: string; area: string } {
    const data = this.sparkFor(metric);
    if (!data.length) return { line: '', area: '' };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = 100 / Math.max(1, data.length - 1);
    const points = data.map((v, i) => {
      const x = (i * step).toFixed(2);
      const y = (28 - ((v - min) / range) * 26 - 1).toFixed(2);
      return { x, y };
    });
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    const last = points[points.length - 1];
    const first = points[0];
    const area = `${line} L${last.x} 30 L${first.x} 30 Z`;
    return { line, area };
  }

  rangeAverage(metric: 'hr' | 'systolic' | 'glucose'): number {
    const r = this.readings();
    if (!r.length) return 0;
    return Math.round(r.reduce((s, x) => s + x[metric], 0) / r.length);
  }

  trendFor(metric: 'hr' | 'systolic' | 'glucose'): number {
    const r = this.readings();
    if (r.length < 2) return 0;
    const first = r[0][metric];
    const last = r[r.length - 1][metric];
    if (!first) return 0;
    return +(((last - first) / first) * 100).toFixed(1);
  }

  toneFor(metric: 'hr' | 'systolic' | 'glucose'): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
    const v = this.currentValue(metric);
    if (metric === 'hr')       return v > 110 || v < 50 ? 'danger'  : v > 95 ? 'warning' : 'danger';
    if (metric === 'systolic') return v > 160 || v < 90 ? 'danger'  : v > 140 ? 'warning' : 'primary';
    if (metric === 'glucose')  return v > 180 || v < 70 ? 'danger'  : v > 130 ? 'warning' : 'primary';
    return 'neutral';
  }

  xFormat = (ts: number): string => {
    if (this.range() === '7d') {
      return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  private addLiveReading(): void {
    const all = this.vitals.readings();
    if (!all.length) return;
    const last = all[0];
    const lastTs = new Date(last.timestamp).getTime() + 5_000;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const hr = clamp(last.hr       + rand(-2, 2) + (Math.random() < 0.05 ? rand(10, 25) * (Math.random() < 0.5 ? -1 : 1) : 0), 30, 200);
    const sy = clamp(last.systolic  + rand(-2, 2) + (Math.random() < 0.04 ? rand(15, 25) * (Math.random() < 0.5 ? -1 : 1) : 0), 60, 220);
    const di = clamp(last.diastolic + rand(-1, 1) + (Math.random() < 0.04 ? rand(8, 15)  * (Math.random() < 0.5 ? -1 : 1) : 0), 30, 140);
    const gl = clamp(last.glucose   + rand(-3, 3) + (Math.random() < 0.04 ? rand(20, 50) * (Math.random() < 0.5 ? -1 : 1) : 0), 30, 320);
    const sp = clamp(last.spo2      + rand(-1, 1), 70, 100);
    const tp = +(last.temp + rand(-0.2, 0.2)).toFixed(1);

    const flag = (hr > 110 || hr < 50 || sy > 160 || sy < 90 || sp < 92 || tp > 100.4)
      ? 'critical' as const
      : (hr > 95 || sy > 145 || sp < 95 || gl > 180) ? 'watch' as const : 'normal' as const;

    this.vitals.add({
      patientId: last.patientId,
      timestamp: new Date(lastTs).toISOString(),
      hr: Math.round(hr),
      systolic: Math.round(sy),
      diastolic: Math.round(di),
      glucose: Math.round(gl),
      spo2: Math.round(sp),
      temp: tp,
      recordedBy: last.recordedBy,
    });
  }

  private toSeries(
    key: string, label: string, color: string, unit: string,
    data: VitalsReading[], pick: (r: VitalsReading) => number,
    domain: [number, number],
  ): ChartSeries {
    return {
      key, label, color, unit, yDomain: domain,
      data: data.map((r) => ({
        x: new Date(r.timestamp).getTime(),
        y: pick(r),
        anomaly: r.flag !== 'normal',
        anomalyReason: r.note ?? (r.flag === 'critical' ? 'Out of safe range' : 'Slightly out of range'),
      })),
    };
  }
}

function clamp(v: number, a: number, b: number): number { return Math.max(a, Math.min(b, v)); }
