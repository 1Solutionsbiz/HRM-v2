# Legacy HRM — System Audit

**Scope**: read-only audit of `1Solutionsbiz/HRM` (cloned locally to
`../HRM-legacy-readonly`, never pushed to, never modified) and a light check of the public
surface of `https://hrmpulse.com/`. No production database was accessed or connected to.
Commit audited: `4825d04` (2026-06-09 12:11 IST).

**Companion documents** (this file cross-references all of them rather than repeating their
content):
- `legacy-business-rules.md` — every business rule found, with source file + table citations
- `legacy-database-inventory.md` — all 85 tables, grouped by domain, with relationships
- `legacy-integrations.md` — external APIs, cron jobs, email, file uploads, third-party deps
- `legacy-security-audit.md` — security findings by severity (four are **active incidents**,
  already flagged to the business owner separately from this document)
- `legacy-pwa-audit.md` — confirms there is no PWA/mobile-specific functionality to migrate

**A note on how to read this audit**: authorization in the legacy system is effectively
decorative (see security doc) — almost any logged-in user can reach almost any page. That means
"this is what the code does" and "this is the intended business process" are not the same claim
here. Treat everything in this audit as a description of *current behavior*, not as
pre-validated *requirements* — several items are explicitly flagged for confirmation with the
business owner before being encoded into V2.

---

## 1. Application structure

No framework. A flat-file PHP application: ~153 top-level `.php` files (one file per
page/feature, typically mixing data access, business logic, and HTML in the same file), plus:

- `include/` — shared helpers: `db.php` (mysqli `connect()`), `function.php` (39KB grab-bag of
  ~100+ helper functions — lookups, counts, formatting), `menu.php`, `dashboard_main_body.php`,
  `notification_header.php`, plus two **dead** near-duplicates of `function.php`
  (`function1.php`, `functioncopy.php` — included nowhere, confirmed by repo-wide grep)
- `layouts/` — shared chrome: `session.php` (auth/timeout gate, included at the top of nearly
  every page), `config.php` (a second, independent DB connection + empty email config),
  `head-main.php`/`head-css.php`/`title-meta.php`/`vendor-scripts.php`/`footer.php`, and
  several alternate sidebar/menu variants (`sidebar.php`, `sidebar-1.php`,
  `components-sidebar.php`, `chat_sidebar.php`, `inbox_sidebar.php`, `task_sidebar.php`,
  `settings-sidebar.php`, `two-col-sidebar.php`)
- `emp_dashboard/` — employee-dashboard widget partials (Attendance, Calendar, Leaves, Punch
  In/Out, quiz widgets, company policy)
- `notifications/` — scheduled/triggered email scripts + a second vendored copy of PHPMailer
- `certificate/` — Employee-of-the-Month certificate generation/send (dompdf)
- `current_affair/` — the quiz-question auto-generation script (Groq API)
- `email/` — the primary `mailer.php` helper plus a few standalone send scripts
- `assets/` — Bootstrap theme, ~30 bundled jQuery plugins, SCSS source
- `vendor/`, `phpmailer/`, `scssphp/`, `web/`, `src/` — Composer output plus several
  directly-vendored (not package-manager-installed) third-party libraries; see
  `legacy-integrations.md` for the full dependency picture, including three separate PHPMailer
  copies and a stale `composer.json`
- `db/9_june.sql` — a full database dump **with production data**, committed into the repo
  (see security doc — this is the single most urgent finding in the whole audit)
- `upload-image/`, `uploads/` — user-uploaded files, committed/present in the working tree

No `.env` mechanism, no environment-based config — `include/db.php` and `layouts/config.php`
each hardcode local (`localhost`/`root`/empty password) database credentials independently, and
disagree structurally (one is a `connect()` function returning a fresh connection each call, the
other is a `$GLOBALS['con']` singleton) — two parallel DB-connection mechanisms exist in the same
codebase, used inconsistently across files (some `include`s pull in one, some the other, some
both).

## 2. Major PHP modules

Grouped by feature area (file lists are representative, not exhaustive — see the repo directly
for the full ~153-file inventory):

