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
  'company.legalName',
  'company.brandName',
  'company.address',
  'company.website',
  'company.supportEmail',
  'letter.documentNumber',
  'letter.date',
  'signatory.name',
  'signatory.title',
] as const;

const FIXED_VARIABLE_SET = new Set<string>(FIXED_VARIABLE_KEYS);

/**
 * Per-letter-type declaration of which `custom.*` keys that type's
 * templates may use — closes the whitelist loophole a bare `custom.*`
 * namespace would otherwise open. Code-owned rather than a DB column
 * because P1 ships no template-editor UI (P3): every template that exists
 * is seed-authored, so there is no runtime path that could need a new
 * custom key without a code change anyway. Revisit when P3 adds one.
 */
export const LETTER_TYPE_CUSTOM_VARIABLES: Record<string, readonly string[]> = {
  OFFER_LETTER: ['designation', 'ctc', 'joiningDate'],
  APPOINTMENT_LETTER: ['designation', 'reportingManager', 'effectiveDate'],
  CONFIRMATION_LETTER: ['confirmationDate'],
  PROMOTION_LETTER: ['newDesignation', 'newCtc', 'effectiveDate'],
  SALARY_REVISION_LETTER: ['newCtc', 'effectiveDate'],
  TRANSFER_LETTER: ['newLocation', 'newDepartment', 'effectiveDate'],
  WARNING_LETTER: ['reason', 'incidentDate'],
  EXPERIENCE_LETTER: ['lastDesignation', 'tenureSummary'],
  RELIEVING_LETTER: ['lastWorkingDay'],
  NOC_LETTER: ['purpose'],
  SALARY_CERTIFICATE: ['monthlyCtc', 'purpose'],
  TERMINATION_LETTER: ['reason', 'lastWorkingDay'],
};

export function extractTemplateTokens(content: string): string[] {
  const tokens = new Set<string>();
  for (const match of content.matchAll(TOKEN_PATTERN)) {
    tokens.add(match[1]);
  }
  return [...tokens];
}

function allowedKeysFor(letterTypeKey: string): Set<string> {
  const custom = LETTER_TYPE_CUSTOM_VARIABLES[letterTypeKey] ?? [];
  return new Set([...FIXED_VARIABLE_SET, ...custom.map((key) => `custom.${key}`)]);
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

/** Throws if the caller supplied a custom-variable key this letter type didn't declare. */
export function validateCustomVariables(
  letterTypeKey: string,
  supplied: Record<string, string>,
): void {
  const declared = new Set(LETTER_TYPE_CUSTOM_VARIABLES[letterTypeKey] ?? []);
  const unknown = Object.keys(supplied).filter((key) => !declared.has(key));
  if (unknown.length > 0) {
    throw new BadRequestException(
      `Unknown custom variable(s) for letter type "${letterTypeKey}": ${unknown.join(', ')}`,
    );
  }
}

/** Every custom key this letter type declares must be supplied — no silently-blank legal document fields. */
export function validateRequiredCustomVariables(
  letterTypeKey: string,
  supplied: Record<string, string>,
): void {
  const declared = LETTER_TYPE_CUSTOM_VARIABLES[letterTypeKey] ?? [];
  const missing = declared.filter((key) => !supplied[key]?.trim());
  if (missing.length > 0) {
    throw new BadRequestException(
      `Missing required variable(s) for letter type "${letterTypeKey}": ${missing.join(', ')}`,
    );
  }
}

/**
 * Substitutes every `{{token}}` in `content` with its resolved value.
 * Assumes `validateTemplateTokens` already ran - throws instead of
 * rendering a token literally if a resolution is somehow still missing,
 * since that would otherwise put a raw `{{...}}` into a generated legal
 * document.
 */
export function renderTemplate(content: string, resolved: Record<string, string>): string {
  return content.replace(TOKEN_PATTERN, (full, token: string) => {
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
  };
  company: {
    legalName: string;
    brandName: string;
    address: string | null;
    website: string | null;
    supportEmail: string;
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
    'employee.employmentType': source.employee.employmentType,
    'employee.workLocation': source.employee.workLocation ?? '—',
    'company.legalName': source.company.legalName,
    'company.brandName': source.company.brandName,
    'company.address': source.company.address ?? '',
    'company.website': source.company.website ?? '',
    'company.supportEmail': source.company.supportEmail,
    'letter.documentNumber': source.documentNumber,
    'letter.date': formatLongDate(source.generatedAt),
    'signatory.name': source.signatory.name,
    'signatory.title': source.signatory.title,
  };
}
