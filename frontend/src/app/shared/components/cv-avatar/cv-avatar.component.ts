import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ROLE_COLORS, Role } from '../../../core/models/role.model';

export type CvAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<CvAvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const RING_CLASSES: Record<Role, string> = {
  [Role.PATIENT]: 'ring-sky-500',
  [Role.FAMILY]: 'ring-pink-500',
  [Role.NURSE]: 'ring-emerald-500',
  [Role.THERAPIST]: 'ring-violet-500',
  [Role.DOCTOR]: 'ring-indigo-500',
  [Role.SOCIAL_WORKER]: 'ring-amber-500',
  [Role.DISPATCHER]: 'ring-yellow-500',
  [Role.NUTRITIONIST]: 'ring-lime-500',
  [Role.ADMIN]: 'ring-slate-500',
  [Role.BILLING]: 'ring-fuchsia-500',
};

const FALLBACK_PALETTE = [
  'from-indigo-400 to-blue-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-600',
  'from-sky-400 to-cyan-600',
  'from-violet-400 to-fuchsia-600',
  'from-lime-400 to-green-600',
  'from-slate-400 to-slate-700',
];

/** Deterministic 32-bit hash. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

@Component({
  selector: 'cv-avatar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="relative inline-flex items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2"
      [ngClass]="[sizeClasses, gradientClasses(), ringClasses() || 'ring-white dark:ring-slate-900']"
      [attr.aria-label]="name"
    >
      <span class="select-none tracking-wide">{{ initials() }}</span>
      <span
        *ngIf="status"
        class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900"
        [ngClass]="statusDotClass"
        aria-hidden="true"
      ></span>
    </span>
  `,
})
export class CvAvatarComponent {
  private readonly _name = signal('');

  @Input() set name(value: string) {
    this._name.set(value ?? '');
  }
  get name(): string {
    return this._name();
  }

  @Input() size: CvAvatarSize = 'md';
  @Input() role?: Role;
  @Input() status?: 'online' | 'away' | 'offline';

  readonly initials = computed<string>(() => this.computeInitials(this._name()));
  readonly gradientClasses = computed<string>(() => this.computeGradient());
  readonly ringClasses = computed<string>(() =>
    this.role ? RING_CLASSES[this.role] : '',
  );

  get sizeClasses(): string {
    return SIZE_CLASSES[this.size];
  }

  get statusDotClass(): string {
    switch (this.status) {
      case 'online':
        return 'bg-emerald-500';
      case 'away':
        return 'bg-amber-500';
      case 'offline':
        return 'bg-slate-400';
      default:
        return 'bg-slate-400';
    }
  }

  private computeInitials(name: string): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private computeGradient(): string {
    if (this.role) {
      const c = ROLE_COLORS[this.role];
      return `bg-gradient-to-br ${c}`;
    }
    const h = hashString(this._name() || 'anon');
    return `bg-gradient-to-br ${FALLBACK_PALETTE[h % FALLBACK_PALETTE.length]}`;
  }
}
