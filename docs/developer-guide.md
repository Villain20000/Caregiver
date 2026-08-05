# Caregiver Developer Guide — Reading the Code Flow

> **Goal:** Help you (a developer) understand the project architecture and
> Angular code patterns by tracing through the actual code — from browser
> to database and back.

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        CAREGIVER PLATFORM — SERVICES & PORTS                         │
│                                                                                      │
│                     ┌──────────────────────┐                                         │
│                     │      Browser          │  Angular 17+ SPA (standalone)          │
│                     │  http://localhost:4200 │  apps/web                              │
│                     └──────────┬───────────┘                                         │
│                                │                                                     │
│                 ┌──────────────┼──────────────────────────────┐                      │
│                 │    REST API  │  (HTTP)            Socket.io │  WebSocket            │
│                 │    /api/*    │                    /socket.io│                       │
│                 ▼              ▼                           ▼ │                      │
│         ┌─────────────────────────────────────────────────────┴──────┐               │
│         │           API GATEWAY (NestJS)  :3000                     │               │
│         │           apps/api — BFF (Backend For Frontend)           │               │
│         │                                                           │               │
│         │  Auth ─ JWT, bcrypt                                       │               │
│         │  RBAC ─ @caregiver/rbac guard                             │               │
│         │  REST ─ appointments, vitals, ai, fhir, orders, billing  │               │
│         │  WS   ─ Socket.io alerts gateway                          │               │
│         │  Kafka─ TypedProducer (emits events)                     │               │
│         └────────────────────────┬──────────────────────────────────┘               │
│                                  │                                                  │
│                                  │ APACHE KAFKA  (localhost:9092)                   │
│                                  │ 17 topics (event bus)                            │
│                                  │                                                  │
│                    ┌─────────────┼──────────────┬──────────────────┐                │
│                    ▼             ▼              ▼                  ▼                │
│  ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐        │
│  │ FHIR INGESTION   │ │ AI RAG       │ │NOTIFICATIONS │ │ AUDIT          │        │
│  │ :4001            │ │ :4002        │ │ :4003        │ │ :4004          │        │
│  │ services/        │ │ services/    │ │ services/    │ │ services/      │        │
│  │ fhir-ingestion   │ │ ai-rag       │ │ notifications│ │ audit          │        │
│  │                  │ │              │ │              │ │                │        │
│  │ FHIR R4 vali-   │ │ LangChain    │ │ Threshold    │ │ Append-only    │        │
│  │ dation + persist │ │ RAG pipeline │ │ checking     │ │ audit log      │        │
│  │ Kafka consumer   │ │ Kafka        │ │ Alert        │ │ Kafka consumer │        │
│  └────────┬─────────┘ │ consumer     │ │ dispatch     │ └────────┬───────┘        │
│           │           └──────┬───────┘ └──────┬───────┘          │                │
│           │                  │                 │                   │                │
│           ▼                  ▼                 │                   │                │
│  ┌──────────────┐  ┌──────────────┐            │                   │                │
│  │ PostgreSQL   │  │ ChromaDB     │            │                   │                │
│  │ :5432        │  │ :8000        │            │                   │                │
│  │ pgvector     │  │ vector store │            │                   │                │
│  └──────────────┘  └──────┬───────┘            │                   │                │
│                           │                    │                   │                │
│                           ▼                    │                   │                │
│                    ┌──────────────┐            │                   │                │
│                    │ Ollama       │            │                   │                │
│                    │ :11434       │            │                   │                │
│                    │ Llama-3-8B   │            │                   │                │
│                    └──────────────┘            │                   │                │
│                                                │                   │                │
│                    ┌───────────────────────────┴───────────────────┘                │
│                    │  PostgreSQL  :5432                                              │
│                    │  (shared by: api, fhir-ingestion, audit)                        │
│                    │  Tables: users, appointments, vitals, fhir_resources,           │
│                    │          ai_diagnoses, orders, claims, alerts, audit_log        │
│                    └─────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Communication legend

| Path                        | Protocol                  | Direction     | Purpose                                     |
| --------------------------- | ------------------------- | ------------- | ------------------------------------------- |
| Browser ↔ API Gateway       | **REST** (HTTP)           | Bidirectional | All CRUD operations (`/api/*`)              |
| Browser ↔ API Gateway       | **Socket.io** (WebSocket) | Bidirectional | Real-time alerts pushed to browser          |
| API Gateway → Kafka         | **Kafka produce**         | One-way       | API emits events for microservices          |
| Microservices ← Kafka       | **Kafka consume**         | One-way       | Services react to events, emit results      |
| API Gateway → PostgreSQL    | **Drizzle ORM**           | Direct        | Reads + writes to its tables                |
| fhir-ingestion → PostgreSQL | **Drizzle ORM**           | Direct        | Persists validated FHIR resources           |
| audit → PostgreSQL          | **Drizzle ORM**           | Write-only    | Append-only audit log inserts               |
| ai-rag → ChromaDB           | **HTTP** (REST)           | Direct        | Vector similarity search query              |
| ai-rag → Ollama             | **HTTP** (REST)           | Direct        | LLM inference (`/api/generate`)             |
| API Gateway → notifications | **None** (Kafka only)     | —             | Alert dispatch via `alert.dispatched` topic |

### Service port map

| Service                  | Port    | Accessible from host       | Health check endpoint      |
| ------------------------ | ------- | -------------------------- | -------------------------- |
| Angular SPA (`apps/web`) | `4200`  | ✅ `http://localhost:4200` | N/A (nginx in prod)        |
| API Gateway (`apps/api`) | `3000`  | ✅ `http://localhost:3000` | `GET /api/health`          |
| FHIR Ingestion           | `4001`  | ✅ `http://localhost:4001` | `GET /api/health` (future) |
| AI RAG                   | `4002`  | ✅ `http://localhost:4002` | None (headless)            |
| Notifications            | `4003`  | ✅ `http://localhost:4003` | None (headless)            |
| Audit                    | `4004`  | ✅ `http://localhost:4004` | None (headless)            |
| PostgreSQL               | `5432`  | ⚠️ Internal only           | `pg_isready`               |
| Kafka                    | `9092`  | ⚠️ Internal only           | `kafka-topics --list`      |
| ChromaDB                 | `8000`  | ⚠️ Internal only           | `GET /api/v1/heartbeat`    |
| Ollama                   | `11434` | ⚠️ Internal only           | `ollama list`              |

### Key architectural principles

1. **BFF pattern** — The API gateway is the ONLY service with synchronous
   connections to the browser. It handles auth, RBAC, and aggregates
   responses.
2. **Event-driven** — Services NEVER call each other directly. All
   cross-service communication goes through Kafka topics (17 total).
3. **No HTTP listeners on workers** — ai-rag, notifications, and audit
   are headless NestJS apps. They connect to Kafka on startup and run
   forever in the consumer loop.
4. **FHIR-first** — All clinical payloads use HL7 FHIR R4 JSON.
   `packages/fhir-types` holds the TypeScript definitions.
5. **RBAC at the edge** — The 10-role × 30-feature permission matrix
   is enforced at the API gateway before any event is emitted.

---

## Table of Contents

1. [Monorepo Layout at a Glance](#1-monorepo-layout-at-a-glance)
2. [Boot Flow — How the App Starts](#2-boot-flow--how-the-app-starts)
3. [User Login End-to-End](#3-user-login-end-to-end)
4. [Page Navigation Flow](#4-page-navigation-flow)
5. [Feature Page Anatomy (Billing)](#5-feature-page-anatomy-billing)
6. [API Gateway Module Anatomy](#6-api-gateway-module-anatomy)
7. [Event Flow — Kafka + Microservices](#7-event-flow--kafka--microservices)
8. [Angular Patterns in This Project](#8-angular-patterns-in-this-project)
9. [NestJS Patterns in This Project](#9-nestjs-patterns-in-this-project)
10. [How to Add a New Feature](#10-how-to-add-a-new-feature)
11. [AI Diagnostics Feature — Deep Dive with Full Flow Diagram](#11-ai-diagnostics-feature--deep-dive-with-full-flow-diagram)
12. [Vital Signs → Alerts Pipeline — Deep Dive with Full Flow Diagram](#12-vital-signs--alerts-pipeline--deep-dive-with-full-flow-diagram)
13. [Unit Testing — Karma + Jasmine Setup](#13-unit-testing--karma--jasmine-setup)
14. [Patient Favorites — localStorage Persistence](#14-patient-favorites--localstorage-persistence)
15. [Dashboard Quick Actions — RBAC-Driven Role UI](#15-dashboard-quick-actions--rbac-driven-role-ui)
16. [Alert Acknowledgment + Escalation — Deep Dive](#16-alert-acknowledgment--escalation--deep-dive)

---

## 1. Monorepo Layout at a Glance

```
Caregiver/
├── apps/
│   ├── web/               ← Angular 17+ SPA (your main focus)
│   └── api/               ← NestJS BFF (Backend For Frontend)
├── services/              ← Kafka-consuming microservices
│   ├── fhir-ingestion/    ← FHIR R4 validation + persistence
│   ├── ai-rag/            ← LangChain + ChromaDB + Ollama
│   ├── notifications/     ← Real-time alert routing
│   └── audit/             ← Append-only audit log
├── packages/              ← Shared libraries (no runtime servers)
│   ├── contracts/         ← TypeScript DTOs + Kafka event payloads
│   ├── fhir-types/        ← HL7 FHIR R4 TypeScript types
│   ├── rbac/              ← Roles, features, permission matrix
│   ├── db/                ← Drizzle ORM schema + client factory
│   ├── kafka/             ← KafkaJS typed producer/consumer
│   ├── ui/                ← Reusable Angular components
│   └── config/            ← Shared ESLint/Prettier/TS configs
├── docker/                ← docker-compose + Dockerfiles
├── e2e/                   ← Playwright end-to-end tests
└── docs/                  ← Architecture, RBAC, FHIR docs
```

### File-to-concept mapping

| Concept                | Where to find it                                    |
| ---------------------- | --------------------------------------------------- |
| Angular routes         | `apps/web/src/app/app.routes.ts`                    |
| Page components        | `apps/web/src/app/pages/*.ts`                       |
| API services           | `apps/web/src/app/services/*.ts`                    |
| Auth guards            | `apps/web/src/app/guards/*.ts`                      |
| HTTP interceptor       | `apps/web/src/app/interceptors/auth.interceptor.ts` |
| NestJS controllers     | `apps/api/src/*/*.controller.ts`                    |
| NestJS services        | `apps/api/src/*/*.service.ts`                       |
| Database schema        | `packages/db/src/schema/index.ts`                   |
| RBAC permission matrix | `packages/rbac/src/matrix.ts`                       |
| Shared DTOs            | `packages/contracts/src/dto/*.ts`                   |
| Kafka event payloads   | `packages/contracts/src/events/*.ts`                |
| Kafka topics           | `packages/kafka/src/topics.ts`                      |
| Global styles          | `apps/web/src/styles.css`                           |

---

## 2. Boot Flow — How the App Starts

### Step 1: `main.ts` — Angular Bootstrap

**File:** `apps/web/src/main.ts`

```typescript
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(APP_ROUTES, withPreloading(PreloadAllModules)),
    provideAnimations(),
  ],
});
```

This is Angular 17+ **standalone bootstrap** — no `NgModule`. The three providers configure:

1. **HttpClient** with the `authInterceptor` — every HTTP request gets a JWT token
2. **Router** with preloading — lazy-loaded routes start loading in the background
3. **Animations** — for future Material/CDK transitions

### Step 2: `AppComponent` — The Shell

**File:** `apps/web/src/app/app.component.ts`

```typescript
@Component({
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="app-header">...</header>
      @if (user && alerts.length) { <div class="alert-bar">...</div> }
      <main><router-outlet /></main>
    </div>
  `
})
```

Key patterns to notice:

- **`@if` / `@for`** — Angular 17+ control flow syntax (replaces `*ngIf` / `*ngFor`)
- **`router-outlet`** — where lazy-loaded pages render
- **`navLinks` computed signal** — RBAC-driven: a link only shows if your role has permission:

```typescript
readonly navLinks = computed(() => {
  const perms = getRolePermissions(role);
  const hasAny = (...features: Feature[]) => features.some((f) => perms[f] !== 'deny');
  return {
    appointments: hasAny('appointment.schedule', 'appointment.view_by_patient'),
    vitals: hasAny('vitals.record', 'vitals.view'),
    // ...
  };
});
```

### Step 3: Route Resolution

**File:** `apps/web/src/app/app.routes.ts`

```typescript
export const APP_ROUTES: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login.component.js') },
  {
    path: 'billing',
    canActivate: [authGuard, rbacGuard], // ← TWO guards
    data: { requiredPermission: 'billing.claim_create' },
    loadComponent: () => import('./pages/billing/billing.component.js'),
  },
  // ... more routes
];
```

**Key pattern:** Every protected route uses TWO guards:

1. `authGuard` — "Are you logged in?"
2. `rbacGuard` — "Does your role have permission for this feature?"

The `data.requiredPermission` is metadata the `rbacGuard` reads to check against the matrix.

---

## 3. User Login End-to-End

Here's the complete flow when a user submits the login form:

```
LoginComponent           AuthService              API Gateway            DB
    │                        │                        │                  │
    │  submit email+pass     │                        │                  │
    │───────────────────────►│  POST /api/auth/login   │                  │
    │                        │───────────────────────►│                  │
    │                        │                        │ SELECT user      │
    │                        │                        │─────────────────►│
    │                        │                        │◄────────────────┤
    │                        │                        │ bcrypt.compare() │
    │                        │                        │ sign JWT         │
    │                        │                        │ INSERT refresh   │
    │                        │◄───────────────────────│                  │
    │◄───────────────────────│                        │                  │
    │                        │                        │                  │
    │ handleLoginSuccess()   │                        │                  │
    │   → store tokens       │                        │                  │
    │   → store user signal  │                        │                  │
    │   → alertService.connect() (Socket.io)          │                  │
    │   → navigate /dashboard                        │                  │
```

### Key files to read:

| Step             | File                                                             | What to look for                                |
| ---------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| Form submission  | `apps/web/src/app/pages/login.component.ts:onSubmit()`           | `toPromise()` pattern, `loading()` signal       |
| Login HTTP call  | `apps/web/src/app/services/auth.service.ts:login()`              | Returns `Observable`, called via `.toPromise()` |
| Token storage    | `apps/web/src/app/services/auth.service.ts:handleLoginSuccess()` | Sets signals + localStorage                     |
| Session restore  | `apps/web/src/app/services/auth.service.ts:restoreSession()`     | Constructor runs on app load                    |
| API validation   | `apps/api/src/auth/auth.service.ts:login()`                      | `bcrypt.compare()`, JWT signing                 |
| JWT strategy     | `apps/api/src/auth/jwt.strategy.ts`                              | Extracts user from token                        |
| Refresh rotation | `apps/api/src/auth/auth.service.ts:refresh()`                    | Revokes old, creates new                        |

### Angular Signal Pattern (crucial!)

The `AuthService` uses Angular 17+ **signals** for reactive state:

```typescript
private readonly _currentUser = signal<UserProfile | null>(null);
readonly currentUser = this._currentUser.asReadonly();
readonly isAuthenticated = computed(() => this._currentUser() !== null);
readonly userRole = computed(() => this._currentUser()?.role ?? null);
```

- **`signal()`** — holds state, call `.set()` or `.update()` to change
- **`.asReadonly()`** — exposes a read-only view to consumers
- **`computed()`** — derived state that recalculates when dependencies change

The beauty: any template or computed that reads `authService.currentUser()` automatically re-renders when it changes.

---

## 4. Page Navigation Flow

When a user clicks a nav link (e.g., "Billing"):

```
AppComponent                               Router                rbacGuard
    │                                         │                      │
    │ click 'Billing' link                    │                      │
    │────────────────────────────────────────►│                      │
    │                                         │ check canActivate    │
    │                                         │─────────────────────►│
    │                                         │                      │
    │                                         │ authGuard ✅         │
    │                                         │ rbacGuard:           │
    │                                         │   read route.data    │
    │                                         │   .requiredPerm      │
    │                                         │   = billing.claim_   │
    │                                         │     create           │
    │                                         │   hasPermission()    │
    │                                         │   → allow ✅         │
    │                                         │◄─────────────────────│
    │                                         │                      │
    │                                         │ loadComponent        │
    │                                         │→ BillingComponent    │
    │◄────────────────────────────────────────│                      │
    │                                         │                      │
    │ BillingComponent mounts                 │                      │
    │   → inject BillingService               │                      │
    │   → ngOnInit: loadClaims()              │                      │
    │   → GET /api/billing/claims             │                      │
    │     (auth interceptor adds JWT header)  │                      │
```

### Guard Stacking Pattern

The `authGuard` runs **first**, then `rbacGuard`:

```typescript
// auth.guard.ts — redirects to /login?returnUrl=/billing if not authenticated
export const authGuard: CanActivateFn = (_route, state) => {
  if (authService.isAuthenticated()) return true;
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

// rbac.guard.ts — checks permission matrix
export const rbacGuard: CanActivateFn = (route) => {
  const feature = route.data?.['requiredPermission'] as Feature;
  const permission = hasPermission(userRole, feature);
  if (permission === 'allow' || permission === 'conditional') return true;
  router.navigate(['/dashboard']);
  return false;
};
```

---

## 5. Feature Page Anatomy (Billing)

The **Billing page** demonstrates the full pattern. Let's trace it:

### Component Hierarchy

```
BillingComponent (orchestrator)
  ├── BillingSummaryComponent    (stats cards — presentational)
  ├── BillingCreateClaimComponent (form — presentational)
  └── BillingClaimsListComponent  (table + actions — presentational)
```

### 5a. BillingComponent — The Orchestrator

**File:** `apps/web/src/app/pages/billing/billing.component.ts`

```typescript
export class BillingComponent implements OnInit {
  // ── Inject dependencies ──────────────────────
  private readonly billingService = inject(BillingService);

  // ── Signals for data ─────────────────────────
  readonly claims = signal<ClaimResponse[]>([]);
  readonly summary = signal<BillingSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Signals for inline forms ─────────────────
  readonly adjudicatingClaimId = signal<string | null>(null);
  readonly payingClaimId = signal<string | null>(null);

  // ── Computed signals for template visibility ─
  readonly showAdjudicationForm = computed(() => this.adjudicatingClaimId() !== null);

  // ── Computed signals for RBAC ────────────────
  readonly canCreateClaim = computed(() => {
    const role = this.authService.userRole();
    return role === 'admin' || role === 'billing_specialist' || /* ... */;
  });

  // ── Lifecycle ────────────────────────────────
  ngOnInit() { this.loadClaims(); }

  // ── Data loading ─────────────────────────────
  private async loadClaims() {
    this.loading.set(true);
    try {
      const claims = await this.billingService.listClaims().toPromise();
      this.claims.set(claims ?? []);
    } catch { this.error.set('Failed to load claims.'); }
    finally { this.loading.set(false); }
  }
}
```

**Patterns to notice:**

- **`inject()` function** instead of constructor DI (Angular 17+ style)
- **Signals** for all state: loading, error, data arrays
- **Computed signals** for derived state (RBAC, form visibility)
- **`async/await` + `.toPromise()`** — converts Observable to Promise for cleaner code
- **Error handling** — each data operation wraps in try/catch

### 5b. Template structure

```html
<div class="page">
  <h1>Billing & Claims</h1>
  <p class="page-subtitle">Manage claims, adjudication, and payments.</p>

  <!-- Error banner — shown conditionally -->
  @if (error()) {
  <div class="error-banner">{{ error() }}</div>
  }

  <!-- Summary stats — child component -->
  <app-billing-summary [summary]="summary()" />

  <!-- Create claim form — conditionally shown based on RBAC -->
  @if (canCreateClaim()) {
  <app-billing-create-claim
    [processing]="processing()"
    [resetTick]="resetTick()"
    (createClaim)="onCreateClaim($event)"
  />
  }

  <!-- Claims list — child component -->
  <app-billing-claims-list
    [claims]="claims()"
    [loading]="loading()"
    [canSubmitPay]="canSubmitPay()"
    [canAdjudicate]="canAdjudicate()"
    (submitClaim)="onSubmitClaim($event)"
    (adjudicate)="onAdjudicate($event)"
    (pay)="onPayment($event)"
  />

  <!-- Inline adjudication form -->
  @if (showAdjudicationForm()) { ... form ... }
