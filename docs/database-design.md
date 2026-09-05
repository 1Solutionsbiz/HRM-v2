# HRM V2 — Database Design

`apps/api/prisma/schema.prisma`, designed from four inputs: the legacy audit
(`docs/legacy-*.md`), the approved employee + HR/Admin UX already built
against `apps/web/src/lib/mock/*.ts`, the modular-monolith architecture, and
the project's security rules (no plaintext passwords, no passwords in
sessions/tokens/logs, backend-enforced authorization, an audit trail).

This is not a port of the legacy MySQL schema. Where legacy structure was
kept, it's because the audit found it already reasonably normalized (e.g.
onboarding's step-template + per-employee-step pattern). Where it wasn't, the
specific anti-pattern and its replacement are called out below.

## Scope: what's in, what's deferred

Included: every model needed to back the screens actually built with real
mock data (My Day, Attendance, Attendance History, Leave, Apply Leave,
Expenses, Add Expense, Payslips, Documents, Performance, Announcements,
Requests, Profile, Notifications, Settings; HR/Admin dashboards, Employees,
Onboarding, Resignations, Salary management, Payroll reports, Company
settings, Roles & permissions, System logs), plus the auth domain the user
explicitly specified.

Deliberately excluded, because no approved UX covers them yet (still
`PlaceholderPage` stubs in the frontend nav) and building the data model
first risks guessing at requirements that haven't been validated in the UI:
- Assets (`/assets`) — legacy had `hrm_assets` / `hrm_asset_assignments`.
- Team-specific manager views (`/team/*`) — the underlying data (Employee,
  AttendanceDay, LeaveRequest, ExpenseClaim) already supports team-scoped
  queries; no separate tables are needed for these once built.
- Employee-of-the-month / peer voting (`/recognition`) — legacy's
  `eom`/`eom_votes`/`quiz_winners` gamification system. The lightweight
  `Recognition` model *is* included because the approved Performance screen
  already renders a `recognitions` list — that's a static record, not a
  voting system.