| Module | Representative files |
|---|---|
| Auth | `index.php`, `loginck.php`, `logout.php`, `forgot-password.php` (non-functional), `change-password.php`, `passwordgenerate.php` |
| Employee management | `employees.php`, `employees-list.php`, `edit-employees.php`, `archived_employees.php`, `onboarding.php` |
| Employee dashboard | `employee-dashboard.php`, `emp_dashboard/*` |
| Attendance | `attendance.php`, `attendance-employee.php`, `attandance-all-employee.php`, `upload-attandance.php`, `upload-attendance-admin.php`, `attendance-mismatch-*.php`, `office-timing.php`, `overtime.php`, `count-saturday-sunday.php` |
| Leave | `leaves.php`, `leaves-employee.php`, `leave-settings.php`, `delete_leave.php` |
| Expenses | `add-expense.php`, `manage_expenses.php`, `categories.php`, `category.php` |
| Payroll / payslips | `calculate-salary.php`, `calculate-salary-manually.php`, `salary-management.php`, `salary_slips.php`, `salary_template.php`, `send_salary_slip.php`, `Send_salary_slips_bulk.php`, `download_salary_slip.php`, `cron.php` |
| Documents | `upload_document.php`, `company_data.php`, `company_policies.php` |
| Assets | `assets.php`, `assets-new.php`, `assets-details.php`, `assets-category.php`, `assets-reports.php`, `hrm_assets.php`, `hrm_asset_assignments.php` |
| Announcements | `announcement.php`, `welcome_message.php` |
| Complaints | `employee_complaints.php`, `all_employee_complaints.php`, `harresment.php`, `Internal-Complaints-Committee.php`, `guidelineposh.php`, `ticket*.php` |
| Resignation | `apply_resignation.php`, `noticeperiod.php`, `noticeperiodtest.php` |
| Performance / recognition | `eom*.php`, `hrm_employee_of_the_month.php`, `current_affair/auto_quiz_update.php`, `emp_dashboard/quiz_*.php` |
| Reports | `analytics.php` (83KB), `attendance-report*.php`, `attendance-reports-admin.php`, `employee-reports.php`, `assets-reports.php`, `salary-report-admin.php` |
| Notifications | `notifications/*`, `send_notifications.php`, `save_notification.php`, `notification_header.php` |
| Admin | `admin-dashboard.php`, `admin-logs.php`, `companies_management*.php`, `manage_companies.php`, `assignrole.php` |
| Chat | `chat_page.php` + `hrm_chat_*` tables |
| Recruitment (partial) | `candidates.php` — schema/UI present, not deeply audited this pass |

`analytics.php` (83KB) is the largest reporting/logic file in the codebase. It isn't the largest
file overall, though — `employees.php` (183KB), `edit-employees.php` (169KB), and `profile.php`
(165KB) are all bigger, consistent with `hrm_employee` being a 44-column table with a dozen
satellite tables around it that those three pages have to render and edit.

## 3. Authentication

Email + plaintext-compared password against `hrm_employee`, active status required. See
`legacy-business-rules.md` (Authentication) and `legacy-security-audit.md` (Critical #4) for
full detail. Headline facts: no password hashing anywhere; no working self-service password
reset; a 60-second inactivity timeout for non-admin sessions; three log tables written and two
outbound HTTP self-calls fired on every successful login.

## 4. Authorization and roles

Two competing, mostly-unenforced role systems (`hrm_employee.role` enum vs. a 6-table RBAC
schema) and, in practice, **no page-level authorization at all** — see
`legacy-business-rules.md` (Authorization) and `legacy-security-audit.md` (Critical, broken
access control + `assignrole.php` privilege escalation). This is the single most important gap
to close deliberately in V2, not inherit.

## 5. Employee management

Single `hrm_employee` table (44 columns) as source of truth, with ~12 satellite 1:many tables
for education, family, emergency contacts, social links, work/employment history, bank details,
and documents (in fact two separate, overlapping document systems — see database inventory).
"Deletion" is really "copy to `archived_employees`," a structural near-duplicate table with no
FK links and no confirmed cascade behavior for the archived employee's history in other tables.
Full detail: `legacy-database-inventory.md` (Core identity, Employee profile detail),
`legacy-business-rules.md` (Employee lifecycle).

## 6. Employee dashboard

`employee-dashboard.php` (82KB) plus `emp_dashboard/*` widget partials: attendance summary,
calendar, leave balance, punch in/out, company policy links, quiz/badge widgets, "Events of the
Day," Employee-of-the-Month status. This is the correct reference point for V2's "employee
experience first" priority — worth a dedicated close read of this file specifically (not fully
inventoried line-by-line in this pass) before designing V2's employee dashboard.

## 7. Attendance

