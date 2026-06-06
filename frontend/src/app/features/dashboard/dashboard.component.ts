import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvEmojiSliderComponent } from '../../shared/components/cv-emoji-slider/cv-emoji-slider.component';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { VitalsService } from '../../core/services/vitals.service';
import { TaskService } from '../../core/services/task.service';
import { IncidentService } from '../../core/services/incident.service';
import { InventoryService } from '../../core/services/inventory.service';
import { MedicationService } from '../../core/services/medication.service';
import { BillingService } from '../../core/services/billing.service';
import { ScheduleService } from '../../core/services/schedule.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { RoleService } from '../../core/services/role.service';

@Component({
  selector: 'cv-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CvCardComponent,
    CvBadgeComponent,
    CvStatTileComponent,
    CvButtonComponent,
    CvEmojiSliderComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Welcome Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <cv-badge tone="primary" [dot]="true">dashboard</cv-badge>
          <cv-badge tone="neutral">{{ kpis().roleLabel }}</cv-badge>
          <cv-badge tone="neutral" *ngIf="kpis().syncState !== 'online'">Sync: {{ kpis().syncLabel }}</cv-badge>
        </div>

        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Welcome back, {{ currentUser().name }}
        </h1>

        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
          Logged in as {{ kpis().roleLabel }}. Your role-specific metrics and action shortcuts update in real time.
        </p>
      </header>

      <!-- Dynamic Dashboard Switcher based on Role -->
      <ng-container [ngSwitch]="activeRole()">

        <!-- 1. CLINICAL DASHBOARD (Nurses, Doctors, Therapists) -->
        <ng-container *ngSwitchCase="'nurse'">
          <ng-container *ngTemplateOutlet="clinicalLayout"></ng-container>
        </ng-container>
        <ng-container *ngSwitchCase="'doctor'">
          <ng-container *ngTemplateOutlet="clinicalLayout"></ng-container>
        </ng-container>
        <ng-container *ngSwitchCase="'therapist'">
          <ng-container *ngTemplateOutlet="clinicalLayout"></ng-container>
        </ng-container>

        <!-- 2. FINANCE / BILLING DASHBOARD (Billing Auditors) -->
        <ng-container *ngSwitchCase="'billing'">
          <ng-container *ngTemplateOutlet="billingLayout"></ng-container>
        </ng-container>

        <!-- 3. PATIENT & FAMILY PORTAL (Care Receivers and Loved Ones) -->
        <ng-container *ngSwitchCase="'patient'">
          <ng-container *ngTemplateOutlet="patientLayout"></ng-container>
        </ng-container>
        <ng-container *ngSwitchCase="'family'">
          <ng-container *ngTemplateOutlet="patientLayout"></ng-container>
        </ng-container>

        <!-- 4. OPERATIONS & ADMINISTRATION (Admins, Dispatchers, Social Workers, Nutritionists) -->
        <ng-container *ngSwitchDefault>
          <ng-container *ngTemplateOutlet="opsLayout"></ng-container>
        </ng-container>

      </ng-container>
    </div>

    <!-- ========================================== -->
    <!-- CLINICAL LAYOUT TEMPLATE                   -->
    <!-- ========================================== -->
    <ng-template #clinicalLayout>
      <!-- KPIs -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <cv-stat-tile label="My Patients" [value]="kpis().patientCount" icon="👥" tone="primary" sub="Active cases"></cv-stat-tile>
        <cv-stat-tile label="Vitals Alerts" [value]="kpis().vitalsCriticalCount" icon="📈" [tone]="kpis().vitalsCriticalCount > 0 ? 'danger' : 'neutral'" sub="Needs attention"></cv-stat-tile>
        <cv-stat-tile label="My Tasks" [value]="myTasksCount()" icon="⏱️" tone="warning" sub="Todo or in-progress"></cv-stat-tile>
        <cv-stat-tile label="Open Incidents" [value]="kpis().openIncidents" icon="🚨" tone="danger" sub="Critical: {{ kpis().criticalIncidents }}"></cv-stat-tile>
      </section>

      <!-- Main Panels -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Vitals Alerts Watchlist -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card title="Clinical Vitals Watchlist" subtitle="Patients with critical or abnormal readings">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th class="pb-2">Patient ID</th>
                    <th class="pb-2">Flag</th>
                    <th class="pb-2">Vitals Summary</th>
                    <th class="pb-2">Recorded</th>
                    <th class="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
                  <tr *ngFor="let v of alertVitals()" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td class="py-3 font-medium text-slate-900 dark:text-slate-100">{{ v.patientId }}</td>
                    <td class="py-3">
                      <cv-badge [tone]="v.flag === 'critical' ? 'danger' : 'warning'">{{ v.flag }}</cv-badge>
                    </td>
                    <td class="py-3">
                      BP {{ v.systolic }}/{{ v.diastolic }} · HR {{ v.hr }} · SpO2 {{ v.spo2 }}% · Temp {{ v.temp }}°F
                    </td>
                    <td class="py-3 text-slate-500 dark:text-slate-400 text-xs">{{ v.timestamp | date:'shortTime' }}</td>
                    <td class="py-3 text-right">
                      <cv-button variant="ghost" size="sm" (click)="addNoteToVitals(v.id)">Note</cv-button>
                    </td>
                  </tr>
                  <tr *ngIf="alertVitals().length === 0">
                    <td colspan="5" class="py-6 text-center text-slate-400 dark:text-slate-500">
                      All patient vitals are stable. No flags active.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </cv-card>

          <!-- Assigned Tasks -->
          <cv-card title="My Pending Assignments" subtitle="Tasks assigned to you on the Kanban board">
            <div class="space-y-3">
              <div *ngFor="let t of myPendingTasks()" class="flex items-center justify-between border border-slate-100 dark:border-slate-800/70 rounded-xl p-3 bg-white dark:bg-slate-900/20">
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ t.title }}</span>
                  <span class="text-xs text-slate-400 dark:text-slate-500">Patient: {{ t.patientId || 'Global' }} · Due: {{ t.due | date:'short' }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <cv-badge [tone]="t.priority === 'urgent' || t.priority === 'high' ? 'danger' : 'neutral'">{{ t.priority }}</cv-badge>
                  <cv-button variant="primary" size="sm" (click)="completeTask(t.id)">Done</cv-button>
                </div>
              </div>
              <div *ngIf="myPendingTasks().length === 0" class="py-6 text-center text-slate-400 dark:text-slate-500">
                You are all caught up! No pending tasks assigned.
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar Panel -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card title="Clinical Actions" subtitle="Shortcuts & Tools">
            <div class="flex flex-col gap-3">
              <div class="rounded-xl border border-indigo-100 dark:border-indigo-500/10 bg-indigo-50/30 dark:bg-indigo-500/5 p-4 text-xs">
                <span class="font-bold text-indigo-700 dark:text-indigo-300 block mb-1">Double Verification Required</span>
                Controlled substances require co-signature confirmation prior to administration. Verify dosage logs carefully.
              </div>

              <!-- Quick Vitals Logger Form -->
              <div class="space-y-3 pt-2">
                <span class="text-sm font-bold block text-slate-900 dark:text-slate-50">Quick Log Vitals</span>
                <div class="grid grid-cols-2 gap-2">
                  <input type="number" [(ngModel)]="quickVitals.hr" placeholder="HR" class="input !py-1.5 !px-2.5 !text-xs">
                  <input type="number" [(ngModel)]="quickVitals.sys" placeholder="Systolic" class="input !py-1.5 !px-2.5 !text-xs">
                  <input type="number" [(ngModel)]="quickVitals.dia" placeholder="Diastolic" class="input !py-1.5 !px-2.5 !text-xs">
                  <input type="number" [(ngModel)]="quickVitals.spo2" placeholder="SpO2 %" class="input !py-1.5 !px-2.5 !text-xs">
                </div>
                <cv-button variant="primary" (click)="saveQuickVitals()">Log Vitals</cv-button>
              </div>
            </div>
          </cv-card>
        </div>
      </section>
    </ng-template>

    <!-- ========================================== -->
    <!-- FINANCE / BILLING LAYOUT TEMPLATE          -->
    <!-- ========================================== -->
    <ng-template #billingLayout>
      <!-- KPIs -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <cv-stat-tile label="Total Revenue" [value]="'$' + billingStats().revenue" icon="💰" tone="success" sub="Paid invoices"></cv-stat-tile>
        <cv-stat-tile label="Outstanding" [value]="'$' + billingStats().outstanding" icon="💳" tone="warning" sub="Sent & overdue"></cv-stat-tile>
        <cv-stat-tile label="Denied Claims" [value]="billingStats().deniedCount" icon="❌" tone="danger" sub="Appeals recommended"></cv-stat-tile>
        <cv-stat-tile label="Pending Timesheets" [value]="billingStats().pendingTimesheets" icon="📝" tone="primary" sub="Awaiting audit"></cv-stat-tile>
      </section>

      <!-- Main Panels -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Claims & Timesheets -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Claims Queue -->
          <cv-card title="Claim Appeals Queue" subtitle="Claims denied by payers requiring immediate appeal">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th class="pb-2">Claim ID</th>
                    <th class="pb-2">Payer</th>
                    <th class="pb-2">Denial Reason</th>
                    <th class="pb-2">Amount</th>
                    <th class="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
                  <tr *ngFor="let c of deniedClaims()" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td class="py-3 font-medium text-slate-900 dark:text-slate-100">{{ c.id }}</td>
                    <td class="py-3 text-slate-500 dark:text-slate-400">{{ c.payer }}</td>
                    <td class="py-3 text-rose-600 dark:text-rose-400 text-xs font-medium">{{ c.denialReason }}</td>
                    <td class="py-3 font-semibold text-slate-900 dark:text-slate-50">\${{ c.amount }}</td>
                    <td class="py-3 text-right">
                      <cv-button variant="primary" size="sm" (click)="appealClaim(c.id)">Appeal</cv-button>
                    </td>
                  </tr>
                  <tr *ngIf="deniedClaims().length === 0">
                    <td colspan="5" class="py-6 text-center text-slate-400 dark:text-slate-500">
                      No denied claims pending audit. Excellent work!
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </cv-card>

          <!-- Timesheet Audits -->
          <cv-card title="Timesheet Approvals" subtitle="Staff shifts awaiting review and approval">
            <div class="space-y-3">
              <div *ngFor="let t of pendingTimesheets()" class="flex items-center justify-between border border-slate-100 dark:border-slate-800/70 rounded-xl p-3 bg-white dark:bg-slate-900/20">
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-semibold text-slate-900 dark:text-slate-50">User: {{ t.userId }}</span>
                  <span class="text-xs text-slate-400 dark:text-slate-500">Shift: {{ t.shiftId }} · Clocked Hours: {{ t.hours }}h</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium text-amber-600 dark:text-amber-400 italic" *ngIf="t.notes">{{ t.notes }}</span>
                  <cv-button variant="success" size="sm" (click)="approveTimesheet(t.id)">Approve</cv-button>
                </div>
              </div>
              <div *ngIf="pendingTimesheets().length === 0" class="py-6 text-center text-slate-400 dark:text-slate-500">
                All timesheets are approved and locked.
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar Finance Panel -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card title="Finance Actions" subtitle="Audit Utilities">
            <div class="flex flex-col gap-3">
              <div class="rounded-xl border border-emerald-100 dark:border-emerald-500/10 bg-emerald-50/30 dark:bg-emerald-500/5 p-4 text-xs text-slate-700 dark:text-slate-300">
                <span class="font-bold text-emerald-700 dark:text-emerald-300 block mb-1">Billing Policy Alert</span>
                Double check CPT modifiers (like modifier 25) for comprehensive clinic evaluations to prevent automated claim rejections.
              </div>

              <!-- Quick Invoice generator -->
              <div class="space-y-3 pt-2">
                <span class="text-sm font-bold block text-slate-900 dark:text-slate-50">Create Draft Invoice</span>
                <div class="flex flex-col gap-2">
                  <input type="text" [(ngModel)]="quickInvoice.patientId" placeholder="Patient ID (e.g. pat-1)" class="input !py-1.5 !px-2.5 !text-xs">
                  <input type="number" [(ngModel)]="quickInvoice.amount" placeholder="Amount ($)" class="input !py-1.5 !px-2.5 !text-xs">
                </div>
                <cv-button variant="primary" (click)="saveQuickInvoice()">Create Invoice</cv-button>
              </div>
            </div>
          </cv-card>
        </div>
      </section>
    </ng-template>

    <!-- ========================================== -->
    <!-- PATIENT & FAMILY PORTAL LAYOUT TEMPLATE    -->
    <!-- ========================================== -->
    <ng-template #patientLayout>
      <!-- KPIs -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <cv-stat-tile label="Care visits scheduled" [value]="patientShifts().length" icon="🗓️" tone="primary" sub="Next: {{ nextShiftDate() }}"></cv-stat-tile>
        <cv-stat-tile label="Medications today" [value]="upcomingMeds().length" icon="💊" tone="warning" sub="Upcoming doses"></cv-stat-tile>
        <cv-stat-tile label="Last Wellness Rating" [value]="lastMoodEmoji()" icon="❤️" tone="success" sub="Logged in diary"></cv-stat-tile>
        <cv-stat-tile label="Care Team Members" [value]="careTeamCount()" icon="👩‍⚕️" tone="neutral" sub="Active clinicians"></cv-stat-tile>
      </section>

      <!-- Main Panels -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Sliders & Meds -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Daily Mood Slider (Feature 14!) -->
          <cv-card title="Daily Mood & Wellness Journal" subtitle="Let the care team know how you are feeling today">
            <div class="space-y-6 py-2">
              <!-- Mood Slider -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  How is your mood today?
                </label>
                <cv-emoji-slider
                  [emojis]="moodEmojis"
                  [labels]="moodLabels"
                  [value]="currentMood()"
                  (valueChange)="currentMood.set($event)"
                  ariaLabel="Rate your mood today"
                ></cv-emoji-slider>
              </div>

              <!-- Sleep Slider -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Did you sleep well last night?
                </label>
                <cv-emoji-slider
                  [emojis]="sleepEmojis"
                  [labels]="sleepLabels"
                  [value]="currentSleep()"
                  (valueChange)="currentSleep.set($event)"
                  ariaLabel="Rate your sleep"
                ></cv-emoji-slider>
              </div>

              <!-- Appetite Slider -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  How is your appetite today?
                </label>
                <cv-emoji-slider
                  [emojis]="appetiteEmojis"
                  [labels]="appetiteLabels"
                  [value]="currentAppetite()"
                  (valueChange)="currentAppetite.set($event)"
                  ariaLabel="Rate your appetite"
                ></cv-emoji-slider>
              </div>

              <!-- Note -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Optional note
                </label>
                <textarea
                  [(ngModel)]="currentNote"
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-shadow"
                  rows="2"
                  placeholder="Record any discomfort, fatigue or updates..."
                ></textarea>
              </div>

              <div class="flex justify-end">
                <cv-button variant="primary" (click)="saveMoodEntry()">Save Wellness Log</cv-button>
              </div>
            </div>
          </cv-card>

          <!-- Medication Reminder Board -->
          <cv-card title="Today's Medication reminders" subtitle="Prescribed medications to take today">
            <div class="space-y-3">
              <div *ngFor="let m of upcomingMeds()" class="flex items-center justify-between border border-slate-100 dark:border-slate-800/70 rounded-xl p-3 bg-white dark:bg-slate-900/20">
                <div class="flex items-center gap-3">
                  <span class="text-2xl">💊</span>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ m.name }} ({{ m.dose }})</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500">Route: {{ m.route }} · Category: {{ m.category }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <cv-badge tone="primary">{{ m.schedule }}</cv-badge>
                  <cv-button variant="success" size="sm" (click)="takeMedication(m.id)">Take</cv-button>
                </div>
              </div>
              <div *ngIf="upcomingMeds().length === 0" class="py-6 text-center text-slate-400 dark:text-slate-500">
                No medication doses remaining for today.
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar Care Portal Panel -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Care Team Updates -->
          <cv-card title="Care Team Logs" subtitle="Latest notes from caregivers">
            <div class="space-y-4">
              <div *ngFor="let u of recentFamilyUpdates()" class="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ u.author }}</span>
                  <span class="text-[10px] text-slate-400 dark:text-slate-500">{{ u.ts | date:'shortTime' }}</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400 italic">"{{ u.note }}"</p>
                <div class="mt-2 flex justify-between items-center">
                  <span class="text-[10px] uppercase tracking-wide text-slate-400">Mood score:</span>
                  <cv-badge [tone]="u.mood === 'great' ? 'success' : u.mood === 'okay' ? 'neutral' : 'warning'">{{ u.mood }}</cv-badge>
                </div>
              </div>
            </div>
          </cv-card>
        </div>
      </section>
    </ng-template>

    <!-- ========================================== -->
    <!-- OPERATIONS / ADMIN LAYOUT TEMPLATE         -->
    <!-- ========================================== -->
    <ng-template #opsLayout>
      <!-- KPIs -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <cv-stat-tile label="Active Patients" [value]="kpis().patientCount" icon="👥" tone="primary" sub="Across all sectors"></cv-stat-tile>
        <cv-stat-tile label="Low Inventory" [value]="kpis().lowStockCount" icon="🧪" [tone]="kpis().lowStockCount > 3 ? 'warning' : 'neutral'" sub="Reorders suggested"></cv-stat-tile>
        <cv-stat-tile label="Scheduled Shifts" [value]="opsShifts().length" icon="🗓️" tone="success" sub="Field visits today"></cv-stat-tile>
        <cv-stat-tile label="Critical Incidents" [value]="kpis().criticalIncidents" icon="🚨" tone="danger" sub="Open: {{ kpis().openIncidents }}"></cv-stat-tile>
      </section>

      <!-- Main Panels -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Stock Levels & Incidents -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Low Stock Board -->
          <cv-card title="Supply Stock Level Alert" subtitle="Critical supplies requiring immediate procurement reorder">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th class="pb-2">SKU</th>
                    <th class="pb-2">Item Name</th>
                    <th class="pb-2">On Hand</th>
                    <th class="pb-2">Par</th>
                    <th class="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
                  <tr *ngFor="let i of lowStock()" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                    <td class="py-3 font-mono text-xs text-slate-900 dark:text-slate-100">{{ i.sku }}</td>
                    <td class="py-3 text-slate-700 dark:text-slate-300 font-medium">{{ i.name }}</td>
                    <td class="py-3 text-rose-600 dark:text-rose-400 font-semibold">{{ i.onHand }}</td>
                    <td class="py-3 text-slate-500 dark:text-slate-400">{{ i.par }}</td>
                    <td class="py-3 text-right">
                      <cv-button variant="primary" size="sm" (click)="reorderItem(i.sku)">Reorder</cv-button>
                    </td>
                  </tr>
                  <tr *ngIf="lowStock().length === 0">
                    <td colspan="5" class="py-6 text-center text-slate-400 dark:text-slate-500">
                      All inventory item counts are healthy.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </cv-card>

          <!-- Operations Shift Calendar -->
          <cv-card title="Today's Field Staff Operations" subtitle="Visits dispatched for home-care agency staff">
            <div class="space-y-3">
              <div *ngFor="let s of opsShifts()" class="flex items-center justify-between border border-slate-100 dark:border-slate-800/70 rounded-xl p-3 bg-white dark:bg-slate-900/20">
                <div class="flex items-center gap-3">
                  <span class="text-2xl">🚗</span>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-semibold text-slate-900 dark:text-slate-50">Staff ID: {{ s.userId }} ({{ s.role }})</span>
                    <span class="text-xs text-slate-400 dark:text-slate-500">Type: {{ s.visitType | uppercase }} · Location: {{ s.geo?.label || 'HQ' }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <cv-badge [tone]="s.status === 'completed' ? 'success' : s.status === 'in-progress' ? 'primary' : 'warning'">{{ s.status }}</cv-badge>
                </div>
              </div>
              <div *ngIf="opsShifts().length === 0" class="py-6 text-center text-slate-400 dark:text-slate-500">
                No visits dispatched for today.
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar Panel -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card title="Operations Hub" subtitle="Emergency Controls">
            <div class="flex flex-col gap-3">
              <!-- Dispatch Emergency -->
              <div class="rounded-xl border border-rose-100 dark:border-rose-500/10 bg-rose-50/30 dark:bg-rose-500/5 p-4 text-xs">
                <span class="font-bold text-rose-700 dark:text-rose-300 block mb-1">🚨 Emergency SOS Dispatch</span>
                Access the SOS Feature sidebar immediately to track live GPS, coordinate emergency responders, and manage real-time alerts.
              </div>

              <!-- Create incident shortcut -->
              <div class="space-y-3 pt-2">
                <span class="text-sm font-bold block text-slate-900 dark:text-slate-50">File Quick Incident Report</span>
                <div class="flex flex-col gap-2">
                  <select [(ngModel)]="quickIncident.kind" class="input !py-1.5 !px-2.5 !text-xs">
                    <option value="fall">Fall</option>
                    <option value="med-error">Medication Error</option>
                    <option value="elopement">Elopement / Wandering</option>
                    <option value="skin-event">Skin / Pressure Injury</option>
                    <option value="other">Other</option>
                  </select>
                  <textarea [(ngModel)]="quickIncident.summary" placeholder="Brief summary of event..." class="input !py-1.5 !px-2.5 !text-xs" rows="2"></textarea>
                </div>
                <cv-button variant="danger" (click)="saveQuickIncident()">Log Incident</cv-button>
              </div>
            </div>
          </cv-card>
        </div>
      </section>
    </ng-template>
  `,
})
export class DashboardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly auth = inject(AuthService);
  private readonly vitals = inject(VitalsService);
  private readonly tasks = inject(TaskService);
  private readonly inventory = inject(InventoryService);
  private readonly meds = inject(MedicationService);
  private readonly billing = inject(BillingService);
  private readonly schedule = inject(ScheduleService);
  private readonly toast = inject(ToastService);
  private readonly roleService = inject(RoleService);

  readonly kpis = this.facade.kpis;
  readonly currentUser = this.auth.currentUser;
  readonly activeRole = this.roleService.activeRole;

  // Mood/Wellness state inside the Patient view
  readonly moodEmojis = ['😭', '😢', '😐', '🙂', '😄'];
  readonly moodLabels = ['Awful', 'Bad', 'Okay', 'Good', 'Great'];
  readonly sleepEmojis = ['😫', '😩', '😐', '😌', '😴'];
  readonly sleepLabels = ['Terrible', 'Poor', 'Fair', 'Good', 'Amazing'];
  readonly appetiteEmojis = ['🤢', '😣', '😐', '😋', '🤤'];
  readonly appetiteLabels = ['None', 'Little', 'Moderate', 'Good', 'Excellent'];

  readonly currentMood = signal(2);
  readonly currentSleep = signal(2);
  readonly currentAppetite = signal(2);
  currentNote = '';
  lastLoggedMood = signal('😐');

  // Input states for quick logger forms
  quickVitals = { hr: 72, sys: 120, dia: 80, spo2: 98 };
  quickInvoice = { patientId: 'pat-1', amount: 150 };
  quickIncident = { kind: 'fall', summary: '' };

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Dashboard';
  }

  // --- Clinical Data Selectors ---
  readonly alertVitals = computed(() =>
    this.vitals.readings().filter((v) => v.flag !== 'normal').slice(0, 5)
  );

  readonly myPendingTasks = computed(() => {
    const me = this.auth.currentUser();
    return this.tasks.tasks().filter((t) => t.assignee === me.id && t.status !== 'done');
  });

  readonly myTasksCount = computed(() => this.myPendingTasks().length);

  // --- Billing & Finance Data Selectors ---
  readonly deniedClaims = computed(() => this.billing.deniedClaims().slice(0, 5));
  readonly pendingTimesheets = computed(() => this.billing.pendingTimesheets().slice(0, 5));
  readonly billingStats = computed(() => ({
    revenue: this.billing.totalRevenue(),
    outstanding: this.billing.totalOutstanding(),
    deniedCount: this.billing.deniedClaims().length,
    pendingTimesheets: this.billing.pendingTimesheets().length
  }));

  // --- Ops / Admin Selectors ---
  readonly lowStock = computed(() => this.inventory.reorder().slice(0, 5));
  readonly opsShifts = computed(() => this.schedule.shifts().slice(0, 6));

  // --- Patient Portal Selectors ---
  readonly upcomingMeds = computed(() => this.meds.upcoming().slice(0, 5));
  readonly patientShifts = computed(() => {
    const pId = this.facade.selectedPatientId() || 'pat-1';
    return this.schedule.shifts().filter((s) => s.patientId === pId);
  });

  nextShiftDate(): string {
    const shifts = this.patientShifts();
    if (shifts.length === 0) return 'No visits';
    const upcoming = shifts.filter((s) => new Date(s.start).getTime() > Date.now());
    return upcoming.length > 0 ? new Date(upcoming[0].start).toLocaleDateString() : 'No upcoming';
  }

  careTeamCount(): number {
    return 5; // Fixed context team members for active patient
  }

  lastMoodEmoji(): string {
    return this.lastLoggedMood();
  }

  readonly recentFamilyUpdates = computed(() => {
    return [
      { author: 'Maya Patel (RN)', ts: new Date(Date.now() - 3600000), note: 'Vitals stable. Assisted with afternoon ambulation.', mood: 'great' },
      { author: 'Jordan Hale (LCSW)', ts: new Date(Date.now() - 86400000), note: 'Completed weekly resource review. Patient in good spirits.', mood: 'great' },
      { author: 'Tomás Reyes (LVN)', ts: new Date(Date.now() - 172800000), note: 'Administered evening meds. Sleep report was good.', mood: 'okay' }
    ];
  });

  // --- Dashboard Action Handlers ---

  completeTask(id: string): void {
    this.tasks.setStatus(id, 'done');
    this.toast.success('Task marked as completed!');
  }

  takeMedication(id: string): void {
    this.meds.markGiven(id);
    this.toast.success('Dose registered successfully. Keep up the great health routine! 🌟');
  }

  appealClaim(id: string): void {
    this.billing.submitClaim(id);
    this.toast.success(`Claim ${id} appeal packet submitted to payer.`);
  }

  approveTimesheet(id: string): void {
    const approver = this.auth.currentUser();
    this.billing.approveTimesheet(id, approver.id);
    this.toast.success('Timesheet approved successfully.');
  }

  reorderItem(sku: string): void {
    const item = this.inventory.items().find(i => i.sku === sku);
    if (item) {
      this.inventory.adjust(sku, item.par);
      this.toast.success(`Reorder placed for ${item.name}! Stock increased.`);
    }
  }

  addNoteToVitals(id: string): void {
    const note = prompt('Enter care log note:');
    if (note && note.trim()) {
      this.vitals.addNote(id, note.trim());
      this.toast.success('Clinical note appended to vitals entry.');
    }
  }

  saveQuickVitals(): void {
    const pId = this.facade.selectedPatientId() || 'pat-1';
    const recBy = this.auth.currentUser().id;
    this.vitals.add({
      patientId: pId,
      timestamp: new Date().toISOString(),
      hr: this.quickVitals.hr,
      systolic: this.quickVitals.sys,
      diastolic: this.quickVitals.dia,
      glucose: 110,
      spo2: this.quickVitals.spo2,
      temp: 98.6,
      recordedBy: recBy
    });
    this.toast.success('Vitals logged successfully!');
  }

  saveQuickInvoice(): void {
    const newInv = {
      id: `inv-${Date.now()}`,
      number: `INV-2025-${Math.floor(Math.random() * 9000 + 1000)}`,
      patientId: this.quickInvoice.patientId,
      payer: 'Self-pay',
      issuedAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: 'draft' as const,
      items: [{ code: '99213', description: 'Quick evaluation', units: 1, rate: this.quickInvoice.amount }],
      subtotal: this.quickInvoice.amount,
      tax: 0,
      total: this.quickInvoice.amount
    };
    this.billing.addInvoice(newInv);
    this.toast.success('Draft invoice generated!');
  }

  saveQuickIncident(): void {
    const recBy = this.auth.currentUser().id;
    this.toast.success(`Incident report filed under ${this.quickIncident.kind.toUpperCase()}`);
    this.quickIncident.summary = '';
  }

  saveMoodEntry(): void {
    const emoji = this.moodEmojis[this.currentMood()];
    this.lastLoggedMood.set(emoji);
    this.toast.success(`Wellness check-in saved! Feeling ${this.moodLabels[this.currentMood()]} ${emoji}`);
    this.currentNote = '';
  }
}
