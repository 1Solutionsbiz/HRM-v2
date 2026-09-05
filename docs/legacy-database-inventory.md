# Legacy HRM — Database Inventory

Source: `1Solutionsbiz/HRM`, `db/9_june.sql` (85 tables, InnoDB, `utf8mb4`), commit `4825d04`
(2026-06-09), read-only audit performed 2026-09-05.

This file is a full MySQL dump — schema **and data**. It is discussed in detail (as a critical
finding, not just a schema source) in `legacy-security-audit.md`. This document only covers
structure.

Only **24 foreign keys** exist across 85 tables. Nearly all relationships in this schema are
implicit — enforced by naming convention (`emp_id` / `employee_id` → `hrm_employee.id`) and
application code discipline, not by the database. Treat every non-FK relationship below as
"logical, not enforced."

## Core identity

### `hrm_employee` (44 cols) — the single source of truth for a person
Primary employee record. Key columns:
- Identity: `id`, `emp_id` (string code like `EXP-12-0001-OM`), `fname`, `lname`, `email`,
  `office_email`, `mobile1`, `mobile2`
- Auth: **`password` (plaintext, no hash column, no salt)**, `role` — `enum('super admin','admin','user')`
- Org placement: `department_id` → `hrm_department.id`, `designation_id` → `hrm_designation.id`,
  `attendance_id`
- Employment: `doj`, `status` (`1`=Active/`2`=Inactive/`3`=Ex-Employee per column comment),
  `employee_type`, `probation_period`, `probation_status`, `work_location`, `job_title`,
  `candidate_type`, `archive_status`
- Compensation: `salary` (varchar, not decimal — see business rules doc)
- Personal: `dob`, `gender`, `marital_status`, `marriage_anniversary`, `bgroup`, `religion`,
  `nationality`, `current_address`, `permanent_address`, `pincode`, `city_id`, `state_id`,
  `house_type`, `image` (profile photo filename)

No FK constraints at all on `hrm_employee`'s own foreign-key-shaped columns
(`department_id`, `designation_id`, `city_id`, `state_id`) — all logical only.

### `archived_employees` (43 cols)
Structural near-duplicate of `hrm_employee` (same column set minus a couple), used as a manual
"soft delete via copy" target. See business rules doc for the archive flow and its risks.

### Org structure
- `hrm_department` (`id`, `name`, `code`)
- `hrm_subdepartment` (`id`, `department_id`, `name`) — logical FK to `hrm_department`
- `hrm_designation` (`id`, `name`, `department_name`) — `department_name` is a denormalized
  string, not `department_id`
- `hrm_reporting_manager` (`id`, `employee_id`, `reporting_manager_id`, `date`,
  `reporting_manager_type`) — both columns logically reference `hrm_employee.id`
- `hrm_city` (`id`, `state_id`, `name`), `hrm_state` (`id`, `name`) — location lookups

### Role / permission (a second, mostly-unused RBAC layer)
- `hrm_user_roles_name` (`id`, `name`, `description`)
- `hrm_user_role_association` (`id`, `user_id`, `user_role_id`)
- `hrm_user_role_permission` (`id`, `role_id`, `permission_id`)
- `hrm_user_role_permission_log` (`id`, `user_id`, `activity_type`, `description`, `date`)
- `hrm_permission_name` (`id`, `permission_name`, `description`)
- `hrm_permission` (`id`, `emp_id`, `permission_id`)

These tables model a proper granular RBAC system, but the running application does not gate
pages through them (see `legacy-security-audit.md`). Two competing role systems exist:
`hrm_employee.role` (3-value enum) and this 6-table structure. Neither is consistently enforced.

## Employee profile detail (1:many off `hrm_employee.id`, all logical FK)

- `hrm_employee_education` — qualification, course, dates, college/university, grade
- `hrm_employee_family` — `relationship_id` → `hrm_family_relationship_member`, dependent flag, phone
- `hrm_family_relationship_member` — lookup (Spouse, Child, etc.)
- `hrm_employee_emergency_contact` — name, relationship, number
- `hrm_employee_social` — facebook/twitter/instagram/linkedin URLs
- `hrm_employee_history` — free-text subject/detail/date log entries
- `hrm_employee_work_history` — department/designation + start/end date, i.e. an internal
  transfer history table
- `hrm_employee_work_days` — `day_id`, `work_type`, effective_date — configurable work-day
  patterns
- `hrm_bank_detail` — bank name, account type/number, IFSC, branch, **PAN**, `emp_id`
- `hrm_employee_payroll` — a second bank-detail-shaped table (account number, IFSC, bank name,
  branch, city) plus `salary_type`, `tax_scheme` — overlaps `hrm_bank_detail` almost entirely
- `hrm_qualification_type`, `hrm_course_type` — lookups for the education table

### Documents
- `hrm_employee_documents` — `document_type_id` → `hrm_employee_document_type`, `document_number`,
  `file`, `proof_of`, `uploaded_by`