</div>
```

**Angular 17+ template features used:**

- **`@if` / `@for`** — control flow (replaces structural directives)
- **`[input]`** — property binding to child components
- **`(output)`** — event binding from child components
- **`$event`** — the emitted value from `output()`

### 5c. Child component pattern (BillingCreateClaimComponent)

```typescript
@Component({
  selector: 'app-billing-create-claim',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
})
export class BillingCreateClaimComponent {
  // ── Inputs from parent ─────────────────────
  readonly processing = input<boolean>(false);
  readonly resetTick = input<number>(0);

  // ── Outputs to parent ──────────────────────
  readonly createClaim = output<CreateClaimRequest>();

  // ── Reactive form ──────────────────────────
  readonly claimForm = this.fb.nonNullable.group({ ... });

  constructor() {
    // Reset form when parent signals success
    effect(() => { this.resetTick(); this.claimForm.reset(); });
  }
}
```

**Key patterns:**

- **`input()`** — Angular 17+ signal-based input (instead of `@Input()`)
- **`output()`** — Angular 17+ signal-based output (instead of `@Output()` + `EventEmitter`)
- **`effect()`** — runs side effects when signal dependencies change
- **`FormBuilder.nonNullable`** — ensures form values are never null

### 5d. Service layer (BillingService)

**File:** `apps/web/src/app/services/billing.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);

  createClaim(req: CreateClaimRequest) {
    return this.http.post<ClaimResponse>('/api/billing/claims', req);
  }

  submitClaim(id: string, submittedBy: string) {
    return this.http.post<ClaimResponse>(`/api/billing/claims/${id}/submit`, { submittedBy });
  }

  listClaims() {
    return this.http.get<ClaimResponse[]>('/api/billing/claims');
  }
}
```

**Patterns:**

- **`providedIn: 'root'`** — singleton service, no NgModule registration needed
- Returns **Observables** (consumed via `.toPromise()` in components)
- All endpoints prefixed with `/api/...` (global prefix set by NestJS)

---

## 6. API Gateway Module Anatomy

### 6a. Module registration

**File:** `apps/api/src/app.module.ts`

```typescript
@Module({
  imports: [
    KafkaModule,       // Global — Kafka producer available to all modules
    AuthModule,        // Login, refresh, JWT strategy
    HealthModule,      // GET /api/health
    AppointmentModule, // Appointment CRUD
    VitalsModule,      // Vitals recording
    AiModule,          // AI diagnosis requests
    AuditModule,       // Read-only audit log queries
    FhirModule,        // FHIR bundle ingestion + search
    OrdersModule,      // Lab/imaging/medication orders
    BillingModule,     // Claims, adjudication, payments
  ],
  providers: [AlertsGateway],  // Socket.io for real-time alerts
})
```

### 6b. Controller pattern (BillingController)

**File:** `apps/api/src/billing/billing.controller.ts`

```typescript
@Controller('billing')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('claims')
  @RequirePermission('billing.claim_create')
  async createClaim(@Body() body: CreateClaimRequest, @Request() req) {
    return this.billingService.createClaim(body, req.user.id);
  }

  @Post('claims/:id/submit')
  @RequirePermission('billing.claim_submit')
  async submitClaim(@Param('id') id: string, @Body('submittedBy') submittedBy: string) {
    return this.billingService.submitClaim(id, submittedBy);
  }

  @Get('claims')
  @RequirePermission('billing.claim_view')
  async listClaims() {
    return this.billingService.listClaims();
  }
}
```

**Key NestJS patterns:**

- **Class-level `@UseGuards`** — protects ALL endpoints with JWT + RBAC
- **`@RequirePermission`** — custom decorator that the RbacGuard reads
- **`@Body()` / `@Param()` / `@Query()`** — request data extraction
- **`@Request() req`** — access authenticated user (set by JwtAuthGuard)

### 6c. RBAC Guard

**File:** `apps/api/src/common/rbac.guard.ts`

```typescript
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.get<Feature>(PERMISSION_KEY, context.getHandler());
    if (!feature) return true; // No permission required → allow

    const user = context.switchToHttp().getRequest().user;
    const result = canAccess(user.role as Role, feature, {
      userId: user.id,
      targetOwnerId: request.body?.patientId ?? user.id,
    });

    if (!result.granted) throw new ForbiddenException(result.reason);
    return true;
  }
}
```

---

## 7. Event Flow — Kafka + Microservices

The API gateway **does not contain business logic**. It delegates to microservices via Kafka.

### Example: Vital signs recording

```
Frontend                    API Gateway                 Kafka                Notifications
  │                             │                         │                      │
  │ POST /api/vitals            │                         │                      │
  │ (heartRate, systolicBp...)  │                         │                      │
  │────────────────────────────►│                         │                      │
  │                             │                         │                      │
  │                             │ 1. INSERT INTO vitals   │                      │
  │                             │ 2. Emit vitals.recorded │                      │
  │                             │────────────────────────►│                      │
  │◄──── 201 Created ──────────│                         │                      │
  │                             │                         │                      │
  │                             │                         │ vitals.recorded      │
  │                             │                         │─────────────────────►│
  │                             │                         │                      │
  │                             │                         │   check thresholds   │
  │                             │                         │   if breached:       │
  │                             │                         │   emit alert.dispatch│
  │                             │                         │◄─────────────────────│
  │                             │                         │                      │
  │                             │ alert.dispatched        │                      │
  │◄──── Socket.io 'alert' ────│◄────────────────────────│                      │
