# CareVibe: Caregiver Operations Console 🏥✨

[![Angular](https://img.shields.io/badge/Angular-18.x-DD0031.svg?logo=angular&logoColor=white)](https://angular.dev/)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![WebSockets](https://img.shields.io/badge/WebSockets-ws-blue.svg)](https://github.com/websockets/ws)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**CareVibe** is a premium, Awwwards-grade caregiver operations console designed for home-care agencies. It enables clinic staff, field nurses, social workers, operations managers, billers, and families to coordinate care plan delivery in real time. 

The application has a decoupled architecture, using **Angular 18** (Signals, Standalone components, RxJS) for the frontend and **Express + WebSockets + PostgreSQL** for the backend database and live event synchronization.

---

## 🏗️ Architecture Overview

The system is organized as a monorepo:

```
Caregiver/
  ├── frontend/               # Angular 18 Single Page Application
  │    ├── src/
  │    │    ├── app/
  │    │    │    ├── core/          # Services, Mock state, Guards & Facades
  │    │    │    ├── features/      # Role views (Clinical, Ops, Finance, Portal, SOS, Mood, Therapy, Welfare, etc.)
  │    │    │    ├── shared/        # Reusable UI controls, avatars, and layout wrappers
  │    │    │    └── ...
  │    │    └── index.html
  │    └── tailwind.config.js
  │
  ├── backend/                # Express + WebSocket + PostgreSQL Server
  │    ├── src/
  │    │    ├── models/
  │    │    │    └── types.ts       # Shared TypeScript interfaces
  │    │    ├── db.ts               # PostgreSQL connection pool & DDL initialization
  │    │    └── index.ts            # REST controllers & WebSocket server
  │    ├── .env                     # Database credentials & server port config
  │    └── package.json
  │
  └── package.json            # Monorepo task runner scripts
```

---

## ⚡ Key Features

### 1. Role-Specific Dashboards
Users see customized dashboard designs depending on their account type:
* **Clinical (Doctors & Nurses)**: Focuses on patient lists, critical vitals alerts, medications pass, and wound care assessments.
* **Operations (Dispatchers & Admins)**: Focuses on shift scheduling, live maps, alerts queues, and inventory par levels.
* **Finance (Billing Managers)**: Highlights invoices, insurance claims queues, CPT codes modifiers, and timesheet approvals.
* **Portal (Patients & Families)**: Gives simplified access to daily mood updates, nurse comments, care schedules, and direct family messaging.

### 2. Phase 2 Features (Fully Integrated)
* **🚨 SOS Emergency System**: Dynamic emergency activation with a configurable countdown timer (3-15 seconds), cancellation mechanics, and real-time backend/WebSocket dispatch logs.
* **📓 Daily Mood Journal**: A rich entry portal for patients to track mood emojis, physical symptoms, notes, and view interactive trend graphs. Supports historical navigation and nurse feedback flags.
* **🏋️ PT Workout Builder & Video Player**: Interactive physical therapy builder permitting caregivers to customize workout routines, select exercises, view video simulation playback, and log workout session outcomes directly.
* **📋 Social Welfare Eligibility Wizard**: A step-by-step wizard (Household, Income, Expenses, Review) evaluating FPL eligibility thresholds in real-time, accompanied by custom role-based recommendations.

### 3. Live Synchronization (WebSockets)
Live events are broadcast instantly to connected clients:
* **Vitals Alerts**: Critical vitals triggers are immediately flagged on nurse consoles.
* **Operation Center Kanban**: Real-time card movement and deletion updates task boards for other dispatchers instantly.
* **Direct & Team Chat**: Secure chat messaging with typing indicators, reactions, and channels support.
* **Family Updates**: Real-time logs of care notes and photos sent to the family portal.

### 4. PostgreSQL Engine
The database layer is migrated to **PostgreSQL 16** with:
* Secure, passwordless **Unix Domain Socket peer authentication** inside developer environments.
* 18 structured tables utilizing specialized columns like **JSONB** (for objects and list data) and **DOUBLE PRECISION** (for high-fidelity decimals).
* **Automated Bootstrapping & Seeding**: The backend validates tables on startup and automatically seeds them from `data.json` if they are empty.

---

## 🗄️ Database Schema Mapping

The database schema maps TypeScript entities directly to PostgreSQL tables:

| PostgreSQL Table | Primary Key | Description | Key Column Types |
| :--- | :--- | :--- | :--- |
| `"users"` | `id` | Agency employees, patients, and family contacts | `credentials` (JSONB) |
| `"patients"` | `id` | Client demographics, diagnostics, emergency contacts | `careTeam`, `emergencyContact`, `riskFlags` (JSONB) |
| `"vitals"` | `id` | Patient clinical vitals history | `temp` (DOUBLE PRECISION) |
| `"medications"` | `id` | Prescribed dosages and schedules | `times` (JSONB) |
| `"medAdministrations"`| `id` | Logs of administered or skipped dosages | - |
| `"schedule"` | `id` | Caregiver visits, visit status, and coordinates | `geo` (JSONB) |
| `"geoPoints"` | `label` | Predefined service neighborhood coordinates | `lat`, `lng` (DOUBLE PRECISION) |
| `"channels"` | `id` | Chat rooms and channels configurations | `members`, `lastMessage` (JSONB) |
| `"messages"` | `id` | Secure messaging logs | `reactions` (JSONB) |
| `"invoices"` | `id` | Billing invoices with unit/modifier items | `items` (JSONB), `subtotal`, `tax`, `total` (DOUBLE PRECISION) |
| `"claims"` | `id` | Insurance claims submitted | `amount` (DOUBLE PRECISION) |
| `"timesheets"` | `id` | Hours worked logs for agency staff | `hours` (DOUBLE PRECISION) |
| `"tasks"` | `id` | Operations Kanban tasks | `tags` (JSONB) |
| `"wounds"` | `id` | Wound stage development logs | `lengthCm`, `widthCm`, `depthCm` (DOUBLE PRECISION), `photos` (JSONB) |
| `"incidents"` | `id` | Incident report filings | `witnesses`, `correctiveActions` (JSONB) |
| `"auditEntries"` | `id` | User transaction logging | `meta` (JSONB) |
| `"inventory"` | `sku` | Medical supplies and PPE inventory tracking | `unitCost` (DOUBLE PRECISION) |
| `"familyUpdates"` | `id` | Daily updates shared with family portals | - |

---

## 🚀 Setup & Execution

### Prerequisites
* **Node.js** (v18+)
* **PostgreSQL** (v16+) installed and running locally.

### 1. Environment Config
Verify the backend's environment variables are defined inside `backend/.env`:
```ini
PORT=3000
PGUSER=codespace
PGDATABASE=carevibe
PGHOST=/var/run/postgresql
```

> [!NOTE]
> Setting `PGHOST` to `/var/run/postgresql` forces the pg client to connect via Unix sockets, enabling passwordless authentication when running under the `codespace` user.

### 2. Prepare the Database (PostgreSQL)
Ensure you have created the target database. Run the following commands in your terminal:
```bash
# Start PostgreSQL service manually (if not running)
sudo service postgresql start

# Create the superuser role matching your terminal user
sudo sudo -u postgres psql -c "CREATE ROLE codespace WITH LOGIN SUPERUSER;"

# Create the carevibe database
createdb carevibe
```

### 3. Install Dependencies
Run the following command at the monorepo root to install dependencies for the root, frontend, and backend packages:
```bash
npm run install:all
```

### 4. Run Development Servers
Launch the Angular web application and Express API concurrently:
```bash
npm start
```
* **Frontend console**: Running at [http://localhost:4200](http://localhost:4200)
* **Backend API**: Running at [http://localhost:3000](http://localhost:3000)
* **WebSocket server**: Listening at `ws://localhost:3000`

---

## 🧪 REST API Endpoints

### Patients & Vitals
* `GET /api/patients` — List all patients.
* `GET /api/patients/:id` — Get patient by ID.
* `POST /api/patients` — Register a new patient.
* `GET /api/vitals` — Get all vitals records.
* `GET /api/vitals/patient/:patientId` — Vitals log for a patient.
* `POST /api/vitals` — Post a new vitals reading (automatically generates normal/watch/critical alerts and broadcasts via WS).

### Medications & Operations
* `GET /api/medications` — List all medications.
* `GET /api/medications/patient/:patientId` — Medications prescribed for a patient.
* `POST /api/medications` — Prescribe a new medication.
* `POST /api/medications/:id/administer` — Record medication administration status.
* `GET /api/schedule` — Get all shift schedule visits.
* `POST /api/schedule` — Create a scheduled shift.
* `PUT /api/schedule/:id` — Update visit event state (clock-in, clock-out, status).
* `GET /api/geo-points` — List predefined neighborhood coordinates.

### Channels & Chat
* `GET /api/channels` — List all channels.
* `POST /api/channels` — Create a new channel.
* `GET /api/messages` — Get all messages.
* `GET /api/channels/:id/messages` — Messages list for a channel.
* `POST /api/channels/:id/messages` — Post message (broadcasts real-time to other subscribers).
* `POST /api/channels/:id/read` — Reset unread message count for a user.

### Billing, Tasks & Clinical Reports
* `GET /api/invoices` — List billing invoices.
* `POST /api/invoices` — Create a patient invoice.
* `GET /api/claims` — List submitted insurance claims.
* `PUT /api/claims/:id` — Update claim processing state.
* `GET /api/timesheets` — List timesheets.
* `POST /api/timesheets` — Record clock events.
* `PUT /api/timesheets/:id` — Update timesheets status.
* `GET /api/tasks` — List Kanban board tasks.
* `POST /api/tasks` — Create task card.
* `PUT /api/tasks/:id` — Update task.
* `DELETE /api/tasks/:id` — Remove task card.
* `GET /api/wounds` — List wound logs.
* `GET /api/wounds/patient/:patientId` — Wound assessments for a patient.
* `POST /api/wounds` — Post new wound assessment.
* `GET /api/incidents` — List incident reports.
* `POST /api/incidents` — File incident report.
* `PUT /api/incidents/:id` — Update incident status/actions.

### Audits, Inventory & Family Updates
* `GET /api/audit-entries` — List audit entries.
* `POST /api/audit-entries` — Post an audit trail entry.
* `GET /api/inventory` — List medical supplies.
* `POST /api/inventory` — Add a new inventory item.
* `PUT /api/inventory/:sku` — Update item quantity/cost.
* `GET /api/family-updates` — List updates sent to family portals.
* `POST /api/family-updates` — Send care status and mood updates.

---

## 🛠️ Troubleshooting

### Peer authentication failed
If you receive the error `Peer authentication failed for user "codespace"`, ensure the PostgreSQL role exists:
```bash
sudo sudo -u postgres psql -c "CREATE ROLE codespace WITH LOGIN SUPERUSER;"
```

### SCRAM Password Authentication error
If you receive `client password must be a string`, double-check your `.env` file. Ensure `PGHOST` is set to `/var/run/postgresql` rather than `localhost` or `127.0.0.1`. Connecting via IP address activates password authentication, while socket directories use local OS user peer authentication.

### Inspecting logs
To inspect the output and debug messages for the backend database initialization and seeding:
```bash
# Print database user counts
psql -d carevibe -c "SELECT COUNT(*) FROM users;"
```

