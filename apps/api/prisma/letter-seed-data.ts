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
  /**
   * Ordered template content, one entry per version, starting at version 1.
   * seed-letters.ts creates any version here that doesn't exist yet and
   * promotes the template to the last (highest) entry - existing
   * `EmployeeLetter` rows keep pointing at whichever version they were
   * actually generated from, so appending a new entry here never touches
   * an already-issued letter. Never edit an existing entry in place
   * (that would silently rewrite history for anything still pointing at
   * it, and there's no way to change a LetterTemplateVersion row post
   * creation - it's append-only, see the schema comment) - append a new
   * one instead.
   */
  versions: string[];
}

const P = (...lines: string[]) => lines.join('\n\n');
/**
 * Joins a heading with its body using a SINGLE newline, keeping them one
 * paragraph (one entry after the service's `.split(/\n{2,}/)`) instead of
 * two - required for letter-pdf.ts's heading-detection + `unbreakable`
 * stack to treat them as one atomic block. Using `P()` here instead (which
 * joins with a blank line) was the actual cause of a real bug: the
 * heading and body became separate top-level paragraphs, so `unbreakable`
 * on the heading's own block couldn't stop a page break landing between
 * it and its body - confirmed by rendering a real test letter.
 */
const S = (heading: string, ...body: string[]) => [heading, ...body].join('\n');

/**
 * Appointment Letter v2 (2026-09-11): replaces the short, plain v1 body
 * with a full corporate appointment letter, per explicit request after v1
 * was judged too thin for real use. Every optional fact (reporting
 * manager, employee address, monthly compensation figure, probation/
 * notice period specifics, special conditions) is wrapped in
 * `{{#if custom.<key>}}`/`{{#if employee.<key>}}` so an employee missing
 * that data gets a clean, complete letter with the fact's sentence simply
 * absent - never a literal "undefined"/"null"/blank field. Nothing here
 * invents a specific probation length, notice period, or named company
 * policy; those stay in general "subject to applicable company policy"
 * language unless HR supplies a specific value via the optional custom
 * fields.
 */