- Help & support / tickets (`/support`) — legacy's `tickets` module.
- Employee education and family-member records (`hrm_employee_education`,
  `hrm_employee_family`) — legitimate legacy data, but no built screen (not
  even the Profile screen's tabs) exposes them. Flagged here as a known gap
  from the audit rather than silently built or silently dropped.
- **"Today's meetings"** (My Day content) — the mock `todaysMeetings` shape
  (`title`, `time`, `withWhom`, `mode: "In-person" | "Video call"`) reads
  like calendar-integration output, not employee-authored data. Modeling a
  native meeting/scheduling table would duplicate whatever calendar tool the
  company already uses (Google Calendar/Outlook) rather than integrating
  with it. Deferred until it's confirmed whether V2 owns meeting data or
  reads it from an external calendar. By contrast, **"Today's tasks"** *is*
  modeled (`Task`, below) — the built UI gives each task a `done` checkbox,
  i.e. per-employee actionable state that a calendar can't supply, and My
  Day's own spec named it explicitly.
- Company policy documents (`company_policies`) — no built screen renders
  these.
- Offboarding step checklists for resignation (legacy had
  `notice_period_steps` mirroring onboarding) — Resignations screen only
  does approve/decline, no step checklist UI exists yet.
- Advance salary / salary deductions (`hrm_advance_salary`,
  `hrm_deduction_history`) — no built screen surfaces this.

Any of these can be added later without disrupting what's here — none of the
excluded areas are load-bearing for the models below.

## The explicitly instructed structure

**Attendance**: `Employee → AttendanceDay → AttendanceEvent`. `AttendanceDay`
is a materialized one-row-per-employee-per-date summary; `AttendanceEvent` is
an append-only log of raw punches (`CHECK_IN`/`CHECK_OUT`/`BREAK_START`/
`BREAK_END`/`CORRECTION`). A mistaken check-in is fixed by inserting a
`CORRECTION` event, never by editing history. This replaces three separate
legacy structures at once: the 72-column `date1..date31` wide table
(`hrm_attandance_machine_detail`), the live clock table
(`newuser_attendance`), and the separate manual-correction log
(`hrm_attandance_machine_update_detail`).

**Holidays**: a dedicated `Holiday` model (name, date, isActive) backs
`AttendanceDayStatus.HOLIDAY` — without it, nothing in the schema could
answer "is this date a holiday," since `AttendancePolicy.workingWeekdays`
only covers recurring weekends. Replaces legacy's `hrm_holidays`
(year/name/date/no_of_days/added_by), minus `added_by` (covered by
`AuditLog` instead of a column on every domain table).

**Sequential codes**: `Employee.employeeCode`, `LeaveRequest.code`,
`ExpenseClaim.code`, and `Payslip.payslipNumber` are all unique, non-null,
application-generated strings with no schema-level default — a plain
"max + 1" would race under concurrency. `SequenceCounter` (key → value) is a
single generic atomic-increment table the application uses for all of them,
replacing legacy's two separate purpose-built counter tables
(`hrm_employee_sequence`, `invoice_numbers`) with one mechanism.

**Leave**: `Employee → LeaveRequest` directly, plus a `LeaveBalance` ledger
that legacy never had (it computed remaining balance ad hoc from
`hrm_leave_type.number_of_leave` minus a sum over `hrm_leave_applied`, in
application code, unauditable).

**Auth, fully separated from the HR/Employee domain**: `User`, `Role`,
`Permission`, `RolePermission` (role↔permission, many-to-many),
`UserRole` (user↔role, many-to-many — a person can hold more than one role
at once, unlike the mock UI's single "preview as" role switcher),
`Session`, `Device`. `Employee.userId` is a required 1:1 link to `User`;
nothing employee/HR-shaped lives on `User`, and nothing authentication-shaped
lives on `Employee`. This directly answers the audit's core finding: legacy
authenticated straight off `hrm_employee` (plaintext `password` column on
the same row as HR profile data), had two competing, largely-unenforced role
systems (`hrm_employee.role` enum vs. the 6-table RBAC schema nobody wired
up), and had no session table at all (`$_SESSION["token"] = rand()`, no
device tracking beyond a pure-analytics fingerprint table).

## Security decisions encoded directly in the schema

- `User.passwordHash` — never a plaintext column; nothing named `password`
  exists anywhere in the schema.
- `Session.refreshTokenHash` — the same rule extended to bearer tokens: the
  raw token is never persisted, only its hash.
- `User.failedLoginCount` / `lockedUntil` — legacy had no lockout or rate
  limiting on login at all; this makes it representable.
- `AuditLog` is a standalone table, not FK-linked to `User` — an audit row
  (including a failed login against an email with no account) must outlive
  and stay independent of the identity record's lifecycle. `actorEmail` is a
  point-in-time snapshot for the same reason.
- `EmployeeBankDetail.accountNumberEncrypted` / `panNumberEncrypted` — named
  to signal that the application layer must encrypt before write and decrypt
  only on authorized read; these fields must never appear in logs.
- All primary keys are opaque (`cuid()`), not auto-increment integers —
  avoids leaking sequential counts (e.g. total employee/session counts) or
  making IDs guessable.
- `SalaryRevision` is an append-only compensation-change trail, added beyond
  what any built screen currently renders, because the security requirements
  input (not the UX input) calls for traceability of pay changes.
- Money fields are `Decimal`, never `Float` or `String` — legacy stored
  `hrm_employee.salary` as `varchar` and `salary_managment.salary` as
  `float`, both flagged in the audit as correctness risks.

## Deliberate corrections over the mock data's own shortcuts

The mock fixtures were built for UI demonstration and take shortcuts a real
schema shouldn't repeat:

- `DirectoryEmployee.status` includes `"On Leave"` as a static value. The
  schema's `Employee.status` enum is only `ACTIVE`/`INACTIVE` — "on leave
  today" is a derived fact (an approved `LeaveRequest` covering today), not a
  column that would otherwise go stale the moment the leave ends. The same
  reasoning applies to a future "on notice period" derivation from
  `Resignation`.
- `currentEmployee.manager` / `DirectoryEmployee.manager` are display-name
  strings. The schema uses a proper `Employee.managerId` self-relation.
- Legacy's `announcement.status`-style single read flag is wrong because
  "read" is a fact about a reader, not the announcement. `AnnouncementRead`
  makes per-viewer read state explicit instead.
- Human-facing codes (`LV-1042`, `EX-3311`) are kept as a separate unique
  `code` field, not as the primary key — the PK stays an opaque `cuid()`,
  and code generation is an application-layer concern.

## Documented UNKNOWNs (carried from the audit, not silently resolved)

- **Multi-tenancy**: the legacy audit flagged three separate, inconsistently
  wired "company" tables (`companies`, `hrm_company`, `companiesexpense`) as
  evidence of an abandoned or unconfirmed multi-tenancy effort. This schema
  is single-tenant by deliberate decision (`CompanySettings` is a singleton
  row) — no `companyId` column exists anywhere. If multi-tenancy is ever
  confirmed as a real requirement, every domain table would need a
  `companyId`, which is a materially bigger migration the longer it's
  deferred — worth a conscious decision, not a default.
- **Exact attendance fine/grace formula**: legacy's `office_timing` table had
  `normal_fine`, `extra_fine_time`, `extra_fine`, `monthly_shorts`,
  `monthly_half` columns whose exact interaction wasn't fully reconstructable
  from static code alone. `AttendancePolicy` models the values that were
  clear (grace minutes, half-day threshold, full-day hours, standard
  start/end) and omits a fine-calculation model until that formula is
  confirmed with HR — encoding a guessed formula would silently create a
  business rule that doesn't match legacy behavior.
- **Employee education/family records**: legitimate legacy data with no
  corresponding approved UX yet (see Scope section above).
- **Payslip compliance numbering**: `payslipNumber` is included (legacy's
  `invoice_numbers` table implies payslips need a stable sequential number
  for financial record-keeping), but the exact required format
  (financial-year reset? prefix convention?) hasn't been confirmed with
  finance/HR — `SequenceCounter` supports either without a schema change.

## Verification performed

- `npx prisma validate --config prisma7.config.ts` — passes.
- `npx prisma generate --config prisma7.config.ts` — generates the client
  with no errors or relation ambiguity warnings.
- `npx prisma migrate diff --config prisma7.config.ts --from-empty
  --to-schema prisma/schema.prisma --script` — generates the full MySQL DDL
  (41 `CREATE TABLE` statements) offline, with no Docker/live database
  needed. Spot-checked the highest-risk renderings by hand: the singleton
  tables' `VARCHAR(191) NOT NULL DEFAULT 'singleton'` primary keys,
  `TIME(0)` columns, the `JSON` column, and `DECIMAL(p,s)` precision/defaults
  all rendered correctly. This exercises MySQL-specific DDL generation that
  `validate`/`generate` alone do not.
- **Not yet verified**: applying that DDL against a live MySQL instance
  (`docker-compose.yml`, port 3307) via `prisma migrate dev`. Docker was not
  available in this session's shell. The generated DDL is syntactically
  sound MySQL, but has not been executed.

## Recommended next step

1. Run `docker compose up -d` and `npm run prisma:migrate` (in `apps/api`)
   against the real local MySQL container to apply the DDL for real (this
   session generated it offline but couldn't execute it — no Docker
   access).
2. ~~Write a seed script~~ — done: `apps/api/prisma/seed.ts` (roles,
   the `user:manage` permission, a bootstrap admin account). Still needs
   extending as later modules add lookup data: `Department`/`Designation`
   from `employeeDirectory`, `LeaveType` from `leaveTypes`,
   `ExpenseCategory` from `expenseCategories`, `DocumentType` from the
   `documents` fixture's categories, a default `AttendancePolicy` row from
   `officeTiming`, a `CompanySettings` row from `companyProfile`, and
   `SequenceCounter` rows for each code type — add these alongside the
   module that owns each table, not all at once.
3. Confirm the three open UNKNOWNs above with the business owner before they
   become load-bearing (multi-tenancy, attendance fine formula, payslip
   numbering format).
