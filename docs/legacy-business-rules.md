# Legacy HRM — Business Rules

Source: `1Solutionsbiz/HRM`, commit `4825d04` (2026-06-09). Every rule below cites the file
(and line, where a single line captures it) and the table(s) it reads or writes. Rules marked
**(bug)** are things the code does, not things it was necessarily designed to do — flagged
because HRM V2 needs to decide deliberately whether to keep the behavior or fix it, rather than
inherit it silently.

## Authentication

- Login is by `email` + `password`, matched against `hrm_employee` where `status = '1'`
  (Active only — inactive/ex-employees cannot log in even with a correct password).
  Source: `loginck.php:95`. Table: `hrm_employee`.
- **Passwords are stored and compared as plaintext.** No hashing anywhere in the login,
  password-change, or password-reset paths. Source: `loginck.php:95`,
  `change-password.php:41`, `passwordgenerate.php:14,24`. Table: `hrm_employee.password`.
  (Full severity discussion in `legacy-security-audit.md`.)
- Post-login routing is by **`department_id`**, not by `hrm_employee.role`: `department_id`
  4 or 6 → `admin-dashboard.php`; everything else → `employee-dashboard.php`. Source:
  `loginck.php:193`. The `role` enum column exists and is stored in session but does not drive
  this decision.
- On every login, if `emp_id` is in `[10, 14]` (hardcoded), the system logs to
  `admin_login_logs` and emails `hr@1solutions.biz` an "Admin Login Alert." Source:
  `loginck.php:121-146`. This is an identity-based rule (two specific people), not a role-based
  one — it does not apply to any other admin/super-admin account.
- Every login writes to **three** separate log tables (`hrm_login_detail`, `hrm_login_logs`,
  and conditionally `admin_login_logs`) and fires two fire-and-forget HTTP requests to
  `hrmpulse.com` endpoints. Source: `loginck.php:148-190`. See `legacy-integrations.md`.
- Session timeout: 600 seconds (10 min) if `$_SESSION['userrole'] == 'admin'`, else **60
  seconds** for everyone else. Source: `layouts/session.php:6-10`. A 60-second inactivity
  timeout for every non-admin employee is unusually aggressive — confirm with the business
  owner whether this is intentional before carrying it into V2 (flagged **(bug)**-or-intentional,
  unresolved).
- There is no self-service password reset. `forgot-password.php` renders a form with no
  `action`, no field `name` attributes, and no backend handler — and it is gated behind
  `layouts/session.php`, meaning a logged-out user cannot even reach the page. **(bug)**. The
  only way to reset a password today is `passwordgenerate.php`, an admin-only bulk/individual
  reset tool that generates a new plaintext password and displays it back in the browser.

## Authorization / roles

- There is effectively **no page-level authorization**. Every page checked (including
  `admin-dashboard.php`, `admin-logs.php`, `companies_management.php`, `assignrole.php`,
  `salary-report-admin.php`, `passwordgenerate.php`) gates access only through
  `layouts/session.php`, which verifies "a session exists," not "this user's role permits this
  page." Any authenticated employee who knows or guesses a URL can load it. **(bug)**, full
  detail in `legacy-security-audit.md`.
- `hrm_employee.role` is a 3-value enum (`super admin`/`admin`/`user`); a second, more granular
  RBAC schema also exists (`hrm_user_roles_name`, `hrm_user_role_association`,
  `hrm_user_role_permission`, `hrm_permission`) but is not read by any page-gating logic found
  in this audit — it appears to be either unfinished or vestigial.
