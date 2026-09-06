# HRM V2 — Project Status

Keep this file current at the end of every work session. It exists so any
session (or person) can tell at a glance what exists, what's mid-flight, and
what hasn't been started — without re-deriving it from git history.

**Current phase:** Live in production. Backend and frontend are both deployed
on Hostinger and connected to a real MySQL database; real legacy-HRM data has
been imported; most of the frontend is wired to the real API — see the
"Frontend ↔ API wiring" table below for the current per-screen status.
**Dashboard is now wired** (2026-09-06, see below) — 7 screens remain on
mock data: Performance, Announcements, Notifications, Settings, Onboarding,
Resignations, Payroll reports. See also "Legacy feature-parity audit
(2026-09-06)" for what's still missing relative to the legacy hrmpulse.com
system and what legacy data is genuinely still unmigrated.
**Admin dashboard redesign + My Day partially de-mocked** (2026-09-06, see
"Dashboard redesign" session notes below) — active-employee counting bug
fixed, new blue attendance banner + birthday highlights on Admin dashboard;
My Day's Leave balance and a new attendance calendar are now real, but
My Day's Tasks/Meetings/Performance snapshot/Notifications/Pending-requests
counts are still mock (not part of this pass).

**⚠️ Superseded throughout this file:** every module note below that says
"still nothing against real MySQL" / "no live database in this environment"
was true when written (no Docker/MySQL in the dev sandbox) but is **no
longer true as of 2026-09-05** — see "Deployment" and "Data migration"
below. Those notes are left as-is because they accurately describe how each
module was built and unit/e2e-tested in isolation; just don't read the MySQL
caveat as current status.

**Deployment constraint to not miss:** the API host's system timezone must
match `CompanySettings.timezone` (default Asia/Kolkata). Attendance derives
"today" and late/on-time classification from the process's local clock —
see module 05's notes below for the specific failure mode on a mismatched
host. (Hostinger's `hrm-api` host timezone has not been explicitly verified
against this requirement — check before trusting any Attendance data.)

## Deployment (2026-09-05)

Both apps are live on the user's existing Hostinger "Cloud Professional"
account, as Node.js Web Apps, deployed via a GitHub App connected to
`1Solutionsbiz/HRM-v2` (push to `main` → auto-redeploy):

- **Frontend**: `https://hrm.1solutions.biz` (Next.js, custom `server.js`
  entry point — `next start` doesn't fit Hostinger's "start file" model)
- **API**: `https://hrm-api.1solutions.biz` (NestJS, `dist/main.js`)
- **Database**: real MariaDB on Hostinger (`u447604075_hrmv2`), connected via
  its literal IPv4 address (not hostname — the hostname resolves dual-stack
  and IPv6 isn't in the Remote MySQL allowlist). The app server's own
  outbound IP is allowlisted via "Any Host" on this specific database (not
  the shadow database) — **this must stay enabled for the app to keep
  working**, it's not a one-time migration step.
- Four real deployment bugs found and fixed in the process (all committed):
  build-command scoping (Hostinger's creation-wizard dropdown reads the
  wrong `package.json`; fixed via the site's own "Settings and redeploy"
  page), `NODE_ENV=production` making `npm install` skip devDependencies
  (`@nestjs/cli` needed at build time — removed the env var), the generated
  Prisma Client never being generated on a fresh checkout (added a
  `postinstall` script), and a top-level `await` in `main.ts` breaking under
  Hostinger's CommonJS `require()`-based loader (`bootstrap().catch(...)`
  instead of `await bootstrap()`).
- CORS is a single explicit origin (`WEB_ORIGIN=https://hrm.1solutions.biz`)
  — this means the production API is **not reachable from a local dev
  frontend** (`localhost:3100` gets no CORS headers, `/auth/me` fails
  silently and clears stored tokens). To point local dev at the real API
  for testing, set `NEXT_PUBLIC_API_URL=https://hrm-api.1solutions.biz` in
  `apps/web/.env.local` (gitignored) and restart the dev server — but you
  still can't log in from there due to CORS; that only works for
  already-authenticated-elsewhere testing patterns, not a real login flow.

## Data migration (2026-09-05)

Real data from the legacy PHP HRM (`1Solutionsbiz/HRM`, live at
`hrmpulse.com`) has been imported into the production database, via two
idempotent scripts that parse a phpMyAdmin dump directly rather than
executing it as SQL (`apps/api/prisma/import-legacy-spine.ts`,
`import-legacy-phase2.ts` — safe to re-run against a newer dump; each wipes
only the rows it owns before reimporting).