Live clock-in/out (`newuser_attendance`, IP-captured both directions) plus a wide, denormalized
bulk-import table for biometric machine data (`hrm_attandance_machine_detail`, 72 columns:
`date1..date31` + `date_in_out1..31`). Fine/threshold rules driven by one global config row
(`office_timing`). Full formula and rules: `legacy-business-rules.md` (Attendance).

## 8. Leave

Global per-type allocation (`hrm_leave_type.number_of_leave`), no per-employee balance table —
balance is computed on demand from applied leave. Half-day is first-class. Full detail:
`legacy-business-rules.md` (Leave).

## 9. Expenses

Standard submit → approve/reject workflow (`employee_expenses`, `Pending`/`Approved`/`Rejected`),
the *only* module with an actually FK-enforced company scoping, connected to a company table
(`companiesexpense`) distinct from the app's two other "company" tables. Full detail:
`legacy-business-rules.md` (Expenses), `legacy-database-inventory.md` (Multi-company section).

## 10. Payroll

Monthly cron-driven salary reset + advance-salary deduction with **no idempotency guard** — the
single highest-impact business-logic bug found in this audit if it's ever double-triggered. Late
arrival / half-day / absence deduction formula fully captured in
`legacy-business-rules.md` (Payroll / salary). Two parallel, non-FK-linked salary-history tables
exist (`hrm_salary_management` vs. `salary_managment`) — confirm which is authoritative before
designing V2's payroll data model.

## 11. Payslips

Generated and stored as a snapshot per employee/month (`salary_slip_generate`), rendered to PDF
via dompdf, sent by email. Bulk send is likely broken in production today — see
`legacy-integrations.md` and `legacy-business-rules.md` (the hardcoded `localhost` URL).

## 12. Documents

Two independent, overlapping document storage systems (`hrm_employee_documents` +
`hrm_employee_document_type`/`_proof` vs. the simpler fixed-column `emp_documents` table that
`upload_document.php` actually writes to), plus separate company-level document/policy tables.
Full detail: `legacy-database-inventory.md` (Documents section). Upload path has no
authentication — see security doc.

## 13. Assets

Simple assign/return tracking (`hrm_assets` + `hrm_asset_assignments`), `ON DELETE CASCADE` on
both FKs — assignment history does not survive employee or asset deletion as currently modeled.
See `legacy-business-rules.md` (Assets).

## 14. Announcements

Scheduled (display window), free-text audience targeting (`announcement.show_to` is
unstructured text, not a normalized audience table — exact targeting logic not traced in this
pass, flagged **UNKNOWN**). See `legacy-business-rules.md` (Notifications / announcements).

## 15. Complaints

Two structurally very different systems sitting side by side: general IT/HR `tickets` (full
status workflow, priority, post-resolution rating) and POSH `sexual_harassment_complaints`
(**no status/workflow column at all** — a real compliance-relevant gap, not just a technical
one). See `legacy-business-rules.md` (Complaints / POSH).

## 16. Resignation

Notice-period submission with a real audit trail (`resignation_history`) and a configurable,
ordered offboarding checklist with file attachments per step — one of the better-modeled parts
of the schema. See `legacy-business-rules.md` (Resignation / notice period).

## 17. Performance

No formal performance-review module was found (no goals/KPI/appraisal tables in the schema).
"Performance" in this codebase means the Employee-of-the-Month peer-voting + attendance-points
system and a gamified current-affairs quiz (points/badges). If a real performance-review
process exists today, it is not in this codebase — flagged **UNKNOWN**, confirm with HR whether
performance reviews happen outside this system entirely (spreadsheets, another tool) before
assuming V2 needs to build one from scratch with no legacy reference.

## 18. Reports

`analytics.php` (83KB, largest single logic file in the app) plus dedicated attendance, salary,
and asset report pages. Not deeply reverse-engineered in this pass beyond confirming its
existence and scale — recommend a dedicated follow-up read of `analytics.php` before designing
V2's reporting module, since it's likely where the most business-specific reporting logic (and
the most deeply nested SQL) lives.

## 19. Notifications

In-app, database-backed only (`hrm_notification`) — no push notifications, no service worker to
receive them (see PWA audit). Email is the only "push" channel that reaches employees outside
the app.

## 20. Admin functionality

`admin-dashboard.php` (ticket counts, employee counts), `admin-logs.php`, company
management (`companies_management*.php`, `manage_companies.php`), and role assignment
(`assignrole.php` — critically broken, see security doc). No admin page found in this audit
enforces that its visitor is actually an admin.

