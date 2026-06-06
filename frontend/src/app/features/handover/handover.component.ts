import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvAvatarComponent } from '../../shared/components/cv-avatar/cv-avatar.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { MOCK_USERS } from '../../core/models/user.model';

type ShiftContext = 'morning' | 'evening' | 'night';

interface HandoverNote {
  id: string;
  subject: string;
  body: string;
  authorId: string;
  urgency: boolean;
  shift: ShiftContext;
  createdAt: string;
  expanded: boolean;
}

interface AudioNote {
  id: string;
  authorId: string;
  durationSec: number;
  createdAt: string;
  expanded: boolean;
}

interface NoteForm {
  subject: string;
  body: string;
  urgency: boolean;
  shift: ShiftContext;
}

const SHIFT_LABELS: Record<ShiftContext, string> = {
  morning: 'Morning',
  evening: 'Evening',
  night: 'Night',
};

const SHIFT_COLORS: Record<ShiftContext, string> = {
  morning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  evening: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  night: 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300',
};

function emptyNoteForm(): NoteForm {
  return { subject: '', body: '', urgency: false, shift: 'morning' };
}

@Component({
  selector: 'cv-handover',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent, CvAvatarComponent, CvModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">handover</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Shift Handover Notes</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Communicate shift-critical information to the next care team</p>
      </header>

      <!-- Tab bar -->
      <div class="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button
          *ngFor="let tab of tabs"
          (click)="activeTab.set(tab.id)"
          class="px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg"
          [ngClass]="activeTab() === tab.id
            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'"
        >
          <span class="flex items-center gap-2">
            <span class="h-4 w-4" [innerHTML]="tab.icon"></span>
            {{ tab.label }}
          </span>
        </button>
      </div>

      <!-- ==================== TEXT NOTES TAB ==================== -->
      <ng-container *ngIf="activeTab() === 'text'">
        <!-- Add note form -->
        <div class="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">New Handover Note</h3>
          <div>
            <input
              [ngModel]="noteForm.subject"
              (ngModelChange)="noteForm.subject = $event"
              class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Subject"
            />
          </div>
          <div>
            <textarea
              [ngModel]="noteForm.body"
              (ngModelChange)="noteForm.body = $event"
              rows="3"
              class="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Detailed handover notes..."
            ></textarea>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" [ngModel]="noteForm.urgency" (ngModelChange)="noteForm.urgency = $event" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Urgent
            </label>
            <select
              [ngModel]="noteForm.shift"
              (ngModelChange)="noteForm.shift = $event"
              class="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5"
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </select>
            <div class="ml-auto">
              <cv-button variant="primary" size="sm" [disabled]="!noteForm.subject.trim()" (click)="addTextNote()">
                Add Note
              </cv-button>
            </div>
          </div>
        </div>

        <!-- Text notes list -->
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300">All Notes ({{ textNotes().length }})</h3>

          <div *ngIf="textNotes().length === 0" class="flex flex-col items-center justify-center py-16 text-center">
            <svg class="h-16 w-16 text-slate-300 dark:text-slate-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <p class="text-sm text-slate-400 dark:text-slate-500">No handover notes yet</p>
          </div>

          <div
            *ngFor="let note of textNotes(); trackBy: trackNoteId"
            class="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden transition-all"
          >
            <div
              (click)="toggleNote(note)"
              class="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
            >
              <div class="flex items-start gap-3 min-w-0 flex-1">
                <cv-avatar [name]="userName(note.authorId)" size="sm"></cv-avatar>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ note.subject }}</h4>
                    <cv-badge *ngIf="note.urgency" tone="danger">Urgent</cv-badge>
                    <span class="text-[11px] px-1.5 py-0.5 rounded font-medium" [ngClass]="SHIFT_COLORS[note.shift]">
                      {{ SHIFT_LABELS[note.shift] }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-slate-400">{{ userName(note.authorId) }}</span>
                    <span class="text-xs text-slate-300 dark:text-slate-500">·</span>
                    <span class="text-xs text-slate-400">{{ note.createdAt | date:'MMM d, h:mm a' }}</span>
                  </div>
                </div>
              </div>
              <svg
                class="h-4 w-4 mt-1 text-slate-400 transition-transform shrink-0"
                [ngClass]="note.expanded ? 'rotate-180' : ''"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            <div
              *ngIf="note.expanded"
              class="px-4 pb-4 pt-0"
            >
              <div class="pl-11">
                <p class="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{{ note.body }}</p>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ==================== AUDIO NOTES TAB ==================== -->
      <ng-container *ngIf="activeTab() === 'audio'">
        <!-- Voice recorder simulation -->
        <div class="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/60 space-y-4">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Voice Recorder</h3>

          <div class="flex items-center justify-center gap-4">
            <!-- Record button -->
            <button
              (click)="toggleRecording()"
              class="h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200 shrink-0"
              [ngClass]="isRecording()
                ? 'bg-rose-500 shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-rose-600 hover:bg-rose-500 shadow-md'"
              [attr.aria-label]="isRecording() ? 'Stop recording' : 'Start recording'"
            >
              <svg class="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <rect *ngIf="isRecording()" x="6" y="6" width="12" height="12" rx="1"/>
                <path *ngIf="!isRecording()" d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path *ngIf="!isRecording()" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line *ngIf="!isRecording()" x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </button>

            <!-- Waveform visualization -->
            <div class="flex-1 flex items-end gap-0.5 h-12">
              <div
                *ngFor="let bar of waveformBars(); trackBy: trackBarIndex"
                class="w-1.5 rounded-full transition-all duration-150"
                [ngClass]="isRecording() ? 'bg-rose-400' : 'bg-indigo-400'"
                [style.height.%]="bar"
              ></div>
            </div>

            <!-- Timer -->
            <div class="text-lg font-mono font-bold text-slate-700 dark:text-slate-200 min-w-[80px] text-center shrink-0">
              {{ formatDuration(recordingElapsed()) }}
            </div>

            <!-- Playback controls -->
            <div class="flex items-center gap-1 shrink-0" *ngIf="!isRecording() && audioNotes().length">
              <button
                (click)="playPauseAudio()"
                class="h-10 w-10 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-colors"
                aria-label="Play / Pause"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <polygon *ngIf="!isPlaying()" points="5 3 19 12 5 21 5 3"/>
                  <rect *ngIf="isPlaying()" x="6" y="4" width="4" height="16"/>
                  <rect *ngIf="isPlaying()" x="14" y="4" width="4" height="16"/>
                </svg>
              </button>
              <button
                (click)="stopAudio()"
                class="h-10 w-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                aria-label="Stop"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Audio notes list -->
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-300">Recordings ({{ audioNotes().length }})</h3>

          <div *ngIf="audioNotes().length === 0" class="flex flex-col items-center justify-center py-16 text-center">
            <svg class="h-16 w-16 text-slate-300 dark:text-slate-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
            <p class="text-sm text-slate-400 dark:text-slate-500">No handover notes yet</p>
          </div>

          <div
            *ngFor="let note of audioNotes(); trackBy: trackAudioId"
            class="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
          >
            <div
              (click)="toggleAudioNote(note)"
              class="flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <svg class="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400">{{ userName(note.authorId) }}</span>
                    <span class="text-xs text-slate-300 dark:text-slate-500">·</span>
                    <span class="text-xs text-slate-400">{{ note.createdAt | date:'MMM d, h:mm a' }}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ formatDuration(note.durationSec) }}</span>
                    <!-- Mini waveform -->
                    <div class="flex items-end gap-px h-4">
                      <div
                        *ngFor="let h of miniWaveform"
                        class="w-0.5 rounded-full bg-indigo-300 dark:bg-indigo-500"
                        [style.height.%]="h"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              <svg
                class="h-4 w-4 text-slate-400 transition-transform shrink-0"
                [ngClass]="note.expanded ? 'rotate-180' : ''"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>

            <div *ngIf="note.expanded" class="px-4 pb-4 pt-0">
              <div class="pl-11 flex items-center gap-3">
                <cv-button variant="ghost" size="sm" (click)="$event.stopPropagation()">
                  <span cv-btn-icon-left>
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </span>
                  Play
                </cv-button>
                <span class="text-xs text-slate-400">{{ formatDuration(note.durationSec) }}</span>
                <span class="text-xs text-slate-400">Recorded by {{ userName(note.authorId) }}</span>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class HandoverComponent {
  readonly SHIFT_LABELS = SHIFT_LABELS;
  readonly SHIFT_COLORS = SHIFT_COLORS;

  readonly tabs = [
    { id: 'text' as const, label: 'Text Notes', icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
    { id: 'audio' as const, label: 'Audio Notes', icon: '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  ];

  readonly activeTab = signal<'text' | 'audio'>('text');

  // ── Text Notes ──────────────────────────────────────────────
  noteForm: NoteForm = emptyNoteForm();

  private readonly _textNotes = signal<HandoverNote[]>([]);
  readonly textNotes = this._textNotes.asReadonly();

  // ── Audio Notes ──────────────────────────────────────────────
  private readonly _audioNotes = signal<AudioNote[]>([]);
  readonly audioNotes = this._audioNotes.asReadonly();

  readonly isRecording = signal(false);
  readonly isPlaying = signal(false);
  readonly recordingElapsed = signal(0);
  private recordingInterval: ReturnType<typeof setInterval> | null = null;

  readonly waveformBars = signal<number[]>(this.generateWaveform(40));

  readonly miniWaveform = [30, 50, 40, 60, 45, 55, 35, 65, 40, 50, 60, 45];

  constructor() {
    this.seedTextNotes();
    this.seedAudioNotes();
  }

  // ── Seed data ─────────────────────────────────────────────
  private seedTextNotes(): void {
    const now = Date.now();
    this._textNotes.set([
      { id: 'hn-1', subject: 'Morphine administered at 14:30 — pat-3', body: 'Given 5mg PO for breakthrough pain. Patient reported relief within 20 minutes. Next dose due at 18:30. Monitor respiratory rate closely.', authorId: 'u-nurse1', urgency: true, shift: 'morning', createdAt: new Date(now - 3600000).toISOString(), expanded: false },
      { id: 'hn-2', subject: 'Bed alarm activated — pat-2', body: 'Patient attempted to get up unassisted at 13:15. No fall, redirected to call light. Family notified. OT re-eval recommended.', authorId: 'u-nurse2', urgency: true, shift: 'morning', createdAt: new Date(now - 7200000).toISOString(), expanded: false },
      { id: 'hn-3', subject: 'Lisinopril dose adjustment', body: 'Dr. Park increased to 20mg if SBP > 150 twice. Monitor BP at each visit. Last reading 148/92 at 09:00.', authorId: 'u-nurse1', urgency: false, shift: 'morning', createdAt: new Date(now - 10800000).toISOString(), expanded: false },
      { id: 'hn-4', subject: 'Family requested evening visit window', body: 'Sofia Mendes requested visits after 17:00 starting next week to accommodate work schedule. Coordinate with dispatch.', authorId: 'u-soc1', urgency: false, shift: 'evening', createdAt: new Date(now - 14400000).toISOString(), expanded: false },
      { id: 'hn-5', subject: 'Wound care supply low — pat-7', body: 'Only 2 hydrogel dressings remaining for right heel wound. Need reorder before Thursday. Current dressing protocol is q3d.', authorId: 'u-nurse2', urgency: true, shift: 'evening', createdAt: new Date(now - 18000000).toISOString(), expanded: false },
      { id: 'hn-6', subject: 'Dietary preferences updated', body: 'pat-4 has new renal-friendly menu approved by Dr. Faruq. Ensure no high-potassium foods. Updated meal plan is in the system.', authorId: 'u-nutr1', urgency: false, shift: 'evening', createdAt: new Date(now - 21600000).toISOString(), expanded: false },
      { id: 'hn-7', subject: 'Night shift: pat-1 glucose monitoring', body: 'Patient has been trending high (180-210) before bedtime. Check FSBS at 21:00 and 03:00. Report any values > 250.', authorId: 'u-doc1', urgency: true, shift: 'night', createdAt: new Date(now - 25200000).toISOString(), expanded: false },
      { id: 'hn-8', subject: 'OT equipment delivery expected', body: 'New tub transfer bench arriving tomorrow 10:00-12:00 for pat-2. Ensure installation before afternoon visit.', authorId: 'u-ther1', urgency: false, shift: 'morning', createdAt: new Date(now - 28800000).toISOString(), expanded: false },
      { id: 'hn-9', subject: 'Lab results due — pat-4 INR', body: 'INR was 3.1 yesterday. Dr. Faruq adjusted Warfarin to 4mg. Recheck scheduled for tomorrow 07:00. Notify if > 3.5.', authorId: 'u-nurse1', urgency: true, shift: 'night', createdAt: new Date(now - 32400000).toISOString(), expanded: false },
    ]);
  }

  private seedAudioNotes(): void {
    const now = Date.now();
    this._audioNotes.set([
      { id: 'an-1', authorId: 'u-nurse1', durationSec: 142, createdAt: new Date(now - 3600000).toISOString(), expanded: false },
      { id: 'an-2', authorId: 'u-nurse2', durationSec: 89, createdAt: new Date(now - 7200000).toISOString(), expanded: false },
      { id: 'an-3', authorId: 'u-soc1', durationSec: 215, createdAt: new Date(now - 10800000).toISOString(), expanded: false },
      { id: 'an-4', authorId: 'u-doc1', durationSec: 67, createdAt: new Date(now - 14400000).toISOString(), expanded: false },
      { id: 'an-5', authorId: 'u-nurse1', durationSec: 178, createdAt: new Date(now - 18000000).toISOString(), expanded: false },
      { id: 'an-6', authorId: 'u-ther1', durationSec: 95, createdAt: new Date(now - 21600000).toISOString(), expanded: false },
      { id: 'an-7', authorId: 'u-nurse2', durationSec: 123, createdAt: new Date(now - 25200000).toISOString(), expanded: false },
      { id: 'an-8', authorId: 'u-nutr1', durationSec: 154, createdAt: new Date(now - 28800000).toISOString(), expanded: false },
    ]);
  }

  // ── Text note methods ─────────────────────────────────────
  addTextNote(): void {
    const n = this.noteForm;
    if (!n.subject.trim()) return;
    const note: HandoverNote = {
      id: 'hn-' + Date.now(),
      subject: n.subject.trim(),
      body: n.body.trim(),
      authorId: 'u-nurse1',
      urgency: n.urgency,
      shift: n.shift,
      createdAt: new Date().toISOString(),
      expanded: false,
    };
    this._textNotes.update((list) => [note, ...list]);
    this.noteForm = emptyNoteForm();
  }

  toggleNote(note: HandoverNote): void {
    note.expanded = !note.expanded;
    this._textNotes.update((list) => [...list]);
  }

  // ── Audio note methods ─────────────────────────────────────
  toggleAudioNote(note: AudioNote): void {
    note.expanded = !note.expanded;
    this._audioNotes.update((list) => [...list]);
  }

  toggleRecording(): void {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private startRecording(): void {
    this.isRecording.set(true);
    this.recordingElapsed.set(0);
    this.waveformBars.set(this.generateWaveform(40));
    this.recordingInterval = setInterval(() => {
      this.recordingElapsed.update((s) => s + 1);
      this.waveformBars.set(this.generateWaveform(40));
    }, 1000);
  }

  private stopRecording(): void {
    this.isRecording.set(false);
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    const dur = this.recordingElapsed();
    if (dur > 0) {
      const note: AudioNote = {
        id: 'an-' + Date.now(),
        authorId: 'u-nurse1',
        durationSec: dur,
        createdAt: new Date().toISOString(),
        expanded: false,
      };
      this._audioNotes.update((list) => [note, ...list]);
    }
    this.recordingElapsed.set(0);
  }

  playPauseAudio(): void {
    this.isPlaying.update((v) => !v);
  }

  stopAudio(): void {
    this.isPlaying.set(false);
  }

  // ── Helpers ────────────────────────────────────────────────
  userName(userId: string): string {
    return MOCK_USERS.find((u) => u.id === userId)?.name ?? userId;
  }

  formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private generateWaveform(count: number): number[] {
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
      bars.push(20 + Math.random() * 80);
    }
    return bars;
  }

  trackNoteId(_i: number, n: HandoverNote): string {
    return n.id;
  }

  trackAudioId(_i: number, n: AudioNote): string {
    return n.id;
  }

  trackBarIndex(i: number): number {
    return i;
  }
}
