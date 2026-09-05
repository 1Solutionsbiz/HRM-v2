# HRM V2 — Project Status

Keep this file current at the end of every work session. It exists so any
session (or person) can tell at a glance what exists, what's mid-flight, and
what hasn't been started — without re-deriving it from git history.

**Current phase:** Backend (`apps/api`), module-by-module build-out.

**Deployment constraint to not miss:** the API host's system timezone must
match `CompanySettings.timezone` (default Asia/Kolkata). Attendance derives
"today" and late/on-time classification from the process's local clock —
see module 05's notes below for the specific failure mode on a mismatched
host.

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
| 04 | Notifications | ✓ done (self-service list/read; see notes below) |
| 05 | Attendance | ✓ done (event-sourced check-in/out, policy-driven late/half-day, history synthesis; see notes below) |
| 06 | Leave | ✓ done (apply/approve, balance ledger, Attendance integration; see notes below) |
| 07 | Requests | ✓ done (read-only aggregator over Leave; extend for Expenses at 09; see notes below) |
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

**Module 04 (Notifications) notes:**
- Endpoints: `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH
  /notifications/read-all` — all scoped to the caller (`authContext.userId`),
  no `:userId` param, no `@RequirePermissions()`. This is the first
  self-service module (act on your own data) as opposed to 02/03's
  admin-management pattern (act on anyone's, behind a permission) — worth
  knowing before building 06/07/08/09, which are the same shape (a person's
  own leave/requests/documents/expenses).
- `create()` has no controller route — it's exported for other modules
  (Leave, Expenses, ...) to call directly when something happens a user
  should be notified about. Nothing calls it yet.
- Marking someone else's notification returns 404, not 403 — matches the
  same "don't confirm another record's existence" reasoning used in Auth's
  login error messages.
- 8 new unit tests + 3 new e2e tests, including cross-user isolation (listing
  only returns your own; marking another user's notification 404s; marking
  "all" read never touches another user's rows).

**Module 05 (Attendance) notes — the most architecturally significant
module so far, alongside 15 (Payroll) still to come:**
- Endpoints: self-service `POST /attendance/check-in`, `POST
  /attendance/check-out`, `GET /attendance/today`, `GET /attendance/history`
  (`from`/`to` query params, capped at 90 days), `GET /attendance/policy`
  (read-only). Admin-only `POST /attendance/employees/:employeeId/corrections`
  behind a new `attendance:manage` permission (granted to admin+hr in the
  seed).
- **Event-sourced as instructed**: `AttendanceEvent` rows are the source of
  truth; `AttendanceDay` is a materialized summary recomputed after every
  write (`recomputeDay()`), never edited directly. A manual correction is a
  *new* `CHECK_IN`/`CHECK_OUT`/etc. event with `source: MANUAL_CORRECTION`,
  not a separate always-non-computational path — `AttendanceEventType.CORRECTION`
  itself stays unwired to any endpoint this pass; force-fitting an
  interpretation for it was judged worse than leaving it a documented gap.
- **Which event "wins" per type is resolved by insertion order, not
  `occurredAt`**: `recomputeDay()` takes the *most recently created*
  `CHECK_IN`/`CHECK_OUT` event (ordered by `id`, since `AttendanceEvent` has
  no separate `createdAt`), not the earliest/latest by clock time. This was
  a deliberate choice over the more obvious `min(CHECK_IN)`/`max(CHECK_OUT)`
  rule: min/max only lets a correction move check-in earlier or check-out
  later — the opposite direction would silently do nothing. "Most recent
  insertion wins" corrects in both directions.
- **`punchState` (`NOT_CHECKED_IN`/`CHECKED_IN`/`CHECKED_OUT`) is distinct
  from `AttendanceDay.status`** (`PRESENT`/`LATE`/.../`WEEKEND`) — the mock
  UI's `TodayAttendance.status` conflates "have you punched today" with "how
  is today classified," which are different questions once policy-driven
  classification exists. `punchState` is derived on read, never stored.
- **History read-path synthesizes gap days**: `AttendanceDay` rows are only
  ever created reactively (on a day's first event), so a weekend/holiday/
  absence with zero events has no row at all. `getHistoryForUser()` fills
  every requested date with a real row if one exists, else derives
  `WEEKEND` (from `AttendancePolicy.workingWeekdays`), `HOLIDAY` (from the
  `Holiday` table), or `ABSENT` (a past working day with nothing recorded) —
  today/future gaps are omitted rather than marked absent. This is the
  reason the `Holiday` model exists at all (see `docs/database-design.md`).
- **Real, load-bearing deployment constraint, not just a comment**: "today"
  and late/on-time classification are derived from the API process's own
  local clock, assuming the host's system timezone matches
  `CompanySettings.timezone` (default Asia/Kolkata). **Whoever deploys this
  must set the host/container timezone accordingly** — on a UTC host, a
  punch made between roughly 00:00–05:30 IST would silently attach to the
  wrong `AttendanceDay` (`@@unique([employeeId, date])` merges rather than
  errors). No per-user timezone support exists or is planned yet.
- `AttendancePolicy` has no schema defaults for `standardStartTime`/
  `standardEndTime`/`workingWeekdays` — `getPolicyOrThrow()` fails loudly
  (`InternalServerErrorException`) rather than guessing if unseeded (rule
  13: no legacy policy to invent from). The seed script now creates the
  singleton row from the mock's `officeTiming` (09:30–18:30, 15min grace, 9h
  full day, 4.5h half-day threshold, Mon–Fri).
- Break (`BREAK_START`/`BREAK_END`) minutes are correctly subtracted from
  `workedMinutes` when those events exist, but no endpoint creates them —
  no built UI calls for it yet; the computation is there for when one does.
- 19 new unit tests + 7 new e2e tests (using `vi.useFakeTimers()` to control
  "today" and grace-window boundaries precisely) — including the
  double-check-in conflict, a late check-in producing nonzero
  `lateMinutes`, weekend/holiday/absent synthesis, and a correction
  overriding the original regardless of clock-time ordering. Still nothing
  against real MySQL.

**Module 06 (Leave) notes:**
- Self-service: `GET /leave/types`, `GET /leave/balances`, `GET
  /leave/requests`, `POST /leave/requests` (apply), `PATCH
  /leave/requests/:id/cancel` (PENDING-only, own requests only). HR/manager:
  `GET /leave/requests/company`, `PATCH /leave/requests/:id/decide`
  (approve/reject) — both behind a new `leave:approve` permission (granted
  to admin/hr/manager in the seed — manager approval is **not** scoped to
  "my direct reports," since no reporting-hierarchy enforcement exists yet;
  documented gap, same shape as Employees' `managerId` limitation).
- **Balances are synthesized on read, same pattern as Attendance's history
  gaps**: no `LeaveBalance` row exists until a request is first approved, so
  `GET /leave/balances` fills in `LeaveType.defaultAnnualDays` as the
  allocation when no row exists — never persisted by the GET itself.
- **Submission-time balance check is computed live**, not from the
  persisted `usedDays` counter: available = allocation minus every
  PENDING+APPROVED request's days, summed fresh from `LeaveRequest` rows.
  This is deliberate — it catches double-booking across several pending
  requests without needing to reserve/release a counter. `usedDays` itself
  only updates on approval (see below), so it reflects approved
  consumption, matching how the mock's balance widget reads ("used" = taken,
  not "requested").
- **New validations with no legacy rule behind them** (rule 13 doesn't
  apply — legacy had no overlap check and computed remaining balance ad
  hoc): overlapping PENDING/APPROVED requests are rejected, and a request
  exceeding the available balance is rejected at submission, not left for
  the approver to catch.
- **Cross-module integration with Attendance (05)**: approving a leave
  request sets `AttendanceDay.status = ON_LEAVE` and `leaveRequestId` for
  every day it covers (creating the row if none exists yet) — this is the
  one place outside Attendance's own event-sourced path that writes an
  `AttendanceDay` directly, legitimate because a leave decision isn't
  derived from punches. `AttendanceService.recomputeDay()` already treated
  `leaveRequestId` as authoritative (built in module 05, unused until now).
  Simplification: a half-day leave still marks the *whole* day `ON_LEAVE`,
  even if the employee also punched in for the working half — not modeled.
- Extracted `src/common/date-only.ts` (`toDateOnly`/`parseDateOnly`/
  `addDays`/`formatDateOnly`) out of `AttendanceService` — Leave needed the
  identical date-only semantics (and the identical local-vs-UTC pitfalls),
  so module 05's helpers are now shared rather than duplicated.
- Fixed on the way: `LeaveRequest.totalDays` is a Prisma `Decimal`, and
  decimal.js's own `toJSON()` serializes as a **string** ("1", not 1) —
  caught by an e2e assertion expecting a number. Every endpoint returning a
  `LeaveRequest` now explicitly converts `totalDays` to a plain number
  before responding, matching `getBalancesForUser()`'s fields instead of
  silently disagreeing with them on type.
- 16 new unit tests + 4 new e2e tests, including the full approve flow
  (balance updates, AttendanceDay gets marked ON_LEAVE) and a rejected
  self-cancel of an already-approved request. Still nothing against real
  MySQL.

**Module 07 (Requests) notes:**
- `GET /requests/mine` only — a read-only aggregator, not its own domain
  (no `Request` table exists; matches the mock's `getMyRequests()`, which
  merges `leaveRequestStore` + `expenseStore` client-side). Self-service,
  no permission required beyond being authenticated.
- Only Leave is wired in today (Expenses doesn't exist until module 09).
  `RequestsService` injects `LeaveService` and maps its rows to the unified
  `{ id, kind, title, detail, status, submittedOn }` shape; when Expenses
  lands, add it the same way (inject `ExpensesModule`, map, merge, re-sort)
  rather than redesigning this module.
- Also fixed while extending the fake test double for this: `FakeEmployee`
  test fixtures across three e2e spec files (attendance, leave, requests)
  had been silently missing a required `dateOfBirth` field — invisible
  because `vitest` doesn't type-check spec files. `npx tsc --noEmit -p
  tsconfig.json` is the way to actually catch this (`npm run build`
  excludes `test/` entirely); ran it and fixed the one real gap it found
  (a pre-existing, unrelated `supertest/types` import error from the
  original scaffold is left alone).
- 2 new unit tests + 2 new e2e tests. Still nothing against real MySQL.

## Not started

- ○ Real authentication wired into the frontend (frontend still uses
  `RoleProvider`'s "preview as" switcher, not a real session)
- ○ Deployment / hosting decision
- ○ Workspace integration (whatever external system(s) this needs to talk to
  — not yet scoped)