```

### Kafka topics (the "event bus")

**File:** `packages/kafka/src/topics.ts`

All 17 topics are listed here. The naming convention is `<domain>.<entity>.<action>`:

- `vitals.recorded`, `appointment.created`, `order.created`, `claim.submitted`
- `fhir.resource.ingested`, `ai.diagnosis.requested`, `alert.dispatched`

### Typed event payloads

**File:** `packages/contracts/src/events/vitals-events.ts`

```typescript
export interface VitalsRecordedPayload {
  vitalsId: string;
  patientId: string;
  heartRate?: number;
  systolicBp?: number;
  temperature?: number;
  thresholdBreached?: boolean;
}
```

---

## 8. Angular Patterns in This Project

### Pattern 1: Standalone Components (no NgModules)

Every component uses `standalone: true` and lists its dependencies in `imports`:

```typescript
@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
})
```

### Pattern 2: Signals for State Management

```typescript
// Writable state
readonly loading = signal(true);
readonly error = signal<string | null>(null);

// Derived state
readonly canCreate = computed(() => this.allowedTypes().length > 0);

// Updating state
this.loading.set(true);
this.error.set('Failed to load.');
this.items.update((prev) => [newItem, ...prev]);
```

### Pattern 3: Signal-based Inputs and Outputs

```typescript
// Parent → Child (input)
readonly items = input.required<ItemType[]>();
readonly loading = input<boolean>(false);

// Child → Parent (output)
readonly itemClick = output<string>();
```

### Pattern 4: `effect()` for Side Effects

```typescript
constructor() {
  effect(() => {
    // Runs whenever resetTick() changes
    this.resetTick();
    this.form.reset();
  });
}
```

### Pattern 5: `async/await` with `toPromise()`

```typescript
async loadData() {
  try {
    const result = await this.myService.getData().toPromise();
    this.data.set(result ?? []);
  } catch {
    this.error.set('Failed to load.');
  }
}
```

### Pattern 6: RBAC-Driven UI

Permissions are checked at 3 levels:

| Level         | Mechanism                                     | File                   |
| ------------- | --------------------------------------------- | ---------------------- |
| **Route**     | `canActivate: [authGuard, rbacGuard]`         | `app.routes.ts`        |
| **Nav link**  | `computed()` reading `getRolePermissions()`   | `app.component.ts`     |
| **Component** | `computed()` reading `authService.userRole()` | `billing.component.ts` |

---

## 9. NestJS Patterns in This Project

### Pattern 1: Module Organization

Each feature has a module, controller, and service:

```
billing/
├── billing.module.ts      ← @Module({ controllers, providers })
├── billing.controller.ts  ← @Controller('billing')
├── billing.service.ts     ← @Injectable()
└── __tests__/
    └── billing.service.spec.ts