**Imported and verified** (row counts independently confirmed via raw SQL,
not just script output — a first Phase-1 run silently crashed partway
through at 14/41 employees and was caught this way, not by trusting the
script's own success message):

| What | Count | Source |
|---|---:|---|
| Company profile | 1 | `companies` |
| Departments | 5 | `hrm_department` |
| Designations | 16 | `hrm_designation` (one resolved via actual employee data, not the placeholder `department_name` legacy had for it) |
| Employees | 41 (7 active / 34 ex — corrected 2026-09-06, was 25/16) | `hrm_employee` — passwords rehashed with the real `scrypt` hasher, not migrated in plaintext |
| Manager links | 25 | `hrm_reporting_manager` |
| Holidays | 9/9 | `hrm_holidays` |
| Education records | 27/32 | `hrm_employee_education` (5 skipped: reference legacy employee ids that no longer exist anywhere in `hrm_employee`) |
| Bank details (encrypted) | 25/29 | `hrm_bank_detail` (4 skipped: empty/corrupted rows or `emp_id=0`) |
| Emergency contacts | 20/24 (all contacts, not one-per-employee — see below) | `hrm_employee_family`, **not** `hrm_employee_emergency_contact` (that table is empty/unused in the live legacy app — confirmed by comparing against what the legacy profile page actually renders). 4 skipped: reference legacy employee ids (11, 20) that no longer exist anywhere in `hrm_employee` — same orphaned-FK class as the 5 skipped education records above |
| Employee demographics | 41/41 | `hrm_employee.gender`/`marital_status`/`bgroup`/`religion`/`nationality` — see below |
| Employee photos | 35/41 (6 have none in legacy either) | `hrm_employee.image`, downloaded + resized, self-hosted under `apps/web/public/avatars/` — see below |
| Leave types | 3/3 | `hrm_leave_type` |
| Leave requests | 176/176 | `hrm_leave_applied` |
| Leave balances | 46 (computed) | derived from approved-request history, since legacy never had a balance table |
| Expense categories | 21/21 | `expense_categories` |
| Expense claims | 79/98 | `employee_expenses` (19 skipped: `employee_id = NULL` in legacy itself) |
| Salary structures | 14 | `salary_managment` |
| Salary revisions | 21 | `salary_managment` (full history, not just current) |
| Payslips | 24/24 | `salary_slip_generate` |
| Attendance history | 237 days (14 employees, Dec 2024–Feb 2025) | `newuser_attendance` (238 rows; 1 exact duplicate row collapsed to the same day) |

**Known, permanent structural gaps** (V2 schema can't represent these, not
an import failure):
- Social media links, employee free-text history, internal transfer
  history, sub-departments, POSH complaints, advance salary/deductions,
  IT/HR tickets, EOM/quiz gamification, chat, company policy documents,
  offboarding checklists — none of these have a V2 model. Full inventory and
  legacy row counts for each were audited against the live dump; ask if this
  list is needed again.

**Multiple emergency contacts + employee demographics (2026-09-06)**: two
real gaps found while checking Aditya Srivastava's record against his own
legacy profile page — reported for one employee, true for all 41, fixed for
all 41, not just the one reported.
- `EmployeeEmergencyContact` was `@unique(employeeId)` (1-per-employee) since
  the original schema design; Phase 1's import kept only the "best" contact
  per employee and dropped the rest — previously listed above as a
  permanent structural gap, but it wasn't structural, just an unnecessary
  constraint. Migration `20260906030459_allow_multiple_emergency_contacts`
  drops the unique index (creating a plain one first — MariaDB won't drop a
  unique index that's the only index backing the FK) and the `Employee`
  relation is now `emergencyContacts: EmployeeEmergencyContact[]`. The old
  single `PUT :id/emergency-contact` upsert route (never called by any
  frontend page — dead code) is now `POST .../emergency-contacts`,
  `PATCH .../emergency-contacts/:contactId`, `DELETE .../emergency-contacts/
  :contactId`. `reimport-emergency-contacts.ts` wiped and fully re-imported
  from `hrm_employee_family` (24 rows, all of them — not "best per
  employee"): 20 imported across 19 employees (Aditya now correctly shows
  both Rakhi Srivastava/Mother and Shyam Srivastava/Father), 4 skipped
  (legacy emp_ids 11, 20 — orphaned, same class as the education-records
  skips above). Both frontend read sites (Employee detail page, Profile's
  "Bank & emergency" tab) render the list; no add/edit/delete UI was built
  for the new endpoints — that's a real gap if HR needs to manage these,
  not something this pass claims to have closed.
- `Employee.gender`/`nationality`/`religion`/`maritalStatus`/`bloodGroup`
  have existed in the schema since the 2026-09-05 personal-details
  migration, but no import script ever wrote to them — Phase 1 predates
  that migration, and nothing followed up, so all 41 employees showed "—"
  for all five on every profile/detail page. `backfill-employee-
  demographics.ts` fixed all 41 from `hrm_employee`'s `gender`/
  `marital_status`/`bgroup`/`religion`/`nationality` columns. Code mappings
  verified against hrmpulse.com's own rendered profile pages, not guessed:
  gender 1=Male (Aditya/Shivam/Atul), 2=Female (Ritika/Nikita);
  marital_status 1=Married (Shivam's own profile says "Married"),
  2=Single (Aditya's own profile says "Unmarried" — the legacy label,
  V2's `SINGLE` enum value is the equivalent). Neither `DIVORCED` nor
  `WIDOWED` appears anywhere in this 41-row dataset.

**Legacy `hrm_employee` columns with no V2 home at all** (not imported,
not previously flagged — found while auditing the demographics gap above,
reported here rather than silently imported): `mobile2` (second phone),
`fathers_name`, `permanent_address` (V2 only has `currentAddress`),
`experience`, `other_detail`, `marriage_anniversary`, `house_type`,
`staying_current_residence`, `living_current_city`, `probation_period`,
`probation_status`, `job_title` (distinct from designation), structured
`city_id`/`state_id`/`pincode` (V2's address is one free-text field). `image`
(profile photo) is no longer in this list — see below, it's now backfilled
and rendered. None of the remaining ones gate any workflow today. Ask if any
should get a real V2 field — this is a list to decide from, not a queued
import.

**Employee profile photos (2026-09-06)**: `Employee.avatarUrl` has existed
in the schema since the personal-details migration but nothing ever wrote
to it, and no frontend page ever rendered shadcn's `AvatarImage` — every
avatar everywhere was initials-only, regardless of data. `AvatarImage`
(with a fallback to initials on load failure, Radix's default behavior)
was wired into the screens with real employee data: Employees list +
detail header, Team attendance roster + its employee picker (shared with
Payroll payslips), Profile, and the topbar user menu.

First pass set `avatarUrl` to a hotlinked `https://hrmpulse.com/upload-
image/<filename>` URL for the 35/41 employees who have a legacy
`hrm_employee.image` filename — a real dependency on the legacy host
staying reachable, which is exactly the "no file storage" gap this project
already tracked. **Fixed the same day**: `apps/web/download-avatars.mjs`
(one-off, deleted after running) downloaded each of the 35 photos from
hrmpulse.com, resized to a 256×256 JPEG thumbnail via `sharp` (already a
transitive Next.js dependency — no new package needed), and saved them to
`apps/web/public/avatars/<employeeCode>.jpg` — 35 files, 484KB total (down
from several multi-megabyte originals, Atul Chaudhary's was 2.2MB).
Checked into the web app's own `public/` folder, these deploy and persist
exactly like any other static asset: no file-storage provider, no
dependency on hrmpulse.com, survives every redeploy since they're in git.
`backfill-employee-avatars.ts` now points `avatarUrl` at that same-origin
path (`/avatars/<employeeCode>.jpg`) instead of the hotlink.
Leave/Expense approvals, Payroll salary, Resignations, Onboarding, and
Dashboard were deliberately left untouched — several are still mock data
(see the wiring table above) and the rest weren't asked for; ask if photos
should go there too.

**Old payslips were already fully imported — the real gap was visibility,
not missing data (2026-09-06)**: checked because the user asked to "import
the old payslips" from legacy. All 24 legacy `salary_slip_generate` rows
were already in production (Phase 1/2, see the migration table above) —
verified again directly against the dump, every employee/month/net-amount
pair matches exactly. The actual problem: `/payroll/payslips`'s employee
search was filtered to active employees only, and 4 of the 6 employees who
have legacy payslip history (Gurjeet Kaur, Shikha Pandey, Rajat Kumar,
Kanchan Gupta, Pallavi Kumari) are no longer active — their real, correctly-
imported payslips were unreachable through the admin UI. Fixed by
searching all employees regardless of status; "Generate payslip" (a new
one) now only shows for active employees, since generating one for someone
no longer employed doesn't make sense — viewing existing history still
works for anyone.

**Phase 3 import (2026-09-06, `import-legacy-phase3.ts`)** closed most of the
above: Assets (8/14 — 6 legacy assets have no assignment row, skipped),
Announcements (2/2, both made company-wide — legacy's per-employee
`show_to` targeting has no V2 equivalent), Onboarding (11 step templates +
209/209 progress rows), and 2 real Documents (the only `emp_documents` rows
with both a resolvable employee and a URL that actually returns 200 —
`hrm_employee_documents`/`hrm_employee_document_proof` were skipped: they
reference a `document_type_id` that doesn't exist in the legacy type table,
and most rows belong to a legacy employee id that doesn't exist anywhere in
`hrm_employee`).

**Attendance history import (2026-09-06, `import-legacy-attendance-history.ts`)**:
`newuser_attendance` (238 rows, Dec 2024–Feb 2025, clean numeric employee
ids) is now imported as real `AttendanceDay`/`AttendanceEvent` rows
(`AttendanceEventSource.BIOMETRIC_IMPORT`), status/lateMinutes/workedMinutes
computed with the exact same formula `AttendanceService.recomputeDay()`
uses, not trusted from legacy's own `status`/`late_status` labels. Two data-
quality issues found and handled, not silently imported as-is:
- 1 exact duplicate row (legacy ids 4 and 17, Prem Rai, same timestamps) —
  collapsed to one `AttendanceDay`, per the schema's own
  `@@unique([employeeId, date])`.
- 19 of 238 rows (8%) had `clock_out_time` at or before `clock_in_time` —
  mostly an exact "06:00:00" same-date sentinel, clearly a legacy
  placeholder for "never checked out" rather than a real punch. Importing
  it at face value would have produced a negative shift clamped to a
  fabricated 0-minute day and (for a few) an inflated `lateMinutes`. Treated
  as no real checkout instead (`lastCheckOutAt: null`, `workedMinutes:
  null`) — same shape a live "forgot to check out" day already has.

**Deliberately still not imported**, with reasons (so "done" is a real
claim, not an oversight):
- The 72-col wide `hrm_attandance_machine_detail` table (Sep–Dec 2024, the
  real historical bulk, predates `newuser_attendance`) identifies employees
  by first-name string, not id — 3 of 18 distinct names are ambiguous or
  unresolvable (two different "Shivam"s, "sonali" vs "sonali~seo", "punit"
  doesn't exist in `hrm_employee` at all), so an automated import would
  misattribute real people's attendance. Needs manual disambiguation first,
  not a script.
- `mismatch_attendance` — superseded by design, not skipped for convenience:
  V2's event-sourced `AttendanceDay`/`AttendanceEvent` (see the schema's own
  comment) replaces the whole class of problem this table tracked.
- `device_info` / `hrm_login_detail` / `hrm_login_logs` / `admin_login_logs`
  — no V2 model, and backfilling into `AuditLog` would pollute a table
  whose whole purpose is recording V2's own actions, not historical import.
- Real document/receipt/payslip file storage — still no provider wired
  anywhere (see "Not started" at the bottom).

**Real misclassification found and fixed (2026-09-06)**: Phase 1's employee
import used `hrm_employee.status` ('1'/'3') for `Employee.status`
(ACTIVE/INACTIVE) — that field is actually a login-enabled flag, not
employment status. The legacy app's own UI (Employees / Board Members /
Former Employees pages) is driven by a separate `archive_status` column,
confirmed three independent ways: `archive_status='0'` (7 rows) exactly
matches employees.php's 6 + the 1 Board Member; `archive_status='1'` (34
rows) exactly matches archived_employees.php's own stated "34 Total
Former"; and every one of the resulting 18 previously-misclassified rows
had a real `doe` on file. Fixed by flipping those 18 from ACTIVE to
INACTIVE with their real `dateOfExit` backfilled — see git history for the
one-off script (deleted after running, matching this project's convention
for migration scripts that touch real data once and don't need to persist).
V2's active count is now 7, matching the legacy system's real roster
exactly (Ritika Rajan, Sumit Kumar, Aditya Srivastava, Nikita, Shivam
Singhaniya, Sonu Yadav, Atul Chaudhary).

**Schema additions made to close a gap against the legacy profile page**
(migration `20260905142756_add_employee_personal_education_assets`,
applied): `Employee.gender`/`nationality`/`religion`/`maritalStatus`/`bloodGroup`,
plus new `EmployeeEducation` (list, normalized — legacy had one row per
employee) and `Asset` (flat per-employee assignment, matching legacy's
Assets tab exactly) models. This retroactively updates the "Not started"
call above for modules 12/13 for the **Assets** half only: the schema now
exists (unlike the original decision to defer it with "no schema model
exists"), though the dedicated Assets *module* (CRUD endpoints beyond what
`EmployeesService`'s `include` already returns) still doesn't. Complaints
(13) remains fully deferred, no schema, no change.

## Frontend ↔ API wiring (started 2026-09-05)

The frontend was 100% mock-data-driven except auth (login/me/logout, wired
earlier — see "Frontend auth wiring" below) until this pass. Wiring proceeds
screen-by-screen; a screen isn't "done" until it's been clicked through live
on `hrm.1solutions.biz` against real production data, not just typechecked.

| Screen | Status |
|---|---|
| Login / auth | ✓ wired (see notes below) |
| Employees (list + detail, Active/Past Employees tabs) | ✓ wired |
| Leave (self-service + Team → Leave approvals) | ✓ wired |
| Payslips (self-service view + new admin generate/history at `/payroll/payslips`) | ✓ wired |
| Documents (self-service submit + admin verify/reject) | ✓ wired |
| Expenses (self-service + Team → Expense approvals, new admin page) | ✓ wired |
| Requests (aggregator) | ✓ wired |
| Attendance (self-service check-in/out/history + Team attendance roster + per-employee day/week/month/quarter search) | ✓ wired |
| Holidays (new module + page, admin add/edit/delete) | ✓ wired |
| Salary management | ✓ wired |
| Admin (Roles & permissions, Company settings, System logs) | ✓ wired |
| Profile (self-service view + edit) | ✓ wired |
| Dashboard (Admin/HR/Manager variants) | ✓ wired — see caveat below |
| Performance, Announcements, Notifications, Settings, Onboarding, Resignations, Payroll reports | ○ still mock — not touched this pass |

Every "✓ wired" row above has been clicked through live on `hrm.1solutions.biz`
against real production data, not just typechecked — see the 2026-09-06
session notes below for what was found and fixed along the way. **One
exception**: Dashboard's HR and Manager variants were verified by typecheck/
lint/build plus direct API-level checks against production (the two
genuinely new pieces — `/employees/birthdays` and `/announcements` — were
hit directly through an authenticated session and returned correct real
data), but not clicked through in the browser as an HR or Manager user,
because **no account currently holds either role** (`/dashboard`'s own
"Roles distribution" widget shows Manager: 0, HR: 0 in production as of
2026-09-06) — there's no one to log in as. The Admin variant, which shares
the same underlying real endpoints, was confirmed live. Re-verify HR/
Manager in-browser once a real account holds either role.

**Bug found and fixed while wiring Employees**: `EmployeesService`'s
`findOne()` (`GET /employees/:id`) was missing `user` (so no work email at
all on the detail view), `education`, `assets`, and `documents` from its
Prisma `include` — only `findAll()`'s separate `select` had `user.email`.
Fixed by extending `EMPLOYEE_INCLUDE`; this shipped as part of today's
schema-addition deploy, not a separate one.

**Verification method note for future wiring passes**: the production API's
CORS restriction (see Deployment) blocks testing from a local dev frontend
against the real API. What worked: mint a real `Session` row + matching
JWT directly via Prisma/`jsonwebtoken` (same shape `AuthService.issueTokens`
produces) for QA purposes, curl the endpoint to confirm the JSON contract,
then deploy and click through the *actual* `hrm.1solutions.biz` site with an
already-real, already-logged-in browser session — never the user's actual
password, and the temporary session row is deleted after each round.

## Session notes (2026-09-06)

Continued the wiring pass from 2026-09-05 through to "everything except
Dashboard/Performance/Announcements/Notifications/Settings/Onboarding/
Resignations/Payroll-reports is wired" (see the table above). Rather than
repeat every module's notes here, the load-bearing findings:

- **Team attendance was a bare `PlaceholderPage`**, not mock data — the
  2026-09-05 pass deliberately skipped it (no company-wide roster endpoint
  existed yet). Built `GET /attendance/company` (one day, every active
  employee) and `GET /attendance/employees/:id/history` (any employee,
  day/week/month/quarter), both `attendance:manage`-gated. Also fixed a real
  permission mismatch this surfaced: the nav item was visible to "manager,"
  but `attendance:manage` is only granted to hr/admin in `seed.ts` — a
  manager opening the old page would have 403'd.
- **`/profile` was still 100% mock** (`lib/mock/fixtures.ts`'s
  `currentEmployee`) — edits "saved" into local React state only, so they
  reverted on every reload. This is the kind of gap easy to miss precisely
  because the mock UI looks finished. New `GET`/`PATCH /employees/me`
  (overrides the controller's class-level `employee:manage` via a bare
  `@RequirePermissions()` — method metadata wins over class metadata in
  `PermissionsGuard`'s `getAllAndOverride`), with a deliberately narrow
  `UpdateMyProfileDto` — identity/employment fields stay HR-only via the
  existing `PATCH /employees/:id`.
- **Payslip generation and admin payslip history didn't exist in the
  frontend at all**, despite the backend having both endpoints since the
  Payroll module was built. New `/payroll/payslips`: employee search, that
  employee's salary + full history, and a generate dialog that pre-fills
  the real legacy earnings formula (basic 40% of salary, HRA 50% of basic,
  medical/conveyance flat 800/1200, special allowance as the remainder —
  verified byte-for-byte against a real issued payslip on 2026-09-05, not
  invented). Leave/Late deduction default to 0 and are dropped from the
  payload if left there (the backend requires every line item's amount to
  be positive).
- **New Holidays module** (backend + `/holidays` page) — the legacy system
  has a full Holidays admin screen; V2 had the `Holiday` data (imported,
  used internally by Attendance) but no way to see or manage it directly.
- **A real, previously-shipped data-corruption bug**: every date picked via
  the shadcn Calendar/DatePicker (Leave apply, Expense add, Holidays
  add/edit) was silently saving one day earlier than what was picked -
  `date.toISOString().slice(0, 10)` reads a locally-constructed midnight
  Date in UTC, which crosses into the previous calendar day for any
  positive UTC offset (IST included). Caught live while testing Holidays.
  Checked for real damage: none found (zero real leave requests existed
  yet; the one real expense claim landed correctly by time-of-day
  coincidence). Fixed everywhere via `lib/format.ts`'s `toDateOnlyString()`.
- **`AttendancePolicy` was never seeded in production** (same class of gap
  as `DocumentType` below) — was actively throwing on `/attendance` and
  would have broken check-in/out. Seeded with the real legacy
  `office_timing` values (09:00–18:00, 15min grace, 3h half-day), not the
  mock-fixture defaults `seed.ts` would have used.
- **`DocumentType` lookup rows were never seeded in production** either —
  every employee's document checklist came back empty. Same root cause as
  `AttendancePolicy`: only a minimal manual seed (roles/permissions/admin)
  ever ran against production, not the full `seed.ts`.
- **Employee active/inactive was wrong for 18 people** — see the Data
  migration section's "Real misclassification found and fixed" note.

**Later the same day**, after the feature-parity audit below: payslip PDF
download actually generates a file (was a UI stub that only toasted
"Downloading..."), the payslip PDF was missing Date of Joining, Team
attendance roster names are now clickable into that employee's history
(they weren't before), `newuser_attendance` (238 rows) is imported as real
attendance history, `EmployeeEmergencyContact` was silently 1-per-employee
and now supports the multiple contacts real employees actually have,
employee demographics (gender/nationality/religion/maritalStatus/
bloodGroup) were backfilled for all 41 employees (schema existed, nothing
had ever written to it), employee profile photos are now backfilled and
rendered (self-hosted under `apps/web/public/avatars/`, not hotlinked —
an initial hotlinked version was corrected the same day), and the
Payslips admin search was fixed to include past employees, not just active
ones. Full detail on each is in "Data migration" above and the dedicated
notes right below it (search this file for "2026-09-06" — several distinct
same-day entries, added as each fix landed rather than batched).

**Still later the same day: Dashboard wired** (user asked to work through
the remaining 8 mock screens one at a time, starting here). Turned out to
be three separate role-specific components (`admin-dashboard.tsx`,
`hr-dashboard.tsx`, `manager-dashboard.tsx`), not one screen — and Admin's
was **already fully real** (`getEmployees` + `lib/api/admin`'s endpoints),
mislabeled mock only because the other two dragged the whole row down in
the wiring table. HR and Manager were both 100% mock/sample data; both now
compute every widget from real endpoints — reusing `getCompanyLeaveRequests`/
`getCompanyExpenseClaims`/`decideLeaveRequest`/`decideExpenseClaim` (the
same ones Team approvals already uses) and `getCompanyAttendance` for
headcount/attendance stats. Two things didn't already exist and had to be
built:
- `GET /employees/birthdays` — a new, narrow endpoint. `Employee.dateOfBirth`
  is deliberately excluded from `findAll()`'s directory select (that
  method's own comment: avoids bulk-exposing it company-wide to every
  `employee:manage` holder), so the "Upcoming birthdays" widget needed its
  own endpoint returning only name/department/next-occurrence, not full
  records. Verified against production: correctly finds Sonu Yadav's
  birthday 2 days out, matching hrmpulse.com's own dashboard ("Upcoming
  Birthday: Sonu Yadav on September 8") seen earlier in this same session.
- `apps/web/src/lib/api/announcements.ts` — the Announcements backend
  module has existed since module 11 was built; nothing in the frontend had
  ever called it. Verified directly against production: 2 real
  announcements, correct per-viewer `read` state.

Manager dashboard's stats and weekly attendance chart are scoped to actual
direct reports (`Employee.manager`), not company-wide — computed from 5 real
per-day `getCompanyAttendance` calls for the current work week. "Open
tickets" (no Tickets module exists — see the feature-parity audit above)
was replaced with "On leave today".

**Verification caveat**: HR and Manager variants were not clicked through
in-browser as an HR or Manager user — production currently has **zero**
accounts holding either role (confirmed via the Admin dashboard's own Roles
distribution widget: Manager 0, HR 0), so there's no one to log in as.
Verified instead via full typecheck/lint/build and by hitting the two new
endpoints directly through an authenticated session (shown above). Admin's
dashboard, which shares the same underlying endpoints, was confirmed live.
Re-verify HR/Manager in-browser once a real account holds either role.

## Dashboard redesign + My Day wiring (2026-09-06)

User attached two hrmpulse.com/Cipla-style reference screenshots and asked for
five things: (1) Admin dashboard should count active employees only, (2) a
blue top banner with greeting/date/Mark attendance/last-punch, (3) a
"Highlights" birthdays section on Admin dashboard, (4) a real Leave balance
on the "user dashboard" (interpreted as My Day, the page plain employees
land on), (5) a monthly attendance calendar ("Yesterday's attendance") on
the same page.

**Bug fix, not just Admin's stat card**: `getEmployees()`/`findAll()` was
never changed (it's correctly consumed elsewhere with client-side filters —
Employees list, Payslips search, Team attendance all need the full roster
and already filter appropriately). The actual bug was narrower: Admin
dashboard's "Total employees" counted all 41 records instead of the 7
active ones, and "Active roles"/Roles distribution (`GET
/admin/roles/employees`, a separate endpoint with no status filter at all)
counted roles across all 41 too. Fixed both by filtering to
`status === "ACTIVE"` at the point of consumption in `admin-dashboard.tsx`,
cross-referencing role rows against the active employee id set already
fetched for the stat card — no backend change needed.

**Attendance check-in/out logic extracted into a hook**: `AttendanceCard`'s
state machine (load/checkIn/checkOut/elapsed-time ticking) moved into
`lib/use-attendance-punch.ts` so the new `AttendanceBanner` component
(Admin dashboard's blue top bar) could reuse it without duplicating it.
`AttendanceCard` itself is unchanged in behavior, just thinner.

**New**: `AttendanceCalendarCard` (`components/hrm/attendance-calendar-card.tsx`)
renders the current month from real `GET /attendance/history`, bucketed
into Present (PRESENT/LATE/HALF_DAY)/Absent/Week off/Leave/Holiday — the
five statuses `AttendanceDayStatus` actually models. One thing to flag
back to the user: the reference screenshot's legend also had "Home"/
"Office" (work-location for the day) — V2 has no per-day work-location
field on `AttendanceDay` at all, so those two are simply not representable
today; would need a schema addition if wanted. Also note: `getAttendanceHistory`
only synthesizes a WEEKEND row for *past* dates (today-or-later with no
record is omitted from the response, not synthesized — see the service's
own `continue` for that case), so future Saturdays/Sundays in the grid are
derived client-side from `AttendancePolicy.workingWeekdays` as a fallback,
not from the API response.

**Also fixed while wiring this**: `apps/web/server.js` (the Hostinger
Node-hosting entry point, added in eb35c64) is deliberately CommonJS —
Hostinger's `lsnode.js` loader can't load an ESM module using top-level
await — but was never excluded from ESLint's TypeScript rules, so it had
been failing the `web (Next.js)` GitHub Actions CI job's lint step on
every single push to `main` since that commit, regardless of what changed.
Added it to `eslint.config.mjs`'s ignore list.

**Verified live** on `hrm.1solutions.biz` as Atul (admin): Total employees
reads 7 (not 41), Active roles reads 2 (Employee 6 + Admin 1, matching
Roles distribution), Highlights shows Sonu Yadav's real Sept 8 birthday.
On My Day (admins don't land here by default — navigated directly):
Leave balance correctly reads 0 days (real `GET /leave/balances` — Atul's
1-day Casual Leave allocation is fully used), and the attendance calendar
correctly renders a real HALF_DAY (Sep 5, an actual short check-in) and a
real ON_LEAVE day (Sep 7, Atul's own pending leave request) alongside
synthesized WEEKEND/ABSENT days.

**Follow-up same day**: user shared a legacy hrmpulse.com screenshot showing
Payslips as a card grid (one card per document: folder icon, type label,
month/year, download icon) instead of a plain list, and asked for the same
treatment on both the self-service `/payslips` page and the admin
per-employee "Payslip history" view at `/payroll/payslips` (opened by
picking an employee there). Built one shared `PayslipCardGrid` component
(search box + card grid, click a card to open the existing detail sheet)
used by both. The legacy screenshot's grid actually paired a "Salary" card
with a "Tax" card per month - asked the user, confirmed scoping to Salary
only, since V2 has no separate tax-document type or generation logic (would
be new scope, not a redesign). Verified live: picked Kanchan Gupta in the
admin view, saw 3 real Salary cards (Jul/Jun/May 2026), opened one, and the
existing detail sheet + PDF download still worked unchanged.

**Deploy note for future sessions**: Hostinger's CDN (`hcdn`) caches pages
independently of whether the underlying Node app redeployed — after a
push, the app itself may already be running the new build while
`hrm.1solutions.biz` keeps serving a stale cached response (check
`x-hcdn-cache-status`/`age` response headers to tell). Flush via
hpanel.hostinger.com → the site → Performance → CDN → "Flush cache" before
trusting what a fresh page load shows. Don't use a JS chunk hash (e.g.
`main-app-*.js`) to detect a redeploy either — that chunk only changes
when its own code changes, not on every deploy; check hPanel's
Deployments list instead.

## Legacy feature-parity audit (2026-09-06)

Full pass comparing hrmpulse.com's live admin nav (extracted directly from
its rendered sidebar, not guessed) against V2's actual built/wired feature
set, plus a check of every legacy table that looked like it might still hold
unmigrated data. Two-part ask: (1) what's missing in V2, (2) is any legacy
data left behind.

### 1. Feature gaps vs. legacy

**Has no V2 equivalent at all (explicit deferrals, module 12/13 territory or
new findings):**
- **Tickets / HR Ticket Management** (`ticket.php` self-service,
  `view-ticket.php` admin) — **44 real historical tickets exist in the
  legacy dump** (`tickets` table — mostly attendance mispunch/correction
  requests), none imported, no V2 model. This is genuine unmigrated data,
  not an empty legacy feature — see part 2.
- **POSH** (Guidelines/Committee/Complaint/All Complaints) — no V2 model.
  Confirmed **0 rows** in legacy's `sexual_harassment_complaints` table, both
  in the dump and live (`all_employee_complaints.php` shows "No data
  available"). Nothing to migrate; the feature itself is just absent.
- **1Sol Fun Time** (Quiz Board leaderboard + points-based Employee of the
  Month, e.g. live: "Sonu Yadav — 71.42 Points — August 2026") — V2's
  `/recognition` ("Employee of the month") is a bare `PlaceholderPage`, no
  quiz/gamification/points system exists anywhere in the schema.
- **Company Policies** document library (`company_policies.php`) — no V2
  model. Confirmed empty in legacy too (dashboard's Company Policy widget
  shows 5× "No Policies Available" placeholders) — nothing to migrate.
- **Company Document** repository (`company_data.php`, company-wide files
  distinct from the per-employee Documents module V2 already has) — no V2
  model. Confirmed empty in legacy (no documents listed).
- **Office Timing admin screen** — legacy has a dedicated settings page to
  edit office hours/grace/half-day thresholds. V2's equivalent
  (`AttendancePolicy`) is a DB row with no admin UI at all; it was seeded
  manually via a one-off script this session (see "AttendancePolicy was
  never seeded" above) and can currently only be changed by hand.
- **Password Management** (admin-side generate/reset for any employee's
  password) — no V2 equivalent found; V2 only has self-service Change
  Password (`/settings`, wired, works).
- **Notice Period step-tracking** (`employee_notice_period_steps`,
  `notice_period_steps`, `notice_period_files` — a per-step checklist with
  file uploads) — V2's Resignation module covers submit/withdraw/decide only,
  no step tracking. Turns out moot for data purposes: see part 2, these
  tables are empty in legacy.

**Backend exists, frontend doesn't (or is still mock) — the closest thing to
a "quick win" list:**
- **`/people/resignations`** (legacy: Resignation Form / Notice Period) —
  the backend module is fully done (`resignation:decide`, submit/withdraw/
  decide), but the frontend page is still on mock data, not wired.
- **Departments / Designations admin management** (`departments.php`,
  `designations.php`) — `DepartmentsController`/`DesignationsController`
  already exist with full CRUD in the API; there is no admin UI page for
  either, so today they're only usable as read-only lookups inside the
  Employees screens.
- **Assets** — data is imported (8 real rows, see the Data migration
  section and module 12 above) and visible read-only on an employee's
  detail page, but there's no admin UI to assign/return an asset and the
  standalone `/assets` ("My assets") page is still a bare `PlaceholderPage`.
- **Onboarding candidates, Payroll reports, Announcements, Dashboard,
  Performance** — backend modules are done; frontend pages still run on
  `lib/mock/mock-api` per the wiring table above.
- **Notifications** (`/notifications`, the bell-icon center) — still 100%
  `lib/mock/mock-api` dummy data, reachable from the topbar for every user.
  Worth calling out specifically since it's the same class of problem as the
  `/admin/roles` dummy-data complaint fixed earlier this session.
- **Team directory** — still a bare `PlaceholderPage`, not even mock data.

**Already fully covered in V2** (confirmed live, not just assumed): Holidays,
Team attendance (roster + per-employee history), Salary Slips (self-service
+ new admin generate/history), Salary Management, Announcement *publishing*
(admin side works; the employee-facing feed is what's still mock, see
above), Employees incl. Active/Past tabs, Company Details (`/admin/company`),
Permission Management + Users role (`/admin/roles`), Expenses Management,
Admin Logs, Leave (Admin).

### 2. Legacy data completeness

Row-count table in "Data migration" above is accurate as of Phase 3
(2026-09-06) with one correction made today: Assets' module-status row said
"no real asset data imported yet," which was stale — 8 rows are in
production (verified directly against the live DB, not just the import
report).

**Newly confirmed still-unmigrated, real data** (not covered by the
"Deliberately still not imported" list above, because these tables weren't
on anyone's radar until this audit):
- **44 support tickets** (`tickets` table) — real historical mispunch/leave-
  correction requests from named employees (Aditya Srivastava, Sonu Yadav,
  Chetan Pal, Kanchan Gupta, Rajat Kumar, Nikita, Deepak Kumar, …), dated
  back to at least April 2025. No V2 ticket model exists to import them
  into — this is the one real gap this audit found on the data side.

**Confirmed genuinely empty in legacy — not a migration gap, just an unused
feature** (checked the dump directly, 0 INSERT rows in each): 
`employee_resignations`, `resignation_history`, `notice_period_steps`,
`notice_period_files`, `employee_notice_period_steps`,
`sexual_harassment_complaints`, `company_policies`. So the Notice Period /
POSH / Company Policies feature gaps above cost nothing in migrated data —
there was never any real data in those legacy tables to lose.

Everything else (attendance history, login/device logs, mismatch-attendance)
is exactly as already documented in "Deliberately still not imported" above
— no changes from this audit.

## Frontend (`apps/web`)

- ✓ Design system (shadcn/ui "Nova" preset, Tailwind v4)
- ✓ Navigation shell, topbar (dark/light toggle, live clock, last-login)
- ✓ Login UI (`/login` — posts to the real `POST /auth/login`, see "Frontend
  auth wiring" below; redesigned 2026-09-05: split branding/form layout,
  icon-only mark, password show/hide toggle, loading-spinner submit state)
- ✓ Every screen listed as "✓ wired" in the Frontend ↔ API wiring table
  above runs against the real API. `lib/mock/fixtures.ts` / `hr-fixtures.ts`
  still exist and still back the screens listed as "still mock" there.

Except Employees (see "Frontend ↔ API wiring" above), the rest of the
frontend still runs on the in-memory mock API — not wired to `apps/api` yet.
Wire a module once its real endpoints exist (all 16 built modules do) and
update the wiring table above when a screen moves over; don't do it all in
one sweep.

## Database

- ✓ Prisma schema designed (`apps/api/prisma/schema.prisma`, 43 models as of
  2026-09-05 — see `docs/database-design.md` for the original rationale,
  and "Data migration" above for the `gender`/`nationality`/`religion`/
  `maritalStatus`/`bloodGroup`/`EmployeeEducation`/`Asset` additions made
  since).
- ✓ Migrations applied to the live production MariaDB on Hostinger (see
  "Deployment" above) — `20260905112951_init` (the original 41-model
  schema), `20260905142756_add_employee_personal_education_assets`,
  `20260905190657_add_employee_date_of_exit`, and
  `20260906030459_allow_multiple_emergency_contacts`.
  Local dev still has no Docker/MySQL; every migration so far has been
  generated and applied directly against production
  (`prisma migrate diff --to-config-datasource` + hand-placed migration
  folder, since no shadow database credentials were available in this
  session — the shadow DB itself was created earlier but its credentials
  weren't persisted anywhere retrievable).
- ✓ Minimal seed run against production: roles, permissions,
  role-permission mappings, one real admin account
  (`atul@1solutions.biz`) — **not** the full `prisma/seed.ts` (that script
  is explicitly local-dev-only per its own header comment; company
  settings/performance cycles/lookup tables came from the real legacy-data
  import instead, see "Data migration").

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
| 07 | Requests | ✓ done (read-only aggregator over Leave + Expenses; see notes below) |
| 08 | Documents | ✓ done (submit/verify checklist, no real file storage yet; see notes below) |
| 09 | Expenses | ✓ done (submit/approve, monthly-cap enforcement, wired into Requests; see notes below) |
| 10 | Performance | ✓ done (goals, reviews, recognitions; see notes below) |
| 11 | Announcements | ✓ done (publish + per-viewer read state; see notes below) |
| 12 | Assets | ○ dedicated module still not started, but **schema exists and data is imported**: `Asset` (added 2026-09-05) holds 8 real rows from the Phase 3 legacy import (6 legacy assets had no assignment row and were correctly skipped — see "Data migration"), and the frontend Employee-detail Assets tab reads real `Employee.assets` through the Employees module's own `include`. Still missing: dedicated `/assets` CRUD endpoints (assign/return/edit), and the standalone Assets nav item (`/assets`, "My assets") is still a bare `PlaceholderPage` — confirmed 2026-09-06, corrects this row's earlier "no real asset data imported yet," which was stale. |
| 13 | Complaints | ○ not started — same reason and same decision as Assets (12): no schema model, no approved UX, explicitly skipped for now. |
| 14 | Resignation | ✓ done (submit/withdraw/decide; see notes below) |
| 15 | Payroll | ✓ done (salary structure/revision, HR-entered payslip generation, trend/by-department aggregates; see notes below) |
| 16 | Reports | ✓ done — **folded into module 15**, no separate endpoints. The only reports screen in the frontend (`/payroll/reports`) is Payroll's own trend/by-department view; `getTrend`/`getByDepartment` were sharpened (activeHeadcount, trailing-6-months window, department name join) to fully back it. See Module 15 notes. |
| 17 | Admin | ✓ done (company settings CRUD, live role→permission view, employee role assignment; see notes below) |
| 18 | Audit | ✓ done (`GET /audit/logs`, read-facing over the `AuditLog` table every other module already writes; see notes below) |

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
- Both Leave and Expenses (module 09) are now wired in — `RequestsService`
  injects both, maps each source's rows to the unified `{ id, kind, title,
  detail, status, submittedOn }` shape, merges, and re-sorts newest first.
  Complaints/Resignation could plausibly join too if they turn out to need
  a "my requests" presence; nothing beyond the two the mock combines is
  assumed.
- Also fixed while extending the fake test double for this: `FakeEmployee`
  test fixtures across three e2e spec files (attendance, leave, requests)
  had been silently missing a required `dateOfBirth` field — invisible
  because `vitest` doesn't type-check spec files. `npx tsc --noEmit -p
  tsconfig.json` is the way to actually catch this (`npm run build`
  excludes `test/` entirely); ran it and fixed the one real gap it found
  (a pre-existing, unrelated `supertest/types` import error from the
  original scaffold is left alone).
- 2 new unit tests + 2 new e2e tests. Still nothing against real MySQL.

**Module 08 (Documents) notes:**
- Self-service: `GET /documents/types`, `GET /documents/mine`, `POST
  /documents/mine/:documentTypeId/submit`. HR-facing (reuses `employee:manage`
  rather than minting a new permission — this is a subset of employee HR
  management, not a distinct capability): `GET
  /documents/employees/:employeeId`, `PATCH
  /documents/employees/:employeeId/:documentTypeId/verify`.
- **No real file storage integration** — no provider (S3 or otherwise) is
  wired up anywhere in this project, and building one wasn't requested.
  `POST .../submit` accepts a `fileUrl` string (the URL of a file uploaded
  somewhere else) rather than a file body; the API only ever records the
  URL. Documented as a real gap, not silently worked around.
- Checklist rows synthesize `MISSING` on read for any active `DocumentType`
  with no `EmployeeDocument` row yet — third module using this pattern
  (Attendance's history gaps, Leave's balances, now this).
- Resubmitting a document clears any prior `verifiedByUserId`/`verifiedAt`/
  `notes` and resets to `PENDING_REVIEW` — a new file means the previous
  review no longer applies to what's on file. Verifying/rejecting is only
  allowed from `PENDING_REVIEW`; nothing can be verified before it's been
  submitted at least once.
- 8 new unit tests + 4 new e2e tests, including the full
  submit-then-HR-verify round trip and the two 4xx paths (verifying an
  unsubmitted document, an employee attempting to verify their own).
  `npx tsc --noEmit -p tsconfig.json` re-run clean (aside from the
  pre-existing unrelated `supertest/types` error). Still nothing against
  real MySQL.

**Module 09 (Expenses) notes:**
- Self-service: `GET /expenses/categories`, `GET /expenses/claims`, `POST
  /expenses/claims`, `PATCH /expenses/claims/:id/cancel` (PENDING-only, own
  claims only — same shape as Leave's cancel). HR-facing: `GET
  /expenses/claims/company`, `PATCH /expenses/claims/:id/decide` — behind a
  new `expense:approve` permission (granted to admin/hr/manager, same
  manager-approval-not-scoped-to-reports caveat as `leave:approve`).
- **`ExpenseCategory.monthlyCapAmount` is now actually enforced**, not just
  modeled — the schema comment on that field cites the exact motivating
  case ("₹5,000/mo internet cap" as a legacy hardcoded policy-doc rule),
  and the seed sets that cap on "Internet & Phone" specifically, leaving
  every other category uncapped. The check is computed live from that
  employee's PENDING+APPROVED claims in the category for the calendar month
  of the new claim's `expenseDate` — same reasoning as Leave's balance
  check: catches double-booking across several pending claims without a
  reserve/release step, and categories with no cap skip the query
  entirely.
- No file storage integration here either (same `receiptUrl`-as-string
  limitation as Documents' `fileUrl`).
- Same `Decimal`-serializes-as-a-string fix applied proactively this time
  (`ExpenseClaim.amount`) — module 06 found this the hard way for
  `LeaveRequest.totalDays`; `serializeClaim()` converts to a number at
  every response boundary from the start.
- Wired into `RequestsModule` (07): `RequestsService` now merges both
  Leave and Expense sources into the unified view, closing the gap that
  module left open on purpose.
- 12 new unit tests + 4 new e2e tests, including the monthly-cap rejection
  and the full submit → HR-approve → shows-up-in-`/requests/mine` path
  across two modules. Still nothing against real MySQL.

**Module 10 (Performance) notes:**
- Self-service: `GET /performance/cycles`, `GET /performance/me`, `PATCH
  /performance/goals/:id/progress` (own goals only — a plain 403, not a
  silent no-op, for someone else's goal). HR/manager-facing (new
  `performance:manage` permission, granted to admin/hr/manager): `GET
  /performance/employees/:employeeId`, `POST .../goals`, `POST
  .../reviews`, `POST .../recognitions`.
- The mock's `performance` fixture is entirely read-only (no goal-editing,
  review-writing, or recognition-awarding call exists in `mock-api.ts`) —
  unlike modules 06-09, there was no built self-service write flow to
  match. Goal progress as a self-service action was added anyway because
  it's clearly employee-owned data with no approval workflow, the same
  reasoning that made Attendance's check-in/check-out self-service; goal
  *assignment*, reviews, and recognitions stayed HR/manager actions since
  nothing suggests otherwise.
- `PerformanceCycle` creation deferred to Admin (17), consistent with
  LeaveType/DocumentType — the seed provides the two cycles the mock
  references ("H1 2026", "H2 2026 Review Cycle") so `/performance/me` has
  something real to return without Admin existing yet. Their start dates
  aren't given by the mock (only `cycle.endsOn`) — inferred as Jan 1 / Jul 1
  half-year boundaries, documented as a guess, not confirmed.
- `PerformanceReview.rating` is a `Decimal` — applied the same
  serialize-to-number fix proactively (third time this pattern's needed,
  after Leave and Expenses).
- 11 new unit tests + 3 new e2e tests, including the 403 on updating
  someone else's goal and the full HR-assigns-goal → employee-updates-it →
  reflected-on-GET round trip. Still nothing against real MySQL.

**Module 11 (Announcements) notes:**
- `GET /announcements` (self-service, annotates each row with `read: boolean`
  for the caller), `PATCH /announcements/:id/read` (self-service, idempotent
  upsert), `POST /announcements` (new `announcement:publish` permission,
  granted to admin/hr).
- **Per-viewer read state via `AnnouncementRead`, as the design doc always
  intended** — this is the first module to actually build it. Fixes
  legacy's single global read flag (`docs/database-design.md`: "read" is a
  fact about a reader, not the announcement). e2e-tested explicitly: one
  viewer marking an announcement read leaves every other viewer's read
  state untouched.
- No edit/delete — the mock has no editing flow, and announcements are
  treated as immutable once published (a correction would be a new
  announcement) rather than adding unrequested write paths.
- 5 new unit tests + 2 new e2e tests, including the per-viewer isolation
  case. Still nothing against real MySQL.

**Module 12/13 (Assets/Complaints):** skipped by explicit user decision —
neither has a Prisma model, both were deliberately deferred at the
database-design phase pending real frontend UX. Revisit once that exists
rather than guessing at a schema now.

**Module 14 (Resignation) notes:**
- Self-service: `GET /resignations/mine`, `POST /resignations`, `PATCH
  /resignations/:id/cancel` (withdrawal, PENDING-only). HR-facing (new
  `resignation:decide` permission, admin/hr only — not extended to manager,
  a more sensitive decision than leave/expense approval): `GET
  /resignations/company`, `PATCH /resignations/:id/decide`.
- **`noticePeriodDays` is derived from `submittedAt`→`lastWorkingDay`, not
  accepted as a separate client field** — the mock's own two sample rows
  have `lastWorkingDay` exactly `noticePeriodDays` after `submittedOn` in
  both cases, so trusting an independently-suppliable number that could
  disagree with the dates would be a self-inflicted data-integrity gap.
- **Added `WITHDRAWN` to `ResignationStatus`** (schema was PENDING/
  APPROVED/DECLINED only) — self-service withdrawal updates status rather
  than deleting the row, consistent with how every other domain in this
  schema never destroys decision history (Leave/Expenses use CANCELLED on
  the same principle). Free to add since nothing has touched a live DB yet.
- **Approving a resignation deliberately does not deactivate the
  `Employee` record** — that stays a separate action via Users/Employees'
  existing status toggle. No scheduled-job infrastructure exists to defer
  deactivation to the actual `lastWorkingDay`, and doing it immediately on
  approval would be premature when that day may be weeks out.
- 10 new unit tests + 4 new e2e tests, including the derived-notice-period
  check, the duplicate-pending rejection, and withdraw-then-resubmit. Still
  nothing against real MySQL.

**Module 15 (Payroll) notes:**
- Self-service: `GET /payroll/salary/mine`, `GET /payroll/payslips/mine`,
  `GET /payroll/payslips/mine/:id`. HR-facing (new `payroll:manage`
  permission, admin/hr only, not manager — same reasoning as
  `resignation:decide`): `GET /payroll/salary/company`, `GET
  /payroll/employees/:id/salary`, `POST
  /payroll/employees/:id/salary/revise`, `GET
  /payroll/employees/:id/payslips`, `POST /payroll/employees/:id/payslips`,
  `PATCH /payroll/payslips/:id/mark-paid`, `GET /payroll/trend`, `GET
  /payroll/by-department`.
- **Payslip line items are HR-entered, never computed from a
  basic/HRA/PF/tax formula.** The schema has no salary-component-breakdown
  model — `SalaryStructure.currentAmount` is a single number — and the
  mock's `buildPayslip()` hardcodes the same basic/HRA/special split for
  every employee regardless of salary, confirming it's demo filler, not a
  real formula. Inventing percentages here would fabricate numbers nobody
  signed off on (rule 13). Instead HR enters the actual earnings/deductions
  (sourced from wherever payroll is really run) and the server only
  aggregates what the schema's own `EARNING`/`DEDUCTION` split already
  defines: `grossAmount = Σ EARNING`, `netAmount = grossAmount − Σ
  DEDUCTION`. **UNKNOWN, alongside the attendance fine formula**: the real
  basic/HRA/PF/tax breakdown rule, if one is ever wanted.
- **Salary revision is the first `$transaction` in this codebase.**
  Capturing `previousAmount` off the current `SalaryStructure`, updating
  (or creating) that structure, and inserting the `SalaryRevision` row all
  happen in one transaction — a revision whose `previousAmount` doesn't
  match what the structure said (or a structure updated with no revision
  recorded) corrupts the audit trail, unlike a failed write. Payslip +
  line-item creation is transactional for the same reason. Every other
  module's multi-write sequences remain non-transactional, per the
  precedent already accepted in Users/Employees.
- **First salary revision for an employee creates `SalaryStructure`** (no
  Employees-module action creates one) — `previousAmount` is `null` in
  that case, distinguishing "first-ever salary on record" from "no
  change."
- **A revision's `effectiveDate` cannot be in the future** —
  `reviseSalary` rejects it (400). Revisions take effect immediately on
  record, not on `effectiveDate`; there's no scheduled-job infrastructure
  (same gap already documented for Resignation approval not deferring
  deactivation) to apply a future-dated change later, so silently making a
  future date "current" today would misrepresent when the raise actually
  took hold. If backdated/forward-dated revisions become a real
  requirement, that needs actual scheduling, not a silent field.
- **`SalaryStatus.UNDER_REVIEW` is unreachable.** The enum value exists in
  the schema but nothing in this module (or anywhere else) transitions a
  `SalaryStructure` into or out of it — same treatment as Performance's
  deferred cycle CRUD. No UX or workflow for it exists yet; revisit if one
  does.
- **Money summed via integer paise** (`src/common/money.ts`), not floating
  `+` — avoids the classic `0.1 + 0.2` drift on a payslip total. Every
  `Decimal` field at the response boundary
  (`currentAmount`/`previousAmount`/`newAmount`/`grossAmount`/`netAmount`/line-item
  `amount`) is converted to a plain number.
- **DTO money fields enforce `maxDecimalPlaces: 2`** (`ReviseSalaryDto.newAmount`,
  `PayslipLineItemDto.amount`) — the columns are `Decimal(12, 2)`; rejecting
  a third decimal place at the boundary is better than letting MySQL round
  or reject it silently on insert.
- **`payslipNumber` format is a documented guess**: `PS-{periodYear}-{5-digit
  sequence}` (e.g. `PS-2026-00001`) via a new `payslipCode`
  `SequenceCounter`. The schema comment already flags the format as
  unconfirmed; the year is embedded for readability only — the underlying
  counter is global and never resets per year.
- **`getTrend`/`getByDepartment` back the entire "Reports" module (16) —
  no separate reports endpoints exist because `/payroll/reports` is the
  only reports screen in the frontend.** Two headcount-shaped fields, kept
  distinct because neither alone answers what the screen needs:
  `payslipCount`/`employeeCount` — employees with a payslip that
  period, undercounts anyone hired mid-period or missing a payslip — and
  `activeHeadcount` (trend only) — currently-`ACTIVE` employees whose
  `dateOfJoining` precedes the period end, a real headcount but only
  accurate for the *current* roster, since `Employee` has no
  termination-date field to exclude someone from a period after they
  left. `getTrend` also now takes a `months` param (default 6, matching
  the screen's "Last 6 months" chart) and returns only the trailing
  window; `getByDepartment` joins `Department.name` as `departmentName`
  since the frontend needs a label, not just an id. Both aggregate real
  `Payslip` rows rather than reproducing the mock's
  `payrollMonthlyTrend`/`payrollByDepartment` fixtures.
- No payslip PDF/download path — no file-storage integration exists yet,
  same limitation already documented for Documents and Expenses receipts.
- 17 unit tests + 4 e2e tests, including one asserting gross/net are
  correct numbers (not decimal-stringified) end to end through generate →
  mark-paid, and unit coverage for activeHeadcount, the trailing-months
  window, and getByDepartment's department-name join and no-data path.
  Still nothing against real MySQL.

**Module 17 (Admin) notes:**
- `GET`/`PUT /admin/company-settings` (new `company:manage` permission,
  admin-only — not granted to hr, matching the nav's `roles: ["admin"]`
  restriction on that screen). `PUT` is a **full replace, not a merge**:
  `website`/`phone`/`address` are always overwritten with the request's
  value, `null` if omitted. Safe because the admin form is one page
  submitting the whole record, not a per-field editor — if a genuine
  partial-update caller shows up later, that needs its own PATCH, not this
  method reused. `timezone` is excluded from the DTO entirely (the
  frontend renders it disabled; the schema default is still the only
  source).
- `GET /admin/roles/permissions` (permission `user:manage`, already
  admin-only per the seed) reads live `RolePermission`/`Permission` rows
  keyed by role — **not a hand-maintained copy** the way the mock's
  `getRolePermissions` fixture was, which could silently drift from what
  routes actually enforce. This is a real improvement over the UI it
  replaces, not just a port of it.
- `GET /admin/roles/employees` / `PATCH
  /admin/roles/employees/:employeeId` (`{ roleKey }`) back the "Employee
  role assignments" table and its one-role-per-employee dropdown. The
  PATCH **delegates to `UsersService.replaceRoles(userId, [roleKey],
  actor)`** (module 02) rather than reimplementing role writes — it
  inherits that method's existing `ROLE_CHANGED` audit log for free. A
  user with more than one role only shows the first here (a UI
  constraint, not a data one); `PUT /users/:id/roles` still exists for
  true multi-role assignment.
- **Administration nav is only two-thirds covered by this module.**
  `/admin/logs` ("System logs") is module 18's read API over `AuditLog` —
  intentionally not built here. `/style-guide` ("Design system") is a
  static frontend page with no backend surface at all. The nav group is
  fully accounted for once 18 lands.
- 6 unit tests + 3 e2e tests, including one asserting a worker gets 403 on
  all four gated routes — the mutating ones (`PUT company-settings`,
  `PATCH roles/employees/:id`) matter most, since a permission gap on the
  role-assignment route is a privilege-escalation path. Still nothing
  against real MySQL.

**Module 18 (Audit) notes:**
- `GET /audit/logs?limit=` (new `audit:view` permission, admin-only),
  most-recent-first, tie-broken by `id` — `DateTime` on MySQL is
  millisecond-precision, and a burst of same-millisecond rows (concurrent
  logins, a multi-step admin action) needs a stable secondary sort or
  ordering among them is whatever the storage engine feels like. `limit`
  clamps to [1, 500]; no cursor pagination, matching every other list
  endpoint in this codebase (Expenses, Resignation, etc.) and the mock's
  own unpaginated `getAuditLogs()`.
- **Actor display name is resolved at read time, not write time — fixed
  here instead of touching the 17 existing `.log()` call sites.**
  `AuditService.log()`'s `actorName` field is only ever populated by
  `AuthService`'s login events; every other module's call (documents,
  expenses, performance, announcements, resignation, payroll, admin, …)
  passes `actorUserId` + `actorEmail` only, since `AuthContext` itself
  carries no name and threading one through every service's audit call
  wasn't worth the touch count for a display concern. `getLogs()` instead
  joins `actorUserId` → `Employee` per batch and falls back through
  write-time `actorName` → `actorEmail` → `'Unknown'` (an unrecognized
  login attempt has no user to join against at all) — this fixes the
  display gap without changing any write path.
- **`ipAddress` is populated only on login rows.** The mock's fixture
  shows IPs on non-login actions too ("Role changed", "Company settings
  updated"), but unlike the actor-name gap, this genuinely can't be fixed
  at read time — `AuthContext` doesn't carry the request IP into every
  service, so there's nothing stored to join against for non-login rows.
  Threading it through the guard and 17 call sites is a bigger change than
  this module warrants on its own; left as a known, empty column rather
  than fabricated.
- **`status` (`SUCCESS`/`FAILED`) is derived from `eventType`, not stored**
  — `LOGIN_FAILED` is the only event type that represents a failure by
  definition; every other type is only ever logged after its action
  already succeeded. That's an invariant nothing enforces, though: a
  future module that logs before confirming its write would silently
  read as `SUCCESS` here.
- **Fixed: `audit:view` no longer transitively exposes compensation
  data.** `reviseSalary`'s audit entry used to embed the amount verbatim
  in `description` ("Revised salary to 60000, effective 2026-09-01") —
  readable by anyone with `audit:view` via `GET /audit/logs`, a permission
  never scoped to payroll. The amount now goes in `metadata`
  (`{ newAmount, previousAmount, effectiveDate }`), a field `getLogs()`
  never selects into its response; `description` is now
  `"Revised salary, effective 2026-09-01"`. `generatePayslip`'s and
  `markPayslipPaid`'s descriptions were already amount-free (payslip
  number and period only), so no change was needed there. This is a
  data-minimization fix, not a permission-based redaction layer — no new
  plumbing of the actor's permissions into `AuditService`, just not
  writing the sensitive figure into the field a broad-access endpoint
  reads.
- The mock's `action`/`target` two-column split isn't reproduced —
  `description` already reads as a full sentence for every module's
  events and splitting it back into pseudo-fields would mean guessing at
  a delimiter that was never real structure. The response instead returns
  the schema's real fields (`eventType`, `description`, `targetType`,
  `targetId`); the frontend's column mapping is left to the eventual
  wiring pass, not invented here.
- 4 unit tests + 2 e2e tests, including one that fires a failed login, two
  successful ones, and asserts both the resolved name and the derived
  status through a real HTTP round trip. Still nothing against real
  MySQL.

**Modules 12/13 (Assets, Complaints) remain the two skipped modules** —
deferred by explicit user decision (2026-09-05), not built. Every other
module in the 01–18 order is done: 16 of 18 shipped, 2 deliberately
deferred pending real UX/schema, none silently skipped.

**Frontend auth wiring (2026-09-05) — real login replaces the "preview as"
switcher:**
- `RoleProvider`/`role-context.tsx` is gone, replaced by
  `apps/web/src/lib/auth-context.tsx` (`AuthProvider`, `useAuth`,
  `useAuthenticatedUser`) and a new `apps/web/src/lib/api-client.ts`. The
  login page now calls the real `POST /auth/login` + `GET /auth/me`; the
  role a user sees is whatever the backend actually grants them, not a
  menu selection — the "Preview as" role switcher in `user-menu.tsx` and
  the role `<Select>` on the login form are both removed, since with real
  authorization behind every endpoint they'd be actively misleading, not
  just dead UI. Logout calls the real `POST /auth/logout`.
- **Tokens live in `localStorage`** (`hrm-v2:access-token`/`-refresh-token`)
  — the backend returns both in the login response body with no cookie
  support, and adding one would be a bigger backend change than this task
  warranted. Accepted XSS tradeoff of that storage choice, not
  reconsidered here.
- **`api-client.ts` dedupes concurrent token refreshes.** The backend
  rotates and revokes the refresh token on every use
  (`AuthService.refresh`), so if several requests hit a 401 at the same
  moment, each independently calling `/auth/refresh` would have only the
  first succeed — the rest would present an already-revoked token and get
  logged out. Concurrent callers instead await one shared in-flight
  refresh promise.
- **Route protection is a client-side guard in `AppShell`**, not Next.js
  middleware — middleware can't read `localStorage`, and there's no
  cookie to read instead. It gates on three states: hydrating a stored
  token (`isLoading`, renders a spinner — must not bounce an authenticated
  user to `/login` on a hard refresh before this resolves), no user after
  loading (redirects), user present (renders the real shell). Components
  inside the protected tree read identity via `useAuthenticatedUser()`,
  which throws rather than returning a possibly-null user — a wiring
  mistake fails loudly instead of rendering `undefined` into a name field.
- **Backend additions**: `app.enableCors()` in `main.ts`, restricted to a
  single explicit origin from a new `WEB_ORIGIN` env var (default
  `http://localhost:3000`) — not a wildcard or a reflected Origin header,
  which would be the kind of default that survives into production on a
  system with `payroll:manage` endpoints. `AuthService.me()`'s employee
  select now includes `designation` (`/my-day` already rendered it; the
  mock's `user.designation` had nothing backing it before).
- **Verified live in a browser**, first against local dev only (CORS
  preflight, error rendering, signed-out redirect — MySQL not connected
  yet at that point), then **fully end-to-end after deployment
  (2026-09-05)**: a real successful login on `hrm.1solutions.biz` as
  `atul@1solutions.biz`, landing on `/dashboard` with "Signed in as
  atul@1solutions.biz" and the real last-login timestamp — the one thing
  the original note above said wasn't verified is now confirmed working
  against real production data.
- `mockLogin` deleted from `mock-api.ts` (dead code — nothing else in
  that file changed).

## Not started

- ○ Frontend wiring for Performance, Announcements, Notifications, Settings,
  Onboarding, Resignations, Payroll reports — everything else (see
  "Frontend ↔ API wiring" above, including Dashboard as of 2026-09-06) is
  wired.
- ○ Assets and Complaints backend modules (12/13) — Assets now has a schema
  and passive read access via Employees; neither has real CRUD endpoints.
- ○ `hrm_attandance_machine_detail` import (the Sep–Dec 2024 bulk, predating
  `newuser_attendance` which **is** now imported — see Data migration) —
  still blocked on name-based employee-id ambiguity, needs manual
  disambiguation first, not a "hasn't gotten to it" gap.
- ○ Real file storage for documents/receipts/payslip PDFs — no provider
  wired anywhere; every "file" field in the schema is a URL string with
  nothing populating it from a real upload yet. Employee photos are no
  longer part of this gap (self-hosted as static files under `apps/web/
  public/avatars/`, see "Employee profile photos" in Data migration) — that
  worked because it's a small, fixed set of 35 images touched once, not
  ongoing user uploads. Documents/receipts are actual user uploads that
  grow over time and still need a real provider (S3/R2/etc.) — checking
  those into git the same way would not scale.
- ○ Workspace integration (whatever external system(s) this needs to talk to
  — not yet scoped)
- ○ **Weekly attendance email report** (explicitly requested 2026-09-06,
  explicitly deferred by the user - "we can work on this later... but it is
  important"): every employee should receive their own Mon-Fri attendance
  for the week, emailed Saturday 8am. Needs two things neither of which
  exist yet: an outbound email provider (nothing sends email anywhere in
  this app today) and a scheduled-job mechanism (no cron/scheduler
  infrastructure exists - Hostinger Node.js Web Apps don't have a
  standing background-job runner distinct from the request-serving
  process, this needs its own decision). The data side is ready:
  `AttendanceService.getHistoryForEmployeeId` (added 2026-09-06 for the
  Team attendance per-employee search) already returns exactly a Mon-Fri
  week's rows for any employee.
