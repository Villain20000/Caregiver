import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { CvEmojiSliderComponent } from '../../shared/components/cv-emoji-slider/cv-emoji-slider.component';

import { WoundService } from '../../core/services/wound.service';
import { AuthService } from '../../core/services/auth.service';
import { WoundAssessment, WoundStage } from '../../core/models/wound.model';

type Filter = 'all' | WoundStage;
type Severity = 'mild' | 'moderate' | 'severe';

interface TimelineEntry { id: string; ts: number; thumb: string; location: string; severity: Severity; }

@Component({
  selector: 'cv-wound-tracker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, FormsModule,
    CvCardComponent, CvButtonComponent, CvBadgeComponent, CvModalComponent,
    CvEmojiSliderComponent,
  ],
  templateUrl: './wound-tracker.component.html',
})
export class WoundTrackerComponent {
  private readonly wounds = inject(WoundService);
  private readonly auth   = inject(AuthService);

  readonly all = this.wounds.wounds;

  readonly locations = computed<string[]>(() =>
    Array.from(new Set(this.all().map((w) => w.location))).sort(),
  );
  readonly selectedLocation = signal<string>('all');
  readonly selectedSeverity = signal<Severity | 'all'>('all');
  readonly stageFilter = signal<Filter>('all');

  readonly stageOptions: { value: Filter; label: string }[] = [
    { value: 'all',        label: 'All stages' },
    { value: 'I',          label: 'Stage I' },
    { value: 'II',         label: 'Stage II' },
    { value: 'III',        label: 'Stage III' },
    { value: 'IV',         label: 'Stage IV' },
    { value: 'unstageable',label: 'Unstageable' },
  ];

  /** Map a wound's stage to a coarse severity bucket used by the UI. */
  severityOf(w: WoundAssessment): Severity {
    if (w.stage === 'I')                       return 'mild';
    if (w.stage === 'II')                      return 'moderate';
    return 'severe';
  }

  readonly filtered = computed<WoundAssessment[]>(() => {
    const loc = this.selectedLocation();
    const sev = this.selectedSeverity();
    const st  = this.stageFilter();
    return this.all().filter((w) => {
      if (loc !== 'all' && w.location !== loc) return false;
      if (sev !== 'all' && this.severityOf(w) !== sev) return false;
      if (st  !== 'all' && w.stage !== st) return false;
      return true;
    });
  });

  /* ---- photo lightbox ---- */
  readonly lightbox = signal<WoundAssessment | null>(null);
  openLightbox(w: WoundAssessment): void { this.lightbox.set(w); }
  closeLightbox(): void { this.lightbox.set(null); }

  /* ---- upload modal ---- */
  readonly uploadOpen = signal(false);
  readonly uploadLoc = signal<string>('Sacrum');
  readonly uploadStage = signal<WoundStage>('II');
  readonly uploadSize = signal<number>(3.0);
  readonly uploadColor = signal<string>('#fb923c');
  readonly uploadDrainage = signal<'none' | 'serous' | 'sanguineous' | 'purulent'>('serous');
  readonly uploadPain = signal<number>(3);
  readonly uploadNotes = signal<string>('');

  readonly stageInputOptions: WoundStage[] = ['I', 'II', 'III', 'IV', 'unstageable'];
  readonly colorOptions = ['#fde68a', '#fb923c', '#dc2626', '#7f1d1d', '#1e293b'];

  openUpload(): void { this.uploadOpen.set(true); }
  closeUpload(): void { this.uploadOpen.set(false); }

  confirmUpload(): void {
    // The seed WoundService has no add() — augment the signal by reaching
    // around through a tiny helper. We synthesise a WoundAssessment for UI
    // purposes and add it via a workaround (the service exposes only
    // computed slices, so we mutate the underlying signal indirectly by
    // adding a new entry through the public add API or by simulating one).
    // The wound service does not provide add(); we work around it by
    // emitting a custom event into a local list.  See localUploads().
    const id = 'wnd-local-' + Math.random().toString(36).slice(2, 8);
    const fake: WoundAssessment = {
      id,
      patientId: this.auth.currentUser().id,
      location: this.uploadLoc(),
      stage: this.uploadStage(),
      lengthCm: this.uploadSize(),
      widthCm: +(this.uploadSize() * 0.8).toFixed(1),
      depthCm: 0.2,
      exudate: this.uploadDrainage() as any,
      odor: 'none',
      periWound: 'Pending in-person review',
      pain: this.uploadPain(),
      notes: this.uploadNotes() || 'Photo uploaded via tracker',
      photos: [{
        id: 'ph-' + id, takenAt: new Date().toISOString(), takenBy: this.auth.currentUser().id,
        url: this.makePlaceholderDataUri(this.uploadLoc(), this.severityFromStage(this.uploadStage())),
        width: 320, height: 240,
      }],
      assessedAt: new Date().toISOString(),
      assessedBy: this.auth.currentUser().id,
      trend: 'stable',
    };
    this.localUploads.update((list) => [fake, ...list]);
    this.closeUpload();
    this.uploadNotes.set('');
  }