```

### Pattern 2: Guard Stacking

```typescript
@UseGuards(JwtAuthGuard, RbacGuard)  // ← Always together!
@RequirePermission('billing.claim_create')
```

### Pattern 3: Kafka + Database in Services

Services combine Drizzle DB queries with Kafka event emission:

```typescript
@Injectable()
export class BillingService {
  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer) {}

  async createClaim(dto: CreateClaimRequest, userId: string) {
    // 1. Insert into DB
    const [claim] = await this.db.insert(schema.claims).values({ ... }).returning();

    // 2. Emit Kafka event
    await this.producer.emit('claim.created', { claimId: claim.id, ... });

    // 3. Return response
    return this.toResponse(claim);
  }
}
```

---

## 10. How to Add a New Feature

Let's say you want to add a "Reports" feature. Here's the checklist:

### Frontend (apps/web)

| Step                | File                                                  | What to do                                                                                                                   |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1. Create DTO       | `packages/contracts/src/dto/report.dto.ts`            | Define request/response interfaces                                                                                           |
| 2. Export DTO       | `packages/contracts/src/index.ts`                     | Add `export type * from './dto/report.dto.js'`                                                                               |
| 3. Create service   | `apps/web/src/app/services/report.service.ts`         | `@Injectable({ providedIn: 'root' })` with HTTP methods                                                                      |
| 4. Create page      | `apps/web/src/app/pages/reports/reports.component.ts` | Standalone component with signals                                                                                            |
| 5. Add route        | `apps/web/src/app/app.routes.ts`                      | `{ path: 'reports', canActivate: [authGuard, rbacGuard], data: { requiredPermission: 'reports.view' }, loadComponent: ... }` |
| 6. Add nav link     | `apps/web/src/app/app.component.ts`                   | Add to `navLinks` computed                                                                                                   |
| 7. Add RBAC         | `packages/rbac/src/features.ts`                       | Add `'reports.view'` feature                                                                                                 |
| 8. Add to matrix    | `packages/rbac/src/matrix.ts`                         | Set allow/deny for each role                                                                                                 |
| 9. Add feature card | `apps/web/src/app/pages/dashboard.component.ts`       | Add to `featureCards` computed                                                                                               |

### Backend (apps/api)

| Step                 | File                                         | What to do                            |
| -------------------- | -------------------------------------------- | ------------------------------------- |
| 1. Create module     | `apps/api/src/reports/reports.module.ts`     | `@Module({ controllers, providers })` |
| 2. Create controller | `apps/api/src/reports/reports.controller.ts` | `@UseGuards(JwtAuthGuard, RbacGuard)` |
| 3. Create service    | `apps/api/src/reports/reports.service.ts`    | DB queries + Kafka events             |
| 4. Register module   | `apps/api/src/app.module.ts`                 | Add to `imports`                      |
| 5. Add DB table      | `packages/db/src/schema/index.ts`            | Add `pgTable` definition              |

---

## 11. AI Diagnostics Feature — Deep Dive with Full Flow Diagram

This section traces the complete **AI Diagnostics** pipeline, from the moment
a clinician clicks "Request Diagnosis" in the browser, through the RAG
pipeline, all the way back to the result on screen.

### The Full 10-Step Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    AI DIAGNOSTICS — REQUEST → RAG → LLM → RESPONSE           │
│                                                                              │
│  apps/web (Angular)          apps/api (NestJS Gateway)       PostgreSQL      │
│  ─────────────────────      ──────────────────────────       ──────────      │
│                              ┌───────────────────────┐                        │
│  1. Doctor fills form        │   AiController         │                       │
│     Patient ID + Context ───►│   POST /api/ai/diagnose│                       │
│                              │   @RequirePermission   │                       │
│  2. ◄── 201 Created ────────│   ('ai.request_diag-   │                       │
│      (status: 'requested')   │    nosis')             │                       │
│                              └──────────┬────────────┘                        │
│                                         │                                    │
│                              ┌──────────▼────────────┐                       │
│                              │   AiService            │                       │
│                              │   requestDiagnosis()   │                       │
│                              │                         │                       │
│                              │  ┌──────────────────┐  │   INSERT INTO         │
│                              │  │ 1. INSERT INTO   │──┼──► ai_diagnoses       │
│                              │  │    ai_diagnoses  │  │   (status: requested) │
│                              │  │    RETURNING id   │  │                       │
│                              │  └────────┬─────────┘  │                       │
│                              │           │             │                       │
│                              │  ┌────────▼─────────┐  │                       │
│                              │  │ 2. Emit Kafka     │  │                       │
│                              │  │    event:         │  │                       │
│                              │  │ ai.diagnosis.     │  │                       │
│                              │  │ requested         │  │                       │
│                              │  └────────┬─────────┘  │                       │
│                              └───────────┼────────────┘                        │
│                                          │                                    │
│     ╔════════════════════════════════════╪══════════════════════════════════╗  │
│     ║           APACHE KAFKA             │     (async, event-driven)        ║  │
│     ║  Topic: ai.diagnosis.requested     │                                  ║  │
│     ╚════════════════════════════════════╪══════════════════════════════════╝  │
│                                          │                                    │
│                              ┌───────────┴────────────┐                       │
│                              │ services/ai-rag (NestJS)│                      │
│                              │ ───────────────────────  │                      │
│                              │                         │                      │
│                              │ RagConsumerService       │                      │
│                              │  • Subscribes to topic  │                      │
│   Polling / Socket.io       │  • Dispatches to         │                      │
│   (frontend polls           │    RagPipelineService    │                      │
│    GET /api/ai/diagnoses)   └──────────┬──────────────┘                       │
│                                         │                                    │
│                              ┌──────────▼──────────────┐                       │
│                              │ RagPipelineService.run() │                      │
│                              │                         │                      │
│                              │  ┌──────────────────┐   │  UPDATE              │
│                              │  │ 3. Mark status    │───┼──► ai_diagnoses      │
│                              │  │    = 'processing' │   │  (status:            │
│                              │  └────────┬─────────┘   │   processing)        │
│                              │           │              │                      │
│                              │           ▼              │                      │
│                              │  ┌──────────────────┐   │                      │
│                              │  │ 4. ChromaService   │   │                      │
│                              │  │    retrieveContext │   │                      │
│                              │  │                    │   │                      │
│                              │  │    ┌───────────┐  │   │                      │
│                              │  │    │ ChromaDB   │  │   │                      │
│                              │  │    │ (vector    │  │   │                      │
│                              │  │    │  store)    │  │   │                      │
│                              │  │    └─────┬─────┘  │   │                      │
│                              │  │          │ query   │   │                      │
│                              │  │          │ (similar│   │                      │
│                              │  │          │  search) │   │                      │
│                              │  │          ▼         │   │                      │
│                              │  │    ┌───────────┐  │   │                      │
│                              │  │    │ Top-K doc │  │   │                      │
│                              │  │    │  chunks   │  │   │                      │
│                              │  │    └───────────┘  │   │                      │
│                              │  └────────┬─────────┘   │                      │
│                              │           │              │                      │
│                              │           ▼              │                      │
│                              │  ┌──────────────────┐   │                      │
│                              │  │ 5. Build RAG     │    │                      │
│                              │  │    Prompt:       │    │                      │
│                              │  │    • System msg  │    │                      │
│                              │  │    • Retrieved   │    │                      │
│                              │  │      context     │    │                      │
│                              │  │    • Clinical Q  │    │                      │
│                              │  └────────┬─────────┘   │                      │
│                              │           │              │                      │
│                              │           ▼              │                      │
│                              │  ┌──────────────────┐   │                      │
│                              │  │ 6. OllamaService  │   │                      │
│                              │  │    generate(prompt)│  │                      │
│                              │  │                    │  │                      │
│                              │  │    ┌───────────┐  │  │                      │
│                              │  │    │ Ollama     │  │  │                      │
│                              │  │    │ (Llama-3-  │  │  │                      │
│                              │  │    │  8B)       │  │  │                      │
│                              │  │    └─────┬─────┘  │  │                      │
│                              │  │          │ response│  │                      │
│                              │  │          ▼         │  │                      │
│                              │  │    ┌───────────┐  │  │                      │
│                              │  │    │ Diagnosis │  │  │                      │
│                              │  │    │  text     │  │  │                      │
│                              │  │    └───────────┘  │  │                      │
│                              │  └────────┬─────────┘   │                      │
│                              │           │              │                      │
│                              │  ┌────────▼─────────┐  │                      │
│                              │  │ 7. UPDATE         │  │  UPDATE              │
│                              │  │    ai_diagnoses   │──┼──► ai_diagnoses      │
│                              │  │    status=        │  │  (status: completed  │
│                              │  │    'completed'    │  │   + diagnosis text   │
│                              │  │    + diagnosis    │  │   + source refs)     │
│                              │  └────────┬─────────┘  │                       │
│                              │           │              │                      │
│                              │  ┌────────▼─────────┐  │                      │
│                              │  │ 8. Emit Kafka     │  │                      │
│                              │  │    event:         │  │                      │
│                              │  │    ai.diagnosis.  │  │                      │
│                              │  │    completed      │  │                      │
│                              │  │    + audit.event  │  │                      │
│                              │  └──────────────────┘  │                      │
│                              └─────────────────────────┘                      │
│                                                                              │
│  9. Frontend polls GET /api/ai/diagnoses                                     │
│     or receives via Socket.io                                                │
│                                                                              │
│     ┌─────────────────────────────────────────┐                              │
│     │ AiDiagnosisComponent                    │                              │
│     │                                         │                              │
│     │  Diagnosis Card:                        │                              │
│     │  ┌─────────────────────────────────┐   │                              │
│     │  │ Status: completed               │   │                              │
│     │  │ Patient: pt-123                 │   │                              │
│     │  │ AI Diagnosis: "The patient's    │   │                              │
│     │  │  imaging shows..."             │   │                              │
│     │  │ [Approve] [Override]           │   │                              │
│     │  └─────────────────────────────────┘   │                              │
│     └─────────────────────────────────────────┘                              │
│                                                                              │
│ 10. Doctor reviews:                                                         │
│     POST /api/ai/diagnoses/:id/review                                       │
│     { decision: 'approve' }  ──► status = 'approved'                        │
│     { decision: 'override', overrideDiagnosis: '...' }  ──► overridden      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-step breakdown

| Step   | What happens                                                   | Service               | Key file                                                           |
| ------ | -------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| **1**  | Clinician fills form, clicks submit                            | Angular               | `apps/web/src/app/pages/ai-diagnosis.component.ts:onRequest()`     |
| **2**  | API gateway validates permissions, inserts DB row, returns 201 | API Gateway           | `apps/api/src/ai/ai.service.ts:requestDiagnosis()`                 |
| **3**  | Kafka event emitted: `ai.diagnosis.requested`                  | API Gateway → Kafka   | `packages/contracts/src/events/ai-events.ts`                       |
| **4**  | ai-rag consumer receives the event                             | ai-rag microservice   | `services/ai-rag/src/rag/rag-consumer.service.ts`                  |
| **5**  | Diagnosis marked `processing` in DB                            | ai-rag → PostgreSQL   | `services/ai-rag/src/rag/rag-pipeline.service.ts`                  |
| **6**  | ChromaDB similarity search (top-5 relevant documents)          | ai-rag → ChromaDB     | `services/ai-rag/src/rag/chroma.service.ts:retrieveContext()`      |
| **7**  | RAG prompt built: system + context + question                  | ai-rag                | `services/ai-rag/src/rag/rag-pipeline.service.ts:buildPrompt()`    |
| **8**  | Ollama generates diagnosis (Llama-3-8B)                        | ai-rag → Ollama       | `services/ai-rag/src/rag/ollama.service.ts:generate()`             |
| **9**  | Result persisted to DB + Kafka events emitted                  | ai-rag → Kafka + PG   | `services/ai-rag/src/rag/rag-pipeline.service.ts`                  |
| **10** | Frontend loads result via GET or Socket.io                     | Angular → API Gateway | `apps/web/src/app/pages/ai-diagnosis.component.ts:loadDiagnoses()` |

### Error handling strategy

The pipeline never throws to the caller. If any step fails (ChromaDB down,
Ollama unavailable, DB write failure), the diagnosis is marked `failed` in
the database and a `completed` event with `success: false` is emitted so
the frontend can surface the error:

```
services/ai-rag/src/rag/rag-pipeline.service.ts  (lines ~143-167)

