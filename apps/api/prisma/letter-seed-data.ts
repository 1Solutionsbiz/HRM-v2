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

/**
 * Appointment Letter v3 (2026-09-11): v2 was judged not comprehensive
 * enough for an official personnel-file document - each section read as a
 * single sentence. v3 expands every section into genuine substantive
 * prose (~3,000 words before rendering) without inventing any fact v2
 * didn't already have available: no new custom variables, no new fixed
 * variables, same optional-field conditional-omission behaviour. Purely a
 * content depth and presentation revision - v1 and v2 are untouched and
 * every letter already generated from either keeps rendering exactly as
 * it always did (see EmployeeLetter.renderedContent's snapshot + the
 * append-only LetterTemplateVersion history).
 */
const APPOINTMENT_LETTER_V3 = P(
  '{{employee.fullName}}{{#if employee.address}}\n{{employee.address}}{{/if}}',
  'Subject: Appointment as {{employee.designation}}',
  'Dear {{employee.firstName}},',
  'Further to the discussions between you and {{company.legalName}} ("the Company"), we are pleased to confirm your appointment on the terms and conditions set out in this letter ("the Appointment Letter"). We request you to read this letter carefully, as it forms part of your terms of employment. Please sign and return a copy in confirmation of your acceptance, as set out at the end of this letter.',
  S(
    '1. Appointment and Designation',
    'The Company is pleased to appoint you as {{employee.designation}}{{#if employee.department}}, within the {{employee.department}} department{{/if}}, effective from {{employee.dateOfJoining}}. This appointment is made on the basis of the information, representations, qualifications, and experience furnished by you during the recruitment process, and the Company\'s assessment of your suitability for this role.{{#if employee.reportingManager}} In this role, you will report to {{employee.reportingManager}}, or to such other person as the Company may designate from time to time.{{/if}} Your employee code for all official Company records, correspondence, and systems is {{employee.code}}, and this code should be quoted in all communication relating to your employment. This letter, together with the Company\'s policies referred to herein, constitutes the governing employment relationship between you and the Company from the date of joining.',
  ),
  S(
    '2. Date of Joining',
    'Your employment with the Company is effective from {{employee.dateOfJoining}}, and this is the date from which your continuous service with the Company will be reckoned for all purposes, including probation, performance review cycles, leave accrual, and benefit eligibility, in each case subject to the applicable Company policy in force at the relevant time. Should you, for any reason, be unable to join on this date, you are required to inform the Company in writing at the earliest opportunity so that appropriate arrangements can be made; the Company reserves the right to treat this offer of appointment as withdrawn if you fail to join within a reasonable period without prior intimation.',
  ),
  S(
    '3. Place of Work',
    'Your initial place of work will be {{employee.workLocation}}. Given the nature of the Company\'s business, you may be required, from time to time, to work from or be assigned to another office, client site, project location, or business location of the Company, whether on a temporary or ongoing basis, where the Company reasonably determines this to be necessary. Where the Company operates or permits remote or hybrid working arrangements for your role, these will be subject to the Company\'s applicable policy on the subject, as may be communicated to you and updated from time to time. Any change of work location will, so far as reasonably practicable, be discussed with you in advance and will remain subject to applicable Company policy and applicable law.',
  ),
  S(
    '4. Nature of Employment',
    'Your employment with the Company is on a {{employee.employmentType}} basis. You are expected to devote your full professional time, skill, and attention to the duties and responsibilities of your role during working hours, and to discharge those responsibilities diligently, honestly, and to the best of your ability. You are expected to comply with the Company\'s standard operating procedures, reporting lines, and internal processes applicable to your role and department, and to act at all times in a manner consistent with the interests of the Company. Nothing in this letter should be construed as a guarantee of continued employment for any particular duration, and your employment remains subject to the terms set out in this letter and applicable law.',
  ),
  S(
    '5. Probation',
    'Your appointment is subject to a period of probation, during which the Company will assess your performance, conduct, attendance, and overall suitability for the role.{{#if custom.probationPeriod}} The probation period applicable to your appointment is {{custom.probationPeriod}}, commencing from your date of joining.{{/if}} During probation, you are expected to demonstrate the competencies, work quality, and conduct expected of your role, and your reporting manager may provide feedback to help you meet these expectations. The Company may, at its discretion, extend the probation period where it considers further evaluation necessary, and will inform you in writing of any such extension and the revised period. On satisfactory completion of probation, your employment will be confirmed in writing in accordance with the Company\'s confirmation process; confirmation is not automatic and remains subject to a satisfactory assessment of your performance and conduct during the probation period.',
  ),
  S(
    '6. Compensation',
    'In consideration of your services, the Company will pay you an annual compensation of {{custom.annualCompensation}}.{{#if custom.monthlyCompensation}} This corresponds to a monthly compensation of {{custom.monthlyCompensation}}.{{/if}} Your compensation is paid on the Company\'s standard monthly payroll cycle, subject to applicable statutory deductions (including but not limited to income tax and employee provident fund contributions, where applicable) and any employer contributions the Company is required or agrees to make under applicable law. The detailed breakup of your compensation into its constituent components, along with any applicable allowances, benefits, or reimbursements, will be communicated to you separately and may be revised by the Company from time to time in accordance with its compensation policy, applicable law, and your performance. Any future revision to your compensation will be communicated to you in writing and does not require an amendment to this letter.',
  ),
  S(
    '7. Duties and Responsibilities',
    'You are expected to perform the duties and responsibilities associated with your role diligently and to the standard reasonably expected of a person in your position, and to work towards the objectives agreed with your reporting manager from time to time. This includes maintaining the quality standards applicable to your work, completing assigned tasks within agreed timelines, and taking ownership of matters entrusted to you. You are expected to maintain proper documentation of your work where required by your role or by Company process, to collaborate constructively with your colleagues and team, and to interact professionally with clients, vendors, and other stakeholders as your role requires. You are expected to attend and participate constructively in meetings, performance reviews, and training or development sessions relevant to your role, and to take reasonable care to protect the Company\'s resources, equipment, and information in the course of your work. This letter does not purport to set out an exhaustive job description; the specific duties of your role will be communicated to you by your reporting manager and may evolve with business requirements.',
  ),
  S(
    '8. Working Hours and Attendance',
    'You are required to observe the working hours, shift timings, and attendance requirements applicable to your role and location, as communicated to you by the Company or your reporting manager and as may be updated from time to time in accordance with Company policy. You are expected to be punctual and to record your attendance through the Company\'s prescribed attendance system or procedure. If you are unable to attend work, or expect to be late, you are required to inform your reporting manager in a timely manner and in accordance with the Company\'s reporting procedure. Unauthorised absence from work, and repeated or unexplained late attendance, may be treated as a matter of conduct and addressed in accordance with the Company\'s applicable policy, up to and including disciplinary action where warranted.',
  ),
  S(
    '9. Leave and Holidays',
    'Your entitlement to leave, and the holidays observed by the Company, will be governed by the Company\'s applicable leave and holiday policy as in force from time to time, and by applicable law. All leave must be applied for and approved in advance through the Company\'s prescribed leave request and approval process, save in genuine circumstances where prior application is not reasonably possible, in which case you should inform your reporting manager at the earliest opportunity. Unapproved absence will not be treated as sanctioned leave. Nothing in this letter should be read as setting out a specific leave entitlement; your leave entitlement is as set out in the Company\'s leave policy applicable to your role and location, as may be updated from time to time.',
  ),
  S(
    '10. Performance and Review',
    'Your performance in the role will be reviewed periodically in accordance with the Company\'s performance management process then in force. Such reviews may have regard to factors including the quality and timeliness of your work, productivity, ownership of responsibilities, communication and teamwork, achievement of agreed objectives, professional conduct, and compliance with applicable Company policy. Feedback from these reviews may inform decisions relating to your development, training needs, and future role within the Company. For the avoidance of doubt, a satisfactory performance review does not, by itself, entitle you to promotion, a change in designation, or a revision in compensation; any such decision remains at the discretion of the Company, having regard to business requirements, budgets, and your overall performance and conduct.',
  ),
  S(
    '11. Company Policies',
    'You are required to familiarise yourself with, and comply with, the Company\'s policies and procedures applicable to your role, as they may be communicated to you and updated from time to time. These may include, where applicable and as adopted by the Company, policies relating to Code of Conduct, Attendance, Leave, Information Security, Data Protection, Acceptable Use of Company systems, Prevention of Sexual Harassment at the Workplace, Expense Management, IT and Device Usage, and Social Media, together with any other human resources policy the Company may adopt from time to time. Where a specific policy has not been separately issued to you, the general principles of professional conduct and compliance described in this letter will apply. Compliance with applicable Company policy is a condition of your continued employment.',
  ),
  S(
    '12. Confidentiality',
    'In the course of your employment, you are likely to have access to confidential and proprietary information belonging to the Company, its clients, its customers, or its employees. Such information may include, without limitation, client and customer information, employee information, financial information, pricing and commercial terms, business strategy, internal processes and methodologies, technical information, software and source code, login credentials and access details, and other proprietary or commercial documents and information not generally available to the public. You agree to hold all such confidential information in strict confidence, to use it only for the purposes of your employment, and not to disclose, publish, or misuse it in any manner, whether during your employment or after its termination, except as required by law or with the Company\'s prior written authorisation. This obligation of confidentiality survives the termination of your employment for any reason.',
  ),
  S(
    '13. Intellectual Property',
    'Any work product, invention, material, process, or other output that you create, develop, or contribute to in the course of your employment, using the Company\'s time, resources, or confidential information, may be governed by the Company\'s intellectual property policy and any applicable agreement between you and the Company, in each case subject to applicable law. Nothing in this letter is intended to claim rights over work created by you entirely outside the course of your employment and without use of the Company\'s resources or confidential information, except as may be separately agreed in writing or required by applicable law.',
  ),
  S(
    '14. Company Property and Assets',
    'The Company may, in connection with your role, provide you with property and assets including, where applicable, a laptop or other computing device, mobile device, software licences, access credentials, identification and access cards, documents, files, and other equipment. All such property remains the property of the Company at all times, and you are responsible for its proper care, safe custody, and use solely for purposes connected with your employment. You are required to return all Company property in your possession or control promptly upon request, or in any event upon separation from the Company, in good working condition, ordinary wear and tear excepted.',
  ),
  S(
    '15. Information Security and Data Protection',
    'You are required to keep your passwords, login credentials, and access details confidential, and not to share them with any other person. You are required to use the Company\'s systems, devices, and networks appropriately and only for purposes connected with your employment, to take reasonable steps to protect Company data and information (including personal data of employees, clients, and customers) from unauthorised access, loss, or disclosure, and to promptly report any suspected security incident, data breach, or loss of Company property or information to the appropriate person within the Company. You are required to comply with the Company\'s applicable information security and data protection policies and procedures, as updated from time to time.',
  ),
  S(
    '16. Conflict of Interest',
    'You are required to avoid situations that give rise to an actual or potential conflict between your personal interests and the interests of the Company, and to promptly disclose to the Company any such actual or potential conflict of which you become aware. This may include, where relevant, outside employment, consultancy, or business activity that could reasonably be expected to affect your ability to perform your duties, compete with the Company\'s business, or otherwise adversely affect the Company\'s interests. This clause is not intended to unreasonably restrict your ability to pursue personal or professional activities outside your role; it requires disclosure and good-faith cooperation with the Company to protect its legitimate business interests, in accordance with applicable Company policy and law.',
  ),
  S(
    '17. Professional Conduct',
    'You are expected to maintain a high standard of professional conduct at all times in the course of your employment, and to treat your colleagues, clients, customers, and other stakeholders of the Company with courtesy and respect. Harassment, discrimination, fraud, dishonesty, and workplace violence, in any form, will not be tolerated, and any instance will be addressed in accordance with the Company\'s applicable policy, which may include disciplinary action up to and including termination of employment, in each case in accordance with applicable law and principles of natural justice.',
  ),
  S(
    '18. Transfer and Change of Responsibilities',
    'The Company\'s business needs may, from time to time, require reasonable changes to your department, project assignment, responsibilities, reporting manager, or place of work. Any such change will be made having regard to business requirements and, so far as reasonably practicable, communicated to you in advance, and will remain subject to your applicable employment terms, Company policy, and applicable law. This letter should not be read as fixing your role, department, or reporting line permanently for the duration of your employment.',
  ),
  S(
    '19. Background Verification and Documentation',
    'This appointment, and your continued employment, is subject to the accuracy of the information, representations, and documents provided by you during the recruitment and joining process, and to any background verification the Company may choose to conduct, whether before or after your date of joining, in accordance with applicable law. Should the Company discover that any information or document provided by you is false, misleading, or materially inaccurate, the Company reserves the right to take appropriate action, which may include termination of your employment, in accordance with applicable Company policy and law.',
  ),
  S(
    '20. Notice Period and Separation',
    'Your employment may be terminated by either you or the Company in accordance with the applicable notice period and the Company\'s policy in force at the relevant time.{{#if custom.noticePeriod}} The notice period applicable to your role is {{custom.noticePeriod}}.{{/if}} During any notice period, you are expected to continue to discharge your responsibilities diligently and to cooperate fully with a proper and orderly handover of your work, responsibilities, and any documents, files, or information in your possession, to the person(s) designated by the Company. On separation, for any reason, you are required to complete the Company\'s exit formalities, settle any outstanding dues to the Company, and return all Company property in your possession or control, as described in this letter.',
  ),
  S(
    '21. Resignation',
    'Should you wish to resign from your employment, you are required to submit your resignation in writing through the Company\'s prescribed process, and to serve the applicable notice period referred to above, or such shorter period as may be mutually agreed in writing with the Company. The Company may, at its discretion, agree to waive or reduce the notice period, or require you to serve the full notice period, having regard to business requirements.',
  ),
  S(
    '22. Termination',
    'The Company may terminate your employment, including during or after the probation period, in accordance with your applicable employment terms, the Company\'s policy in force at the relevant time, and applicable law, including in circumstances of unsatisfactory performance, misconduct, redundancy, or other business reasons. Nothing in this letter is intended to set out an exhaustive statement of the grounds or procedure for termination; the applicable procedure will be that required under your employment terms, Company policy, and applicable law at the relevant time.',
  ),
  S(
    '23. Retirement',
    'Your employment will, where applicable, be subject to the Company\'s retirement policy as in force from time to time, in accordance with applicable law. This letter does not itself specify a retirement age.',
  ),
  S(
    '24. Amendments to Policies and Terms',
    'The Company\'s policies, procedures, and benefits referred to in this letter may be introduced, updated, or withdrawn from time to time in accordance with business requirements and applicable law, and any such change will apply to you from the date it takes effect, whether or not this letter is separately amended.',
  ),
  S(
    '25. General Conditions',
    'This appointment, and its continuation, is subject to: the accuracy and completeness of the information and documents provided by you; your compliance with applicable Company policies and procedures; your satisfactory performance and conduct; your completion of the Company\'s joining and onboarding formalities; and your compliance with applicable law.{{#if custom.specialConditions}} This appointment is further subject to the following condition(s): {{custom.specialConditions}}{{/if}}{{#if custom.additionalTerms}} {{custom.additionalTerms}}{{/if}} In the event of any conflict between this letter and a specific Company policy, the terms of this letter will prevail to the extent of the conflict, unless applicable law requires otherwise.',
  ),
  S(
    '26. Acceptance of Appointment',
    'We are confident that you will find your association with the Company both professionally rewarding and personally satisfying. Please sign and return a copy of this letter, along with the acceptance below duly completed, to confirm your acceptance of this appointment on the terms set out in this letter.',
    'I, {{employee.fullName}} (Employee Code: {{employee.code}}), confirm that I have read and understood this Appointment Letter and accept my appointment as {{employee.designation}}, effective {{employee.dateOfJoining}}, on the terms set out herein.',
    'Employee Signature: _______________________     Date: _______________',
  ),
  'We look forward to a long and mutually rewarding association with you.',
);

