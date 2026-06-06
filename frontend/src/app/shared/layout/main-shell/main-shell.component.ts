import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { CvToastContainerComponent } from '../../components/cv-toast/cv-toast.component';
import { DashboardMockStateService } from '../../../core/services/dashboard-mock-state.service';

@Component({
  selector: 'cv-main-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    CvToastContainerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 relative overflow-hidden bg-aurora">
      <!-- Modern tech grid pattern overlay -->
      <div class="absolute inset-0 bg-grid-pattern bg-grid pointer-events-none opacity-40 dark:opacity-20" aria-hidden="true"></div>

      <cv-sidebar class="relative z-10" />
      <div class="flex-1 flex flex-col overflow-hidden relative z-10">
        <cv-topbar />
        <main class="flex-1 overflow-y-auto p-6 md:p-8">
          <router-outlet />
        </main>
      </div>
      <cv-toast-container class="relative z-50" />
    </div>
  `,
})
export class MainShellComponent {
  // Instantiating the binder establishes a coordinated role-scoped workspace context.
  private readonly _binder = inject(DashboardMockStateService);
}
