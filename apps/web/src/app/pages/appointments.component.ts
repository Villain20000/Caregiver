/**
 * apps/web/src/app/pages/appointments.component.ts
 *
 * Appointment Calendar page — day/week/month views with drag-and-drop rescheduling.
 *
 * 🏗️ Architecture:
 *   - Custom-built calendar (no external lib) using CSS Grid + HTML5 Drag & Drop
 *   - Three view modes: month (grid), week (hour rows × 7 days), day (hour rows)
 *   - Color-coded appointment cards by status (booked/fulfilled/cancelled/noshow/arrived)
 *   - Click an empty slot → create modal pre-filled with date/time
 *   - Click an appointment → detail modal with edit/cancel/fulfill actions
 *   - Drag appointment → drop on new slot → PATCH API for reschedule
 *
 * 📝 Angular Concepts Demonstrated:
 *   - **Standalone component** with ReactiveFormsModule + CommonModule
 *   - **Signals** for reactive state: appointments, viewMode, selectedDate, etc.
 *   - **Computed signals** for calendar grid calculations
 *   - **Reactive forms** for creation + edit modals
 *   - **Native HTML5 Drag & Drop** API (dragstart, dragover, drop events)
 *   - **@if/@for** control flow blocks (Angular 17+)
 *   - **| date** pipe for formatted date/time display
 *   - **Dependency injection** via inject()
 */
import { Component, inject, signal, computed, type OnInit, type OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service.js';
import type { AppointmentResponse } from '@caregiver/contracts';

// ── Type helpers ─────────────────────────────────────────────────────────
type ViewMode = 'month' | 'week' | 'day';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  appointments: AppointmentResponse[];
}

interface HourSlot {
  hour: number; // 0-23
  label: string; // "8:00 AM"
  date: Date;
}

// ── Status color map ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'booked': { bg: '#e3f2fd', text: '#1565c0', dot: '#1565c0' },
  'checked-in': { bg: '#e0f2f1', text: '#00695c', dot: '#00695c' },
  'arrived': { bg: '#e8f5e9', text: '#2e7d32', dot: '#2e7d32' },
  'fulfilled': { bg: '#e8f5e9', text: '#2e7d32', dot: '#2e7d32' },
  'cancelled': { bg: '#ffebee', text: '#c62828', dot: '#c62828' },
  'noshow': { bg: '#fce4ec', text: '#880e4f', dot: '#880e4f' },
  'proposed': { bg: '#fff3e0', text: '#e65100', dot: '#e65100' },
  'entered-in-error': { bg: '#f3e5f5', text: '#6a1b9a', dot: '#6a1b9a' },
  'waitlist': { bg: '#e8eaf6', text: '#3949ab', dot: '#3949ab' },
};

const DEFAULT_STATUS_COLOR = { bg: '#f5f5f5', text: '#616161', dot: '#616161' };

function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? DEFAULT_STATUS_COLOR;
}

