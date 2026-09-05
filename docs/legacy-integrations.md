# Legacy HRM — External Integrations, Cron, Email, File Uploads

Source: `1Solutionsbiz/HRM`, commit `4825d04` (2026-06-09).

## External API calls

| Call | Where | Purpose | Notes |
|---|---|---|---|
| `http://ip-api.com/json/{ip}` | `loginck.php:60` | Geo-IP lookup (city/region/country/ISP) for every login, stored in `hrm_login_logs` | Unauthenticated third-party HTTP API, called synchronously on every login (no caching, no timeout visible), response fields interpolated into a raw SQL `INSERT` without escaping — see `legacy-security-audit.md` |
| `https://hrmpulse.com/notifications/hrm-login-alert.php` and `https://hrmpulse.com/attendance-mismatch-calculate.php` | `loginck.php:163-188` | The app calling **itself** over HTTP, fired via `curl_multi_*` on every login | Architectural pattern: "background work" is done by having the app make an outbound HTTP request back to its own production domain rather than an internal function call or a real queue. Repeated elsewhere (see below). 3-second timeout, fire-and-forget (response ignored). |
| `https://hrmpulse.com/attendance-mismatch-calculate.php` and `...-check.php` | `attandance-all-employee.php:4-5` | Same self-call pattern, triggered on page load of the admin attendance page | `@file_get_contents`, errors suppressed |
| `http://localhost/singhaniya/HRM_Live/HRM-2026/send_salary_slip.php` | `Send_salary_slips_bulk.php:21` | Per-employee payslip send, called in a loop | Hardcoded to `localhost` — a leftover dev path (`singhaniya` looks like a developer/contractor's local folder name). Will not reach the real send endpoint in production. See business rules doc. |
| Groq LLM API (`https://api.groq.com/...`, inferred from `GROQ_API_KEY`) | `current_affair/auto_quiz_update.php:54,81` | Auto-generates quiz questions for the "current affairs" employee quiz feature | **API key is hardcoded in the file, in plaintext, committed to source control** (the repo is
private, but the key is still exposed to anyone with repo access) — see security doc. This is the only AI/LLM integration found in the legacy app. |
| `simple_html_dom` (bundled scraper library, `web/`) | Not confirmed wired to a live call in this pass | Present in the repo (with examples/manual bundled) alongside the quiz feature | Likely used by, or intended for, `current_affair/auto_quiz_update.php` to scrape source content for quiz questions, but the scraping call itself wasn't traced to a specific URL in this pass — flagged **UNKNOWN**, re-check `current_affair/auto_quiz_update.php` in full if the quiz feature is kept. |

No payment gateway, SMS gateway, calendar sync, biometric-device live API, or single-sign-on
integration was found anywhere in this codebase. "Attendance machine" data enters the system as
a **file upload** (`upload-attandance.php`, `upload-attendance-admin.php`), not a live device
API — the biometric hardware is not directly integrated.

## Cron / scheduled jobs

There is no crontab, Task Scheduler config, or GitHub Actions workflow in this repository — every
"cron job" is a plain PHP file meant to be hit by an external scheduler over HTTP (or invoked via
CLI on the host; both are possible given the code, but only the HTTP self-call pattern above is
directly evidenced). This matches the pattern already documented for the 1Solutions CRM project
(external scheduler such as cron-job.org hitting a URL) — treat as the working hypothesis for how
these are actually triggered in production, not confirmed from this repo alone.

| Script | Purpose | Idempotent? |
|---|---|---|
| `cron.php` | Monthly salary reset + advance-salary deduction | **No** — see business rules doc, this is a real financial risk if double-triggered |
| `ticket-cron.php` | Emails on open/in-progress/reopened tickets | Not verified |
| `ticket-cron-month.php` | Monthly ticket digest (last calendar month) | Not verified |
| `morning_reminder.php` / `evening_reminder.php` | Daily attendance reminder emails, Mon–Fri only (hardcoded via `date('N')`) | Sends each run; no per-day dedupe check found |
| `attendance-mismatch-calculate.php` / `-check.php` | Detects and expires attendance mismatches (missing clock-out etc.) | Partially — `-check.php` comments describe a status lifecycle (1=Active, 2=Expired, 3=Resolved) suggesting some idempotency was intended, not fully traced |
| `send_attendance_emails.php` | Weekly attendance summary (previous Mon–Sun) | Not verified |
| `notifications/daily_attendance.php`, `notifications/monthly-attendance-report.php` | Daily / monthly attendance report emails | Not verified |
| `current_affair/auto_quiz_update.php` | Generates new quiz questions via the Groq API | Not verified |

`cron-setting.php` is an admin-facing settings page ("Cron Key", "Auto Backup Database" toggle)
but its `<form>` has no `action` and its inputs are not wired to any backend handler — it is a
non-functional UI stub, not a real configuration surface. There is no evidence in this repo of
where the actual schedule (URLs + timing) is configured; it is external to the codebase.

## Email

All outbound email goes through **PHPMailer over SMTP**, via a `send_email()` helper
(`email/mailer.php`) and several near-duplicate inline copies of the same PHPMailer setup
(`notifications/mail.php`, `notifications/hrm-login-alert.php`,
`notifications/daily_attendance.php`, `notifications/monthly-attendance-report.php`,
`certificate/emp-of-the-month_send.php`, `send_notifications.php`, `email/send-salary-slip.php`).

**SMTP credentials are hardcoded in plaintext and repeated across at least 9 files**:
host `expetize.com`, username `hr@expetize.com`, password present in source. This is covered as
a critical finding in `legacy-security-audit.md` — flagging here only as the integration fact:
there is effectively **one shared SMTP account for all system email**, configured nowhere
centrally (each file redeclares it), so rotating the password requires editing 9+ files.

`layouts/config.php` separately declares empty `$gmailid` / `$gmailpassword` / `$gmailusername`
variables that are not populated and do not appear to be used by the PHPMailer setup above —
likely a dead/abandoned alternate email path.

Email is used for: admin login alerts, daily/weekly/monthly attendance summaries and reminders,
salary slip delivery, ticket notifications, Employee-of-the-Month announcements, and general
notifications (`send_notifications.php`). No transactional email provider (SES, SendGrid,
Postmark, etc.) is used — direct SMTP only.

## File uploads

| Upload | Handler | Validation found | Auth check found |
|---|---|---|---|
| Employee documents (Aadhaar, PAN, 10th/12th certs, bank docs) | `upload_document.php` | Extension whitelist (`pdf`/`jpg`/`jpeg`/`png`) checked against the **client-supplied filename** only, no MIME/content sniffing; upload directory created with `mkdir(..., 0777, true)` | **None** — no session/auth check in this file at all; `emp_id` is taken directly from `$_POST` with no verification the caller is that employee or an admin |
| Profile photo | `profile-image-upload.php` | **None** — no extension or content-type check of any kind; original filename (minus spaces) is preserved | **None** — no session/auth check; `emp_id_for_image` taken directly from `$_POST` |
| Attendance machine export | `upload-attandance.php`, `upload-attendance-admin.php` | Not traced in this pass | Not traced in this pass |
| Expense receipts | via `manage_expenses.php` / `add-expense.php` (`employee_expenses.receipt_path`) | Not traced in this pass | Not traced in this pass |
| Company documents / policies | `company_data`, `company_policies` tables — admin-side upload, handler not isolated in this pass | Not traced | Not traced |

The two handlers actually read in full (`upload_document.php`, `profile-image-upload.php`) have
no authentication check whatsoever — this is elevated from "file upload hygiene" to a critical
access-control finding; full detail in `legacy-security-audit.md`.

Uploaded files are served from plain, predictable, web-accessible paths under `upload-image/`
and `uploads/documents/` inside the web root, with no access control on retrieval either — if
you know or guess a filename, you can fetch it directly.

## Third-party dependencies

**Composer** (`composer.json` — note this file only declares one dependency; `vendor/` actually
contains more, meaning `composer.json` is stale relative to what's installed):
- `phpmailer/phpmailer ^6.9` (declared) — SMTP email
- Present in `vendor/` but **not** declared in `composer.json`: `dompdf/dompdf` (PDF
  generation — almost certainly payslip/certificate PDFs), `dompdf/php-font-lib`,
  `dompdf/php-svg-lib`, `masterminds/html5`, `sabberworm/php-css-parser` (dompdf's own
  dependencies), `thecodingmachine/safe` (a "throws exceptions instead of silently failing"
  wrapper library for core PHP functions — present but not obviously used given how much of the
  codebase still checks `mysqli_query(...) or die(...)` manually)

**npm** (`package.json` — frontend assets, not a build pipeline; no bundler config found):
- `bootstrap ^5.3.2` — UI framework (the entire admin theme)
- `@fortawesome/fontawesome-free ^6.5.1` — icons
- `apexcharts ^3.44.2`, `chart.js ^4.4.1` — two separate charting libraries used side by side
- `clipboard ^2.0.11` — copy-to-clipboard utility

**Vendored (not via a package manager, committed directly into the repo)**:
- `web/` — the `simple_html_dom` PHP HTML-parsing/scraping library, including its full manual,
  changelog, and examples (i.e. the entire upstream repo appears to have been copied in wholesale
  rather than installed as a dependency)
- `src/SimpleXLSX.php`, `src/SimpleXLSXEx.php` — Excel (`.xlsx`) read/write, almost certainly for
  bulk attendance-machine import/export and/or employee bulk import
- `phpmailer/` at the repo root **and** `notifications/PHPMailer/` — a second, separate copy of
  PHPMailer vendored directly under `notifications/`, distinct from the Composer-managed one in
  `vendor/phpmailer/`. Three different PHPMailer install paths exist in this repo simultaneously
  (root `phpmailer/`, `notifications/PHPMailer/`, `vendor/phpmailer/`) — confirm which one(s) are
  actually loaded by which scripts if PHPMailer version/behavior ever matters; do not assume
  they're kept in sync.
- `scssphp/` — a vendored SCSS compiler