- `hrm_employee_document_type` — lookup (Aadhaar, PAN, etc. — actual values are seed data in
  the dump, not in this schema-only file)
- `hrm_employee_document_proof` — links a document to a "proof" id
- `emp_documents` — a **second, structurally different** document table: one row per employee
  with fixed columns `aadhaar`, `pancard`, `10th`, `12th`, `bank_doc_1/2`, `other_1/2` (each a
  file path). This is the table `upload_document.php` actually writes to — `hrm_employee_documents`
  and `emp_documents` are two independent, overlapping document systems.
- `company_data` — company-level documents (name, type, `updated_on`, `file_path`)
- `company_policies` — policy documents (name, type, `file_path`)

## Attendance

- `newuser_attendance` — the live clock-in/out table: `user_id`, `clock_in_time`, `clock_in_ip`,
  `clock_out_time`, `clock_out_ip`, `status`, `late_status`, `status_color`,
  `total_working_time`, `extra_or_remaining_time/_label`. This is what payroll calculation
  reads (see business rules doc).
- `hrm_attandance_machine_detail` (72 cols) — a **wide, denormalized** table: one row per
  employee per month with `date1`..`date31` and `date_in_out1`..`date_in_out31` columns holding
  raw biometric-machine punch data as strings. Bulk-import target for uploaded attendance
  machine files.
- `hrm_attandance_machine_update_detail` — manual correction log against the above (`old_in_time`,
  `new_in_time`, `update_by`, `detail`) — an audit trail for manual attendance edits.
- `hrm_attandance_file` — metadata for uploaded attendance files (`year`, `month`, `file1`,
  `upload_for_month`)
- `mismatch_attendance` — flags for punch-in/out mismatches (missing clock-out etc.),
  `status`, per employee/date
- `office_timing` — a **single global config row** (see business rules doc) driving fines,
  grace periods, and thresholds: `relaxation_time`, `relaxation_late`, `monthly_shorts`,
  `monthly_half`, `monthly_leaves`, `normal_fine`, `extra_fine_time`, `extra_fine`,
  `half_day_time`, `evening_half_time`, `min_half_day_time`, `morning_short`, `evening_short`,
  `overall_short`, `login_time`, `logout_time`, `saturday_option`
- `hrm_holidays` — `year`, `name`, `date`, `no_of_days`, `added_by`
- `device_info` — browser/device fingerprint captured per employee login (fingerprint, platform,
  screen resolution, timezone, CPU cores, RAM) — see integrations doc for what this feeds

## Leave

- `hrm_leave_type` — `name`, `number_of_leave` (the annual allocation per type — global, not
  per-employee or per-join-date)
- `hrm_leave_applied` — `leave_type_id`, `emp_id`, `start_date`, `end_date`, `no_of_days`,
  `day_type`, `half_day_type`, `leave_reason`, `approved_by`, `status`

No leave-balance table exists — remaining balance is computed on the fly from
`hrm_leave_type.number_of_leave` minus a sum over `hrm_leave_applied`, in application code
(see business rules doc).

## Expenses

- `employee_expenses` — `employee_id`, `category_id` → `expense_categories`, `expense_date`,
  `amount`, `receipt_path`, `status` (`Pending`/`Approved`/`Rejected`), `approved_by`,
  `approved_at`, `payment_method`, `reference_id`, `company_id` → `companiesexpense` (FK enforced)
- `expense_categories` — `name`, `description`
- `companiesexpense` — a **separate, minimal company table** (`id`, `name`) used only as the FK
  target for `employee_expenses.company_id` — distinct from both `companies` and `hrm_company`
  below (three separate "company" tables in this schema; see business rules doc)

## Payroll / salary / payslips

- `hrm_salary_management` — one row per employee: `actual_salary`, `current_salary`, `status`
  (FK to `hrm_employee`)
- `salary_managment` — a **second, differently-spelled** salary table (`emp_id_are` string code,
  `emp_id` int, `salary` float, `start`/`end` date range) — appears to be an older/parallel
  salary-history mechanism, not FK-linked to `hrm_salary_management`
- `hrm_advance_salary` — `emp_id`, `advance_amount`, `monthly_deduction`, `status`
  (`1`=Active/`2`=Paused/`0`=Completed per comment), `remaining_amount` (FK to `hrm_employee`)
- `hrm_deduction_history` — one row per monthly deduction run, `advance_id` + `emp_id` FK,
  `actual_salary`, `deduction_amount`, `remaining_amount`, `month_year`
- `salary_slip_generate` — one row per generated payslip: `emp_id`, `salary`,
  `leave_deduction`, `late_deduction`, `total_deduction`, `new_salary`, `month`, `year`,
  `generated_by`, `updated_by`
- `invoice_numbers` — a sequence/counter table (`invoice_number`) used for generating sequential
  identifiers (payslip or invoice numbering — see business rules doc)

