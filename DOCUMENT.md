# RIDSS — Race Intelligence Decision Support System
## Project Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Authentication & Security](#4-authentication--security)
5. [Database Schema](#5-database-schema)
6. [Backend Structure](#6-backend-structure)
7. [API Reference](#7-api-reference)
8. [Frontend Structure](#8-frontend-structure)
9. [Modules](#9-modules)
10. [Shared Services](#10-shared-services)
11. [Development Setup](#11-development-setup)
12. [Environment Variables](#12-environment-variables)
13. [Database Migrations](#13-database-migrations)
14. [Utility Scripts](#14-utility-scripts)

---

## 1. Project Overview

**RIDSS** (Race Intelligence Decision Support System) is a full-stack enterprise web application built for a Formula 1 racing team. It provides a unified operations platform where team members across different roles — Administrators, Team Managers, Race Engineers, Drivers, Mechanics, and Strategy Engineers — each have access to a tailored dashboard with role-specific tools.

Key capabilities include:
- Real-time F1 telemetry analysis powered by the [FastF1](https://docs.fastf1.dev/) library
- Role-based access control (RBAC) enforced at every API layer
- Cross-module audit trail for all write actions
- Team-scoped data access (no cross-team data leakage)
- Engineering report generation with PDF/PNG export
- Vehicle health monitoring and maintenance scheduling
- Race calendar, season results, and driver-season performance comparison

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                             │
│   Next.js 16 (App Router) — React 19 — TypeScript           │
│   Runs on: http://localhost:3000                             │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Route Guard │  │  Axios + TQ  │  │  Role Dashboards │   │
│  │ (middleware)│  │  (API layer) │  │  (6 modules)     │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │ HTTP (cookie auth)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                              │
│   FastAPI — Python 3.11 — SQLAlchemy 2 (async)              │
│   Runs on: http://localhost:8000                             │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  CSRF   │  │   CORS   │  │   RBAC   │  │  FastF1    │  │
│  │Middleware│  │Middleware│  │  Cache   │  │ Telemetry  │  │
│  └─────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Routes (v1)                         │  │
│  │  /auth  /admin  /team-manager  /race-engineer        │  │
│  │  /driver  /mechanic  /strategy-engineer              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (RIDSS)                    │
│   Managed via Alembic migrations                            │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. Browser makes a request to a protected page
2. Next.js Edge Middleware checks for `ridss_access_token` cookie — redirects to `/login` if absent
3. Page component fetches data via Axios from the FastAPI backend
4. Backend validates the JWT from `ridss_access_token` cookie
5. RBAC permission is checked against the in-memory `RBACCacheEngine`
6. Data is queried from PostgreSQL via SQLAlchemy async session
7. Response is returned to the frontend

---

## 3. Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | FastAPI 0.115.5 |
| Language | Python 3.11 |
| ORM | SQLAlchemy 2.0.36 (async) |
| Database Driver (async) | asyncpg 0.30.0 |
| Database Driver (migrations) | psycopg2-binary 2.9.10 |
| Migrations | Alembic 1.14.0 |
| Validation | Pydantic 2.10.3 + pydantic-settings 2.6.1 |
| Auth — JWT | python-jose[cryptography] 3.3.0 |
| Auth — Passwords | passlib[bcrypt] 1.7.4 |
| F1 Data | FastF1 3.8.3 |
| Server | uvicorn[standard] 0.32.1 |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3.0 (App Router) |
| Language | TypeScript 5 |
| UI Library | React 19 |
| Styling | Tailwind CSS 4 |
| Data Fetching | TanStack Query (React Query) 5 + Axios |
| Forms | React Hook Form 7 + Zod 3 |
| Icons | Lucide React |
| Animations | Framer Motion 13 |
| Country Flags | country-flag-icons |

### Database
| Layer | Technology |
|-------|-----------|
| Primary DB | PostgreSQL (named `RIDSS`) |
| Connection | `postgresql+asyncpg://` |
| Dev fallback | SQLite (`sqlite+aiosqlite:///./ridss.db`) |

---

## 4. Authentication & Security

### JWT Tokens

Tokens are issued as **httpOnly cookies** (`ridss_access_token`). This prevents JavaScript access to the token (mitigates XSS attacks).

- **Algorithm:** HS256 (HMAC-SHA256)
- **Library:** `python-jose`
- **Cookie name:** `ridss_access_token`
- **Expiry:** Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 60 minutes)

### CSRF Protection

A **double-submit cookie** pattern is implemented:
- Cookie `ridss_csrf_token` is set (NOT httpOnly — JavaScript must read it)
- All state-changing requests (POST, PUT, PATCH, DELETE) must include the value in the `X-CSRF-Token` header
- `CSRFMiddleware` validates the header against the cookie on every mutating request
- The Axios instance (`frontend/lib/axios.ts`) automatically attaches this header

### Password Hashing

bcrypt via `passlib.CryptContext` — constant-time comparison to prevent timing oracle attacks.

### RBAC — Role-Based Access Control

- Permissions are stored in the `permissions` table and linked to roles via `role_permissions`
- At startup, all role-permission mappings are loaded into an in-memory **`RBACCacheEngine`** singleton
- Every protected API endpoint uses a `require_permission("permission.key")` FastAPI dependency
- The cache auto-invalidates and reloads from the database when permissions are updated via Admin UI
- Permission keys follow the format: `module.resource.action` (e.g. `admin.users.write`, `race_engineer.telemetry.read`)

### Frontend Route Guard

`frontend/middleware.ts` (Next.js Edge Middleware) checks for the `ridss_access_token` cookie on all protected routes. Does **not** decode the JWT — that is the backend's responsibility. It is a UX-layer guard only.

Guarded route prefixes: `/admin/**`, `/team-manager/**`, `/race-engineer/**`, `/strategy-engineer/**`, `/mechanic/**`, `/driver/**`

---

## 5. Database Schema

All primary keys are UUIDs. Managed with Alembic (10 migrations as of latest build).

### Core Tables

| Table | Purpose |
|-------|---------|
| `roles` | Role definitions (Administrator, Team Manager, Race Engineer, etc.) |
| `permissions` | Permission keys (e.g. `admin.users.write`) |
| `role_permissions` | Many-to-many: which permissions each role has |
| `users` | All platform users — linked to a role and optionally a team |
| `teams` | F1 team entities |
| `drivers` | Driver profiles, extends users with FastF1-specific fields |
| `vehicles` | Team vehicle/car fleet |
| `driver_vehicle_assignments` | Active + historical driver-vehicle pairings |
| `races` | Race events |
| `circuits` | Circuit data |
| `components` | Vehicle components tracked for health |
| `maintenances` | Maintenance records for components |
| `reports` | Engineering/team reports |
| `notifications` | In-app notifications for all roles |
| `audit_logs` | Immutable audit trail for all write actions |
| `system_settings` | Key-value store for configurable platform settings |
| `login_history` | Per-user login event log |
| `cache_status` | Records last FastF1 pre-warm script execution |
| `lap_notes` | Race engineer annotations on specific laps |
| `saved_comparisons` | Saved telemetry comparison parameters |

### Key Relationships

```
users ──── role_id ──→ roles ──→ role_permissions ──→ permissions
users ──── team_id ──→ teams
users (driver) ──→ driver_vehicle_assignments ──→ vehicles
reports ──── team_id ──→ teams
audit_logs ── user_id ──→ users
notifications ── user_id ──→ users (recipient)
lap_notes ── user_id ──→ users
saved_comparisons ── user_id ──→ users
```

### User & Driver Model Extensions

- `users.team_since` — team-wide join date tracking tenure across all operational staff roles (Driver, Race Engineer, Mechanic, etc.)
- `drivers.fastf1_driver_number` — car number used to match FastF1 results
- `drivers.fastf1_code` — 3-letter driver code (e.g. `VER`, `HAM`)
- `drivers.is_active` — soft-disable flag for departed drivers

---

## 6. Backend Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI app factory, lifespan, middleware
│   ├── api/
│   │   └── v1/
│   │       ├── router.py           # Aggregates all endpoint routers
│   │       └── endpoints/
│   │           ├── auth.py         # Login, logout, /me, CSRF token
│   │           ├── users.py        # User CRUD (Admin)
│   │           ├── roles.py        # Role + permission management
│   │           ├── teams.py        # Team CRUD + member management
│   │           ├── races_circuits.py
│   │           ├── notifications.py
│   │           ├── audit_logs.py
│   │           ├── admin_system.py # System health, retention settings
│   │           ├── settings.py     # System settings CRUD
│   │           ├── dashboard.py    # Admin dashboard KPIs
│   │           ├── team_manager.py # All Team Manager features
│   │           ├── race_engineer.py # FastF1 telemetry, notes, export, comparisons
│   │           ├── driver.py
│   │           └── mechanic.py     # Vehicle, component, maintenance
│   ├── core/
│   │   ├── config.py               # Pydantic settings from .env
│   │   ├── security.py             # JWT encode/decode, bcrypt helpers
│   │   ├── csrf.py                 # CSRF middleware + token generation
│   │   └── rbac.py                 # RBACCacheEngine + require_permission dependency
│   ├── db/
│   │   └── session.py              # AsyncSessionLocal, get_db, check_db_connection
│   ├── models/                     # SQLAlchemy ORM models (20 files)
│   ├── schemas/                    # Pydantic request/response schemas
│   └── services/
│       ├── audit.py                # log_audit_event() — shared across all modules
│       ├── cache.py                # Thread-safe TTLCache + FastF1 cache keys
│       ├── telemetry_provider.py   # FastF1TelemetryProvider (session load, telemetry, comparison)
│       ├── telemetry_export.py     # ReportLab + Matplotlib PDF/PNG export
│       ├── mechanic_health.py      # Vehicle health roll-up logic
│       ├── race_telemetry.py       # Shared analysis for Strategy Engineer
│       └── retention.py            # Background AuditLog pruning job
├── alembic/
│   └── versions/                   # 10 migration scripts (0001 → 0010)
├── scripts/                        # Seed + test + cache prewarm scripts
├── requirements.txt
├── alembic.ini
└── .env / .env.example
```

---

## 7. API Reference

All API routes are prefixed with `/api/v1/`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Authenticate user, issue JWT cookie |
| `POST` | `/auth/logout` | Clear JWT + CSRF cookies |
| `GET` | `/auth/me` | Return current user info from JWT |
| `GET` | `/auth/csrf-token` | Bootstrap CSRF token cookie |

### Admin — Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/users` | List all users (paginated, searchable) |
| `POST` | `/admin/users` | Create a new user |
| `GET` | `/admin/users/{id}` | Get user detail |
| `PATCH` | `/admin/users/{id}` | Update user (role, team, status) |
| `DELETE` | `/admin/users/{id}` | Delete user |
| `PATCH` | `/admin/users/bulk-status` | Bulk enable/disable users |
| `GET` | `/admin/users/{id}/login-history` | User login history |

### Admin — Roles & Permissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/roles` | List all roles with permissions |
| `POST` | `/admin/roles` | Create a new role |
| `PUT` | `/admin/roles/{id}/permissions` | Update permissions for a role |
| `POST` | `/admin/roles/{id}/duplicate` | Duplicate role as new template |

### Admin — Teams, Races, Circuits

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/admin/teams` | List / create teams |
| `GET/PATCH/DELETE` | `/admin/teams/{id}` | Team detail, update, delete |
| `POST` | `/teams/{id}/members` | Add user to team |
| `DELETE` | `/teams/{id}/members/{uid}` | Remove user from team |
| `GET/POST` | `/admin/races` | List / create races |
| `GET/POST` | `/admin/circuits` | List / create circuits |

### Admin — System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/system-health` | DB + cache + migration health check |
| `GET` | `/admin/audit-logs` | Paginated audit log viewer |
| `GET` | `/admin/audit-logs/export` | Export audit logs as CSV |
| `GET/PUT` | `/admin/settings` | System settings read/write |
| `GET/PATCH` | `/admin/retention` | Retention period config |
| `POST` | `/admin/retention/prune` | Trigger immediate audit log pruning |

### Team Manager

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/team-manager/dashboard` | Dashboard KPIs + recent activity |
| `GET` | `/team-manager/roster` | Driver-vehicle roster + pairing history |
| `POST` | `/team-manager/assign` | Assign driver to vehicle |
| `POST` | `/team-manager/unassign` | Remove driver-vehicle pairing |
| `GET` | `/team-manager/staff` | List team operational staff members with tenure |
| `PATCH` | `/team-manager/staff/{user_id}` | Update staff member details / tenure join date |
| `GET` | `/team-manager/reports` | List team engineering reports |
| `POST` | `/team-manager/reports` | Create team report |
| `GET` | `/team-manager/calendar` | Race calendar with team results |
| `GET` | `/team-manager/season-comparison` | Season-over-season performance comparison |
| `GET` | `/team-manager/pairing-history/{driver_id}` | Vehicle pairing history for a driver |
| `GET` | `/team-manager/drivers` | List all team drivers |

### Race Engineer

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/race-engineer/dashboard` | Dashboard with driver telemetry summary |
| `GET` | `/race-engineer/overview` | Tier 1 session overview (lap summaries, results) |
| `GET` | `/race-engineer/lap-telemetry` | Tier 2 full-resolution lap telemetry |
| `GET` | `/race-engineer/compare` | Dual-driver comparison telemetry + delta time |
| `GET` | `/race-engineer/circuits` | Season circuit list from FastF1 |
| `POST` | `/race-engineer/reports` | Create engineering performance report |
| `GET` | `/race-engineer/reports` | List own engineering reports |
| `POST` | `/race-engineer/lap-notes` | Add annotation note to a specific lap |
| `GET` | `/race-engineer/lap-notes` | Fetch notes for a session/driver/lap |
| `DELETE` | `/race-engineer/lap-notes/{id}` | Delete a lap note (own or admin) |
| `GET` | `/race-engineer/lap-telemetry/{session}/{driver}/{lap}/export` | Export lap telemetry as PDF or PNG |
| `POST` | `/race-engineer/saved-comparisons` | Save a telemetry comparison config |
| `GET` | `/race-engineer/saved-comparisons` | List saved comparisons |
| `DELETE` | `/race-engineer/saved-comparisons/{id}` | Delete a saved comparison |

### Driver Module

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/driver/dashboard` | Season stats, last result, recent notifications |
| `GET` | `/driver/reports` | Own received engineering reports |
| `GET` | `/driver/sessions` | Own lap data / session history |
| `GET` | `/driver/notifications` | Own in-app notifications |
| `PATCH` | `/driver/notifications/{id}/read` | Mark notification as read |

### Mechanic Module

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/mechanic/dashboard` | Vehicle health summary, upcoming maintenance |
| `GET` | `/mechanic/vehicles` | Team vehicle list with health status |
| `GET` | `/mechanic/vehicles/{id}/components` | Component detail for a vehicle |
| `POST` | `/mechanic/vehicles/{id}/components` | Add a component to a vehicle |
| `PATCH` | `/mechanic/components/{id}/status` | Update component status |
| `POST` | `/mechanic/maintenance` | Schedule a maintenance task |
| `PATCH` | `/mechanic/maintenance/{id}` | Update maintenance status |
| `GET` | `/mechanic/maintenance/history` | Maintenance history (filterable) |

---

## 8. Frontend Structure

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout
│   ├── providers.tsx               # TanStack Query global provider
│   ├── globals.css                 # Design tokens + Tailwind config
│   ├── page.tsx                    # Root — calls /me and routes to role dashboard
│   ├── login/                      # Login page (public)
│   └── (protected)/                # Route group — all authenticated pages
│       ├── admin/                  # Administrator dashboard + sub-pages
│       │   ├── page.tsx            # Admin dashboard
│       │   ├── users/              # User management (CRUD + bulk actions)
│       │   ├── roles/              # Role + permission management
│       │   ├── teams/              # Team management
│       │   ├── races/              # Race & circuit management
│       │   ├── notifications/      # Admin notification management
│       │   ├── audit-logs/         # Audit log viewer + CSV export
│       │   ├── settings/           # System settings
│       │   └── system-health/      # System health dashboard
│       ├── team-manager/           # Team Manager dashboard + sub-pages
│       │   ├── page.tsx
│       │   ├── roster/             # Driver-vehicle pairing + history
│       │   ├── staff/              # Staff directory & team-wide tenure management
│       │   ├── reports/            # Team reports
│       │   ├── drivers/            # Driver list
│       │   ├── calendar/           # F1 race calendar
│       │   ├── season-comparison/  # Season-over-season comparison
│       │   └── notifications/
│       ├── race-engineer/          # Race Engineer dashboard + sub-pages
│       │   ├── page.tsx
│       │   ├── telemetry/
│       │   │   ├── page.tsx        # Tier 1 — Session overview + lap bar chart
│       │   │   └── [session]/[driver]/[lap]/
│       │   │       └── page.tsx    # Tier 2 — Full telemetry, notes, export
│       │   ├── reports/
│       │   └── notifications/
│       ├── driver/
│       │   ├── page.tsx
│       │   ├── reports/
│       │   ├── sessions/
│       │   └── notifications/
│       ├── mechanic/
│       │   ├── page.tsx
│       │   ├── vehicles/
│       │   ├── maintenance/
│       │   └── notifications/
│       └── strategy-engineer/      # Stub (future)
├── features/                       # Feature-scoped API hooks + Zod schemas
│   ├── auth/                       # Login hook, auth API, UserMeResponse
│   ├── admin/                      # Admin API hooks (React Query)
│   ├── mechanic/
│   └── team-manager/
├── components/                     # Shared UI components
│   ├── admin/                      # Sidebar, tables, modals
│   ├── race-engineer/              # LapNotesPanel, SavedComparisonsManager,
│   │                               # RaceEngineerSidebar, FastF1LoadingSkeleton
│   ├── team-manager/               # TeamManagerSidebar
│   ├── driver/                     # DriverSidebar
│   ├── mechanic/                   # MechanicSidebar
│   ├── notifications/              # SharedNotificationsPage (reused across roles)
│   ├── forms/
│   └── DashboardStub.tsx
├── lib/
│   └── axios.ts                    # Axios instance (baseURL, credentials, CSRF interceptor)
├── middleware.ts                   # Edge middleware — route protection
└── next.config.ts                  # API proxy: /api/* → localhost:8000
```

### Design System

- **Brand color:** Electric Cyan `#06B6D4` (primary accent)
- **Background palette:** Dark slate (`#020617`, `#0f172a`, `#1e293b`)
- **Telemetry colors:** Verstappen always cyan-blue (`#06B6D4`); comparison driver amber (`#F59E0B`) to avoid clash
- **Layout pattern:** Sidebar + content area per module dashboard

---

## 9. Modules

### Administrator Module

The central admin control plane. Accessible only to users with the `Administrator` role.

**Features:**
- **User Management:** Full CRUD, bulk enable/disable, login history per user
- **Role & Permission Management:** Create/edit roles, assign granular permissions, duplicate roles as templates
- **Team Management:** Create teams, add/remove members
- **Race & Circuit Management:** Manage the race calendar
- **Audit Logs:** Immutable log of all platform write actions — searchable, exportable as CSV
- **System Health:** Live DB connectivity, migration version, in-memory cache stats
- **System Settings:** Configurable platform settings stored in DB
- **Retention Policy:** Configurable audit log retention + on-demand pruning

---

### Team Manager Module

All data is scoped server-side to the team the Team Manager belongs to (`current_user.team_id`).

**Features:**
- **Dashboard:** Active driver count, vehicle health summary, recent activity feed
- **Roster:** Driver-vehicle assignment management. Creates/ends pairings. Shows full historical pairing records per driver. Blocks assignment to vehicles in Critical health. Includes per-driver contract/tenure management ("On team since [date]") and a "Set tenure dates" bulk-backfill view for single-pass tenure editing.
- **Team Reports:** Generate/view engineering reports for the team's drivers
- **Race Calendar:** Full F1 season calendar with team driver results per race (powered by FastF1)
- **Season Comparison:** Side-by-side chart of points progression across two seasons
- **Driver Directory:** All drivers on the team with their FastF1 codes and tenure

---

### Race Engineer Module

Provides deep F1 telemetry analysis tools backed by FastF1.

**Tier 1 — Session Overview:**
- Select season, circuit, session type, and driver
- Bar chart of lap times across the full session, color-coded by tire compound
- Track status annotations (SC, VSC, Red Flag, Deleted lap)
- Personal best lap markers + session classification table

**Tier 2 — Full Telemetry Analysis (Lap Detail):**
- Live animated track map with sector-colored position trace and moving driver badge
- Multi-channel synchronized telemetry stack: Speed, Throttle/Brake, Time Delta
- Playback controls (Play/Pause, scrub bar, speed selector 0.5×–5×)
- Comparison mode — dual-driver overlay with time delta chart
- Smart color: Verstappen always `#06B6D4`; secondary driver uses `#F59E0B` if colors clash

**Lap Notes:**
- Annotate specific session/driver/lap combinations
- Visible to all race engineers on the team
- Only the author or Admin can delete
- Included in PDF exports
- Audit logged on create/delete

**PDF/PNG Export:**
- Server-side rendering via ReportLab (PDF) + Matplotlib (dark charts)
- Exports: session header, Speed/RPM/Throttle/Brake/Gear charts, track map, lap notes
- Audit logged as `lap_export_generated`

**Saved Comparisons:**
- Save dual-driver comparison configs to the database
- Reopen via "Open & Refetch" — repopulates all UI params and re-fetches telemetry
- URL query params enable deep-linking (`?sec_driver=PER&sec_lap=5&comparison=true`)

---

### Driver Module

All data scoped to the logged-in driver. No cross-driver data leakage.

**Features:**
- Season points total, championship position, last race result
- Own lap session history with season filter
- Engineering reports addressed to this driver
- In-app notifications with read-state tracking

---

### Mechanic Module

**Features:**
- Vehicle health summary dashboard (Healthy / Needs Attention / Critical)
- Per-vehicle component breakdown with health statuses
- Maintenance scheduling and full history log

**Vehicle Health Logic:**
- `Critical` → any component is Critical
- `Needs Attention` → any component is Needs Attention (but none Critical)
- `Healthy` → all components OK

**Cross-module integration:**
- Critical vehicle health triggers an automatic notification to the Team Manager
- Team Manager's assign-driver endpoint blocks assignment to Critical vehicles

---

### Strategy Engineer Module

Dashboard stub — backend exposes the shared analysis service layer from the Race Engineer module for future use.

---

## 10. Shared Services

### Audit Logging (`services/audit.py`)

Every write action across all modules calls `log_audit_event()`:

```python
await log_audit_event(
    db,
    user_id=current_user.user_id,
    action="lap_note_created",
    entity_type="LapNote",
    entity_id=note.id,
    details={"session_id": session_id, "driver": driver, "lap": lap},
    request=request,   # captures IP address automatically
)
```

Fields: `user_id`, `action`, `entity_type`, `entity_id`, `details` (JSON), `ip_address`, `created_at`.

### FastF1 Cache (`services/cache.py`)

Thread-safe in-memory TTL cache layered on top of FastF1's own disk cache:

| Data Type | TTL |
|-----------|-----|
| Event schedule / circuit list | 6 hours |
| Completed race results | 4 hours |
| Current-season overview | 15 minutes |
| Historical lap telemetry | 24 hours |
| Calendar events | 30 minutes |

Cache keys: `"{season}:{circuit_slug}:{session_type}:{data_type}:{args}"`

### FastF1 Telemetry Provider (`services/telemetry_provider.py`)

Wraps all FastF1 interactions. All session loads run in `asyncio.to_thread` (FastF1 is CPU-bound):
- `get_lap_telemetry()` — full resolution position + telemetry channels for a specific lap
- `get_session_overview()` — lap summaries, sector times, tire compounds, track status flags
- `get_comparison()` — dual-driver delta time comparison via `fastf1.utils.delta_time()`
- `get_event_schedule()` — season race calendar
- `get_season_calendar_events()` — calendar with driver result matching

### In-Memory RBAC Cache (`core/rbac.py`)

- Singleton `RBACCacheEngine` initialized at startup from the database
- Holds `role_id → Set[permission_key]` in memory
- `require_permission("key")` is a FastAPI dependency factory used per-route
- Auto-invalidates and reloads when Admin updates permissions

---

## 11. Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (database named `RIDSS`)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET and DATABASE_URL

# Run database migrations
python -m alembic upgrade head

# (Optional) Pre-warm FastF1 disk cache
python scripts/prewarm_cache.py

# Start dev server
uvicorn app.main:app --reload --port 8000
```

- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend at `http://localhost:3000`. `next.config.ts` proxies `/api/*` to `localhost:8000`.

### Initial Data Seeding

```bash
# Required: seed driver roster with FastF1 codes
python scripts/seed_redbull_drivers.py

# Optional: seed vehicle components for Mechanic module
python scripts/seed_mechanic_components.py
```

---

## 12. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required)* | Secret for JWT signing — min 32 characters |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | JWT and cookie lifetime |
| `COOKIE_DOMAIN` | *(empty)* | Production domain. Leave empty for localhost |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `DATABASE_URL` | `sqlite+aiosqlite:///./ridss.db` | SQLAlchemy async connection string |

**Production example:**
```
JWT_SECRET=your-super-secret-32-char-key-here
DATABASE_URL=postgresql+asyncpg://ridss_user:password@db-host:5432/RIDSS
CORS_ORIGINS=https://your-domain.com
COOKIE_DOMAIN=your-domain.com
```

---

## 13. Database Migrations

```bash
# Apply all pending migrations
python -m alembic upgrade head

# Check current version
python -m alembic current

# Create new migration
python -m alembic revision --autogenerate -m "description_of_change"

# Rollback one migration
python -m alembic downgrade -1
```

### Migration History

| ID | Description |
|----|-------------|
| `0001` | Initial schema: 15 core tables + RBAC seed data |
| `0002` | Team Manager tables + RBAC permissions |
| `0003` | Race Engineer circuit + driver FastF1 fields |
| `0004` | Remove deprecated `circuit.track_geometry` column |
| `0005` | Add `driver.is_active` flag |
| `0006` | Driver module tables + notification reference fields |
| `0007` | Deduplicate vehicles + chassis unique constraint |
| `0008` | System health + login history tables |
| `0009` | `driver.team_since` field (tenure tracking) |
| `0010` | `lap_notes` + `saved_comparisons` tables |
| `0011` | Move `team_since` column from `drivers` to `users` table with data migration |

---

## 14. Utility Scripts

Located in `backend/scripts/`:

| Script | Purpose |
|--------|---------|
| `prewarm_cache.py` | Pre-fetches current season FastF1 data into disk cache |
| `prune_retention.py` | Manually trigger audit log pruning |
| `seed_redbull_drivers.py` | Seeds driver roster with FastF1 driver numbers and codes |
| `seed_mechanic_components.py` | Seeds vehicle components for Mechanic module testing |
| `test_race_engineer_new_features.py` | Verifies Lap Notes, SavedComparisons, and PDF export |
| `test_team_manager_features.py` | Verifies Team Manager season comparison features |
| `test_sprint_points.py` | Verifies Sprint race points handling in FastF1 data |

---

*Last updated: September 2026 · Version: 1.0.0*
