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
| 02 | Users | ✓ done (admin-provisioned accounts + role assignment; see notes below) |
| 03 | Employees | ✓ done (onboarding, profile, encrypted bank detail, onboarding steps; see notes below) |
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
`SecurityModule` (scrypt password hashing + AES-256-GCM encryption, global —
no native module, since this sandbox has no Homebrew/build tools),
`AuditModule` (global), `SequenceModule` (atomic code-generation counters,
global), `JwtAuthGuard` + `PermissionsGuard` (registered globally in
`AppModule`), `@Public()` / `@RequirePermissions()` / `@CurrentUser()`
decorators. A `prisma/seed.ts` script (`npm run prisma:seed`) bootstraps
roles, permissions, sequence counters, and an admin account — extend it
alongside each module that adds lookup data, not all at once.

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
**Module 02 (Users) notes:**
- Endpoints (all require the `user:manage` permission): `POST /users`
  (creates a `User` + role assignment, returns a generated temporary
  password once — never persisted or logged in plaintext), `GET /users`,
  `GET /users/:id`, `PATCH /users/:id/status` (activate/deactivate — a
  deactivate immediately revokes that user's active sessions, same
  defense-in-depth as logout/password-change in module 01), `PUT
  /users/:id/roles` (replaces the full role set, including down to zero
  roles). `GET /roles` (read-only; role/permission CRUD is deferred to the
  Admin module, 17).
- Not wrapped in a DB transaction (documented tradeoff): a crash between
  creating the `User` row and its `UserRole` rows leaves a user with no
  role, recoverable via `PUT /users/:id/roles`.
- No "must change password on first login" enforcement — would need a new
  `User.mustChangePassword` schema field plus guard-level enforcement,
  which is more than this pass should half-build. Documented gap, not a
  silent one.
- Added a Prisma seed script (`apps/api/prisma/seed.ts`, run via `npm run
  prisma:seed`) — the roles (`employee|manager|hr|admin`), the `user:manage`
  permission (the only one any route enforces so far — new modules add
  their own keys here as they add gated routes), and a bootstrap admin
  account (email/password from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env
  vars or generated and printed once). This is the answer to "how does
  anyone log in on a fresh database" — nothing else creates a `User` row
  from nothing.
- Tests: 12 unit tests (`UsersService` with a mocked Prisma client) + 4 new
  e2e tests, including the one module 01 couldn't write yet: a valid,
  logged-in user with zero roles hitting a `user:manage`-gated route gets a
  403, not a silent pass. Also covers unknown-role-key rejection and
  deactivate-revokes-session. Still nothing run against real MySQL — the
  seed script itself was run once against no database on purpose, far
  enough to confirm it builds a real query and only fails at the network
  connection step (`pool failed to retrieve a connection`), which is as
  much verification as this sandbox allows.

**Module 03 (Employees) notes:**
- Endpoints (all require `employee:manage`, new permission, granted to
  admin+hr in the seed): `POST /employees` (onboards — provisions the
  `User` via `UsersService.create()` internally, then the `Employee` row;
  returns the same one-time `temporaryPassword`), `GET /employees`, `GET
  /employees/:id`, `PATCH /employees/:id`, `PUT /employees/:id/bank-detail`,
  `PUT /employees/:id/emergency-contact`, `GET
  /employees/:id/onboarding-steps`, `PATCH
  /employees/:id/onboarding-steps/:stepId/complete`. Plus simple
  `GET`/`POST /departments` and `/designations`.
- New `EncryptionService` (`src/security/encryption.service.ts`, global,
  alongside `PasswordService`) — AES-256-GCM, random IV per call, stored as
  `v1$<iv>$<authTag>$<ciphertext>` (same versioned-string idea as password
  hashes). Encrypts `EmployeeBankDetail.accountNumberEncrypted` /
  `panNumberEncrypted` on write, decrypts on read for an authorized caller.
  A tampered or wrong-key value throws rather than returning garbage —
  covered by a unit test that flips one ciphertext hex digit and asserts it
  rejects, which is the test that actually proves the auth tag is checked.
  New `ENCRYPTION_KEY` env var (64 hex chars / 32 raw bytes), validated at
  startup like `JWT_ACCESS_SECRET`.
- New `SequenceService` (`src/sequence/`, global) — atomic `employeeCode`
  generation via `SequenceCounter`, replacing the "max + 1" race the design
  doc flags as a legacy anti-pattern. Requires the counter row to already
  exist (seeded), rather than upserting, since an upsert's own create-path
  isn't race-free either. Format `EXP-{YY}-{seq:04d}-OM` reproduces the
  *shape* of the one sample code seen in mock data — **UNKNOWN, not
  confirmed**: whether "OM" means anything specific and whether the
  sequence should reset yearly. Flag this with whoever owns the real
  convention before it's load-bearing.
- The employee directory's `status` field is `ACTIVE`/`INACTIVE` only, as
  designed — the mock UI's third "On Leave" value is a derived fact (an
  approved `LeaveRequest` covering today) that the Leave module (06, not
  built yet) will need to compute. Deliberately not faked as a field in the
  meantime so nothing downstream binds to a shape that later becomes a
  breaking change.
- No self-service scope yet: every route requires `employee:manage`
  (whole-company management), not "read your own record." A future
  `/employees/me` for the employee-facing Profile screen is a distinct,
  unbuilt piece of authorization.
- Onboarding steps live here (not a separate module — none of the 18 named
  modules owns them): seeded from active `OnboardingStepTemplate` rows at
  employee-create time; template CRUD itself is deferred to Admin (17).
- `EmployeesService.create()` is not wrapped in a DB transaction across
  provisioning the `User` and creating the `Employee` (same tradeoff module
  02 already accepted for `User`+`UserRole`).
- `create`/`update` validate `managerId`/`departmentId`/`designationId`
  reference real rows and reject a *direct* self-manager (`managerId ===
  id`) before writing — otherwise an invalid id surfaced as a raw Prisma FK
  error (500) instead of 400. Judgment call, documented rather than silent:
  a longer manager cycle (A → B → A) is not detected. Nothing depends on
  walking the reporting chain yet (`/team/*` is still a frontend stub);
  revisit if a manager-hierarchy feature is ever built on `managerId`.
- `findAll()` uses a narrow `select` (what the directory screen needs), not
  `include` — the first pass returned every field to any `employee:manage`
  holder, effectively a bulk PII export (`personalEmail`, `dateOfBirth`,
  `currentAddress` for the whole company in one call). Full detail stays
  behind `findOne()` for a specific record.
- Tests: 20 new unit tests (`EmployeesService`, `EncryptionService`,
  `SequenceService`, all against mocked/fake Prisma) + 3 new e2e tests —
  including one that PUTs a plaintext bank account number and GETs it back
  decrypted through the real HTTP path (`test/employees.e2e-spec.ts`),
  which is the only test that actually proves encrypt and decrypt agree
  end-to-end rather than just in isolation. Still nothing against real
  MySQL.

## Not started

- ○ Real authentication wired into the frontend (frontend still uses
  `RoleProvider`'s "preview as" switcher, not a real session)
- ○ Deployment / hosting decision
- ○ Workspace integration (whatever external system(s) this needs to talk to
  — not yet scoped)