catch (error) {
  await this.db.update(schema.aiDiagnoses)
    .set({ status: 'failed', completedAt: new Date() })
    .where(eq(schema.aiDiagnoses.id, diagnosisId));

  await this.producer.send('ai.diagnosis.completed', {
    ...payload,
    success: false,
    errorMessage: error.message,
    completedAt: new Date().toISOString(),
  });
}
```

### Audit trail

Every AI diagnosis step emits an `audit.event` Kafka message for compliance:

| Step                | Audit action                       | Emitted by  |
| ------------------- | ---------------------------------- | ----------- |
| Request received    | `'diagnose'` + `result: 'success'` | API Gateway |
| Pipeline failure    | `'diagnose'` + `result: 'failure'` | ai-rag      |
| Clinician approves  | `'approve'` + `result: 'success'`  | API Gateway |
| Clinician overrides | `'override'` + `result: 'success'` | API Gateway |

### RBAC check points

| Where              | Permission checked                              | Effect                       |
| ------------------ | ----------------------------------------------- | ---------------------------- |
| Route guard        | `ai.view_diagnosis`                             | Blocks page access if denied |
| Nav link           | `ai.request_diagnosis` or `ai.view_diagnosis`   | Hides nav link if denied     |
| API controller     | `ai.request_diagnosis`                          | Blocks POST if denied        |
| API controller     | `ai.view_diagnosis`                             | Blocks GET if denied         |
| API controller     | `ai.approve_diagnosis`                          | Blocks review POST if denied |
| Dashboard card     | `ai.request_diagnosis` or `ai.view_diagnosis`   | Hides card if denied         |
| Component template | `canRequest()` / `canReview()` computed signals | Hides form/buttons           |

### Key files reference

| Role                | File                                                   |
| ------------------- | ------------------------------------------------------ |
| **Angular page**    | `apps/web/src/app/pages/ai-diagnosis.component.ts`     |
| **Angular service** | (inline HttpClient calls — no dedicated service)       |
| **API Controller**  | `apps/api/src/ai/ai.controller.ts`                     |
| **API Service**     | `apps/api/src/ai/ai.service.ts`                        |
| **API Module**      | `apps/api/src/ai/ai.module.ts`                         |
| **Kafka consumer**  | `services/ai-rag/src/rag/rag-consumer.service.ts`      |
| **RAG pipeline**    | `services/ai-rag/src/rag/rag-pipeline.service.ts`      |
| **ChromaDB client** | `services/ai-rag/src/rag/chroma.service.ts`            |
| **Ollama client**   | `services/ai-rag/src/rag/ollama.service.ts`            |
| **RAG module**      | `services/ai-rag/src/rag/rag.module.ts`                |
| **DTOs**            | `packages/contracts/src/dto/ai-diagnosis.dto.ts`       |
| **Kafka events**    | `packages/contracts/src/events/ai-events.ts`           |
| **DB schema**       | `packages/db/src/schema/index.ts` (ai_diagnoses table) |
| **RBAC features**   | `packages/rbac/src/features.ts` (ai.\* features)       |
| **RBAC matrix**     | `packages/rbac/src/matrix.ts` (permissions per role)   |

---

## 12. Vital Signs → Alerts Pipeline — Deep Dive with Full Flow Diagram

This section traces the complete **Vital Signs → Alert** pipeline, from the
moment a nurse records vitals, through threshold evaluation, to the real-time
alert appearing in the browser — all in under a second.

### The Full Flow (5 services, 3 Kafka topics, 2 databases)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│               VITAL SIGNS → THRESHOLD BREACH → ALERT → SOCKET.IO                    │
│                                                                                     │
│  apps/web (Angular)        apps/api (NestJS Gateway)      PostgreSQL                │
│  ────────────────────     ──────────────────────────      ──────────                │
│                            ┌─────────────────────────┐                              │
│  1. Nurse fills form      │ VitalsController         │                              │
│     Patient ID + vitals ──►│ POST /api/vitals         │                              │
│                            │ @RequirePermission       │                              │
│  2. ◄── 201 Created ─────│ ('vitals.record')         │                              │
│      (vitals recorded)    └───────────┬─────────────┘                              │
│                                        │                                            │
│                            ┌──────────▼──────────────┐                             │
│                            │ VitalsService.record()  │                             │
│                            │                         │                             │
│                            │  ┌──────────────────┐   │  INSERT INTO                │
│                            │  │ 1. INSERT INTO   │───┼──► vitals                   │
│                            │  │    vitals         │   │  (patientId, heartRate,    │
│                            │  │    RETURNING id   │   │   systolicBp, ...)         │
│                            │  └────────┬─────────┘   │                             │
│                            │           │              │                             │
│                            │  ┌────────▼─────────┐   │                             │
│                            │  │ 2. Check          │   │                             │
│                            │  │    thresholds     │   │  (quick pre-check:          │
│                            │  │    (pre-check)    │   │   HR<40, SpO2<90, etc.)     │
│                            │  └────────┬─────────┘   │                             │
│                            │           │              │                             │
│                            │  ┌────────▼─────────┐   │                             │
│                            │  │ 3. Emit Kafka     │   │                             │
│                            │  │    event:         │   │                             │
│                            │  │ vitals.recorded   │   │                             │
│                            │  │ (includes         │   │                             │
│                            │  │  thresholdBreach- │   │                             │
│                            │  │  ed hint flag)    │   │                             │
│                            │  └────────┬─────────┘   │                             │
│                            └───────────┼─────────────┘                             │
│                                        │                                            │
│     ╔══════════════════════════════════╪════════════════════════════════════════╗   │
│     ║        APACHE KAFKA              │     Topic: vitals.recorded             ║   │
│     ╚══════════════════════════════════╪════════════════════════════════════════╝   │
│                                        │                                            │
│                            ┌───────────┴──────────────┐                            │
│                            │ services/notifications    │                            │
│                            │ (headless NestJS)         │                            │
│                            │ ────────────────────────  │                            │
│                            │                           │                            │
│                            │ VitalsConsumerService     │                            │
│                            │  • Subscribes to          │                            │
│                            │    vitals.recorded        │                            │
│                            │  • Calls ThresholdService │                            │
│                            └───────────┬──────────────┘                            │
│                                        │                                            │
│                            ┌───────────▼──────────────┐                            │
│                            │ ThresholdService          │                            │
│                            │ checkVitals(payload)      │                            │
│                            │                           │                            │
│                            │  HR < 40 or > 180?  ──► critical                       │
│                            │  Systolic < 80 or         │                            │
│                            │    > 200?          ──► critical                       │
│                            │  Diastolic < 40 or        │                            │
│                            │    > 120?          ──► warning                        │
│                            │  SpO2 < 90%?       ──► critical                       │
│                            │  SpO2 < 95%?       ──► warning                        │
│                            │  Temp < 35 or > 40 ──► critical                       │
│                            │           ┌──────┴──────┐                            │
│                            │           │ No breach?  │                            │
│                            │           │  → return   │  (no alert needed)         │
│                            │           └──────┬──────┘                            │
│                            │                  │ breach found                      │
│                            │                  ▼                                    │
│                            │  ┌──────────────────────────────┐                     │
│                            │  │ AlertService                  │                     │
│                            │  │ createAndDispatch(severity,   │                     │
│                            │  │  message, targetRoles)        │                     │
│                            │  │                               │                     │
│                            │  │  ┌────────────────────────┐  │  INSERT INTO         │
│                            │  │  │ 4. INSERT INTO alerts │──┼──► alerts            │
│                            │  │  │    RETURNING id        │  │  (patientId,         │
│                            │  │  └────────┬───────────────┘  │   severity,          │
│                            │  │           │                   │   message,           │
│                            │  │           ▼                   │   metadata)          │
│                            │  │  ┌────────────────────────┐  │                     │
│                            │  │  │ 5. Map severity →      │  │                     │
│                            │  │  │    target roles:       │  │                     │
│                            │  │  │    critical  → doc,    │  │                     │
│                            │  │  │                  nurse,│  │                     │
│                            │  │  │                  med_dir│  │                     │
│                            │  │  │    warning    → nurse   │  │                     │
│                            │  │  │    info       → patient │  │                     │
│                            │  │  └────────┬───────────────┘  │                     │
│                            │  │           │                   │                     │
│                            │  │  ┌────────▼───────────────┐  │                     │
│                            │  │  │ 6. Emit Kafka events:  │  │                     │
│                            │  │  │    alert.dispatched    │  │                     │
│                            │  │  │    audit.event         │  │                     │
│                            │  │  └────────┬───────────────┘  │                     │
│                            │  └───────────┼──────────────────┘                     │
│                            └──────────────┼────────────────────────────────────────┘
│                                           │                                         │
│     ╔═════════════════════════════════════╪═══════════════════════════════════════╗  │
│     ║         APACHE KAFKA                │     Topic: alert.dispatched           ║  │
│     ╚═════════════════════════════════════╪═══════════════════════════════════════╝  │
│                                           │                                         │
│                            ┌──────────────┴──────────────┐                         │
│                            │ apps/api (NestJS Gateway)    │                         │
│                            │ ───────────────────────────  │                         │
│                            │                              │                         │
│                            │ AlertsGateway                │                         │
│                            │ (Socket.io WebSocket)         │                         │
│                            │                              │                         │
│  7. ◄── Socket.io 'alert'─│  broadcastAlert(payload)     │                         │
│      event received by    │  • server.to('role:doctor')  │                         │
│      Angular AlertService │  • server.to('role:nurse')   │                         │
│      → signal updates     │  • server.to('role:medical_  │                         │
│      → UI re-renders      │    director')                │                         │
│      → alert bar shows    └──────────────────────────────┘                         │
│                                                                                    │
│  ┌──────────────────────────────────────────┐                                     │
│  │ AppComponent (alert bar)                 │                                     │
│  │ ┌──────────────────────────────────────┐ │                                     │
│  │ │ 🔴 CRITICAL: Heart rate 190 bpm      │ │                                     │
│  │ │    for patient pt-123               │ │                                     │
│  │ │    [Acknowledge]  [Clear]           │ │                                     │
│  │ └──────────────────────────────────────┘ │                                     │
│  │ ┌──────────────────────────────────────┐ │                                     │
│  │ │ ⚠ WARNING: O2 saturation 92%        │ │                                     │
│  │ │    for patient pt-456               │ │                                     │
│  │ │    [Acknowledge]                    │ │                                     │
│  │ └──────────────────────────────────────┘ │                                     │
│  │                                          │                                     │
│  │ alertService.acknowledge(alertId)        │                                     │
│  │   → Socket.io emits 'alert:acknowledge'  │                                     │
│  │   → AlertsGateway handles it             │                                     │
│  │   → UPDATE alerts SET acknowledged=true  │                                     │
│  └──────────────────────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-step breakdown

| Step   | What happens                                                           | Service             | Key file                                                                 |
| ------ | ---------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| **1**  | Nurse records vitals via form (POST /api/vitals)                       | Angular             | `apps/web/src/app/pages/vitals.component.ts:onRecord()`                  |
| **2**  | API gateway validates JWT + RBAC, inserts vitals row                   | API Gateway         | `apps/api/src/vitals/vitals.service.ts:record()`                         |
| **3**  | API gateway emits `vitals.recorded` Kafka event with threshold hint    | API Gateway → Kafka | `packages/contracts/src/events/vitals-events.ts`                         |
| **4**  | Notifications consumer receives the event                              | Notifications       | `services/notifications/src/alerts/vitals-consumer.service.ts`           |
| **5**  | ThresholdService evaluates each vital against clinical limits          | Notifications       | `services/notifications/src/alerts/threshold.service.ts:checkVitals()`   |
| **6**  | If breached: AlertService inserts alert row + emits `alert.dispatched` | Notifications       | `services/notifications/src/alerts/alert.service.ts:createAndDispatch()` |
| **7**  | API gateway's AlertsGateway receives alert via Kafka consumer          | API Gateway         | (Kafka consumer bridge — receives message, calls `broadcastAlert()`)     |
| **8**  | Socket.io fans alert to role-based rooms (`role:doctor`, etc.)         | API Gateway         | `apps/api/src/alerts/alerts.gateway.ts:broadcastAlert()`                 |
| **9**  | Angular AlertService receives 'alert' event → signal updates → UI      | Angular             | `apps/web/src/app/services/alert.service.ts`                             |
| **10** | User acknowledges alert → Socket.io emits → DB updated                 | Angular → API       | `apps/api/src/alerts/alerts.gateway.ts:handleAcknowledge()`              |

### Severity → Target role mapping

| Severity    | Target roles                    | Example threshold                  |
| ----------- | ------------------------------- | ---------------------------------- |
| `critical`  | doctor, nurse, medical_director | Heart rate < 40 or > 180 bpm       |
| `warning`   | nurse                           | O₂ saturation < 95%                |
| `info`      | patient                         | Appointment reminder               |
| `emergency` | doctor, nurse, medical_director | (reserved for critical lab alerts) |

The mapping lives in `services/notifications/src/alerts/alert.service.ts:targetRolesForSeverity()`.

### Threshold defaults (all configurable via env vars)

| Vital               | Low | High | Severity | Env override keys                 |
| ------------------- | --- | ---- | -------- | --------------------------------- |
| Heart rate (bpm)    | 40  | 180  | critical | `THRESHOLD_HEART_RATE_LOW/HIGH`   |
| Systolic BP (mmHg)  | 80  | 200  | critical | `THRESHOLD_SYSTOLIC_BP_LOW/HIGH`  |
| Diastolic BP (mmHg) | 40  | 120  | warning  | `THRESHOLD_DIASTOLIC_BP_LOW/HIGH` |
| O₂ saturation (%)   | 90  | —    | critical | `THRESHOLD_OXYGEN_CRITICAL_LOW`   |
| O₂ saturation (%)   | 95  | —    | warning  | `THRESHOLD_OXYGEN_WARNING_LOW`    |
| Temperature (°C)    | 35  | 40   | critical | `THRESHOLD_TEMPERATURE_LOW/HIGH`  |

Threshold configuration is loaded once at startup from environment variables
by `services/notifications/src/alerts/threshold.service.ts`. All thresholds can
be tuned without redeploying code.

### Alert acknowledgment flow

```
Browser                                  API Gateway                         PostgreSQL
  │                                          │                                 │
  │ Click 'Acknowledge' button               │                                 │
  │ Socket.io emit('alert:acknowledge',      │                                 │
  │   { alertId: 'abc-123' })               │                                 │
  │─────────────────────────────────────────►│                                 │
  │                                          │                                 │
  │                                          │  AlertsGateway                  │
  │                                          │  handleAcknowledge()            │
  │                                          │  ┌─────────────────────────┐    │
  │                                          │  │ UPDATE alerts            │    │
  │                                          │  │ SET acknowledged = true  │    │
  │                                          │  │ WHERE id = 'abc-123'     │───►│
  │                                          │  └─────────────────────────┘    │
  │                                          │                                 │
  │◄──── { success: true } ─────────────────│                                 │
  │                                          │                                 │
  │ AlertService.acknowledge() removes       │                                 │
  │ the alert from the signal → UI updates   │                                 │