  private severityFromStage(s: WoundStage): Severity {
    if (s === 'I') return 'mild';
    if (s === 'II') return 'moderate';
    return 'severe';
  }

  /** Local uploads that aren't reflected in the read-only WoundService. */
  private readonly localUploads = signal<WoundAssessment[]>([]);
  readonly allWithLocal = computed<WoundAssessment[]>(() => [...this.localUploads(), ...this.all()]);

  /** Filtered list (using allWithLocal so new uploads are visible). */
  readonly filteredAll = computed<WoundAssessment[]>(() => {
    const loc = this.selectedLocation();
    const sev = this.selectedSeverity();
    const st  = this.stageFilter();
    return this.allWithLocal().filter((w) => {
      if (loc !== 'all' && w.location !== loc) return false;
      if (sev !== 'all' && this.severityOf(w) !== sev) return false;
      if (st  !== 'all' && w.stage !== st) return false;
      return true;
    });
  });

  /** Active wound (selected for annotation). */
  readonly activeId = signal<string | null>(null);
  readonly activeWound = computed<WoundAssessment | null>(() => {
    const id = this.activeId();
    if (!id) return this.filteredAll()[0] ?? null;
    return this.filteredAll().find((w) => w.id === id) ?? null;
  });

  selectActive(id: string): void { this.activeId.set(id); }

  /* ---- timeline (chronological thumbs for active wound's patient) ---- */
  readonly timeline = computed<TimelineEntry[]>(() => {
    const active = this.activeWound();
    if (!active) return [];
    // Synthesize progression: every wound on the same location counts as
    // a snapshot (since the service is seed-only).
    const all = this.allWithLocal()
      .filter((w) => w.location === active.location)
      .sort((a, b) => a.assessedAt.localeCompare(b.assessedAt));
    return all.map((w) => ({
      id: w.id,
      ts: new Date(w.assessedAt).getTime(),
      thumb: w.photos[0]?.url ?? this.makePlaceholderDataUri(w.location, this.severityOf(w)),
      location: w.location,
      severity: this.severityOf(w),
    }));
  });

  /* ---- helpers ---- */
  severityTone(s: Severity): 'success' | 'warning' | 'danger' {
    return s === 'mild' ? 'success' : s === 'moderate' ? 'warning' : 'danger';
  }
  trendTone(t: 'improving' | 'stable' | 'worsening'): 'success' | 'neutral' | 'danger' {
    return t === 'improving' ? 'success' : t === 'worsening' ? 'danger' : 'neutral';
  }
  emojiIcons = ['😄', '🙂', '😐', '🙁', '😣'];
  painEmoji(p: number): string {
    if (p <= 1) return this.emojiIcons[0];
    if (p <= 3) return this.emojiIcons[1];
    if (p <= 5) return this.emojiIcons[2];
    if (p <= 7) return this.emojiIcons[3];
    return this.emojiIcons[4];
  }

  /** Synthesise a colourful SVG data URL used as a placeholder photo. */
  makePlaceholderDataUri(location: string, severity: Severity): string {
    const palette = severity === 'mild'
      ? { from: '#fde68a', to: '#fca5a5' }
      : severity === 'moderate'
        ? { from: '#fb923c', to: '#dc2626' }
        : { from: '#7f1d1d', to: '#1f2937' };
    const noise = Array.from({ length: 6 }, () => {
      const x = 20 + Math.random() * 60;
      const y = 20 + Math.random() * 60;
      const r = 2 + Math.random() * 4;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(255,255,255,0.25)"/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 100 75" preserveAspectRatio="none">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="${palette.from}"/>
          <stop offset="100%" stop-color="${palette.to}"/>
        </radialGradient>
        <pattern id="grid" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.3"/>
        </pattern>
      </defs>
      <rect width="100" height="75" fill="url(#g)"/>
      <rect width="100" height="75" fill="url(#grid)"/>
      <circle cx="50" cy="38" r="14" fill="rgba(0,0,0,0.45)"/>
      <circle cx="50" cy="38" r="9" fill="${palette.from}" opacity="0.85"/>
      ${noise}
      <text x="50" y="70" text-anchor="middle" font-size="4" font-family="ui-sans-serif" fill="rgba(255,255,255,0.7)">${location}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
}
