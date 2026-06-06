import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CvCardComponent } from './cv-card/cv-card.component';
import { CvButtonComponent } from './cv-button/cv-button.component';

@Component({
  selector: 'cv-forbidden',
  standalone: true,
  imports: [RouterLink, CvCardComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[60vh] grid place-items-center">
      <cv-card title="Access denied">
        <p class="text-slate-600 dark:text-slate-300">You don't have permission to view that page with your current role.</p>
        <div class="mt-4 flex gap-2">
          <cv-button variant="primary" [routerLink]="['/dashboard']">Go to Dashboard</cv-button>
        </div>
      </cv-card>
    </div>
  `,
})
export class ForbiddenComponent {}
