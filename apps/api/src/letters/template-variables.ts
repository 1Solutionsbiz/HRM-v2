import { BadRequestException } from '@nestjs/common';

/**
 * The whitelist a letter template's `{{token}}`s and a generation request's
 * custom-variable keys are both checked against. Nothing outside this
 * module ever writes a variable value into rendered output without going
 * through `validateTemplateTokens` / `validateCustomVariables` first — an
 * unrecognized token means the template (or the request) is wrong, not
 * something to render literally or silently drop into a legal document.
 */

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
/**
 * Minimal conditional block: `{{#if token}}...{{/if}}` - the block's inner
 * content is kept only when `token` resolves to a real value (see
 * `isBlank`). Deliberately just this one form (no `{{#unless}}`, no
 * else-branch) - added for the Appointment Letter rewrite's "omit the
 * sentence, don't print undefined/null/—" requirement, which flat
 * substitution can't satisfy. Every template written before this addition
 * has no `{{#if}}` blocks at all, so they render byte-identically.
 */
const CONDITIONAL_BLOCK_PATTERN = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
const CONDITIONAL_OPEN_PATTERN = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}/g;

/** Auto-resolved from Employee/Department/Designation/User at generation time — never supplied by the caller. */
export const FIXED_VARIABLE_KEYS = [
  'employee.fullName',
  'employee.firstName',
  'employee.lastName',
  'employee.code',
  'employee.email',
  'employee.department',
  'employee.designation',
  'employee.dateOfJoining',
  'employee.employmentType',
  'employee.workLocation',
  'employee.address',
  'employee.reportingManager',
  'company.legalName',
  'company.brandName',
  'company.address',
  'company.website',
  'company.supportEmail',
  'company.phone',
  'letter.documentNumber',
  'letter.date',
  'signatory.name',
  'signatory.title',
] as const;

const FIXED_VARIABLE_SET = new Set<string>(FIXED_VARIABLE_KEYS);

export interface LetterTypeVariableSpec {
  /** Generation fails (400) if any of these is missing/blank - the letter can't say anything sensible without it. */
  required: readonly string[];
  /** May be omitted - templates gate these behind `{{#if custom.<key>}}` rather than assuming a value. */
  optional: readonly string[];
}

/**
 * Per-letter-type declaration of which `custom.*` keys that type's
 * templates may use — closes the whitelist loophole a bare `custom.*`
 * namespace would otherwise open. Code-owned rather than a DB column
 * because P1 ships no template-editor UI (P3): every template that exists
 * is seed-authored, so there is no runtime path that could need a new
 * custom key without a code change anyway. Revisit when P3 adds one.
 */
export const LETTER_TYPE_CUSTOM_VARIABLES: Record<string, LetterTypeVariableSpec> = {
  OFFER_LETTER: { required: ['designation', 'ctc', 'joiningDate'], optional: [] },
  APPOINTMENT_LETTER: {
    // designation/effectiveDate are deliberately NOT custom fields here -
    // employee.designation and employee.dateOfJoining already carry this
    // for a fresh appointment (the two are the same event), and the P1
    // spec explicitly asks to keep custom fields minimal rather than
    // re-asking HR for data already on the employee record.
    required: ['annualCompensation'],
    optional: ['monthlyCompensation', 'probationPeriod', 'noticePeriod', 'specialConditions', 'additionalTerms'],
  },
  CONFIRMATION_LETTER: { required: ['confirmationDate'], optional: [] },
  PROMOTION_LETTER: { required: ['newDesignation', 'newCtc', 'effectiveDate'], optional: [] },
  SALARY_REVISION_LETTER: { required: ['newCtc', 'effectiveDate'], optional: [] },
  TRANSFER_LETTER: { required: ['newLocation', 'newDepartment', 'effectiveDate'], optional: [] },
  WARNING_LETTER: { required: ['reason', 'incidentDate'], optional: [] },
  EXPERIENCE_LETTER: { required: ['lastDesignation', 'tenureSummary'], optional: [] },
  RELIEVING_LETTER: { required: ['lastWorkingDay'], optional: [] },
  NOC_LETTER: { required: ['purpose'], optional: [] },
  SALARY_CERTIFICATE: { required: ['monthlyCtc', 'purpose'], optional: [] },
  TERMINATION_LETTER: { required: ['reason', 'lastWorkingDay'], optional: [] },
};

function specFor(letterTypeKey: string): LetterTypeVariableSpec {
  return LETTER_TYPE_CUSTOM_VARIABLES[letterTypeKey] ?? { required: [], optional: [] };
}

export function extractTemplateTokens(content: string): string[] {
  const tokens = new Set<string>();
  for (const match of content.matchAll(TOKEN_PATTERN)) {
    tokens.add(match[1]);
  }
  // {{#if token}} guards reference a variable too, even though they're
  // never substituted in place themselves - must be whitelisted the same
  // as a plain {{token}}, or a template could gate on an unrecognized key.
  for (const match of content.matchAll(CONDITIONAL_OPEN_PATTERN)) {
    tokens.add(match[1]);
  }
  return [...tokens];
}

function allowedKeysFor(letterTypeKey: string): Set<string> {
  const spec = specFor(letterTypeKey);
  return new Set([
    ...FIXED_VARIABLE_SET,
    ...spec.required.map((key) => `custom.${key}`),
    ...spec.optional.map((key) => `custom.${key}`),
  ]);
}