/**
 * Appointment Letter v4 (2026-09-11): same 26 sections and the same
 * substantive wording as v3 - not a content rewrite. Restyled to match the
 * visual format of a reference appointment letter the user supplied
 * (uppercase section headings with a rule under each, bulleted lists
 * inside sections that already enumerate items, and a structured
 * Employee Acceptance block of labelled lines instead of one dense
 * paragraph). The uppercasing and dividers are handled by letter-pdf.ts
 * itself; the only content-level change here is restructuring four
 * sections (Company Policies, Confidentiality, Company Property and
 * Assets, General Conditions) from an inline comma-separated list into
 * "- " bullet lines, and section 26's closing into labelled acceptance
 * lines - both using facts already stated in v3, not new ones.
 */
const APPOINTMENT_LETTER_V4 = P(
  '{{employee.fullName}}{{#if employee.address}}\n{{employee.address}}{{/if}}',
  'Subject: Appointment as {{employee.designation}}',
  'Dear {{employee.firstName}},',
  'Further to the discussions between you and {{company.legalName}} ("the Company"), we are pleased to confirm your appointment on the terms and conditions set out in this letter ("the Appointment Letter"). We request you to read this letter carefully, as it forms part of your terms of employment. Please sign and return a copy in confirmation of your acceptance, as set out at the end of this letter.',
  S(
    '1. Appointment and Designation',
    'The Company is pleased to appoint you as {{employee.designation}}{{#if employee.department}}, within the {{employee.department}} department{{/if}}, effective from {{employee.dateOfJoining}}. This appointment is made on the basis of the information, representations, qualifications, and experience furnished by you during the recruitment process, and the Company\'s assessment of your suitability for this role.{{#if employee.reportingManager}} In this role, you will report to {{employee.reportingManager}}, or to such other person as the Company may designate from time to time.{{/if}} Your employee code for all official Company records, correspondence, and systems is {{employee.code}}, and this code should be quoted in all communication relating to your employment. This letter, together with the Company\'s policies referred to herein, constitutes the governing employment relationship between you and the Company from the date of joining.',
  ),
  S(
    '2. Date of Joining',
    'Your employment with the Company is effective from {{employee.dateOfJoining}}, and this is the date from which your continuous service with the Company will be reckoned for all purposes, including probation, performance review cycles, leave accrual, and benefit eligibility, in each case subject to the applicable Company policy in force at the relevant time. Should you, for any reason, be unable to join on this date, you are required to inform the Company in writing at the earliest opportunity so that appropriate arrangements can be made; the Company reserves the right to treat this offer of appointment as withdrawn if you fail to join within a reasonable period without prior intimation.',
  ),
  S(
    '3. Place of Work',
    'Your initial place of work will be {{employee.workLocation}}. Given the nature of the Company\'s business, you may be required, from time to time, to work from or be assigned to another office, client site, project location, or business location of the Company, whether on a temporary or ongoing basis, where the Company reasonably determines this to be necessary. Where the Company operates or permits remote or hybrid working arrangements for your role, these will be subject to the Company\'s applicable policy on the subject, as may be communicated to you and updated from time to time. Any change of work location will, so far as reasonably practicable, be discussed with you in advance and will remain subject to applicable Company policy and applicable law.',
  ),
  S(
    '4. Nature of Employment',
    'Your employment with the Company is on a {{employee.employmentType}} basis. You are expected to devote your full professional time, skill, and attention to the duties and responsibilities of your role during working hours, and to discharge those responsibilities diligently, honestly, and to the best of your ability. You are expected to comply with the Company\'s standard operating procedures, reporting lines, and internal processes applicable to your role and department, and to act at all times in a manner consistent with the interests of the Company. Nothing in this letter should be construed as a guarantee of continued employment for any particular duration, and your employment remains subject to the terms set out in this letter and applicable law.',
  ),
  S(
    '5. Probation',
    'Your appointment is subject to a period of probation, during which the Company will assess your performance, conduct, attendance, and overall suitability for the role.{{#if custom.probationPeriod}} The probation period applicable to your appointment is {{custom.probationPeriod}}, commencing from your date of joining.{{/if}} During probation, you are expected to demonstrate the competencies, work quality, and conduct expected of your role, and your reporting manager may provide feedback to help you meet these expectations. The Company may, at its discretion, extend the probation period where it considers further evaluation necessary, and will inform you in writing of any such extension and the revised period. On satisfactory completion of probation, your employment will be confirmed in writing in accordance with the Company\'s confirmation process; confirmation is not automatic and remains subject to a satisfactory assessment of your performance and conduct during the probation period.',
  ),
  S(
    '6. Compensation',
    'In consideration of your services, the Company will pay you an annual compensation of {{custom.annualCompensation}}.{{#if custom.monthlyCompensation}} This corresponds to a monthly compensation of {{custom.monthlyCompensation}}.{{/if}} Your compensation is paid on the Company\'s standard monthly payroll cycle, subject to applicable statutory deductions (including but not limited to income tax and employee provident fund contributions, where applicable) and any employer contributions the Company is required or agrees to make under applicable law. The detailed breakup of your compensation into its constituent components, along with any applicable allowances, benefits, or reimbursements, will be communicated to you separately and may be revised by the Company from time to time in accordance with its compensation policy, applicable law, and your performance. Any future revision to your compensation will be communicated to you in writing and does not require an amendment to this letter.',
  ),
  S(
    '7. Duties and Responsibilities',
    'You are expected to perform the duties and responsibilities associated with your role diligently and to the standard reasonably expected of a person in your position, and to work towards the objectives agreed with your reporting manager from time to time. This includes maintaining the quality standards applicable to your work, completing assigned tasks within agreed timelines, and taking ownership of matters entrusted to you. You are expected to maintain proper documentation of your work where required by your role or by Company process, to collaborate constructively with your colleagues and team, and to interact professionally with clients, vendors, and other stakeholders as your role requires. You are expected to attend and participate constructively in meetings, performance reviews, and training or development sessions relevant to your role, and to take reasonable care to protect the Company\'s resources, equipment, and information in the course of your work. This letter does not purport to set out an exhaustive job description; the specific duties of your role will be communicated to you by your reporting manager and may evolve with business requirements.',
  ),
  S(
    '8. Working Hours and Attendance',
    'You are required to observe the working hours, shift timings, and attendance requirements applicable to your role and location, as communicated to you by the Company or your reporting manager and as may be updated from time to time in accordance with Company policy. You are expected to be punctual and to record your attendance through the Company\'s prescribed attendance system or procedure. If you are unable to attend work, or expect to be late, you are required to inform your reporting manager in a timely manner and in accordance with the Company\'s reporting procedure. Unauthorised absence from work, and repeated or unexplained late attendance, may be treated as a matter of conduct and addressed in accordance with the Company\'s applicable policy, up to and including disciplinary action where warranted.',
  ),
  S(
    '9. Leave and Holidays',
    'Your entitlement to leave, and the holidays observed by the Company, will be governed by the Company\'s applicable leave and holiday policy as in force from time to time, and by applicable law. All leave must be applied for and approved in advance through the Company\'s prescribed leave request and approval process, save in genuine circumstances where prior application is not reasonably possible, in which case you should inform your reporting manager at the earliest opportunity. Unapproved absence will not be treated as sanctioned leave. Nothing in this letter should be read as setting out a specific leave entitlement; your leave entitlement is as set out in the Company\'s leave policy applicable to your role and location, as may be updated from time to time.',
  ),
  S(
    '10. Performance and Review',
    'Your performance in the role will be reviewed periodically in accordance with the Company\'s performance management process then in force. Such reviews may have regard to factors including the quality and timeliness of your work, productivity, ownership of responsibilities, communication and teamwork, achievement of agreed objectives, professional conduct, and compliance with applicable Company policy. Feedback from these reviews may inform decisions relating to your development, training needs, and future role within the Company. For the avoidance of doubt, a satisfactory performance review does not, by itself, entitle you to promotion, a change in designation, or a revision in compensation; any such decision remains at the discretion of the Company, having regard to business requirements, budgets, and your overall performance and conduct.',
  ),
  S(
    '11. Company Policies',
    'You are required to familiarise yourself with, and comply with, the Company\'s policies and procedures applicable to your role, as they may be communicated to you and updated from time to time. These may include, where applicable and as adopted by the Company, policies relating to:',
    '- Code of Conduct',
    '- Attendance and Leave',
    '- Information Security and Data Protection',
    '- Acceptable Use of Company Systems',
    '- Prevention of Sexual Harassment at the Workplace',
    '- Expense Management',
    '- IT and Device Usage',
    '- Social Media',
    'together with any other human resources policy the Company may adopt from time to time. Where a specific policy has not been separately issued to you, the general principles of professional conduct and compliance described in this letter will apply. Compliance with applicable Company policy is a condition of your continued employment.',
  ),
  S(
    '12. Confidentiality',
    'In the course of your employment, you are likely to have access to confidential and proprietary information belonging to the Company, its clients, its customers, or its employees. Such information may include, without limitation:',
    '- Client and customer information',
    '- Employee information',
    '- Financial information, pricing, and commercial terms',
    '- Business strategy, internal processes, and methodologies',
    '- Technical information, software, and source code',
    '- Login credentials and access details',
    '- Other proprietary or commercial documents and information not generally available to the public',
    'You agree to hold all such confidential information in strict confidence, to use it only for the purposes of your employment, and not to disclose, publish, or misuse it in any manner, whether during your employment or after its termination, except as required by law or with the Company\'s prior written authorisation. This obligation of confidentiality survives the termination of your employment for any reason.',
  ),
  S(
    '13. Intellectual Property',
    'Any work product, invention, material, process, or other output that you create, develop, or contribute to in the course of your employment, using the Company\'s time, resources, or confidential information, may be governed by the Company\'s intellectual property policy and any applicable agreement between you and the Company, in each case subject to applicable law. Nothing in this letter is intended to claim rights over work created by you entirely outside the course of your employment and without use of the Company\'s resources or confidential information, except as may be separately agreed in writing or required by applicable law.',
  ),
  S(
    '14. Company Property and Assets',
    'The Company may, in connection with your role, provide you with property and assets including, where applicable:',
    '- Laptop or other computing device',
    '- Mobile device',
    '- Software licences and access credentials',
    '- Identification and access cards',
    '- Documents and files',
    '- Other Company equipment',
    'All such property remains the property of the Company at all times, and you are responsible for its proper care, safe custody, and use solely for purposes connected with your employment. You are required to return all Company property in your possession or control promptly upon request, or in any event upon separation from the Company, in good working condition, ordinary wear and tear excepted.',
  ),
  S(
    '15. Information Security and Data Protection',
    'You are required to keep your passwords, login credentials, and access details confidential, and not to share them with any other person. You are required to use the Company\'s systems, devices, and networks appropriately and only for purposes connected with your employment, to take reasonable steps to protect Company data and information (including personal data of employees, clients, and customers) from unauthorised access, loss, or disclosure, and to promptly report any suspected security incident, data breach, or loss of Company property or information to the appropriate person within the Company. You are required to comply with the Company\'s applicable information security and data protection policies and procedures, as updated from time to time.',
  ),
  S(
    '16. Conflict of Interest',
    'You are required to avoid situations that give rise to an actual or potential conflict between your personal interests and the interests of the Company, and to promptly disclose to the Company any such actual or potential conflict of which you become aware. This may include, where relevant, outside employment, consultancy, or business activity that could reasonably be expected to affect your ability to perform your duties, compete with the Company\'s business, or otherwise adversely affect the Company\'s interests. This clause is not intended to unreasonably restrict your ability to pursue personal or professional activities outside your role; it requires disclosure and good-faith cooperation with the Company to protect its legitimate business interests, in accordance with applicable Company policy and law.',
  ),
  S(
    '17. Professional Conduct',
    'You are expected to maintain a high standard of professional conduct at all times in the course of your employment, and to treat your colleagues, clients, customers, and other stakeholders of the Company with courtesy and respect. Harassment, discrimination, fraud, dishonesty, and workplace violence, in any form, will not be tolerated, and any instance will be addressed in accordance with the Company\'s applicable policy, which may include disciplinary action up to and including termination of employment, in each case in accordance with applicable law and principles of natural justice.',
  ),
  S(
    '18. Transfer and Change of Responsibilities',
    'The Company\'s business needs may, from time to time, require reasonable changes to your department, project assignment, responsibilities, reporting manager, or place of work. Any such change will be made having regard to business requirements and, so far as reasonably practicable, communicated to you in advance, and will remain subject to your applicable employment terms, Company policy, and applicable law. This letter should not be read as fixing your role, department, or reporting line permanently for the duration of your employment.',
  ),
  S(
    '19. Background Verification and Documentation',
    'This appointment, and your continued employment, is subject to the accuracy of the information, representations, and documents provided by you during the recruitment and joining process, and to any background verification the Company may choose to conduct, whether before or after your date of joining, in accordance with applicable law. Should the Company discover that any information or document provided by you is false, misleading, or materially inaccurate, the Company reserves the right to take appropriate action, which may include termination of your employment, in accordance with applicable Company policy and law.',
  ),
  S(
    '20. Notice Period and Separation',
    'Your employment may be terminated by either you or the Company in accordance with the applicable notice period and the Company\'s policy in force at the relevant time.{{#if custom.noticePeriod}} The notice period applicable to your role is {{custom.noticePeriod}}.{{/if}} During any notice period, you are expected to continue to discharge your responsibilities diligently and to cooperate fully with a proper and orderly handover of your work, responsibilities, and any documents, files, or information in your possession, to the person(s) designated by the Company. On separation, for any reason, you are required to complete the Company\'s exit formalities, settle any outstanding dues to the Company, and return all Company property in your possession or control, as described in this letter.',
  ),
  S(
    '21. Resignation',
    'Should you wish to resign from your employment, you are required to submit your resignation in writing through the Company\'s prescribed process, and to serve the applicable notice period referred to above, or such shorter period as may be mutually agreed in writing with the Company. The Company may, at its discretion, agree to waive or reduce the notice period, or require you to serve the full notice period, having regard to business requirements.',
  ),
  S(
    '22. Termination',
    'The Company may terminate your employment, including during or after the probation period, in accordance with your applicable employment terms, the Company\'s policy in force at the relevant time, and applicable law, including in circumstances of unsatisfactory performance, misconduct, redundancy, or other business reasons. Nothing in this letter is intended to set out an exhaustive statement of the grounds or procedure for termination; the applicable procedure will be that required under your employment terms, Company policy, and applicable law at the relevant time.',
  ),
  S(
    '23. Retirement',
    'Your employment will, where applicable, be subject to the Company\'s retirement policy as in force from time to time, in accordance with applicable law. This letter does not itself specify a retirement age.',
  ),
  S(
    '24. Amendments to Policies and Terms',
    'The Company\'s policies, procedures, and benefits referred to in this letter may be introduced, updated, or withdrawn from time to time in accordance with business requirements and applicable law, and any such change will apply to you from the date it takes effect, whether or not this letter is separately amended.',
  ),
  S(
    '25. General Conditions',
    'This appointment, and its continuation, is subject to:',
    '- The accuracy and completeness of the information and documents provided by you',
    '- Your compliance with applicable Company policies and procedures',
    '- Your satisfactory performance and conduct',
    '- Your completion of the Company\'s joining and onboarding formalities',
    '- Your compliance with applicable law',
    '{{#if custom.specialConditions}}This appointment is further subject to the following condition(s): {{custom.specialConditions}}.{{/if}}{{#if custom.additionalTerms}} {{custom.additionalTerms}}{{/if}}',
    'In the event of any conflict between this letter and a specific Company policy, the terms of this letter will prevail to the extent of the conflict, unless applicable law requires otherwise.',
  ),
  S(
    '26. Acceptance of Appointment',
    'We are confident that you will find your association with the Company both professionally rewarding and personally satisfying. Please sign and return a copy of this letter, along with the acceptance below duly completed, to confirm your acceptance of this appointment on the terms set out in this letter.',
    'I, {{employee.fullName}}, confirm that I have read and understood this Appointment Letter and accept my appointment on the terms set out herein.',
    'Employee Name: {{employee.fullName}}',
    'Employee Code: {{employee.code}}',
    'Designation: {{employee.designation}}',
    '{{#if employee.department}}Department: {{employee.department}}{{/if}}',
    'Date of Joining: {{employee.dateOfJoining}}',
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
      APPOINTMENT_LETTER_V3,
      APPOINTMENT_LETTER_V4,
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