const APPOINTMENT_LETTER_V2 = P(
  '{{employee.fullName}}{{#if employee.address}}\n{{employee.address}}{{/if}}',
  'Subject: Appointment as {{employee.designation}}',
  'Dear {{employee.firstName}},',
  'We are pleased to confirm your appointment with {{company.legalName}} ("the Company") on the terms and conditions set out in this letter. Please read this letter carefully; your signature on the acceptance section below will confirm your agreement to these terms.',
  S(
    '1. Appointment and Designation',
    'You are appointed as {{employee.designation}}{{#if employee.department}} in the {{employee.department}} department{{/if}}, effective {{employee.dateOfJoining}}.{{#if employee.reportingManager}} You will report to {{employee.reportingManager}}.{{/if}} Your employee code for all official records is {{employee.code}}.',
  ),
  S(
    '2. Date of Joining',
    'Your employment with the Company commences on {{employee.dateOfJoining}}. This date marks the beginning of your service for all purposes, including probation, benefits, and leave eligibility, subject to applicable company policy.',
  ),
  S(
    '3. Place of Work',
    'Your primary place of work will be {{employee.workLocation}}. You may be required to work from another Company, client, or project location where reasonably necessary for business requirements, subject to applicable company policy.',
  ),
  S(
    '4. Nature of Employment',
    'Your employment is {{employee.employmentType}}. You are expected to devote your full professional time, attention, and best efforts to the duties and responsibilities assigned to you during working hours.',
  ),
  S(
    '5. Probation',
    'Your appointment is subject to a probation period, during which your performance, conduct, attendance, and overall suitability for the role will be evaluated.{{#if custom.probationPeriod}} The probation period will be {{custom.probationPeriod}}, and may be extended at the Company\'s discretion where necessary.{{/if}} On satisfactory completion of probation, your employment will be confirmed in writing.',
  ),
  S(
    '6. Compensation',
    'Your annual compensation will be {{custom.annualCompensation}}.{{#if custom.monthlyCompensation}} This corresponds to a monthly compensation of {{custom.monthlyCompensation}}.{{/if}} Your compensation structure, applicable allowances, and benefits will be communicated separately and are subject to statutory deductions and employer contributions as applicable under law.',
  ),
  S(
    '7. Duties and Responsibilities',
    'You will be expected to perform the duties associated with your role diligently, meet agreed objectives, and maintain the quality standards expected of your position. You are expected to complete your work within agreed timelines, cooperate with colleagues and stakeholders, protect the Company\'s assets and information, follow the Company\'s processes, and participate in meetings, reviews, and training as required, taking ownership of the responsibilities assigned to you.',
  ),
  S(
    '8. Working Hours and Attendance',
    'You are required to observe the working hours, attendance, and punctuality requirements applicable to your role, and to record your attendance in accordance with the Company\'s prescribed procedures. Unauthorised absence or repeated late attendance may be addressed in accordance with applicable company policy.',
  ),
  S(
    '9. Leave and Holidays',
    'Your entitlement to leave and holidays will be governed by the Company\'s applicable leave policy and applicable law. All leave must be requested and approved through the Company\'s prescribed process in advance, except where genuinely not possible.',
  ),
  S(
    '10. Performance and Review',
    'Your performance may be evaluated periodically, having regard to factors such as quality, productivity, timeliness, ownership, communication, teamwork, achievement of objectives, professional conduct, and compliance with Company policy. A performance review does not, by itself, guarantee promotion or salary revision.',
  ),
  S(
    '11. Company Policies',
    'You are required to comply with the Company\'s policies as applicable to your role, including (where applicable) policies covering Code of Conduct, Attendance, Leave, Information Security, Data Protection, Acceptable Use, Prevention of Sexual Harassment, Expense Management, IT and Device Usage, and Social Media, together with any other applicable HR policy the Company may adopt from time to time.',
  ),
  S(
    '12. Confidentiality',
    'In the course of your employment, you may have access to confidential information belonging to the Company, its clients, or its employees, including but not limited to business, financial, pricing, strategic, and technical information, internal processes, software and source code, credentials, and other proprietary or commercial information. You agree not to disclose or misuse any such confidential information, whether during or after your employment, without proper authorisation.',
  ),
  S(
    '13. Intellectual Property',
    'Work product created by you in the course of your employment may be governed by the Company\'s intellectual property policies and any applicable agreements, subject to applicable law.',
  ),
  S(
    '14. Company Property and Assets',
    'Any Company property issued to you, including laptop, mobile device, software, access credentials, documents, files, or other equipment, remains the property of the Company at all times. You are responsible for its proper care and must return all such property when requested or on separation from the Company.',
  ),
  S(
    '15. Information Security and Data Protection',
    'You are required to keep your passwords and account credentials confidential, use Company systems appropriately, take reasonable steps to protect Company data, promptly report any suspected security incident, and comply with the Company\'s applicable information security policies.',
  ),
  S(
    '16. Conflict of Interest',
    'You are required to disclose any actual or potential conflict of interest to the Company and should not undertake any activity that conflicts with your responsibilities to the Company or with applicable Company policy.',
  ),
  S(
    '17. Professional Conduct',
    'You are expected to maintain a high standard of professional conduct at all times, treating colleagues, clients, and stakeholders with respect. Harassment, discrimination, fraud, dishonesty, and workplace violence will not be tolerated and will be dealt with in accordance with applicable Company policy.',
  ),
  S(
    '18. Transfer and Change of Responsibilities',
    'Business requirements may from time to time necessitate changes to your responsibilities, reporting manager, department, project, or work location. Any such change will remain subject to your applicable employment terms, Company policy, and applicable law.',
  ),
  S(
    '19. Background Verification and Documentation',
    'Your employment is subject to verification of the information and documents provided by you during recruitment and joining. Any misrepresentation discovered may be addressed in accordance with applicable Company policy.',
  ),
  S(
    '20. Notice Period and Separation',
    'Your employment may be terminated by either party in accordance with the applicable notice period and Company policy.{{#if custom.noticePeriod}} The applicable notice period for your role is {{custom.noticePeriod}}.{{/if}} On separation, you are required to complete a proper handover of your responsibilities and return all Company property in your possession.',
  ),
  S(
    '21. Resignation',
    'Should you wish to resign from your position, you are required to submit your resignation in writing through the Company\'s prescribed process, and to serve the applicable notice period or otherwise as mutually agreed with the Company.',
  ),
  S(
    '22. Termination',
    'The Company may take appropriate action, including termination of your employment, in accordance with your applicable employment terms, Company policy, and applicable law.',
  ),
  S(
    '23. Retirement',
    'Your employment will be subject to the Company\'s applicable retirement policy, where such a policy applies, in accordance with law.',
  ),
  S(
    '24. Amendments to Policies and Terms',
    'The Company\'s policies and procedures may be updated from time to time in accordance with business requirements and applicable law, and such updates will apply to you as they take effect.',
  ),
  S(
    '25. General Conditions',
    'This appointment is subject to: the accuracy of the information and documents provided by you; your compliance with applicable Company policies; your satisfactory performance and conduct; your completion of the Company\'s joining formalities; and your compliance with applicable law.{{#if custom.specialConditions}} This appointment is further subject to the following condition(s): {{custom.specialConditions}}{{/if}}{{#if custom.additionalTerms}} {{custom.additionalTerms}}{{/if}}',
  ),
  S(
    '26. Acceptance of Appointment',
    'Please sign and return a copy of this letter to confirm your acceptance of this appointment on the terms set out above.',
    'I, {{employee.fullName}} (Employee Code: {{employee.code}}), accept my appointment as {{employee.designation}}, effective {{employee.dateOfJoining}}, on the terms set out in this letter.',
    'Employee Signature: _______________________     Date: _______________',
  ),
  'We look forward to a long and mutually rewarding association with you.',
);

