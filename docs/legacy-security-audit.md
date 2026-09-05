# Legacy HRM — Security Audit

Source: `1Solutionsbiz/HRM`, commit `4825d04` (2026-06-09). Read-only, static-code audit — no
production system, database, or live credentials were accessed as part of this work. Severity
is rated by plausible impact given what the code does, not by confirmed exploitation.

**No plaintext credentials or PII from this repo are reproduced in this document.** Every
finding cites a file (and line, where a single line captures it) so it can be verified directly
against the source.

## Critical — needs action independent of the HRM V2 project

**Repository visibility, checked properly**: `1Solutionsbiz/HRM` is **private** — confirmed via
an anonymous (credential-helper-stripped) `git ls-remote` (fails, asks for a username) and the
raw HTTP git endpoint (`.../info/refs?service=git-upload-pack` returns `401`). An earlier check
in this audit incorrectly reported the repo as publicly cloneable; that check unknowingly relied
on a cached local credential and was wrong. This is corrected here — the findings below are
"secrets and PII committed to source control," not "live public exposure."

These three were raised to the business owner during this audit and should be treated as
findings needing cleanup, not backlog items — the risk is anyone with repo access (current
and former collaborators, anyone who has ever cloned it, anyone who gains access later) rather
than the general public, but plaintext passwords and live-looking credentials sitting in git
history are worth acting on regardless:

### 1. A full production database dump with plaintext passwords and employee PII is committed to the repo
`db/9_june.sql` (2.7MB) is committed directly into the repo and contains real employee records —
names, emails, phone numbers, home addresses, DOB, salary, blood group, religion — and the
`hrm_employee.password` column holds actual, working plaintext password values.

### 2. SMTP credentials are hardcoded and repeated across 9+ files
Host, username, and password for the account that sends all system email are hardcoded in
plaintext in `email/mailer.php`, `notifications/mail.php`, `notifications/hrm-login-alert.php`,
`notifications/daily_attendance.php`, `notifications/monthly-attendance-report.php`,
`certificate/emp-of-the-month_send.php`, `send_notifications.php`, `email/send-salary-slip.php`,
`send_salary_slip.php`.

### 3. A live-looking third-party API key is hardcoded in plaintext
`current_affair/auto_quiz_update.php:54` defines `GROQ_API_KEY` as a literal string in source.

