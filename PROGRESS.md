# RIDSS Development Progress

Last updated: 2026-08-16

## Database
- [x] PostgreSQL connection configured
- [x] Alembic initialized
- [x] All tables migrated
- [x] Roles, Permissions, RolePermission seeded

## Administrator Module
- [x] Dashboard API
- [x] User Management (CRUD)
- [x] Team Management
- [x] Roles & Permissions (DB-driven, with cache invalidation)
- [x] Race & Circuit Management
- [x] Notifications
- [x] Audit Logs (with auto-logging, incl. permission-change logging)
- [x] System Settings

## Administrator Module — System Health & Login History
- [x] LoginHistory table + migration
- [x] Login handler writes LoginHistory record on every successful login
- [x] CacheStatus table + pre-warm script updated to record last run
- [x] GET /api/v1/admin/system-health API (DB, cache, migrations, overall status)
- [x] System health page (color-coded status cards)
- [x] GET /api/v1/admin/users/{id}/login-history API
- [x] Login history added to existing user detail view
- [x] Verified Administrator-only access on both features


## Team Manager Module
- [x] Report table extended (data, team_id columns)
- [x] DriverVehicleAssignment table + constraints (one active pairing per driver/vehicle)
- [x] Dashboard API + page
- [x] Roster (driver-vehicle pairing) API + page
- [x] Team report generation + list + page (explicitly team-filtered)
- [x] Team-scoping enforced server-side on all endpoints
- [x] Audit logging: assign/unassign/report actions write to shared AuditLog table
- [x] Audit logging verified visible in Admin's Audit Logs screen (cross-role check)
- [x] Dashboard "recent activity" reads from shared AuditLog table (not a separate feed)
- [x] Driver notifications sent on assignment/unassignment
## Team Manager Module — Race Calendar
- [x] Shared FastF1 service function(s) for event schedule + filtered results reused/added
- [x] GET /api/v1/team-manager/calendar API (dynamic season, no hardcoded year)
- [x] Nationality flag mapping utility (static, frontend)
- [x] Calendar page: completed vs upcoming status, own-team driver results shown
- [x] Verified against a real completed race and a real upcoming race


## Notes / Decisions
- Database connection set up for PostgreSQL database `RIDSS` via `postgresql+asyncpg` for FastAPI async engine and `psycopg2-binary` for Alembic migrations.
- Primary keys standardized to UUID across all 15 core domain models (`roles`, `users`, `teams`, `drivers`, `vehicles`, `races`, `circuits`, `components`, `maintenances`, `notifications`, `reports`, `audit_logs`, `system_settings`, `permissions`, `role_permissions`) plus `driver_vehicle_assignments`.
- In-memory thread-safe `RBACCacheEngine` loaded on startup and invalidated synchronously inside `update_permissions()` transaction.
- Server-side permission check enforced via `require_permission(perm_key)` FastAPI dependency.
- Auto-audit logging service hook integrated across all administrative and team management write actions with detailed JSON diffs for security-sensitive permission mutations.
- Team Manager driver-vehicle pairings enforced in a single transaction with partial unique database indexes (`uq_active_driver_assignment`, `uq_active_vehicle_assignment`) preserving pairing history by deactivating previous pairings.
- Driver assignment mutations trigger direct user notifications in the shared `Notification` table.

## Race Engineer Module
- [x] Driver table extended (fastf1_driver_number, fastf1_code)
- [x] FastF1TelemetryProvider implemented + cache enabled + pre-warm script
- [x] Own-team-driver filtering enforced server-side
- [x] Tier 1 overview API + page (static, click-to-drill)
- [x] Tier 2 lap telemetry API + page (track map, synced charts, full playback)
- [x] Comparison mode (drivers or cross-season)
- [x] Engineering report generation (analysis summary, not raw arrays)
- [x] Audit logging verified visible in Admin's Audit Logs
- [x] Driver notification on report generation
- [x] Processed-analysis service layer exposed for Strategy Engineer
- [x] Circuit.track_geometry column and bacinger seed script removed
- [x] Track map rebuilt from get_circuit_info() + reference-lap outline (no DRS/speed-trap markers)
- [x] Tier 1 enriched: session.results header, sector times, Deleted/IsAccurate flags
- [x] Comparison mode uses fastf1.utils.delta_time() + fastf1.plotting colors

## Driver Module
- [x] Dashboard API + page (season points, last result, recent notifications/reports)
- [x] Reports API + page (own reports only, detail view)
- [x] Session history API + page (season filter, reuses shared season-aware filtering)
- [x] Notifications API + page (own notifications, read-state tracking, deep-link to referenced content)
- [x] Notification-creation code in Race Engineer/Team Manager updated to store a reference (report_id/context) for deep-linking
- [x] Own-driver filtering verified server-side on every endpoint — no cross-driver data leakage
- [x] Design tokens consistent with Team Manager/Race Engineer

## Mechanic Module
- [x] get_vehicle_health() service function (computed roll-up from components)
- [x] Team Manager's assign_driver_to_vehicle() updated to block Critical vehicles, warn on Needs Attention
- [x] Dashboard API + page (health status counts, upcoming maintenance)
- [x] Vehicle list + component detail API + pages
- [x] Maintenance scheduling + status update + history API + pages
- [x] Audit logging verified for all write actions
- [x] Notification to Team Manager on vehicle reaching Critical health
- [x] Design tokens consistent with other modules