export const LETTER_TYPES: LetterTypeSeed[] = [
  {
    key: 'OFFER_LETTER',
    name: 'Offer Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'OFR',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'We are pleased to offer you the position of {{custom.designation}} at {{company.legalName}}. This offer is subject to the terms and conditions of your employment agreement.',
        'Your annual compensation will be {{custom.ctc}}, and your proposed date of joining is {{custom.joiningDate}}.',
        'We look forward to welcoming you to the team.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'APPOINTMENT_LETTER',
    name: 'Appointment Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'APT',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'Further to your acceptance of our offer, we are pleased to confirm your appointment as {{custom.designation}} at {{company.legalName}}, effective {{custom.effectiveDate}}.',
        'You will report to {{custom.reportingManager}}. Your employee code is {{employee.code}}.',
        'We look forward to a long and mutually rewarding association.',
        'Sincerely,',
      ),
      APPOINTMENT_LETTER_V2,
    ],
  },
  {
    key: 'CONFIRMATION_LETTER',
    name: 'Confirmation Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'CNF',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'We are pleased to confirm your employment as {{employee.designation}} in the {{employee.department}} department, effective {{custom.confirmationDate}}.',
        'This confirmation follows a satisfactory review of your performance since your date of joining, {{employee.dateOfJoining}}.',
        'Congratulations, and we look forward to your continued contribution.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'PROMOTION_LETTER',
    name: 'Promotion Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'PRM',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'We are pleased to inform you that, in recognition of your contribution, you have been promoted to {{custom.newDesignation}}, effective {{custom.effectiveDate}}.',
        'Your revised annual compensation will be {{custom.newCtc}}.',
        'Congratulations on this well-deserved achievement.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'SALARY_REVISION_LETTER',
    name: 'Salary Revision Letter',
    categoryKey: 'COMPENSATION',
    numberPrefix: 'SRV',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'We are pleased to inform you that your annual compensation has been revised to {{custom.newCtc}}, effective {{custom.effectiveDate}}.',
        'This revision reflects your performance and contribution to {{company.legalName}}.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'TRANSFER_LETTER',
    name: 'Transfer Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'TRF',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'This is to inform you that you are being transferred to {{custom.newDepartment}} at {{custom.newLocation}}, effective {{custom.effectiveDate}}.',
        'All other terms of your employment remain unchanged.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'WARNING_LETTER',
    name: 'Warning Letter',
    categoryKey: 'CONDUCT',
    numberPrefix: 'WRN',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'This letter serves as a formal warning regarding an incident on {{custom.incidentDate}}: {{custom.reason}}.',
        'You are advised to ensure this does not recur. Any further such instance may result in further disciplinary action.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'EXPERIENCE_LETTER',
    name: 'Experience Letter',
    categoryKey: 'CERTIFICATES',
    numberPrefix: 'EXP',
    versions: [
      P(
        'To Whomsoever It May Concern,',
        'This is to certify that {{employee.fullName}} (Employee Code: {{employee.code}}) was employed with {{company.legalName}} from {{employee.dateOfJoining}} until their last working day, most recently serving as {{custom.lastDesignation}}.',
        '{{custom.tenureSummary}}',
        'We wish them success in their future endeavours.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'RELIEVING_LETTER',
    name: 'Relieving Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'REL',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'This is to confirm that your resignation has been accepted and you stand relieved from your duties at {{company.legalName}}, with {{custom.lastWorkingDay}} as your last working day.',
        'We thank you for your contribution and wish you the best in your future endeavours.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'NOC_LETTER',
    name: 'No Objection Certificate',
    categoryKey: 'CERTIFICATES',
    numberPrefix: 'NOC',
    versions: [
      P(
        'To Whomsoever It May Concern,',
        'This is to certify that {{company.legalName}} has no objection to {{employee.fullName}} (Employee Code: {{employee.code}}) in connection with: {{custom.purpose}}.',
        'This certificate is issued on request for the purpose stated above.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'SALARY_CERTIFICATE',
    name: 'Salary Certificate',
    categoryKey: 'COMPENSATION',
    numberPrefix: 'SCT',
    versions: [
      P(
        'To Whomsoever It May Concern,',
        'This is to certify that {{employee.fullName}} (Employee Code: {{employee.code}}) is employed with {{company.legalName}} as {{employee.designation}}, with a current monthly compensation of {{custom.monthlyCtc}}.',
        'This certificate is issued for the purpose of: {{custom.purpose}}.',
        'Sincerely,',
      ),
    ],
  },
  {
    key: 'TERMINATION_LETTER',
    name: 'Termination Letter',
    categoryKey: 'EMPLOYMENT_LIFECYCLE',
    numberPrefix: 'TRM',
    versions: [
      P(
        'Dear {{employee.fullName}},',
        'This is to inform you that your employment with {{company.legalName}} is terminated, effective {{custom.lastWorkingDay}}, for the following reason: {{custom.reason}}.',
        'Please contact HR regarding the settlement of your dues and return of company property.',
        'Sincerely,',
      ),
    ],
  },
];