### Related, not repo-exposure: passwords are stored — and displayed — in plaintext everywhere
Not just at rest in the DB: `loginck.php:106` copies the plaintext password into
`$_SESSION["password"]`, and `passwordgenerate.php:165` renders **every employee's actual
current password** into the admin "reset password" page's HTML (`<input type="password"
value="<?= htmlspecialchars($row['password']) ?>">` — `type="password"` only masks it visually;
the real value is in the page source sent to the browser). There is no hashing anywhere in the
codebase for employee credentials. This is a live-application weakness independent of repo
visibility — anyone with legitimate admin access to the running app can already see every
employee's password today.

**Recommended action** (independent of V2, on the business owner's own timeline): scrub the
dump and hardcoded secrets from the repo (content and git history — deleting the file in a new
commit is not sufficient, history still holds it), rotate the SMTP password, rotate/revoke the
Groq API key, review who currently has access to the repo, and force-reset every employee's
password once V2 (or a fixed legacy build) has real password hashing.

## Critical — architectural, will recur if copied into V2

### Broken access control (no page-level authorization)
Every admin-only page sampled in this audit (`admin-dashboard.php`, `admin-logs.php`,
`companies_management.php`, `salary-report-admin.php`, `passwordgenerate.php`, `assignrole.php`)
gates access through `layouts/session.php` alone, which only checks "is a session logged in" —
never the user's role or department. Any authenticated employee, including the lowest-privilege
account, can load any of these pages directly by URL. There is no server-side concept of "this
page requires admin" anywhere in the pages checked.

### Full privilege escalation via `assignrole.php`
The page that changes any employee's `role` to `super admin` hardcodes
`$current_user_role = "super admin";` (`assignrole.php:7`) for **whoever requests the page** —
it does not read the actual logged-in user's role from session or database before honoring a
role-change POST. Any authenticated employee can grant themselves (or anyone) super admin.
Combined with the broken access control above, this is a complete authorization bypass.

### Unauthenticated, unauthorized file upload (2 endpoints)
`upload_document.php` and `profile-image-upload.php` perform no session/authentication check at
all — neither even includes `layouts/session.php`. Both accept an arbitrary `emp_id` from
`$_POST` with no check that it matches the caller. `upload_document.php` at least whitelists
extensions by filename (`pdf`/`jpg`/`jpeg`/`png`); `profile-image-upload.php` performs **no**
file-type validation whatsoever and preserves the uploaded filename (minus spaces), saving it
directly into a web-accessible directory. Practical impact: an unauthenticated caller can (a)
overwrite any employee's identity documents (Aadhaar/PAN/bank docs) by supplying their `emp_id`,
and (b) upload an arbitrary file — including a server-executable script, if the upload directory
allows PHP execution — with no login required.

### SQL injection
SQL safety is inconsistent, not systemic-but-absent: of 167 files that build SQL, only 69 use
any escaping or prepared-statement pattern (`mysqli_real_escape_string`, `->prepare()`,
`mysqli_prepare()`) — meaning a majority of SQL-touching files interpolate values into query
strings directly. Concrete confirmed example: `passwordgenerate.php:14,24` builds
`"UPDATE hrm_employee SET password='$new_password' WHERE id=$id"` with `$id` taken straight from
`$_POST['selected_ids']` / `$_POST['id']`, no casting or escaping — directly exploitable by
anyone who can reach the endpoint (and per the access-control finding above, that's any
authenticated employee). Second-order example: `loginck.php` inserts `$city`/`$region`/
`$country`/`$isp` — values returned by the third-party `ip-api.com` lookup — into a raw SQL
`INSERT` (`hrm_login_logs`) without escaping; if that response could ever be influenced (DNS
manipulation, a compromised or malicious API response), it's a second-order injection path.
Given the ratio above, treat **every** page not explicitly verified as using prepared
statements/escaping as a candidate SQL injection point until checked individually — do not treat
the examples here as exhaustive.

### Weak / predictable session token
`loginck.php:107` sets `$_SESSION["token"] = rand();` — PHP's `rand()` is not
cryptographically secure and its output space is small enough to be brute-forceable if this
token is ever used for anything security-sensitive (e.g. CSRF protection). No CSRF token or
same-site cookie configuration was found protecting any state-changing form or GET-based action
in this audit (e.g. `passwordgenerate.php` and department deletion both perform destructive
actions via plain `$_POST`/`$_GET` with no token check).

## High

- **Error display enabled in production-facing code.** 24 files
  (`loginck.php`, `salary_slips.php`, `announcement.php`, `leaves.php`, `manage_expenses.php`,
  and 19 others) set `ini_set('display_errors', 1)` / `error_reporting(E_ALL)`. If these run
  against the live site as-is, any triggered PHP error or warning — including ones that leak
  query structure or file paths — is shown directly to the visitor's browser.
- **World-writable upload directory.** `upload_document.php:28` creates its target directory
  with `mkdir($upload_dir, 0777, true)`.
- **Uploaded files are served from predictable, unauthenticated paths** (`upload-image/`,
  `uploads/documents/`) directly under the web root — no access control on retrieval, only on
  (partial) upload-time validation.
- **GET-based state changes** (e.g. department deletion via `?delete_id=`) are both
  CSRF-susceptible (a link or `<img>` tag can trigger them) and vulnerable to being triggered
  accidentally by crawlers/prefetchers.
- **No rate limiting or lockout on login.** `loginck.php` has no failed-attempt counter, no
  delay, no CAPTCHA — online password guessing against any known email is unthrottled.

## Medium

- **Session inactivity timeout is very short for non-admin users (60 seconds)** —
  `layouts/session.php:6-10`. Whether this is intentional or a bug, it's worth confirming; as
  written it degrades usability far more than it improves security (a 60-second window is too
  short to meaningfully stop session hijacking but long enough to constantly log employees out
  mid-task).
- **Client-controlled `User-Agent` header parsed with regex** for OS/browser detection
  (`loginck.php:38-59`); the derived values are constrained to a small fixed set of strings
  before being used, so this specific instance is low-risk, but the pattern (trusting
  request headers) recurs and should be treated with the same care everywhere in V2.
- **Duplicate, drifting dependency copies**: three separate PHPMailer installations exist in the
  repo simultaneously (`phpmailer/`, `notifications/PHPMailer/`, `vendor/phpmailer/`) with no
  guarantee they're kept at the same version — a security fix applied to one may not reach the
  others.
- **`composer.json` is stale relative to `vendor/`** — `dompdf` and its dependencies are
  installed but undeclared, meaning `composer install` alone would not reproduce the running
  environment, which makes dependency-vulnerability tracking (e.g. via `composer audit`)
  unreliable as-is.

## Low / hygiene

- Dead code retained in the repo: `include/function1.php` and `include/functioncopy.php` are
  35–36KB near-duplicates of `include/function.php`, confirmed (via repo-wide grep) to be
  included by nothing — pure clutter, but also a risk if someone edits the wrong copy later
  believing it's live.
- `debug.log`, `php_errors.log`, and `include/error_log` are committed into the repository —
  historical error output (potentially including fragments of the same sensitive data classes
  discussed above) is preserved in git history even if the live files are later cleaned.
- A `DO_NOT_UPLOAD_HERE` empty marker file exists at the repo root, suggesting the developers
  were aware the upload directories shouldn't be treated as safe/private but did not enforce
  that with actual access controls.

## What to verify before reusing any legacy logic as a V2 spec

Because authorization is effectively decorative in this codebase, **do not assume any business
rule you find is actually being enforced in practice** — the code path may exist but be
reachable by anyone, which is a different thing from "this is the intended workflow." Cross-check
every rule pulled into `legacy-business-rules.md` against what HR/admin actually experience
day to day before encoding it as a V2 requirement.
