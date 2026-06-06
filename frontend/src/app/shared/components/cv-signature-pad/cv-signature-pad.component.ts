import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cv-signature-pad',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <div
        class="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
        [style.width.px]="width"
        [style.height.px]="height"
      >
        <canvas
          #canvas
          [width]="width"
          [height]="height"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp()"
          (pointerleave)="onPointerUp()"
          (pointercancel)="onPointerUp()"
          class="block touch-none cursor-crosshair"
        ></canvas>
        <div
          *ngIf="!hasInk()"
          class="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm"
        >
          Sign here
        </div>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{{ hasInk() ? 'Signed' : 'Awaiting signature' }}</span>
        <button
          type="button"
          class="rounded-lg px-2 py-1 font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10 transition-colors"
          (click)="clear()"
        >
          Clear
        </button>
      </div>
    </div>
  `,
})
export class CvSignaturePadComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() width = 480;
  @Input() height = 160;
  @Input() strokeColor = '#1e293b';
  @Input() strokeWidth = 2.4;

  @Output() signed = new EventEmitter<string>();

  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private last: { x: number; y: number } | null = null;
  private hasInkSignal = signal(false);
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.setupCanvas();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  hasInk(): boolean {
    return this.hasInkSignal();
  }

  clear(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.restore();
    this.hasInkSignal.set(false);
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.ctx) return;
    this.drawing = true;
    const canvas = this.canvasRef.nativeElement;
    canvas.setPointerCapture(event.pointerId);
    this.last = this.localPoint(event);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing || !this.ctx) return;
    const point = this.localPoint(event);
    const last = this.last ?? point;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.strokeWidth * this.dpr;
    this.ctx.beginPath();
    this.ctx.moveTo(last.x, last.y);
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
    this.ctx.restore();
    this.last = point;
    if (!this.hasInkSignal()) this.hasInkSignal.set(true);
  }

  onPointerUp(): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.last = null;
    this.emit();
  }

  private emit(): void {
    if (!this.hasInkSignal()) return;
    const data = this.canvasRef.nativeElement.toDataURL('image/png');
    this.signed.emit(data);
  }

  private localPoint(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * this.dpr,
      y: (event.clientY - rect.top) * this.dpr,
    };
  }

  private setupCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.width * this.dpr;
    canvas.height = this.height * this.dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(1, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth * this.dpr;
    this.ctx = ctx;
  }

  private handleResize(): void {
    // Snap the canvas to its CSS box while preserving the inked strokes
    // by re-rendering from the current pixel data into the new backing store.
    const canvas = this.canvasRef.nativeElement;
    const snapshot = canvas.toDataURL();
    this.setupCanvas();
    if (!this.ctx) return;
    const img = new Image();
    img.onload = () => {
      this.ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = snapshot;
  }
}
