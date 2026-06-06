# CareVibe — Implementation TODO

## Phase 1 (Dashboard shell + RBAC foundation)
- [x] Role Simulator Dropdown (topbar role switcher)
- [x] MainShell layout with RouterOutlet
- [x] Role-aware navigation sidebar (distinct action lists per role)
- [x] Signals-based mock state foundation + role-aware dashboard KPIs
- [x] Add/confirm selected-patient context binding across feature services (if required by Phase 2 UIs)
  - [x] Verify every Phase-2 feature reads `DashboardFacadeService.selectedPatientId` (directly or via its feature service)
  - [x] If any feature uses its own patient/mock selection, refactor to consume selected patient consistently
  - [x] Ensure role switching updates the UI immediately (no stale patient state)

## Phase 2 (Spec feature completion)
- [x] Implement SOS Emergency Dispatcher (Feature 11)
      - [x] Persistent SOS button (workspace-wide or SOS route-scoped)
      - [x] Full-screen countdown overlay (with cancel/back behavior)
      - [x] Mock dispatch state machine (idle → counting → dispatched → acknowledged)
      - [x] Role-aware dispatch logic + UX copy
      - [x] Dispatch event history (small timeline) using signals
      - [x] Persistence (optional): remember last dispatch status per patient for the session
- [x] Implement Daily Mood & Wellness Journal (Feature 14)
      - [x] Emoji sliding scale UI (accessible keyboard + touch sizing)
      - [x] Daily persistence per patient (localStorage or signal-backed persistence)
      - [x] Role-aware view:
            - [x] Patient: can submit today’s mood
            - [x] Family/Pros: read-only + last entry / trends
      - [x] Day navigation (today / yesterday) or simple history list
- [x] Implement Physical Therapy Workout Builder (Feature 21)
      - [x] Workout selection UI (mock templates)
      - [x] Mock video playback panel (play/pause/seek simulated)
      - [x] Exercise sets/reps logging with validation
      - [x] Outcome entry (pain, RPE, notes) + derived summary
      - [x] Milestone tracking (e.g., completed N sessions / best streak)
      - [x] Persistence per patient (session/workout completion stored locally)
- [x] Implement Social Welfare Eligibility Wizard (Feature 23)
      - [x] Wizard state + stepper UI
      - [x] Conditional questionnaire branching
      - [x] Eligibility results summary (readable, non-technical)
      - [x] Role-aware results:
            - [x] Staff: detailed breakdown
            - [x] Family/Patient: simplified outcome + next steps
      - [x] Persistence (optional): last wizard answers per patient/session

## Phase 2 Audit completion
- [x] Continue auditing feature components to find remaining “Coming soon” scaffolds beyond the 4 scoped features.
  - [x] For each feature route, check template completeness (no empty sections / placeholder text)
  - [x] Identify any missing component templates (ts exists but html missing) or incomplete UI bindings
  - [x] Fix any shared UI pieces that are referenced but not implemented (shared components/pipes/directives)
  - [x] Ensure role guard + sidebar item alignment (no orphan routes / missing icons/badges)

## Phase 3 (Polish + backend planning)
- [x] Address remaining Angular projection warnings if relevant to edited templates
- [x] Backend-ready service interfaces plan (REST + WS/SSE) behind mock/domain services
  - [x] Define domain interfaces for SOS/Mood/Therapy/Welfare
  - [x] Map mock services to likely API endpoints + payload shapes
  - [x] Document streaming needs (WS/SSE) for SOS dispatch updates (if applicable)
- [x] Additional UX polish: transitions, tap targets, dark mode edge cases
  - [x] Verify overlay + dialogs render correctly in dark mode
  - [x] Ensure button sizes meet mobile tap targets
  - [x] Fix any contrast issues in badges/tiles

## Validation
- [x] Run `npm run build` after Phase 2 changes
- [x] Manual UI verification for each edited feature under at least 2 roles (one privileged, one limited)