```

### Dual threshold check design

Both the API gateway and the notifications service check thresholds, but for
different purposes:

| Service       | Check location                                                         | Purpose                                                      |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| API Gateway   | `apps/api/src/vitals/vitals.service.ts:checkThresholds()`              | Quick hint flag on the outgoing event (logical OR)           |
| Notifications | `services/notifications/src/alerts/threshold.service.ts:checkVitals()` | **Authoritative** check — configurable, with severity levels |

The API gateway's check is a simplified "is anything unusual?" indicator.
The notifications service runs the full configurable threshold engine and
determines severity. If the gateway flags a breach but the notifications
service finds none (e.g., thresholds were loosened), a warning is logged but
no alert is dispatched — the notifications service is always the authority.

### Key files reference

| Role                           | File                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| **Angular page**               | `apps/web/src/app/pages/vitals.component.ts`                       |
| **Angular alert service**      | `apps/web/src/app/services/alert.service.ts`                       |
| **API Controller**             | `apps/api/src/vitals/vitals.controller.ts`                         |
| **API Service**                | `apps/api/src/vitals/vitals.service.ts`                            |
| **Socket.io gateway**          | `apps/api/src/alerts/alerts.gateway.ts`                            |
| **Notifications consumer**     | `services/notifications/src/alerts/vitals-consumer.service.ts`     |
| **Threshold evaluator**        | `services/notifications/src/alerts/threshold.service.ts`           |
| **Alert creator + dispatcher** | `services/notifications/src/alerts/alert.service.ts`               |
| **Notifications module**       | `services/notifications/src/alerts/notifications.module.ts`        |
| **Vitals DTOs**                | `packages/contracts/src/dto/vitals.dto.ts`                         |
| **Vitals event**               | `packages/contracts/src/events/vitals-events.ts`                   |
| **Alert event**                | `packages/contracts/src/events/alert-events.ts`                    |
| **DB schema**                  | `packages/db/src/schema/index.ts` (vitals + alerts tables)         |
| **Kafka topics**               | `packages/kafka/src/topics.ts` (vitals.recorded, alert.dispatched) |

---

## Quick Reference — File Lookup

### "Where does this HTTP call go?"

```
Frontend calls:  GET /api/billing/claims
                         │
                         ▼
              apps/api/src/billing/billing.controller.ts
                         │
                         ▼
              apps/api/src/billing/billing.service.ts
                         │
                         ├── Drizzle query → PostgreSQL
                         └── Kafka event → Microservice
```

### "Where is this type defined?"

```
Type used in:    CreateClaimRequest
                         │
                         ▼
              packages/contracts/src/dto/billing.dto.ts
```

### "Where is this permission checked?"

```
Permission:     billing.claim_create
                         │
                         ▼
              packages/rbac/src/matrix.ts  (static matrix)
              packages/rbac/src/guards.ts  (runtime evaluation)
              apps/api/src/common/rbac.guard.ts  (NestJS enforcement)
              apps/web/src/app/guards/rbac.guard.ts  (Angular enforcement)
