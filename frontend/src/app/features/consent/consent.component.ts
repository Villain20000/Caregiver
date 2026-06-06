import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoleService } from '../../core/services/role.service';
import { AuthService } from '../../core/services/auth.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { CvSignaturePadComponent } from '../../shared/components/cv-signature-pad/cv-signature-pad.component';

interface ConsentDocument {
  id: string;
  type: ConsentType;
  signerName: string;
  signerId: string;
  signedAt: string;
  status: 'signed' | 'pending';
  signatureData?: string;
}

type ConsentType = 'HIPAA' | 'NDA' | 'CarePlan' | 'Financial';

const CONSENT_TYPES: ConsentType[] = ['HIPAA', 'NDA', 'CarePlan', 'Financial'];

const CONSENT_LABELS: Record<ConsentType, string> = {
  HIPAA: 'HIPAA Consent Form',
  NDA: 'NDA Agreement',
  CarePlan: 'Care Plan Authorization',
  Financial: 'Financial Agreement',
};

const CONSENT_LEGAL_TEXT: Record<ConsentType, string> = {
  HIPAA: `HIPAA AUTHORIZATION FOR USE AND DISCLOSURE OF PROTECTED HEALTH INFORMATION

I, the undersigned, authorize CareVibe Health Services to use and disclose my protected health information (PHI) for the purposes of treatment, payment, and healthcare operations as described in the Notice of Privacy Practices.

This authorization includes:
\u2022 Sharing of medical records with designated family members and caregivers
\u2022 Coordination of care among physicians, nurses, therapists, and other providers
\u2022 Submission of claims to insurance carriers, Medicare, and Medicaid
\u2022 Release of information to referring and consulting healthcare providers

I understand that I have the right to revoke this authorization at any time in writing, except to the extent that action has already been taken. This authorization expires one year from the date of signature unless otherwise revoked.`,

  NDA: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("NDA") is entered into between the undersigned individual and CareVibe Health Services.

The undersigned agrees to:
\u2022 Maintain strict confidentiality of all patient health information (PHI) as defined by HIPAA
\u2022 Not disclose, share, or distribute any proprietary information, trade secrets, or business processes
\u2022 Use patient data solely for authorized healthcare purposes
\u2022 Report any suspected breach of confidentiality immediately to the Privacy Officer
\u2022 Return or destroy all confidential materials upon termination of relationship

Violation of this agreement may result in disciplinary action, termination of employment or contract, and liability under applicable laws including HIPAA and state privacy statutes.

This NDA shall survive the termination of any underlying employment or service agreement.`,

  CarePlan: `CARE PLAN AUTHORIZATION

I authorize CareVibe Health Services to develop, implement, and adjust a comprehensive care plan for the patient named below.

This authorization includes:
\u2022 Assessment of physical, emotional, and social needs
\u2022 Development of a personalized care plan with specific goals and interventions
\u2022 Coordination among interdisciplinary care team members
\u2022 Adjustment of care plans based on changing conditions and progress
\u2022 Sharing of care plan information with authorized family members and caregivers

I acknowledge that:
\u2022 The care plan will be reviewed and updated at least quarterly or more frequently as needed
\u2022 I have the right to participate in care planning decisions
\u2022 I may request revisions to the care plan at any time
\u2022 Emergency modifications may be made without prior notice when immediate action is required to prevent harm`,

  Financial: `FINANCIAL AGREEMENT AND RESPONSIBILITY

I acknowledge financial responsibility for services provided by CareVibe Health Services and agree to the following:

\u2022 I will provide accurate and complete insurance information
\u2022 I authorize CareVibe to bill my insurance carrier(s), Medicare, and/or Medicaid directly
\u2022 I am responsible for any copayments, deductibles, coinsurance, and non-covered services
\u2022 Payments are due within 30 days of receipt of invoice
\u2022 Late payments may be subject to a finance charge of 1.5% per month (18% APR)
\u2022 I agree to pay all collection costs and reasonable attorney fees if collection action becomes necessary
\u2022 Financial assistance and payment plans are available upon request for qualifying individuals

If I am signing on behalf of a patient or legal entity, I warrant that I have the legal authority to bind the patient or entity to this agreement.`,
};

let docCounter = 100;

@Component({
  selector: 'cv-consent',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent, CvModalComponent, CvSignaturePadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">consent</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Digital Consent &amp; NDA Sign-off
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Electronically sign HIPAA consents, NDAs, care plan authorizations, and financial agreements.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Document signing card -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card title="Sign a Document" subtitle="Choose a document type and sign digitally">
            <div class="flex flex-col gap-5">
              <!-- Document type selector -->
              <div>
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Document Type</label>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    *ngFor="let dt of consentTypes"
                    (click)="selectedDocType.set(dt)"
                    class="rounded-xl px-4 py-3 text-sm font-medium transition-all border text-left"
                    [ngClass]="selectedDocType() === dt
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'"
                  >
                    <div class="text-xs opacity-75">{{ dt }}</div>
                    <div class="text-sm font-semibold mt-0.5">{{ CONSENT_LABELS[dt] }}</div>
                  </button>
                </div>
              </div>

              <!-- Document preview -->
              <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 max-h-64 overflow-y-auto">
                <pre class="text-xs text-slate-700 dark:text-slate-300 font-sans whitespace-pre-wrap leading-relaxed">{{ previewText() }}</pre>
              </div>

              <!-- Signer info -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Signer Name</label>
                  <input
                    type="text"
                    [ngModel]="signerName()"
                    (ngModelChange)="signerName.set($event)"
                    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    placeholder="Full legal name"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Date</label>
                  <input
                    type="date"
                    [ngModel]="signatureDate()"
                    (ngModelChange)="signatureDate.set($event)"
                    class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <!-- Signature pad -->
              <div>
                <label class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Digital Signature</label>
                <cv-signature-pad
                  #sigPad
                  [width]="480"
                  [height]="150"
                  (signed)="onSigned($event)"
                ></cv-signature-pad>
              </div>

              <!-- Sign button -->
              <div class="flex items-center justify-end gap-3">
                <cv-button variant="success" size="lg" [disabled]="!canSign()" (click)="signDocument(sigPad)">
                  <ng-container *ngIf="!isSigning()">Sign & Submit</ng-container>
                  <ng-container *ngIf="isSigning()">Signing...</ng-container>
                </cv-button>
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Signed documents list -->
        <div class="space-y-4">
          <cv-card title="Signed Documents" [subtitle]="signedDocs().length + ' on record'" padding="md">
            <div class="space-y-3">
              <div
                *ngFor="let doc of signedDocs()"
                class="rounded-xl border border-slate-100 dark:border-slate-800 p-3 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                      {{ CONSENT_LABELS[doc.type] }}
                    </p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Signed by {{ doc.signerName }}
                    </p>
                  </div>
                  <cv-badge [tone]="doc.status === 'signed' ? 'success' : 'warning'">
                    {{ doc.status }}
                  </cv-badge>
                </div>
                <div class="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <span>{{ formatDate(doc.signedAt) }}</span>
                  <button
                    type="button"
                    (click)="exportDocument(doc)"
                    class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                  >
                    Export
                  </button>
                </div>
              </div>
              <div
                *ngIf="signedDocs().length === 0"
                class="text-center py-8 text-sm text-slate-500 dark:text-slate-400"
              >
                No signed documents yet. Use the form to sign your first document.
              </div>
            </div>
          </cv-card>

          <!-- Stats card -->
          <cv-card title="Summary" padding="md">
            <div class="space-y-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Total Signed</span>
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ signedDocs().length }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">HIPAA Signed</span>
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ countByType('HIPAA') }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">NDA Signed</span>
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ countByType('NDA') }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Care Plans Signed</span>
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ countByType('CarePlan') }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-500 dark:text-slate-400">Financial Signed</span>
                <span class="font-semibold text-slate-900 dark:text-slate-50">{{ countByType('Financial') }}</span>
              </div>
            </div>
          </cv-card>
        </div>
      </div>
    </div>
  `,
})
export class ConsentComponent {
  private readonly role = inject(RoleService);
  private readonly auth = inject(AuthService);