## Assets

- `hrm_assets` — `asset_name`, `asset_id`, `quantity`, `image`
- `hrm_asset_assignments` — `asset_id` + `assignee_id` (both FK, `ON DELETE CASCADE`),
  `assigned_date`, `issued_date`, `return_date`, `action`

## Announcements / recognition / engagement

- `announcement` — `created_by`, `show_to`, `title`, `description`, display window
  (`display_form_date/time`, `display_end_date/time`), `status`
- `hrm_notification` — `send_to`, `sent_by`, `title`, `description`, `date`, `time`
- `hrm_employee_of_the_month` / `eom` / `eom_details` / `eom_votes` / `quiz_winners` /
  `weekly_winners` — an "Employee of the Month" nomination/voting system: `eom` holds per-batch
  per-employee attendance + peer-vote point totals, `eom_details` holds per-batch aggregate
  stats and the voting deadline, `eom_votes` holds individual peer votes, `quiz_winners` and
  `weekly_winners` are related leaderboards.
- `questions` / `question_answers` / `emp_badges` — a quiz/gamification system ("current
  affairs" quiz per the `current_affair/` module): question bank with an `added_by` default of
  `'AI'`, per-user answers and points, and a badge/points tally per employee (`emp_badges` is
  keyed by `emp_name` string, not `emp_id` — no FK, matched by name only).

## Complaints / grievances / IT support tickets

- `sexual_harassment_complaints` — full POSH (Prevention of Sexual Harassment) complaint intake:
  complainant details, `alleged_harasser_id`, incident date/location/description, witness
  details, `evidence_path`. No `status` or workflow-state column — see business rules doc for
  the implication.
- `tickets` — general IT/HR helpdesk tickets: `CategoryID` → `hrm_ticket_categories`,
  `EmployeeID` → `hrm_employee` (both FK), `Status` enum (`Open`/`In Progress`/`Resolved`/
  `Closed`/`Reopened`), `Priority`, `Rating`
- `ticket_comments` — FK to `tickets` and `hrm_employee`
- `hrm_ticket_categories` — lookup

## Resignation / offboarding

- `employee_resignations` — `employee_id` + `approved_by` (both FK), `resignation_reason`,
  `intended_last_date`, `notice_period_days`, `status` (`Pending`/`Approved`/`Declined`),
  `decline_reason`
- `resignation_history` — audit trail of status changes against a resignation
- `notice_period_steps` / `employee_notice_period_steps` / `notice_period_files` — a
  configurable offboarding checklist (steps with `step_order`), per-employee step completion
  status, and file attachments per step (all FK-linked, `ON DELETE CASCADE` on the steps join)

## Onboarding

- `onboarding_steps` / `employee_onboarding_steps` / `onboarding_files` — the same
  checklist-with-attachments pattern as notice period, for new hires (all FK-linked)

## Chat

- `hrm_chat_groups`, `hrm_chat_group_members`, `hrm_chat_messages` — a basic internal chat
  system: 1:1 (`sender_id`/`receiver_id`) and group messaging, `message_type` enum
  (text/image/audio/video/file), read/seen/deleted/edited flags, `reply_to` for threading

## Login / audit logs

- `hrm_login_detail` — minimal: `date_time`, `emp_id`, every login
- `hrm_login_logs` — richer per-login record: IP, ISP, city/region/country (from a third-party
  geo-IP lookup — see integrations doc), system/browser info, `mail_status`
- `admin_login_logs` — a **separate** log used only for two hardcoded admin employee IDs (see
  business rules / security docs), includes `email_status` for the alert email
- `device_info` — device fingerprint captured client-side and posted to the server
  (see integrations doc)

## Multi-company / tenancy (schema exists, wiring is inconsistent)

Three separate, unrelated "company" tables:
- `companies` (26 cols) — the richest one: name, logo/banner, contact info, socials, industry,
  tax ID, lat/long, `parent_company` (string, not FK) — looks like the intended multi-tenant or
  multi-brand company directory
- `hrm_company` (13 cols) — a second, older-looking company profile table (brand name, domain,
  registered/corporate address, socials) — likely the single-company predecessor of `companies`
- `companiesexpense` (4 cols) — minimal, exists only as the FK target for expense company
  scoping

None of these three are FK-linked to each other, and most of the rest of the schema
(`hrm_employee`, attendance, leave, payroll) has no `company_id` column at all — so even where
`companies`/`companiesexpense` exist, most modules are not company-scoped. Treat this as
evidence of an unfinished or abandoned multi-tenancy effort — flagged `UNKNOWN` pending
confirmation with the business owner (see closing KEEP/TRANSFORM/REPLACE/REMOVE list in
`legacy-system-audit.md`).

## Misc / lookups

- `hrm_employee_sequence` — a single-row counter (`sequence_number`) used for generating the
  `emp_id` string codes
