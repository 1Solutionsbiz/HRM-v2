// Pure data - no Prisma import, no side effects on import. Split out of
// seed-letters.ts specifically so it can be imported from a test (see
// letter-seed-data.spec.ts) without that import executing seed-letters.ts's
// main() against a real database.

export const PERMISSIONS = [
  { key: 'letters:view', description: 'View the letter catalog and every generated letter' },
  { key: 'letters:generate', description: 'Search employees and generate letters for them' },
  { key: 'letters:download', description: 'Download a generated letter PDF' },
  { key: 'letters:cancel', description: 'Cancel a previously generated letter' },
] as const;

export const CATEGORIES = [
  { id: 'employment_lifecycle', key: 'EMPLOYMENT_LIFECYCLE', name: 'Employment Lifecycle' },
  { id: 'compensation', key: 'COMPENSATION', name: 'Compensation' },
  { id: 'conduct', key: 'CONDUCT', name: 'Conduct' },
  { id: 'certificates', key: 'CERTIFICATES', name: 'Certificates' },
] as const;

export const SIGNATORY = { key: 'default', name: 'Atul Chaudhary', title: 'Director' };

export interface LetterTypeSeed {
  key: string;
  name: string;
  categoryKey: (typeof CATEGORIES)[number]['key'];
  numberPrefix: string;
  content: string;
}

const P = (...lines: string[]) => lines.join('\n\n');

export const LETTER_TYPES: LetterTypeSeed[] = [
  {
    key: 'OFFER_LETTER',
    name: 'Offer Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'OFR',
    content: P(
      'Dear {{employee.fullName}},',
      'We are pleased to offer you the position of {{custom.designation}} at {{company.legalName}}. This offer is subject to the terms and conditions of your employment agreement.',
      'Your annual compensation will be {{custom.ctc}}, and your proposed date of joining is {{custom.joiningDate}}.',
      'We look forward to welcoming you to the team.',
      'Sincerely,',
    ),
  },
  {
    key: 'APPOINTMENT_LETTER',
    name: 'Appointment Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'APT',
    content: P(
      'Dear {{employee.fullName}},',
      'Further to your acceptance of our offer, we are pleased to confirm your appointment as {{custom.designation}} at {{company.legalName}}, effective {{custom.effectiveDate}}.',
      'You will report to {{custom.reportingManager}}. Your employee code is {{employee.code}}.',
      'We look forward to a long and mutually rewarding association.',
      'Sincerely,',
    ),
  },
  {
    key: 'CONFIRMATION_LETTER',
    name: 'Confirmation Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'CNF',
    content: P(
      'Dear {{employee.fullName}},',
      'We are pleased to confirm your employment as {{employee.designation}} in the {{employee.department}} department, effective {{custom.confirmationDate}}.',
      'This confirmation follows a satisfactory review of your performance since your date of joining, {{employee.dateOfJoining}}.',
      'Congratulations, and we look forward to your continued contribution.',
      'Sincerely,',
    ),
  },
  {
    key: 'PROMOTION_LETTER',
    name: 'Promotion Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'PRM',
    content: P(
      'Dear {{employee.fullName}},',
      'We are pleased to inform you that, in recognition of your contribution, you have been promoted to {{custom.newDesignation}}, effective {{custom.effectiveDate}}.',
      'Your revised annual compensation will be {{custom.newCtc}}.',
      'Congratulations on this well-deserved achievement.',
      'Sincerely,',
    ),
  },
  {
    key: 'SALARY_REVISION_LETTER',
    name: 'Salary Revision Letter',
    categoryKey: 'COMPENSATION',
    numberPrefix: 'SRV',
    content: P(
      'Dear {{employee.fullName}},',
      'We are pleased to inform you that your annual compensation has been revised to {{custom.newCtc}}, effective {{custom.effectiveDate}}.',
      'This revision reflects your performance and contribution to {{company.legalName}}.',
      'Sincerely,',
    ),
  },
  {
    key: 'TRANSFER_LETTER',
    name: 'Transfer Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'TRF',
    content: P(
      'Dear {{employee.fullName}},',
      'This is to inform you that you are being transferred to {{custom.newDepartment}} at {{custom.newLocation}}, effective {{custom.effectiveDate}}.',
      'All other terms of your employment remain unchanged.',
      'Sincerely,',
    ),
  },
  {
    key: 'WARNING_LETTER',
    name: 'Warning Letter',
    categoryKey: 'CONDUCT',
    numberPrefix: 'WRN',
    content: P(
      'Dear {{employee.fullName}},',
      'This letter serves as a formal warning regarding an incident on {{custom.incidentDate}}: {{custom.reason}}.',
      'You are advised to ensure this does not recur. Any further such instance may result in further disciplinary action.',
      'Sincerely,',
    ),
  },
  {
    key: 'EXPERIENCE_LETTER',
    name: 'Experience Letter',
    categoryKey: 'CERTIFICATES',
    numberPrefix: 'EXP',
    content: P(
      'To Whomsoever It May Concern,',
      'This is to certify that {{employee.fullName}} (Employee Code: {{employee.code}}) was employed with {{company.legalName}} from {{employee.dateOfJoining}} until their last working day, most recently serving as {{custom.lastDesignation}}.',
      '{{custom.tenureSummary}}',
      'We wish them success in their future endeavours.',
      'Sincerely,',
    ),
  },
  {
    key: 'RELIEVING_LETTER',
    name: 'Relieving Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'REL',
    content: P(
      'Dear {{employee.fullName}},',
      'This is to confirm that your resignation has been accepted and you stand relieved from your duties at {{company.legalName}}, with {{custom.lastWorkingDay}} as your last working day.',
      'We thank you for your contribution and wish you the best in your future endeavours.',
      'Sincerely,',
    ),
  },
  {
    key: 'NOC_LETTER',
    name: 'No Objection Certificate',
    categoryKey: 'CERTIFICATES',
    numberPrefix: 'NOC',
    content: P(
      'To Whomsoever It May Concern,',
      'This is to certify that {{company.legalName}} has no objection to {{employee.fullName}} (Employee Code: {{employee.code}}) in connection with: {{custom.purpose}}.',
      'This certificate is issued on request for the purpose stated above.',
      'Sincerely,',
    ),
  },
  {
    key: 'SALARY_CERTIFICATE',
    name: 'Salary Certificate',
    categoryKey: 'COMPENSATION',
    numberPrefix: 'SCT',
    content: P(
      'To Whomsoever It May Concern,',
      'This is to certify that {{employee.fullName}} (Employee Code: {{employee.code}}) is employed with {{company.legalName}} as {{employee.designation}}, with a current monthly compensation of {{custom.monthlyCtc}}.',
      'This certificate is issued for the purpose of: {{custom.purpose}}.',
      'Sincerely,',
    ),
  },
  {
    key: 'TERMINATION_LETTER',
    name: 'Termination Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'TRM',
    content: P(
      'Dear {{employee.fullName}},',
      'This is to inform you that your employment with {{company.legalName}} is terminated, effective {{custom.lastWorkingDay}}, for the following reason: {{custom.reason}}.',
      'Please contact HR regarding the settlement of your dues and return of company property.',
      'Sincerely,',
    ),
  },
];