// ── Date helpers ──────────────────────────────────────────────────────────
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- ═══ PAGE HEADER ═══ -->
    <div class="page page-wide">
      <div class="page-header">
        <div>
          <h1 class="page-title">Appointments</h1>
          <p class="page-subtitle">Schedule, view, and manage patient appointments.</p>
        </div>
        <div class="header-actions">
          <button class="secondary-btn" (click)="goToToday()">Today</button>
          <button class="icon-btn" (click)="goBack()" title="Previous" aria-label="Previous">
            ◀
          </button>
          <button class="icon-btn" (click)="goForward()" title="Next" aria-label="Next">▶</button>
          <div class="view-toggle">
            <button [class.active]="viewMode() === 'month'" (click)="viewMode.set('month')">
              Month
            </button>
            <button [class.active]="viewMode() === 'week'" (click)="viewMode.set('week')">
              Week
            </button>
            <button [class.active]="viewMode() === 'day'" (click)="viewMode.set('day')">Day</button>
          </div>
          @if (canSchedule()) {
            <button class="primary-btn" (click)="openCreateModal()">+ New</button>
          }
        </div>
      </div>

      <!-- ═══ PERIOD TITLE ═══ -->
      <div class="period-title">{{ periodTitle() }}</div>

      <!-- ═══ ERROR ═══ -->
      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <!-- ═══ LOADING ═══ -->
      @if (loading()) {
        <div class="loading"><span class="spinner"></span> Loading appointments...</div>
      }

      <!-- ════════════════════════════════════════════════════ -->
      <!-- MONTH VIEW                                         -->
      <!-- ════════════════════════════════════════════════════ -->
      @if (!loading() && viewMode() === 'month') {
        <div class="calendar month-view">
          <div class="day-headers">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span> <span>Fri</span
            ><span>Sat</span><span>Sun</span>
          </div>
          <div class="month-grid">
            @for (day of monthDays(); track day.date.toISOString()) {
              <div
                class="day-cell"
                [class.other-month]="!day.isCurrentMonth"
                [class.today]="day.isToday"
                (click)="onSlotClick(day.date, viewMode())"
                (dragover)="onDragOver($event)"
                (drop)="onDrop($event, day.date)"
              >
                <span class="day-number">{{ day.date.getDate() }}</span>
                <div class="day-appts">
                  @for (apt of day.appointments.slice(0, 3); track apt.id) {
                    <div
                      class="apt-chip"
                      [style]="{
                        background: getStatusColor(apt.status).bg,
                        color: getStatusColor(apt.status).text,
                        borderLeftColor: getStatusColor(apt.status).dot,
                      }"
                      draggable="true"
                      (dragstart)="onDragStart($event, apt)"
                      (click)="$event.stopPropagation(); openDetailModal(apt)"
                      [title]="formatTime(newDate(apt.start)) + ' - ' + apt.reason"
                    >
                      {{ formatTime(newDate(apt.start)) }}
                    </div>
                  }
                  @if (day.appointments.length > 3) {
                    <span class="more-link">+{{ day.appointments.length - 3 }} more</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ════════════════════════════════════════════════════ -->
      <!-- WEEK VIEW                                          -->
      <!-- ════════════════════════════════════════════════════ -->
      @if (!loading() && viewMode() === 'week') {
        <div class="calendar time-view week-view">
          <div class="day-headers">
            <span class="time-gutter"></span>
            @for (d of weekDays(); track d.toISOString()) {
              <span
                class="day-header-cell"
                [class.today]="isToday(d)"
                (click)="viewMode.set('day'); selectedDate.set(d)"
              >
                {{ d.toLocaleDateString('en-US', { weekday: 'short' }) }}
                <span class="day-header-num">{{ d.getDate() }}</span>
              </span>
            }
          </div>
          <div class="time-body">
            @for (slot of timeSlots(); track slot.hour) {
              <div class="hour-row">
                <span class="hour-label">{{ slot.label }}</span>
                @for (day of weekDays(); track day.toISOString()) {
                  <div
                    class="hour-cell"
                    (click)="onSlotClick(newDate(day), viewMode(), slot.hour)"
                    (dragover)="onDragOver($event)"
                    (drop)="onDrop($event, newDate(day), slot.hour)"
                  >
                    @for (apt of getApptsForHour(day, slot.hour); track apt.id) {
                      <div
                        class="apt-block"
                        [style]="{
                          background: getStatusColor(apt.status).bg,
                          color: getStatusColor(apt.status).text,
                          borderLeftColor: getStatusColor(apt.status).dot,
                        }"
                        draggable="true"
                        (dragstart)="onDragStart($event, apt)"
                        (click)="$event.stopPropagation(); openDetailModal(apt)"
                      >
                        <span class="apt-block-time">{{ formatTime(newDate(apt.start)) }}</span>
                        <span class="apt-block-reason truncate">{{
                          apt.reason || 'No reason'
                        }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- ════════════════════════════════════════════════════ -->
      <!-- DAY VIEW                                           -->
      <!-- ════════════════════════════════════════════════════ -->
      @if (!loading() && viewMode() === 'day') {
        <div class="calendar time-view day-view">
          <div class="day-header-large">
            <span class="day-header-date">{{ selectedDate() | date: 'fullDate' }}</span>
          </div>
          <div class="time-body">
            @for (slot of timeSlots(); track slot.hour) {
              <div class="hour-row">
                <span class="hour-label">{{ slot.label }}</span>
                <div
                  class="hour-cell day-hour-cell"
                  (click)="onSlotClick(selectedDate(), viewMode(), slot.hour)"
                  (dragover)="onDragOver($event)"
                  (drop)="onDrop($event, selectedDate(), slot.hour)"
                >
                  @for (apt of getApptsForHour(selectedDate(), slot.hour); track apt.id) {
                    <div
                      class="apt-block"
                      [style]="{
                        background: getStatusColor(apt.status).bg,
                        color: getStatusColor(apt.status).text,
                        borderLeftColor: getStatusColor(apt.status).dot,
                      }"
                      draggable="true"
                      (dragstart)="onDragStart($event, apt)"
                      (click)="$event.stopPropagation(); openDetailModal(apt)"
                    >
                      <span class="apt-block-time">{{ formatTime(newDate(apt.start)) }}</span>
                      <span class="apt-block-reason truncate">{{ apt.reason || 'No reason' }}</span>
                      <span class="apt-block-patient truncate">{{ apt.patientId }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ═══ EMPTY STATE ═══ -->
      @if (!loading() && appointments().length === 0) {
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <p class="empty-state-text">No appointments found.</p>
          @if (canSchedule()) {
            <button class="primary-btn" (click)="openCreateModal()" style="margin-top: 1rem;">
              Schedule Your First Appointment
            </button>
          }
        </div>
      }

      <!-- ════════════════════════════════════════════════════ -->
      <!-- CREATE / EDIT MODAL                                 -->
      <!-- ════════════════════════════════════════════════════ -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div
            class="modal"
            role="dialog"
            aria-modal="true"
            [attr.aria-label]="editingAppointment() ? 'Edit Appointment' : 'Schedule Appointment'"
            (click)="$event.stopPropagation()"
          >
            <div class="modal-header">
              <h2 id="modal-title">
                {{ editingAppointment() ? 'Edit Appointment' : 'Schedule Appointment' }}
              </h2>
              <button class="icon-btn" (click)="closeModal()" aria-label="Close dialog">✕</button>
            </div>
            <form [formGroup]="appointmentForm" (ngSubmit)="onSubmit()">
              <div class="form-row">
                <div class="form-field">
                  <label for="patientId">Patient ID</label>
                  <input id="patientId" type="text" formControlName="patientId" />
                </div>
                <div class="form-field">
                  <label for="practitionerId">Practitioner ID</label>
                  <input id="practitionerId" type="text" formControlName="practitionerId" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-field">
                  <label for="start">Start Time</label>
                  <input id="start" type="datetime-local" formControlName="start" />
                </div>
                <div class="form-field">
                  <label for="end">End Time</label>
                  <input id="end" type="datetime-local" formControlName="end" />
                </div>
              </div>
              <div class="form-field">
                <label for="reason">Reason</label>
                <input id="reason" type="text" formControlName="reason" />
              </div>
              <div class="modal-actions">
                <button type="button" class="secondary-btn" (click)="closeModal()">Cancel</button>
                <button type="submit" class="primary-btn" [disabled]="saving()">
                  {{ saving() ? 'Saving...' : editingAppointment() ? 'Update' : 'Schedule' }}
                </button>
              </div>
            </form>
            @if (editingAppointment()) {
              <div class="modal-footer-actions">
                <button class="danger-btn" (click)="onCancelAppointment(editingAppointment()!.id)">
                  Cancel Appointment
                </button>
                <button class="action-btn" (click)="onFulfillAppointment(editingAppointment()!.id)">
                  Mark Fulfilled
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- ═══ DETAIL MODAL (read-only view) ═══ -->
      @if (showDetail() && selectedAppt()) {
        @let apt = selectedAppt()!;
        <div class="modal-backdrop" (click)="showDetail.set(false)">
          <div
            class="modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Appointment details"
            (click)="$event.stopPropagation()"
          >
            <div class="modal-header">
              <h2 id="detail-modal-title">Appointment Details</h2>
              <button class="icon-btn" (click)="showDetail.set(false)" aria-label="Close dialog">
                ✕
              </button>
            </div>
            <div class="detail-body">
              <div
                class="detail-status-bar"
                [style]="{
                  background: getStatusColor(apt.status).bg,
                  color: getStatusColor(apt.status).text,
                }"
              >
                <span
                  class="status-dot"
                  [style]="{ background: getStatusColor(apt.status).dot }"
                ></span>
                {{ apt.status | uppercase }}
              </div>
              <div class="detail-row">
                <span class="detail-label">Patient</span>
                <span class="detail-value">{{ apt.patientId }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Practitioner</span>
                <span class="detail-value">{{ apt.practitionerId }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date</span>
                <span class="detail-value">{{ newDate(apt.start) | date: 'fullDate' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time</span>
                <span class="detail-value"
                  >{{ formatTime(newDate(apt.start)) }} – {{ formatTime(newDate(apt.end)) }}</span
                >
              </div>
              @if (apt.reason) {
                <div class="detail-row">
                  <span class="detail-label">Reason</span>
                  <span class="detail-value">{{ apt.reason }}</span>
                </div>
              }
              @if (apt.notes) {
                <div class="detail-row">
                  <span class="detail-label">Notes</span>
                  <span class="detail-value">{{ apt.notes }}</span>
                </div>
              }
            </div>
            <div
              class="modal-header"
              style="border-top: 1px solid var(--color-border); padding-top: 1rem;"
            >
              <button class="secondary-btn" (click)="onEditFromDetail(apt)">✏️ Edit</button>
              @if (apt.status === 'booked') {
                <div class="modal-footer-actions">
                  <button
                    class="danger-btn"
                    (click)="onCancelAppointment(apt.id); showDetail.set(false)"
                  >
                    Cancel
                  </button>
                  <button
                    class="action-btn"
                    (click)="onFulfillAppointment(apt.id); showDetail.set(false)"
                  >
                    Fulfill
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* ═══ HEADER ═══ */
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-white);
        cursor: pointer;
        font-size: 0.85rem;
        transition:
          background var(--transition-fast),
          border-color var(--transition-fast);
      }
      .icon-btn:hover {
        background: var(--color-fill-hover);
        border-color: var(--color-primary-light);
      }

      /* ═══ VIEW TOGGLE ═══ */
      .view-toggle {
        display: inline-flex;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .view-toggle button {
        padding: 0.4rem 0.8rem;
        border: none;
        background: var(--color-white);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition:
          background var(--transition-fast),
          color var(--transition-fast);
      }
      .view-toggle button:not(:last-child) {
        border-right: 1px solid var(--color-border);
      }
      .view-toggle button.active {
        background: var(--color-primary);
        color: white;
      }
      .view-toggle button:hover:not(.active) {
        background: var(--color-fill-hover);
      }

      /* ═══ PERIOD TITLE ═══ */
      .period-title {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        margin-bottom: var(--space-3);
      }

      /* ════════════════════════════════════════════════════════
       MONTH VIEW
       ════════════════════════════════════════════════════════ */
      .calendar {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .day-headers {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        background: var(--color-primary-bg);
        border-bottom: 1px solid var(--color-border);
      }
      .day-headers span {
        padding: 0.6rem 0.5rem;
        text-align: center;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-primary);
      }
      .month-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
      }
      .day-cell {
        min-height: 110px;
        padding: 0.3rem;
        border-right: 1px solid var(--color-border-light);
        border-bottom: 1px solid var(--color-border-light);
        cursor: pointer;
        transition: background var(--transition-fast);
        position: relative;
      }
      .day-cell:nth-child(7n) {
        border-right: none;
      }
      .day-cell:hover {
        background: var(--color-fill-hover);
      }
      .day-cell.other-month {
        background: var(--color-fill-hover);
        opacity: 0.4;
      }
      .day-cell.today {
        background: var(--color-primary-surface);
      }
      .day-number {
        display: inline-block;
        width: 26px;
        height: 26px;
        line-height: 26px;
        text-align: center;
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-text-primary);
        border-radius: 50%;
        margin-bottom: 0.2rem;
      }
      .today .day-number {
        background: var(--color-primary);
        color: white;
      }
      .day-appts {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .apt-chip {
        font-size: 0.65rem;
        padding: 1px 5px;
        border-radius: 3px;
        border-left: 3px solid;
        cursor: grab;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: transform var(--transition-fast);
      }
      .apt-chip:active {
        cursor: grabbing;
        transform: scale(0.95);
      }
      .apt-chip:hover {
        opacity: 0.85;
      }
      .more-link {
        font-size: 0.65rem;
        color: var(--color-accent);
        cursor: pointer;
        padding: 1px 5px;
      }

      /* ════════════════════════════════════════════════════════
       WEEK / DAY VIEW
       ════════════════════════════════════════════════════════ */
      .time-view .day-headers {
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .day-header-cell {
        padding: 0.5rem;
        text-align: center;
        cursor: pointer;
        transition: background var(--transition-fast);
      }
      .day-header-cell:hover {
        background: var(--color-accent-light);
      }
      .day-header-cell.today .day-header-num {
        background: var(--color-primary);
        color: white;
        border-radius: 50%;
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .day-header-num {
        display: block;
        font-size: 1.1rem;
        font-weight: var(--font-bold);
        margin-top: 0.2rem;
      }
      .day-header-large {
        padding: 1rem;
        background: var(--color-primary-bg);
        border-bottom: 1px solid var(--color-border);
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--color-primary);
      }
      .time-gutter {
        min-width: 65px;
      }
      .time-body {
        max-height: 600px;
        overflow-y: auto;
      }
      .hour-row {
        display: grid;
        grid-template-columns: 65px repeat(7, 1fr);
        border-bottom: 1px solid var(--color-border-light);
        min-height: 48px;
      }
      .day-view .hour-row {
        grid-template-columns: 65px 1fr;
      }
      .hour-label {
        padding: 0.3rem 0.5rem;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        text-align: right;
        border-right: 1px solid var(--color-border-light);
      }
      .hour-cell {
        min-height: 48px;
        padding: 2px;
        border-right: 1px solid var(--color-border-light);
        cursor: pointer;
        transition: background var(--transition-fast);
      }
      .hour-cell:hover {
        background: var(--color-fill-hover);
      }
      .hour-cell:nth-child(8) {
        border-right: none;
      }
      .day-hour-cell {
        border-right: none;
      }
      .apt-block {
        font-size: 0.7rem;
        padding: 2px 6px;
        margin-bottom: 1px;
        border-radius: 3px;
        border-left: 3px solid;
        cursor: grab;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: transform var(--transition-fast);
      }
      .apt-block:active {
        cursor: grabbing;
        transform: scale(0.97);
      }
      .apt-block:hover {
        opacity: 0.85;
      }
      .apt-block-time {
        font-weight: var(--font-semibold);
      }
      .apt-block-reason {
        margin-left: 0.3rem;
      }
      .apt-block-patient {
        margin-left: 0.3rem;
        opacity: 0.7;
      }

      /* ═══ MODALS ═══ */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: var(--z-modal-backdrop);
        animation: fadeIn 150ms ease;
      }
      .modal {
        background: var(--color-surface);
        border-radius: var(--radius-xl);
        padding: var(--space-6);
        width: 90%;
        max-width: 520px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: var(--shadow-xl);
        animation: slideUp 200ms ease;
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-4);
      }
      .modal-header h2 {
        margin: 0;
        font-size: var(--text-lg);
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
        margin-top: var(--space-4);
      }
      .modal-footer-actions {
        display: flex;
        gap: var(--space-3);
        margin-top: var(--space-3);
      }
      .detail-modal {
        max-width: 460px;
      }
      .detail-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .detail-status-bar {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
      }
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .detail-row {
        display: flex;
        gap: var(--space-3);
      }
      .detail-label {
        width: 100px;
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-text-muted);
        flex-shrink: 0;
      }
      .detail-value {
        font-size: var(--text-base);
        color: var(--color-text-primary);
        word-break: break-word;
      }

      /* ═══ DRAG-OVER STATE ═══ */
      .day-cell.drag-over,
      .hour-cell.drag-over {
        background: var(--color-accent-light) !important;
        outline: 2px dashed var(--color-accent);
        outline-offset: -2px;
      }

      /* ═══ RESPONSIVE ═══ */
      @media (max-width: 768px) {
        .day-cell {
          min-height: 70px;
          font-size: 0.75rem;
        }
        .day-headers span {
          font-size: 0.65rem;
          padding: 0.3rem;
        }
        .view-toggle button {
          padding: 0.3rem 0.5rem;
          font-size: 0.75rem;
        }
        .hour-row {
          min-height: 36px;
        }
        .hour-label {
          font-size: 0.6rem;
          min-width: 45px;
        }
        .time-body {
          max-height: 400px;
        }
        .week-view .hour-row {
          grid-template-columns: 45px repeat(7, 1fr);
        }
        .day-view .hour-row {
          grid-template-columns: 45px 1fr;
        }
        .header-actions {
          width: 100%;
        }
        .modal {
          padding: var(--space-4);
        }
      }
    `,
  ],
})
export class AppointmentsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

  // ── Signals ────────────────────────────────────────────────────────────
  readonly appointments = signal<AppointmentResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly viewMode = signal<ViewMode>('month');
  readonly selectedDate = signal(new Date());

  // Modal state
  readonly showModal = signal(false);
  readonly showDetail = signal(false);
  readonly selectedAppt = signal<AppointmentResponse | null>(null);
  readonly editingAppointment = signal<AppointmentResponse | null>(null);

  // Drag state
  private draggedAppt: AppointmentResponse | null = null;

  readonly appointmentForm = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    practitionerId: ['', [Validators.required]],
    start: ['', [Validators.required]],
    end: ['', [Validators.required]],
    reason: [''],
  });

  readonly canSchedule = computed(() => {
    const role = this.authService.userRole();
    return role === 'doctor' || role === 'admin' || role === 'nurse';
  });

  // ── Computed: month grid ────────────────────────────────────────────────
  readonly monthDays = computed<CalendarDay[]>(() => {
    const date = this.selectedDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const totalDays = daysInMonth(year, month);
    // Map Sunday=0 → Monday index (0=Mon, 6=Sun)
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const days: CalendarDay[] = [];
    const today = new Date();

    // Leading days from previous month
    const prevMonthDays = daysInMonth(year, month - 1 < 0 ? 11 : month - 1);
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, today), appointments: [] });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, isToday: isSameDay(d, today), appointments: [] });
    }

    // Trailing days from next month (fill to complete last row)
    const remaining = 7 - (days.length % 7 || 7);
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, today), appointments: [] });
    }

    // Distribute appointments to days
    for (const apt of this.appointments()) {
      const aptDate = new Date(apt.start);
      const day = days.find((d) => isSameDay(d.date, aptDate));
      if (day) day.appointments.push(apt);
    }

    return days;
  });

  // ── Computed: week day headers ──────────────────────────────────────────
  readonly weekDays = computed<Date[]>(() => {
    const start = startOfWeek(this.selectedDate());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  });

  // ── Computed: hour slots (7 AM – 8 PM) ──────────────────────────────────
  readonly timeSlots = computed<HourSlot[]>(() => {
    const slots: HourSlot[] = [];
    for (let h = 7; h <= 20; h++) {
      const period = h >= 12 ? 'PM' : 'AM';
      const display = h > 12 ? h - 12 : h;
      slots.push({ hour: h, label: `${display}:00 ${period}`, date: this.selectedDate() });
    }
    return slots;
  });

  // ── Computed: period title ──────────────────────────────────────────────
  readonly periodTitle = computed(() => {
    const date = this.selectedDate();
    switch (this.viewMode()) {
      case 'month':
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'week': {
        const start = startOfWeek(date);
        const end = endOfWeek(date);
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      case 'day':
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
    }
  });

  // ── Helpers exposed to template ─────────────────────────────────────────
  protected readonly formatTime = formatTime;
  protected readonly newDate = (s: string | Date) => new Date(s);
  protected readonly getStatusColor = getStatusColor;
  protected readonly isToday = (d: Date) => isSameDay(d, new Date());

  // ── Computed: appointment lookup cache (for performance) ───────────────
  private readonly apptTimeLookup = computed(() => {
    const map = new Map<string, AppointmentResponse[]>();
    for (const apt of this.appointments()) {
      const date = new Date(apt.start);
      const key = `${date.toDateString()}|${date.getHours()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    }
    return map;
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadAppointments();
    // Close modals on Escape key (accessibility: WCAG 2.1.2)
    window.addEventListener('keydown', this.onKeyDown);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.showModal()) this.closeModal();
      if (this.showDetail()) this.showDetail.set(false);
    }
  };

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  // ── Data loading ────────────────────────────────────────────────────────
  private async loadAppointments(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const appointments = await this.http
        .get<AppointmentResponse[]>('/api/appointments')
        .toPromise();
      if (appointments) this.appointments.set(appointments);
    } catch {
      this.error.set('Failed to load appointments.');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────
  goToToday(): void {
    this.selectedDate.set(new Date());
  }

  goBack(): void {
    this.selectedDate.update((d) => {
      const newDate = new Date(d);
      switch (this.viewMode()) {
        case 'month':
          newDate.setMonth(d.getMonth() - 1);
          break;
        case 'week':
          newDate.setDate(d.getDate() - 7);
          break;
        case 'day':
          newDate.setDate(d.getDate() - 1);
          break;
      }
      return newDate;
    });
  }

  goForward(): void {
    this.selectedDate.update((d) => {
      const newDate = new Date(d);
      switch (this.viewMode()) {
        case 'month':
          newDate.setMonth(d.getMonth() + 1);
          break;
        case 'week':
          newDate.setDate(d.getDate() + 7);
          break;
        case 'day':
          newDate.setDate(d.getDate() + 1);
          break;
      }
      return newDate;
    });
  }

  // ── Modal: Create / Edit ───────────────────────────────────────────────
  openCreateModal(): void {
    this.editingAppointment.set(null);
    this.appointmentForm.reset();
    // Pre-fill with current date/time context
    this.appointmentForm.patchValue({
      start: this.toDatetimeLocal(new Date()),
      end: this.toDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
    });
    this.showModal.set(true);
  }

  private toDatetimeLocal(date: Date): string {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  onSlotClick(date: Date, mode: ViewMode, hour?: number): void {
    if (!this.canSchedule()) return;
    const start = new Date(date);
    if (hour !== undefined) start.setHours(hour, 0, 0, 0);
    else start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    this.editingAppointment.set(null);
    this.appointmentForm.patchValue({
      patientId: '',
      practitionerId: '',
      start: this.toDatetimeLocal(start),
      end: this.toDatetimeLocal(end),
      reason: '',
    });
    this.showModal.set(true);
  }

  openDetailModal(apt: AppointmentResponse): void {
    this.selectedAppt.set(apt);
    this.showDetail.set(true);
  }

  onEditFromDetail(apt: AppointmentResponse): void {
    this.showDetail.set(false);
    this.editingAppointment.set(apt);
    this.appointmentForm.patchValue({
      patientId: apt.patientId,
      practitionerId: apt.practitionerId,
      start: this.toDatetimeLocal(new Date(apt.start)),
      end: this.toDatetimeLocal(new Date(apt.end)),
      reason: apt.reason || '',
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingAppointment.set(null);
  }

  // ── Submit create / update ──────────────────────────────────────────────
  async onSubmit(): Promise<void> {
    if (this.appointmentForm.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const fv = this.appointmentForm.getRawValue();
      const payload = {
        patientId: fv.patientId,
        practitionerId: fv.practitionerId,
        start: new Date(fv.start).toISOString(),
        end: new Date(fv.end).toISOString(),
        reason: fv.reason || undefined,
      };

      const editing = this.editingAppointment();
      if (editing) {
        const result = await this.http
          .patch<AppointmentResponse>(`/api/appointments/${editing.id}`, payload)
          .toPromise();
        if (result)
          this.appointments.update((prev) => prev.map((a) => (a.id === editing.id ? result : a)));
      } else {
        const result = await this.http
          .post<AppointmentResponse>('/api/appointments', payload)
          .toPromise();
        if (result) this.appointments.update((prev) => [result, ...prev]);
      }
      this.closeModal();
    } catch {
      this.error.set('Failed to save appointment.');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Quick actions ──────────────────────────────────────────────────────
  async onCancelAppointment(id: string): Promise<void> {
    this.error.set(null);
    try {
      const result = await this.http
        .patch<AppointmentResponse>(`/api/appointments/${id}`, { status: 'cancelled' })
        .toPromise();
      if (result) this.appointments.update((prev) => prev.map((a) => (a.id === id ? result : a)));
      this.closeModal();
      this.showDetail.set(false);
    } catch {
      this.error.set('Failed to cancel appointment.');
    }
  }

  async onFulfillAppointment(id: string): Promise<void> {
    this.error.set(null);
    try {
      const result = await this.http
        .patch<AppointmentResponse>(`/api/appointments/${id}`, { status: 'fulfilled' })
        .toPromise();
      if (result) this.appointments.update((prev) => prev.map((a) => (a.id === id ? result : a)));
      this.closeModal();
      this.showDetail.set(false);
    } catch {
      this.error.set('Failed to fulfill appointment.');
    }
  }

  // ── Drag-and-Drop Rescheduling ─────────────────────────────────────────
  onDragStart(event: DragEvent, apt: AppointmentResponse): void {
    this.draggedAppt = apt;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', apt.id);
    }
    // Clean up drag-over state if drag is cancelled (Escape/drop outside)
    (event.target as HTMLElement).addEventListener(
      'dragend',
      () => {
        document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
        this.draggedAppt = null;
      },
      { once: true },
    );
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const target = event.currentTarget as HTMLElement;
    target.classList.add('drag-over');
  }

  async onDrop(event: DragEvent, date: Date, hour?: number): Promise<void> {
    event.preventDefault();
    // Remove drag-over class from all cells
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));

    const apt = this.draggedAppt;
    if (!apt || !this.canSchedule()) return;
    this.draggedAppt = null;

    const oldStart = new Date(apt.start);
    const oldEnd = new Date(apt.end);
    const duration = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(date);
    if (hour !== undefined) {
      newStart.setHours(hour, 0, 0, 0);
    } else {
      // Keep the original time but move to the new date
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    }
    const newEnd = new Date(newStart.getTime() + duration);

    this.error.set(null);
    try {
      const result = await this.http
        .patch<AppointmentResponse>(`/api/appointments/${apt.id}`, {
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
        })
        .toPromise();
      if (result)
        this.appointments.update((prev) => prev.map((a) => (a.id === apt.id ? result : a)));
    } catch {
      this.error.set('Failed to reschedule appointment.');
    }
  }

  // ── Helper: get appointments for a specific hour/day (uses memoized lookup) ─
  getApptsForHour(date: Date, hour: number): AppointmentResponse[] {
    const key = `${date.toDateString()}|${hour}`;
    return this.apptTimeLookup().get(key) ?? [];
  }
}