/** Throws if the template body references any token outside this letter type's whitelist. */
export function validateTemplateTokens(content: string, letterTypeKey: string): void {
  const allowed = allowedKeysFor(letterTypeKey);
  const unknown = extractTemplateTokens(content).filter((token) => !allowed.has(token));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `Template references unknown variable(s) for letter type "${letterTypeKey}": ${unknown.join(', ')}`,
    );
  }
}

/** Throws if the caller supplied a custom-variable key this letter type didn't declare (required or optional). */
export function validateCustomVariables(
  letterTypeKey: string,
  supplied: Record<string, string>,
): void {
  const spec = specFor(letterTypeKey);
  const declared = new Set([...spec.required, ...spec.optional]);
  const unknown = Object.keys(supplied).filter((key) => !declared.has(key));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `Unknown custom variable(s) for letter type "${letterTypeKey}": ${unknown.join(', ')}`,
    );
  }
}

/** Every REQUIRED custom key this letter type declares must be supplied — optional ones may be left out. */
export function validateRequiredCustomVariables(
  letterTypeKey: string,
  supplied: Record<string, string>,
): void {
  const missing = specFor(letterTypeKey).required.filter((key) => !supplied[key]?.trim());
  if (missing.length > 0) {
    throw new BadRequestException(
      `Missing required variable(s) for letter type "${letterTypeKey}": ${missing.join(', ')}`,
    );
  }
}

/**
 * What a `{{#if token}}` conditional treats as "not really there" - undefined/
 * empty covers new fields (see resolveFixedVariables, which leaves them ''
 * rather than a placeholder), and '—' covers the older fixed fields that
 * already used that placeholder for direct (non-conditional) substitution
 * before this mechanism existed - so wrapping one of those in a new
 * `{{#if}}` still omits correctly, without changing what direct,
 * non-conditional use of that field renders as anywhere else.
 */
function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '' || value === '—';
}

/**
 * Substitutes every `{{token}}` in `content` with its resolved value, after
 * first resolving `{{#if token}}...{{/if}}` blocks (drop the block's
 * content when the guard is blank, keep it unwrapped otherwise). Assumes
 * `validateTemplateTokens` already ran - throws instead of rendering a
 * token literally if a resolution is somehow still missing, since that
 * would otherwise put a raw `{{...}}` into a generated legal document.
 */
export function renderTemplate(content: string, resolved: Record<string, string>): string {
  const withConditionalsResolved = content.replace(
    CONDITIONAL_BLOCK_PATTERN,
    (_full, token: string, inner: string) => (isBlank(resolved[token]) ? '' : inner),
  );
  return withConditionalsResolved.replace(TOKEN_PATTERN, (full, token: string) => {
    const value = resolved[token];
    if (value === undefined) {
      throw new BadRequestException(`No resolved value for template variable "${token}"`);
    }
    return value;
  });
}

/** UTC getters, matching this codebase's date-only convention (see common/date-only.ts) - avoids a host-timezone day shift. */
export function formatLongDate(date: Date): string {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "FULL_TIME" -> "Full-Time" - the raw Prisma enum value read literally into a legal document otherwise. */
function formatEmploymentType(employmentType: string): string {
  return employmentType
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

export interface FixedVariableSource {
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    email: string;
    department: string | null;
    designation: string | null;
    dateOfJoining: Date;
    employmentType: string;
    workLocation: string | null;
    address: string | null;
    reportingManager: string | null;
  };
  company: {
    legalName: string;
    brandName: string;
    address: string | null;
    website: string | null;
    supportEmail: string;
    phone: string | null;
  };
  documentNumber: string;
  generatedAt: Date;
  signatory: {
    name: string;
    title: string;
  };
}

export function resolveFixedVariables(source: FixedVariableSource): Record<string, string> {
  return {
    'employee.fullName': `${source.employee.firstName} ${source.employee.lastName}`,
    'employee.firstName': source.employee.firstName,
    'employee.lastName': source.employee.lastName,
    'employee.code': source.employee.employeeCode,
    'employee.email': source.employee.email,
    'employee.department': source.employee.department ?? '—',
    'employee.designation': source.employee.designation ?? '—',
    'employee.dateOfJoining': formatLongDate(source.employee.dateOfJoining),
    'employee.employmentType': formatEmploymentType(source.employee.employmentType),
    'employee.workLocation': source.employee.workLocation ?? '—',
    // New fields (added for the Appointment Letter rewrite) use a real
    // empty string, not '—' - they're only ever referenced inside
    // {{#if}} blocks in practice, and isBlank() treats both the same way,
    // but '' is the more honest "not present" value for a field with no
    // pre-existing direct-substitution callers to stay compatible with.
    'employee.address': source.employee.address ?? '',
    'employee.reportingManager': source.employee.reportingManager ?? '',
    'company.legalName': source.company.legalName,
    'company.brandName': source.company.brandName,
    'company.address': source.company.address ?? '',
    'company.website': source.company.website ?? '',
    'company.supportEmail': source.company.supportEmail,
    'company.phone': source.company.phone ?? '',
    'letter.documentNumber': source.documentNumber,
    'letter.date': formatLongDate(source.generatedAt),
    'signatory.name': source.signatory.name,
    'signatory.title': source.signatory.title,
  };
}