- `assignrole.php` (the page that changes any employee's role) hardcodes
  `$current_user_role = "super admin"` for whoever loads the page, rather than reading the
  actual logged-in user's role. **(bug)**, critical — see security doc.

## Employee lifecycle

- **Status model**: `hrm_employee.status` is `1`=Active, `2`=Inactive, `3`=Ex-Employee (column
  comment). A separate `archive_status` flag (0/1) also exists on the same table and is used
  independently in several counts (e.g. `admin-dashboard.php` counts active employees by
  `archive_status = 0`, not by `status`). Two overlapping "is this employee current" signals
  exist on the same table with no documented relationship between them.
- **Archiving** copies a row from `hrm_employee` into the structurally-similar
  `archived_employees` table (`archived_employees.php`). Because `archived_employees` is not
  FK-linked to anything (no FK constraints on it in the schema), and other tables' `emp_id`
  columns still reference the original `hrm_employee.id`, archiving does not cascade — an
  archived employee's attendance, leave, expense, and payroll history remains attached to an
  `hrm_employee.id` that may or may not still exist depending on whether the original row is
  also deleted. Confirm the exact delete-vs-copy behavior in `archived_employees.php` before
  reproducing this in V2.
- Onboarding and offboarding (notice period) both use the same pattern: a shared ordered
  "steps" table (`onboarding_steps` / `notice_period_steps`, with `step_order`) plus a
  per-employee completion/status join table plus a per-step file-attachment table. This is a
  clean, reusable design — worth keeping conceptually even if the specific tables are rebuilt.

## Attendance

- The authoritative live attendance table is `newuser_attendance` (clock-in/out with IP
  captured on both), not the older `hrm_attandance_machine_detail` wide table — the latter is a
  bulk-import target for biometric machine exports, reconciled separately.
- Attendance status classification (on-time / late / half-day, `status_color`) happens against
  a **single global config row**, `office_timing` (id=1) — there is one set of grace periods
  and thresholds for the entire company, not per-department, per-shift, or per-employee-type.
  Source: `calculate-salary.php:320-330`. Table: `office_timing`.
- "Late" attendance is bucketed into two severities using `status_color`: `orange` = normal
  late (fined at `office_timing.normal_fine` per occurrence), `red` = extra-late
  (fined at `office_timing.extra_fine` per occurrence). Source: `calculate-salary.php:288-296`.
- A **relaxation window** exists: the first N late arrivals in a month (driven by
  `office_timing.relaxation_late`) are compared against a running count from the start of the
  month before extra-late fines apply — the code computes a separate "starting" late count via
  a windowed subquery (`LIMIT 3` on recent attendance) before diffing against the full-month
  count. Source: `calculate-salary.php:240-296`. This logic is intricate enough that it should
  be re-derived from a working spec/interview with HR rather than reverse-engineered purely
  from code — flagged for explicit confirmation.
- Morning/evening automated reminder emails are skipped on Saturday and Sunday, hardcoded by
  `date('N')`. Source: `morning_reminder.php:6-11`, `evening_reminder.php:8-12`. This conflicts
  with `office_timing.saturday_option`, which suggests Saturdays are sometimes configurable as
  working days — the reminder scripts do not consult that setting. **(bug)**, needs
  reconciliation.
- Attendance-mismatch detection (missing clock-out, etc.) explicitly excludes
  `role != 'super admin'` employees. Source: `attendance-mismatch-calculate.php:9`. Table:
  `hrm_employee`, writes `mismatch_attendance`.
- The "employees absent today" query used in payroll excludes a hardcoded `emp_id = 14`.
  Source: `calculate-salary.php:618-630` (and repeated at `:980-996`). Same fragile
  identity-based exception pattern as the login-alert rule above.

## Leave

- Each `hrm_leave_type` has one global `number_of_leave` allocation — not per-employee, not
  prorated by date of joining, not tiered by employee type or tenure. Source:
  `include/function.php:521-526`. Table: `hrm_leave_type`.
- There is no leave-balance table. Remaining balance is computed on demand as
  `hrm_leave_type.number_of_leave` minus a sum of `no_of_days` from `hrm_leave_applied` for
  that employee/type (confirm exact status filter — e.g. whether Rejected/Pending leave counts
  against the balance — with HR before reproducing).
- Leave entries support a `day_type` / `half_day_type` split (half-day leave is a first-class
  concept, not a workaround).

## Expenses

- Expense status is a 3-state enum: `Pending` → `Approved`/`Rejected`, with `approved_by` and
  `approved_at` set on decision. Table: `employee_expenses`.
- Expenses can be scoped to a `company_id` (FK to `companiesexpense`), the *only* module in the
  schema where company-scoping is actually FK-enforced — but `companiesexpense` is a minimal,
  separate table from `companies`/`hrm_company` (see database inventory doc), so this scoping
  doesn't connect to whatever the "companies" concept means elsewhere in the app.

## Payroll / salary

- **Monthly salary reset + advance deduction is a cron job with no idempotency guard.**
  `cron.php` (a) resets every employee's `hrm_employee.salary` and
  `hrm_salary_management.current_salary` to `actual_salary`, then (b) for every active
  (`status = 1`) row in `hrm_advance_salary`, subtracts `monthly_deduction` from both salary
  fields and from `remaining_amount`, logging to `hrm_deduction_history`. Source: `cron.php`
  (whole file). Nothing in the script checks whether this month's deduction has already been
  applied — **if the external scheduler fires this endpoint twice in the same month (retry,
  duplicate cron entry, manual re-trigger), every active advance is double-deducted.** This is
  a genuine financial-correctness risk to carry forward deliberately fixed, not silently
  reproduced, in V2.
- Salary deduction formula (source: `calculate-salary.php:399`, function `calculateSalary`):
  ```
  deductions = (normal_late_count  × normal_fine)
             + (extra_late_count   × extra_fine)
             + (half_day_count     × half_day_fine)
             + (absent_days        × per_day_salary)
  ```
  where `half_day_fine = round(per_day_salary / 2, 2)` and `absent_days = total_days -
  present_days`.
- `hrm_employee.salary` is stored as `varchar`, not `decimal` — all arithmetic on it happens
  after implicit/explicit casting in PHP. Confirm there is no currently-live formatting
  (currency symbols, commas) stored inside that column before assuming it's a clean numeric
  string.
- Two independent salary-history mechanisms exist side by side with no FK between them:
  `hrm_salary_management` (current, FK-linked to `hrm_employee`) and `salary_managment` (note
  the different spelling — date-ranged `start`/`end`, not FK-linked). Confirm with the business
  owner which one (if either) is still authoritative before designing V2's payroll history.
- Payslip generation writes one row per employee per month/year to `salary_slip_generate`,
  capturing `leave_deduction`, `late_deduction`, `total_deduction`, and the resulting
  `new_salary` — i.e. payslips are a computed, stored snapshot, not regenerated on demand from
  raw attendance each time they're viewed.
- `Send_salary_slips_bulk.php` triggers individual sends by calling
  `http://localhost/singhaniya/HRM_Live/HRM-2026/send_salary_slip.php?...` — a **hardcoded
  localhost URL** left over from local development. Source: `Send_salary_slips_bulk.php:21`.
  As written, bulk payslip sending cannot function against the production domain
  (`hrmpulse.com`) unless this script is run from a context where "localhost" happens to
  resolve to the production box itself. Treat bulk payslip send as **likely broken in
  production** until verified otherwise.

## Assets

- An asset (`hrm_assets`) can be assigned to one employee at a time via
  `hrm_asset_assignments` (`assigned_date`, `issued_date`, `return_date`, free-text `action`
  column). Both FKs cascade on delete — deleting an employee or an asset silently deletes their
  assignment history rather than preserving it. Confirm this is acceptable before reproducing;
  most HR systems want assignment history to survive employee deletion.

## Employee of the Month / recognition

- EOM scoring combines two point sources per `eom_batch`: an attendance-derived point
  (`attandance_point`) and a peer-voting point (`emp_point`), summed into `total_points`.
  Table: `eom`, `eom_votes`. The exact attendance→point conversion formula was not traced in
  this pass (would require reading `eom.php`/`eom-nomination.php` in full) — flagged
  **UNKNOWN**, re-derive before reproducing if EOM is kept.
- `eom_details` holds a `voteing_date_end` per batch (voting deadline) and a
  `winner_announce` status defaulting to `'pending'` — winner announcement is a distinct,
  separate step from vote tallying (`eom_announced.php`, `hrm_employee_of_the_month.php`).

## Complaints / POSH

- `sexual_harassment_complaints` has **no status/workflow column** — a complaint is either
  present as a row or not; there is no built-in way to track "under investigation" vs.
  "resolved" vs. "closed" in the schema itself. If any such workflow exists today, it must live
  entirely in admin-side manual process (email, offline tracking), not in this table. This is a
  compliance-relevant gap worth raising explicitly with HR/legal before V2 design, not silently
  papering over.
- General IT/HR tickets (`tickets`) do have a full status workflow (`Open` → `In Progress` →
  `Resolved`/`Closed`/`Reopened`) plus a post-resolution `Rating` field — a materially more
  mature workflow than the POSH complaint table sitting right next to it in the same schema.

## Resignation / notice period

- A resignation (`employee_resignations`) has `notice_period_days` set at submission time and a
  `Pending`/`Approved`/`Declined` status; every status change is logged to
  `resignation_history` with `changed_by` and `changed_at` — this module has a real audit trail,
  unlike POSH complaints.
- Notice-period offboarding uses the same ordered-steps pattern as onboarding (see Employee
  Lifecycle above), letting HR track e.g. asset return, knowledge transfer, exit interview as
  discrete, ordered, file-attachable steps.

## Notifications / announcements

- `announcement.show_to` is a free-text column (not a normalized audience table) — audience
  targeting logic (all employees? a department? specific people?) lives entirely in whatever
  string format the admin UI writes there. Needs to be read from `announcement.php` directly if
  audience-targeting rules must be reproduced precisely — flagged **UNKNOWN**, not traced in
  this pass.
- Announcements have a display window (`display_form_date/time` → `display_end_date/time`),
  meaning they are scheduled content, not just an append-only feed.

## Cross-cutting rules worth naming once

- **Identity-based hardcoding recurs across unrelated modules**: login-alert emails
  (`emp_id` in `[10, 14]`), payroll absentee exclusion (`emp_id = 14`), and attendance-mismatch
  exclusion (`role != 'super admin'`) each encode "who is special" a different way (explicit ID
  list, explicit single ID, role check). None of these are configurable from the admin UI seen
  in this audit. V2 should replace all three with one consistent, admin-configurable mechanism
  (e.g. a real permission/flag), not carry forward per-module hardcoded exceptions.
- **"Global, single-row config" is the dominant pattern for tunable business rules**
  (`office_timing` id=1 for attendance/payroll fines, `cron-setting.php` — itself
  non-functional — for cron config). There is no evidence of per-department or per-company
  variation actually being honored anywhere despite the `companies`/`hrm_company` tables
  existing. Confirm with the business owner whether per-entity variation is a real V2
  requirement or whether a single global config (simpler) is genuinely sufficient.
