# HRM V2 — Project Status

Keep this file current at the end of every work session. It exists so any
session (or person) can tell at a glance what exists, what's mid-flight, and
what hasn't been started — without re-deriving it from git history.

**Current phase:** Backend (`apps/api`), module-by-module build-out.

## Frontend (`apps/web`) — done, mock-data only

- ✓ Design system (shadcn/ui "Nova" preset, Tailwind v4)
- ✓ Navigation shell, topbar (dark/light toggle, live clock, last-login)
- ✓ Login UI (`/login` — posts to `mockLogin`, no real backend yet)
- ✓ Employee Experience UX — 16 screens against `lib/mock/fixtures.ts`
  (My Day, Attendance, Leave, Expenses, Payslips, Documents, Performance,
  Announcements, Requests, Profile, Notifications, Settings)
- ✓ HR/Admin UX against `lib/mock/hr-fixtures.ts` (dashboards, Employees,
  Onboarding, Resignations, Salary, Payroll, Company settings, Roles &
  permissions, System logs)

The frontend still runs entirely on the in-memory mock API — none of it is
wired to `apps/api` yet. Don't start that wiring until a module's real
endpoints exist and this file marks it done.

## Database

- ✓ Prisma schema designed (`apps/api/prisma/schema.prisma`, 41+ models) —
  see `docs/database-design.md` for full rationale.
- ○ Migration not yet applied to a live MySQL instance — no Docker/MySQL
  available in the dev sandbox. DDL generated and spot-checked offline
  (`prisma migrate diff --script`) but never executed. Whoever has Docker
  needs to run `docker compose up -d && npm run prisma:migrate` (see that
  doc's "Recommended next step").
- ○ Seed script (roles/permissions/lookup tables) — not started.

## Backend (`apps/api`) — NestJS modules, built in this order

Per-module tests are unit tests against a mocked Prisma client (plus e2e
where noted) — no live database in this environment, so nothing below has
been run against real MySQL.

| # | Module | Status |
|---|--------|--------|
| 01 | Auth | ✓ done (login/refresh/logout/me/change-password; see notes below) |
| 02 | Users | ○ not started |
| 03 | Employees | ○ not started |
| 04 | Notifications | ○ not started |
| 05 | Attendance | ○ not started |
| 06 | Leave | ○ not started |
| 07 | Requests | ○ not started |
| 08 | Documents | ○ not started |
| 09 | Expenses | ○ not started |
| 10 | Performance | ○ not started |
| 11 | Announcements | ○ not started |
| 12 | Assets | ○ not started |
| 13 | Complaints | ○ not started |
| 14 | Resignation | ○ not started |
| 15 | Payroll | ○ not started |
| 16 | Reports | ○ not started |
| 17 | Admin | ○ not started |
| 18 | Audit | ○ not started (module 18 is a read-facing System Logs API over the `AuditLog` table already being written by every other module — not the write path itself) |

Shared infra built alongside module 01 (used by every module after it, so
listed once here rather than per-module): `PrismaModule` (global, MySQL via
`@prisma/adapter-mariadb` — Prisma 7's client generator requires a driver
adapter now), global `ValidationPipe` + `AllExceptionsFilter`,
`SecurityModule` (scrypt-based password hashing, global — no native module,
since this sandbox has no Homebrew/build tools), `AuditModule` (global),
`JwtAuthGuard` + `PermissionsGuard` (registered globally in `AppModule`),
`@Public()` / `@RequirePermissions()` / `@CurrentUser()` decorators.

**Module 01 (Auth) notes:**
- Endpoints: `POST /auth/login`, `POST /auth/refresh` (rotating), `POST
  /auth/logout`, `GET /auth/me`, `POST /auth/change-password`.
- Access tokens are short-lived JWTs (15 min) carrying only `sub`+`jti` — no
  roles/permissions in the token. `JwtAuthGuard` re-reads the `Session` row
  and the user's current roles/permissions on every request, so a revoked
  session or role change takes effect immediately rather than waiting out
  the token's lifetime. This is the one architectural decision here worth
  knowing before building modules 02+: every protected route pays one
  indexed session lookup, by design.
- Refresh tokens are opaque random values (not JWTs), stored only as a
  sha256 hash, rotated (single-use) on every refresh.
- New security requirements not present in legacy (rule 13 doesn't apply —
  nothing to inspect): 5-attempt/15-minute account lockout, 12-character
  minimum password length, timing-safe-equal unknown-email/wrong-password
  login responses.
- Tests: 18 unit tests (`PasswordService`, `AuthService` with a mocked
  Prisma client) + 7 e2e tests booting the real `AppModule` over HTTP with
  `PrismaService` swapped for an in-memory fake (login, wrong-password vs.
  unknown-email parity, `forbidNonWhitelisted`, revoked-session 401, rotated
  refresh-token reuse 401). None of this has run against real MySQL — no
  Docker/MySQL in this sandbox, same limitation as the schema-design phase.
- Not built yet: there's no way to create a `User` row at all (module 02,
  Users, owns admin-driven provisioning) — so nothing in module 01 has been
  exercised against a real seeded account.

## Not started

- ○ Real authentication wired into the frontend (frontend still uses
  `RoleProvider`'s "preview as" switcher, not a real session)
- ○ Deployment / hosting decision
- ○ Workspace integration (whatever external system(s) this needs to talk to
  — not yet scoped)