  readonly consentTypes = CONSENT_TYPES;
  readonly CONSENT_LABELS = CONSENT_LABELS;

  readonly currentUser = this.auth.currentUser;
  readonly isAdmin = computed(() => this.role.activeRole() === Role.ADMIN);

  readonly selectedDocType = signal<ConsentType>('HIPAA');
  readonly signerName = signal<string>('');
  readonly signatureDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly signatureData = signal<string>('');
  readonly isSigning = signal(false);

  private readonly _documents = signal<ConsentDocument[]>(this.mockSignedDocs());

  readonly signedDocs = computed<ConsentDocument[]>(() => {
    const all = this._documents();
    const user = this.currentUser();
    if (this.isAdmin()) return all;
    return all.filter((d) => d.signerId === user.id);
  });

  readonly canSign = computed(() => {
    return this.signerName().trim().length > 0 && this.signatureData().length > 0;
  });

  readonly previewText = computed(() => CONSENT_LEGAL_TEXT[this.selectedDocType()]);

  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  countByType(type: ConsentType): number {
    return this._documents().filter((d) => d.type === type && d.status === 'signed').length;
  }

  onSigned(data: string): void {
    this.signatureData.set(data);
  }

  signDocument(sigPad: any): void {
    if (!this.canSign()) return;
    this.isSigning.set(true);

    setTimeout(() => {
      const doc: ConsentDocument = {
        id: `consent-${++docCounter}`,
        type: this.selectedDocType(),
        signerName: this.signerName().trim(),
        signerId: this.currentUser().id,
        signedAt: new Date().toISOString(),
        status: 'signed',
        signatureData: this.signatureData(),
      };

      this._documents.update((list) => [doc, ...list]);
      this.isSigning.set(false);
      this.signerName.set('');
      this.signatureData.set('');
      sigPad.clear();
    }, 800);
  }

  exportDocument(doc: ConsentDocument): void {
    const header = `${CONSENT_LABELS[doc.type]}\n${'='.repeat(50)}\n`;
    const body = `${CONSENT_LEGAL_TEXT[doc.type]}\n\n`;
    const footer = `Signed by: ${doc.signerName}\nDate: ${this.formatDate(doc.signedAt)}\nStatus: ${doc.status}\nDocument ID: ${doc.id}`;

    const blob = new Blob([header + body + footer], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.type}-${doc.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private mockSignedDocs(): ConsentDocument[] {
    return [
      {
        id: 'consent-1',
        type: 'HIPAA',
        signerName: 'Avery Quinn',
        signerId: 'u-admin',
        signedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        status: 'signed',
      },
      {
        id: 'consent-2',
        type: 'NDA',
        signerName: 'Maya Patel',
        signerId: 'u-nurse1',
        signedAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
        status: 'signed',
      },
      {
        id: 'consent-3',
        type: 'CarePlan',
        signerName: 'Dr. Lena Park',
        signerId: 'u-doc1',
        signedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        status: 'signed',
      },
      {
        id: 'consent-4',
        type: 'Financial',
        signerName: 'Hank Liu',
        signerId: 'u-bill1',
        signedAt: new Date(Date.now() - 21 * 86_400_000).toISOString(),
        status: 'signed',
      },
    ];
  }
}