```

---

> **Pro tip:** Use the `file_picker` agent with prompts like "Find the page component for billing" or "Find where Kafka topics are defined" to quickly navigate the codebase. Use `code_searcher` with patterns like `@RequirePermission` or `@UseGuards` to see how patterns are used across files.

---

## 13. Unit Testing — How the Test Suite Is Wired

This section explains how unit tests are organized across the monorepo, why

the Angular (karma) setup looks the way it does, and how to add your own specs.

### 13a. Test runners at a glance

| Workspace            | Runner              | How to run                                                             |
| -------------------- | ------------------- | ---------------------------------------------------------------------- |
| `apps/web` (Angular) | **Karma + Jasmine** | `npm run test --workspace @caregiver/web` (i.e. `ng test`)             |
| `apps/api` (NestJS)  | **Vitest**          | `npm run test --workspace @caregiver/api`                              |
| `services/*`         | **Vitest**          | `npm run test --workspace @caregiver/<name>`                           |
| `packages/*`         | **Vitest**          | `npm run test --workspace @caregiver/<name>`                           |
| Everything           | —                   | `npm run test` (all workspaces — also what the pre-push git hook runs) |

### 13b. The karma/jasmine setup (apps/web)

Unlike the rest of the monorepo (vitest), the Angular app runs its specs in a

real browser via **Karma + Jasmine**. The wiring:

| Piece             | File                                | What it does                                                                              |
| ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Test target       | `apps/web/angular.json` → `test`    | Uses `@angular-builders/custom-webpack:karma` so webpack config can be injected           |
| Custom webpack    | `apps/web/karma.webpack.config.cjs` | Adds `resolve.extensionAlias: { '.js': ['.ts', ...] }` — see the "why" below              |
| Test TS config    | `apps/web/tsconfig.spec.json`       | `types: ["jasmine"]`, `rootDir: ../../..` for workspace package sources                   |
| Browser launchers | `apps/web/karma.conf.cjs`           | `ChromeHeadless` + `ChromeHeadlessNoSandbox`                                              |
| Coverage gate     | `apps/web/karma.conf.cjs`           | `coverageReporter.check` fails the run below 80% lines/statements, 70% branches/functions |
| Test bootstrap    | `apps/web/src/test.ts`              | Initializes the Angular testing environment (JIT + browser DOM)                           |
| Spec linting      | `apps/web/eslint.config.js`         | Specs type-check against `tsconfig.spec.json` and get jasmine globals                     |

**Why the custom webpack config?** The codebase uses `.js`-suffixed relative

imports everywhere (`import { AuthService } from './services/auth.service.js'`),
which is great for ESM interop but trips up the karma webpack build: the
Angular CLI's webpack config never maps `.js` → `.ts`, so karma would fail with
`Module not found: Can't resolve './auth.service.js'`. The `extensionAlias` in
`karma.webpack.config.cjs` makes `.js` requests resolve to the matching `.ts`
source — which also lets specs import the workspace packages (`@caregiver/rbac`,
`@caregiver/ui`) directly.

**Running the web tests locally** — karma needs a Chrome binary:

```bash
# Point CHROME_BIN at any Chrome/Chromium binary (e.g. Playwright's cache)
CHROME_BIN=/path/to/chrome npx ng test --watch=false --browsers=ChromeHeadless
```

### 13c. Test inventory

| Suite                   | File(s)                                                                           | What's covered                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ThemeService (web)      | `apps/web/src/app/services/theme.service.spec.ts`                                 | light/dark default, toggle, persistence, `data-theme` attribute                                        |
| AuthService (web)       | `apps/web/src/app/services/auth.service.spec.ts`                                  | session restore, login, refresh, logout, storage                                                       |
| rbacGuard (web)         | `apps/web/src/app/guards/rbac.guard.spec.ts`                                      | allow/conditional/deny/no-role vs the real matrix                                                      |
| StatusBadge (web)       | `apps/web/src/app/ui/status-badge.component.spec.ts`                              | status text/classes, size variants                                                                     |
| Dashboard (web)         | `apps/web/src/app/pages/dashboard.component.spec.ts`                              | RBAC-gated quick actions + feature cards, insight strip vs the real matrix                             |
| Favorites (web)         | `apps/web/src/app/services/patient-favorites.service.spec.ts`                     | pin/recent persistence, caps, hydration, corrupt-data guard                                            |
| Orders (web)            | `apps/web/src/app/pages/orders/orders.component.spec.ts`                          | load/error, per-role order types, create routing, fill/dispense                                        |
| Billing (web)           | `apps/web/src/app/pages/billing/billing.component.spec.ts`                        | claims/summary load, RBAC actions, create, adjudication, payment                                       |
| FHIR (web)              | `apps/web/src/app/pages/fhir/fhir.component.spec.ts`                              | load, search/ingest RBAC, bundle ingest, detail toggle                                                 |
| Audit (web)             | `apps/web/src/app/pages/audit.component.spec.ts`                                  | log load/render, user/resource filters, reset                                                          |
| App shell (web)         | `apps/web/src/app/app.component.spec.ts`                                          | favorites bar chips, pin/unpin, empty state, auth gating                                               |
| Order forms (web)       | `apps/web/src/app/pages/orders/order-{imaging,medication}-form.component.spec.ts` | typed emit, validation, optional→undefined, resetTick, disabled submit                                 |
| Create-claim form (web) | `apps/web/src/app/pages/billing/billing-create-claim.component.spec.ts`           | line-item add/remove, typed emit + netAmount math, validation, resetTick, disabled submit              |
| FHIR search (web)       | `apps/web/src/app/pages/fhir/fhir-search.component.spec.ts`                       | search/ingest emit, ingest validation, ingestResult reset, RBAC gating, disabled buttons               |
| API services (web)      | `apps/web/src/app/services/{order,billing,fhir,audit}.service.spec.ts`            | HttpClient-spy: verbs, URLs, request bodies, query params per endpoint                                 |
| AlertService (web)      | `apps/web/src/app/services/alert.service.spec.ts`                                 | socket lifecycle: connect gating, connect/disconnect events, alert signal + 50 cap, acknowledge, clear |
| API services            | `apps/api/src/*/__tests__/*.spec.ts`                                              | audit, billing, fhir, orders, vitals services                                                          |
| ai-rag                  | `services/ai-rag/src/rag/__tests__/*.spec.ts`                                     | ollama client, chroma client, rag pipeline                                                             |
| Shared packages         | `packages/{rbac,contracts,kafka}/src/__tests__/`                                  | permission matrix, typed payloads, kafka envelope                                                      |

### 13d. How to write a new spec

**A service with mocked collaborators** — provide mocks via `TestBed` and
assert with jasmine spies:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let httpSpy: jasmine.SpyObj<Pick<HttpClient, 'post'>>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
  });

  it('posts credentials to the login endpoint', () => {
    const service = TestBed.inject(AuthService);
    service.login({ email: 'a@b.c', password: 'pw' });
    expect(httpSpy.post).toHaveBeenCalledWith('/api/auth/login', jasmine.anything());
  });
});
```

**A functional route guard** — run it inside the injection context:

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { rbacGuard } from './rbac.guard';

TestBed.configureTestingModule({
  providers: [{ provide: Router, useValue: { navigate: jasmine.createSpy() } }],
});
const allowed = TestBed.runInInjectionContext(() =>
  rbacGuard({ data: { requiredPermission: 'ai.request_diagnosis' } } as any, {} as any),
);
```

**A standalone component** — create it directly and set inputs before change
detection:

```typescript
const fixture = TestBed.createComponent(StatusBadgeComponent);
fixture.componentRef.setInput('status', 'completed');
fixture.detectChanges();
expect(fixture.nativeElement.textContent).toContain('completed');
```

### 13e. Gotchas

- **Required signal inputs** (`input.required()`) throw if read before being
  set — always call `setInput(...)` before `detectChanges()`.
- **Import style in specs**: both `./foo` and `./foo.js` work in the karma
  build (the `extensionAlias` handles `.js`); extensionless is the existing
  spec convention.
- **The pre-push hook runs `npm run test`** (all workspaces). On machines
  without a system Chrome, export `CHROME_BIN` before `git push` or the web
  karma suite fails and the push is rejected.
- **Coverage floor is enforced by default**: the web `test` script runs with
  `--code-coverage`, and `karma.conf.cjs` `coverageReporter.check` fails the
  run when global lines/statements drop below 80% or branches/functions below
  70% — so both CI and the pre-push hook gate on coverage, not just on
  passing specs. To inspect the report locally: `npm run test --workspace
@caregiver/web` (the script already enables coverage) then open
  `apps/web/coverage/caregiver-web/index.html`.

---

## 14. Patient Favorites — localStorage Persistence

This section traces the **patient favorites** feature — the pinned-patient
chips and recently-viewed queue in the app shell header.

### What the service owns

**File:** `apps/web/src/app/services/patient-favorites.service.ts`

Two independent signals:

| Signal           | Purpose                                           | Capacity | Persisted? |
| ---------------- | ------------------------------------------------- | -------- | ---------- |
| `favorites`      | Patients the user **pinned** explicitly (★)       | 10       | ✅ yes     |
| `recentPatients` | Patients the user **opened** (auto-tracked queue) | 20       | ✅ yes     |

Both lists are hydrated from `localStorage` in the constructor and written
back on every mutation, so pinned patients AND the recent queue survive full
page reloads and new browser sessions.

### Storage keys

| Key                         | Contents                                             |
| --------------------------- | ---------------------------------------------------- |
| `caregiver_favorites`       | `PatientFavorite[]` — pinned patients                |
| `caregiver_recent_patients` | `PatientFavorite[]` — recently viewed (newest first) |

A `PatientFavorite` is `{ patientId, patientName?, pinnedAt }`.

### Data flow

```
AppComponent (favorites bar)           PatientFavoritesService               localStorage
        │                                     │                                │
        │ toggleFavorite(id)                 │                                │
        │───────────────────────────────────►│                                │
        │                                     │ 1. update favorites signal     │
        │                                     │    (dedupe, cap at 10)         │
        │                                     │ 2. saveFavorites()             │
        │                                     │───────────────────────────────►│  write
        │                                     │                                │
        │ openPatient(id)                    │                                │
        │───────────────────────────────────►│                                │
        │                                     │ 1. trackRecent(id)             │
        │                                     │    (prepend, cap at 20)        │
        │                                     │ 2. saveRecentPatients()        │
        │                                     │───────────────────────────────►│  write
        │                                     │                                │
        │       app boot (constructor)       │                                │
        │◄───────────────────────────────────│ loadFavorites() +              │
        │   chips render from signals        │ loadRecentPatients() ◄─────────│  read
```

### Key files reference

| Role          | File                                                     |
| ------------- | -------------------------------------------------------- |
| **Service**   | `apps/web/src/app/services/patient-favorites.service.ts` |
| **Consumers** | `apps/web/src/app/app.component.ts` (favorites bar)      |
| **Consumer**  | `apps/web/src/app/pages/patient-summary.component.ts`    |

### Notes

- Storage writes are **fire-and-forget** (no quota handling) — the payloads
  are tiny (< 10 KB) so this is fine in practice.
- Corrupt JSON in localStorage is silently ignored (`try/catch`) so a stale
  or hand-edited value can never crash the app shell.
- Pinned favorites are user-curated; the recents queue is best-effort churn.

---

## 15. Dashboard Quick Actions — RBAC-Driven Role UI

This section traces the **dashboard** page — the role-aware landing page that
renders a role overview strip, a quick-actions rail, and the workspace grid.

### Layout (top → bottom)

```
┌────────────────────────────────────────────────────────────────┐
│  Welcome, Dr. Patel                        [ DOCTOR ]         │
├────────────────────────────────────────────────────────────────┤
│  Doctor                                 7/30 features         │
│  Diagnose, prescribe, order tests, and review patient records.│
├────────────────────────────────────────────────────────────────┤
│  Quick Actions                                                 │
│  [📅 Schedule appointment] [❤️ Record vitals]                 │
│  [🤖 Request AI diagnosis] [💊 New clinical order]            │
├────────────────────────────────────────────────────────────────┤
│  Workspace                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ 📅       │ │ ❤️       │ │ 🤖       │   feature cards…      │
│  └──────────┘ └──────────┘ └──────────┘                       │
└────────────────────────────────────────────────────────────────┘
```

### The three computed signals

**File:** `apps/web/src/app/pages/dashboard.component.ts`

| Signal         | What it produces                                       | RBAC source                |
| -------------- | ------------------------------------------------------ | -------------------------- |
| `displayName`  | Human role name (`Doctor`)                             | `ROLE_DISPLAY_NAMES`       |
| `roleInsights` | Role description + enabled-feature count               | `getRolePermissions(role)` |
| `quickActions` | Up to 4 common role tasks as chips (label, icon, link) | `getRolePermissions(role)` |

Every action is gated by the **same feature checks** as the nav links, so a
role only ever sees actions it is allowed to perform:

```typescript
readonly quickActions = computed(() => {
  const perms = getRolePermissions(role);
  const can = (...features: Feature[]) => features.some((f) => perms[f] !== 'deny');

  if (can('appointment.schedule'))     actions.push({ label: 'Schedule appointment',  icon: '📅', link: '/appointments' });
  if (can('vitals.record'))            actions.push({ label: 'Record vitals',         icon: '❤️', link: '/vitals' });
  if (can('ai.request_diagnosis'))     actions.push({ label: 'Request AI diagnosis',  icon: '🤖', link: '/ai' });
  if (can('order.lab_create', 'order.imaging_create', 'order.medication_create'))
                                       actions.push({ label: 'New clinical order',    icon: '💊', link: '/orders' });
  // … billing, fhir, audit …
  return actions.slice(0, 4);  // keep the rail scannable
});
```

### Why the feature count is computed, not hard-coded

`roleInsights().availableFeatures` counts non-denied permissions from the
live matrix (`packages/rbac/src/matrix.ts`), so the number stays correct if
the matrix changes — no per-role constant to drift.

### Key files reference

| Role            | File                                            |
| --------------- | ----------------------------------------------- |
| **Page**        | `apps/web/src/app/pages/dashboard.component.ts` |
| **RBAC matrix** | `packages/rbac/src/matrix.ts`                   |
| **Role names**  | `packages/rbac/src/roles.ts`                    |

---

## 16. Alert Acknowledgment + Escalation — Deep Dive

This section traces the complete **alert lifecycle**: creation → Socket.io
fan-out → acknowledgment → (if nobody responds) escalation.

### The Full 8-Step Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│              ALERT LIFECYCLE — CREATE → DELIVER → ACK → ESCALATE            │
│                                                                              │
│ notifications service        Kafka                  API Gateway             │
│ ─────────────────────       ──────                  ───────────             │
│  ┌──────────────────┐                            ┌────────────────────┐    │
│  │ AlertService     │                            │ AlertConsumerService│   │
│  │ createAndDispatch│                            │ (NEW — wires the    │    │
│  │                  │                            │  pipeline)          │    │
│  │ 1. INSERT alerts │                            └─────────┬──────────┘    │
│  │ 2. emit ─────────┼──► alert.dispatched ───────► subscribe + forward   │
│  └──────────────────┘                            │          │            │
│                                                   │   ┌─────▼──────────┐  │
│                                                   │   │ AlertsGateway  │  │
│                                                   │   │ broadcastAlert │  │
│                                                   │   │ → role:<role>  │  │
│                                                   │   │ → user:<pt>    │  │
│                                                   │   └─────┬──────────┘  │
│                                                   │          │ 'alert'     │
│                                                   │          ▼ Socket.io   │
│                                                   │   ┌──────────────┐     │
│                                                   │   │  Browser      │     │
│                                                   │   │  alert bar    │     │
│                                                   │   └──────┬───────┘     │
│                                                   │          │             │
│                                                   │   ┌──────▼───────┐     │
│                                                   │   │  ack click   │     │
│                                                   │   │ alert:ack-   │     │
│                                                   │   │ nowledge     │     │
│                                                   │   └──────┬───────┘     │
│                                                   │          ▼             │
│                                                   │   emit alert.acknowledged │
│                                                   │   (gateway NEVER writes  │
│                                                   │    the DB — BFF pattern) │
│                                                   └──────────┬──────────┘    │
│                                                              ▼                │
│                              notifications AckConsumerService                │
│                              (NEW) — subscribes to alert.acknowledged       │
│                              UPDATE alerts SET acknowledged=TRUE            │
│                              + audit.event mirror                            │
│                                                                    ┌─────────┴──────┐
│                                                                              │
│  If NO ack within ALERT_ESCALATION_TIMEOUT_MS (default 15 min):            │
│                                                                              │
│  ┌──────────────────┐     ┌───────────────────────┐                         │
│  │ EscalationService│     │  per poll (30s):      │                         │
│  │ (NEW)            │────►│  SELECT critical/     │                         │
│  │ checkDueEscal-   │     │  emergency alerts     │                         │
│  │ ations() on      │     │  WHERE NOT ack NOT    │                         │
│  │ setInterval      │     │  escalated AND old    │                         │
│  └──────────────────┘     └──────────┬────────────┘                         │
│                                       │ escalated → UPDATE alerts            │
│                                       │   SET escalated = true               │
│                                       ▼                                      │
│  emit alert.dispatched ──► (escalated: true, severity: emergency,           │
│                            roles: doctor, nurse, medical_director, admin)   │
│                            → gateway broadcasts again → UI pulses 🔴         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-step breakdown

| Step   | What happens                                                     | Where                                                             |
| ------ | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| **1**  | Alert persisted + dispatched on `alert.dispatched`               | `services/notifications/src/alerts/alert.service.ts`              |
| **2**  | API gateway consumer receives the event                          | `apps/api/src/alerts/alert-consumer.service.ts` (NEW)             |
| **3**  | Gateway broadcasts to `role:*` + `user:*` Socket.io rooms        | `apps/api/src/alerts/alerts.gateway.ts:broadcastAlert()`          |
| **4**  | Browser renders the alert bar (severity-colored chips)           | `apps/web/src/app/app.component.ts`                               |
| **5**  | Clinician clicks ✕ → `alert:acknowledge` over Socket.io          | `apps/web/src/app/services/alert.service.ts:acknowledge()`        |
| **6**  | Gateway emits `alert.acknowledged` on Kafka (no DB write)        | `apps/api/src/alerts/alerts.gateway.ts:handleAcknowledge()`       |
| **6b** | Notifications persists ack + mirrors to `audit.event`            | `services/notifications/src/alerts/ack-consumer.service.ts` (NEW) |
| **7**  | Escalation sweeper finds stale unacknowledged critical/emergency | `services/notifications/src/alerts/escalation.service.ts` (NEW)   |
| **8**  | Escalation re-dispatched → UI renders pulsing **ESCALATED** chip | `escalation.service.ts` → gateway → `app.component.ts`            |

### What makes escalation a "re-dispatch"

Escalation does **not** create a new alert row. It:

1. Sets `escalated = true` on the **same** row (with `escalatedAt` in
   metadata — no schema migration needed).
2. Re-emits on the **same** `alert.dispatched` topic with:
   - `escalated: true` (new contract field — `packages/contracts/src/events/alert-events.ts`)
   - severity forced to `emergency`
   - widened `targetRoles` (`doctor`, `nurse`, `medical_director`, `admin`)
3. Mirrors the escalation to `audit.event`.

The gateway consumer treats initial and escalation dispatches identically —
it just forwards both — so the real-time path stays a single topic.

### Compliance endpoints — alert acknowledgment/escalation state

The API gateway exposes a READ-ONLY surface for audit and compliance review.
All endpoints require `audit.read_log` (admin, doctor, radiologist,
pharmacist, billing_specialist, lab_tech, auditor, medical_director) and
never write — alert writes belong to the notifications microservice and the
Socket.io ack handler.

| Endpoint                             | Description                                       |
| ------------------------------------ | ------------------------------------------------- |
| `GET /api/alerts`                    | Search alerts with filters + pagination           |
| `GET /api/alerts/patient/:patientId` | Per-patient alert lifecycle state (newest first)  |
| `GET /api/alerts/summary`            | Compliance summary: ack/escalation counts + rates |

Query params (all optional): `patientId`, `severity`, `acknowledged`,
`escalated`, `from`, `to` (ISO timestamps), `limit`, `offset`.

Each alert response carries the full lifecycle state:

```json
{
  "id": "…",
  "patientId": "…",
  "alertType": "vital_threshold",
  "severity": "critical",
  "message": "Critical: Heart rate 190 bpm",
  "acknowledged": true,
  "acknowledgedBy": "doctor-1",
  "acknowledgedAt": "2026-07-01T00:10:00.000Z",
  "escalated": true,
  "escalatedAt": "2026-07-01T00:15:00.000Z",
  "metadata": { "…": "…" },
  "createdAt": "2026-07-01T00:00:00.000Z"
}
```

`escalatedAt` is lifted from `metadata.escalatedAt` — the timestamp the
escalation sweeper writes when it escalates an alert.

The summary aggregates counts per severity plus ack/escalation rates:

```json
{
  "total": 4,
  "bySeverity": { "info": 0, "warning": 1, "critical": 2, "emergency": 1 },
  "acknowledged": 2,
  "unacknowledged": 2,
  "escalated": 1,
  "ackRate": 0.5,
  "escalationRate": 0.25
}
```

**Files:** `apps/api/src/alerts/alerts.controller.ts`,
`apps/api/src/alerts/alert-query.service.ts`,
`apps/api/src/alerts/alerts.module.ts`,
`packages/contracts/src/dto/alert.dto.ts`.

### Configuration (env vars)

| Env var                       | Default         | Meaning                                 |
| ----------------------------- | --------------- | --------------------------------------- |
| `ALERT_ESCALATION_TIMEOUT_MS` | 900000 (15 min) | How old an unacknowledged alert must be |
| `ALERT_ESCALATION_POLL_MS`    | 30000 (30 s)    | How often the sweeper runs              |

### Key files reference

| Role                         | File                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **Contract**                 | `packages/contracts/src/events/alert-events.ts`                                |
| **Gateway consumer**         | `apps/api/src/alerts/alert-consumer.service.ts` (NEW)                          |
| **Socket.io gateway**        | `apps/api/src/alerts/alerts.gateway.ts`                                        |
| **Escalation sweeper**       | `services/notifications/src/alerts/escalation.service.ts` (NEW)                |
| **Escalation tests**         | `services/notifications/src/alerts/__tests__/escalation.service.spec.ts` (NEW) |
| **Ack persistence consumer** | `services/notifications/src/alerts/ack-consumer.service.ts` (NEW)              |
| **Alert service**            | `services/notifications/src/alerts/alert.service.ts`                           |
| **Alert compliance API**     | `apps/api/src/alerts/alerts.controller.ts` + `alert-query.service.ts`          |
| **Alert state DTOs**         | `packages/contracts/src/dto/alert.dto.ts`                                      |
| **Web alert service**        | `apps/web/src/app/services/alert.service.ts`                                   |
| **Web alert bar**            | `apps/web/src/app/app.component.ts`                                            |