## 21. Audit and login logs

Three separate login-log tables (`hrm_login_detail`, `hrm_login_logs`, `admin_login_logs`) with
overlapping but not identical purposes — `admin_login_logs` only fires for two hardcoded
employee IDs. Login logs include third-party geo-IP data. Separately, `device_info` captures a
full client-side device fingerprint on login whose purpose was not confirmed (flagged
**UNKNOWN** in the PWA audit). There is no general application audit log (who changed what) —
the only per-domain audit trails found are `resignation_history` and
`hrm_attandance_machine_update_detail` (manual attendance correction log); most tables (salary,
roles, employee records) have no change history at all.

## 22. Cron jobs

No crontab in-repo; every scheduled task is a plain PHP file meant to be hit by an external
scheduler over HTTP. Full inventory and idempotency assessment: `legacy-integrations.md`
(Cron / scheduled jobs).

## 23. External API calls

Geo-IP lookup on every login (`ip-api.com`), the app calling its own production domain over
HTTP for "background" work (a recurring architectural pattern, not a one-off), a hardcoded
`localhost` URL in the bulk payslip sender (likely broken), and a hardcoded Groq LLM API key for
quiz-question generation. Full table: `legacy-integrations.md`.

## 24. Email functionality

PHPMailer over SMTP, one shared hardcoded account reused across 9+ files, no transactional email
provider. Full detail: `legacy-integrations.md` (Email), `legacy-security-audit.md`
(Critical #2).

## 25. File uploads

Employee documents and profile photos upload with **no authentication check** and, for profile
photos, **no file-type validation** — the two most concrete high-severity findings in this
audit's file-upload coverage. Full table and detail: `legacy-integrations.md` (File uploads),
`legacy-security-audit.md` (Critical).

## 26. PWA / mobile functionality

None exists — no manifest, no service worker, no PWA meta tags, responsive Bootstrap only.
Full writeup: `legacy-pwa-audit.md`.

## 27. Database tables and relationships

85 tables, only 24 FK constraints — most relationships are naming-convention-only, not
enforced. Full inventory grouped by domain: `legacy-database-inventory.md`.

## 28. Important business rules

Fully captured, with source file + table citations, in `legacy-business-rules.md`. Highlights:
non-idempotent monthly payroll cron, single global attendance-fine config, identity-hardcoded
exceptions scattered across unrelated modules (login alerts, payroll absentee exclusion,
attendance-mismatch exclusion), and an unresolved multi-company schema that most modules don't
actually honor.

## 29. Security weaknesses

Full severity-ranked writeup in `legacy-security-audit.md`. Three findings — a committed
production DB dump with plaintext passwords and PII, hardcoded SMTP credentials repeated across
9+ files, and a hardcoded LLM API key — were surfaced to the business owner separately from this
document; the repository is confirmed **private**, so these are cleanup/rotation items rather
than a live public exposure, but they're still worth acting on since anyone with repo access
(current and past) can read them. Separately, and regardless of repo visibility, the running
application itself stores and displays every employee's password in plaintext today.
Architecturally, the most important finding to design around in V2 is that **authorization is
effectively decorative** in the legacy system —
every "this role can't do that" boundary needs to be built for real, not assumed from legacy
behavior.

## 30. Hardcoded configuration

Two independent, hardcoded (non-environment-based) DB connection mechanisms
(`include/db.php`, `layouts/config.php`); hardcoded SMTP credentials repeated 9+ times; a
hardcoded LLM API key; hardcoded employee IDs used as ad hoc permission checks in at least three
unrelated modules; a hardcoded `localhost` URL in a production send path; a non-functional
"Cron Settings" admin page whose form isn't wired to anything. See `legacy-integrations.md` and
`legacy-business-rules.md` (Cross-cutting rules) for the full list with citations.

## 31. Third-party dependencies

Composer: PHPMailer (declared) + dompdf and its dependents (installed but **undeclared** —
`composer.json` is stale relative to `vendor/`). npm: Bootstrap 5, Font Awesome, two separate
charting libraries (ApexCharts and Chart.js) used side by side, Clipboard.js. Vendored directly
(not via a package manager): `simple_html_dom` (full upstream repo copied in, including its
manual/changelog), SimpleXLSX, a second and third copy of PHPMailer, a vendored SCSS compiler.
Full detail: `legacy-integrations.md` (Third-party dependencies).

---

## KEEP / TRANSFORM / REPLACE / REMOVE / UNKNOWN

This is a judgment call on *concepts and business capability*, not a literal code-porting plan —
V2 is a ground-up rebuild per the project rules, so nothing here means "copy this file." It means
"this capability, as understood from the legacy system, should exist / should exist but change /
should be rebuilt fundamentally differently / should not exist / needs more input before we can
decide."

**KEEP** (the underlying business capability is sound; V2 should reproduce the *intent*, rebuilt
securely and cleanly)
- Employee master record + satellite profile data (education, family, emergency contact, bank
  details, work history) as one identity with related detail tables
- Attendance clock-in/out with configurable late/half-day/absence classification
- Leave application with half-day support
- Expense submission → approve/reject workflow
- Payroll calculation from attendance (late/absence deductions) + advance salary deductions
- Payslip generation, storage, and PDF delivery
- Asset assignment tracking
- Onboarding and notice-period offboarding as configurable, ordered, file-attachable checklists
  (this is genuinely well-modeled in the legacy schema)
- IT/HR ticket system with status workflow and post-resolution rating
- Announcements with a scheduled display window
- Company holiday calendar

**TRANSFORM** (keep the goal, change the mechanism significantly)
- Authentication and password storage — same goal (email/password login) but with real hashing,
  real session security, and a working self-service reset flow
- Authorization — same goal (admin vs. employee vs. HR capability boundaries) but enforced
  server-side on every request, replacing both legacy role systems with one real RBAC model
- Monthly payroll processing — same goal, made idempotent and auditable
- Login/audit logging — same goal (who logged in when, from where) but consolidated into one
  coherent audit trail instead of three overlapping tables plus ad hoc per-module logs
- Multi-company / multi-entity support — the *intent* (companies, expense scoping) is worth
  keeping if it's a real V2 requirement, but the mechanism needs to be decided fresh and applied
  consistently (see UNKNOWN below) rather than reproducing three disconnected "company" tables
- File uploads (documents, profile photos, receipts) — same goal, with real authentication,
  content validation, and access-controlled retrieval
- Cron-triggered background jobs — same goal, but as properly scheduled, idempotent jobs (see
  this project's own cron architecture pattern — external scheduler hitting an endpoint is fine
  as a mechanism; the jobs themselves need idempotency and auth on the endpoint)
- POSH / sexual-harassment complaint intake — same goal, but with an actual status/workflow
  model, since this is a compliance-sensitive process that currently has none

**REPLACE** (the legacy approach should not be the reference design at all)
- Password reset — legacy has no working self-service flow; build one for real
- Device fingerprinting on login (`device_info`) — pending the UNKNOWN below, but if kept, its
  purpose and scope should be deliberately (re)designed, not copied
- The "app calls its own production URL over HTTP for background work" pattern — use a real
  internal mechanism (function call, queue, or job runner) instead

**REMOVE** (do not carry forward)
- Committing database dumps or any credentials into source control
- Displaying any credential in an admin UI, ever
- Dead code (`include/function1.php`, `include/functioncopy.php`, the non-functional
  `cron-setting.php` UI, the non-functional `forgot-password.php` form)
- Duplicate/competing mechanisms that exist for no evident reason: two DB-connection
  singletons, three PHPMailer installs, two overlapping employee-document systems, two
  non-FK-linked salary-history tables

**UNKNOWN** (needs input from the business owner / HR before V2 can design around it)
- Whether multi-company/multi-entity support is a real current or near-term requirement, or
  whether a single-tenant design is genuinely sufficient (the legacy schema gestures at
  multi-tenancy in three different, disconnected ways but almost no module actually honors it)
- The exact attendance late/half-day relaxation-window formula
  (`calculate-salary.php:240-296`) — intricate enough that it should be confirmed against HR's
  actual policy, not solely reverse-engineered from code
- Whether a formal performance-review process exists outside this codebase (no such module was
  found in the schema)
- The intended audience-targeting model for announcements (currently free text)
- What `device_info` (full client device fingerprinting on every login) was actually used for,
  and whether V2 needs an equivalent
- Whether Employee-of-the-Month / quiz / badge gamification is a feature worth continuing, and
  if so, its exact point-scoring formula (only partially traced in this pass)
- The precise archive/delete semantics for `archived_employees` and what should happen to an
  archived employee's attendance/leave/payroll/asset history (cascade? retain? anonymize?)
