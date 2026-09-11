import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  extractTemplateTokens,
  formatLongDate,
  renderTemplate,
  resolveFixedVariables,
  validateCustomVariables,
  validateRequiredCustomVariables,
  validateTemplateTokens,
} from './template-variables.js';

describe('extractTemplateTokens', () => {
  it('finds every distinct {{token}} in the content', () => {
    const content = 'Dear {{employee.fullName}}, your code is {{employee.code}}. Welcome, {{employee.fullName}}!';
    expect(extractTemplateTokens(content)).toEqual(['employee.fullName', 'employee.code']);
  });

  it('returns an empty list for content with no tokens', () => {
    expect(extractTemplateTokens('No variables here.')).toEqual([]);
  });
});

describe('validateTemplateTokens', () => {
  it('passes when every token is a fixed variable', () => {
    expect(() =>
      validateTemplateTokens('Dear {{employee.fullName}}, joined {{employee.dateOfJoining}}.', 'RELIEVING_LETTER'),
    ).not.toThrow();
  });

  it('passes when a token is a custom variable declared for that letter type', () => {
    expect(() =>
      validateTemplateTokens('Your CTC is {{custom.ctc}}.', 'OFFER_LETTER'),
    ).not.toThrow();
  });

  it('rejects a token from another letter type\'s custom variable set', () => {
    // custom.ctc belongs to OFFER_LETTER, not WARNING_LETTER
    expect(() =>
      validateTemplateTokens('Amount: {{custom.ctc}}.', 'WARNING_LETTER'),
    ).toThrow(BadRequestException);
  });

  it('rejects a completely made-up token', () => {
    expect(() =>
      validateTemplateTokens('{{employee.socialSecurityNumber}}', 'OFFER_LETTER'),
    ).toThrow(BadRequestException);
  });

  it('rejects an attempt to smuggle a raw custom.* namespace without a declared key', () => {
    expect(() =>
      validateTemplateTokens('{{custom.anything}}', 'RELIEVING_LETTER'),
    ).toThrow(BadRequestException);
  });
});

describe('validateCustomVariables', () => {
  it('passes when supplied keys are exactly the declared set', () => {
    expect(() =>
      validateCustomVariables('OFFER_LETTER', { designation: 'x', ctc: 'y', joiningDate: 'z' }),
    ).not.toThrow();
  });

  it('rejects a supplied key the letter type never declared', () => {
    expect(() =>
      validateCustomVariables('RELIEVING_LETTER', { lastWorkingDay: 'x', bonus: 'y' }),
    ).toThrow(BadRequestException);
  });
});

describe('validateRequiredCustomVariables', () => {
  it('rejects a missing required custom variable', () => {
    expect(() => validateRequiredCustomVariables('RELIEVING_LETTER', {})).toThrow(BadRequestException);
  });

  it('rejects a blank (whitespace-only) required custom variable', () => {
    expect(() =>
      validateRequiredCustomVariables('RELIEVING_LETTER', { lastWorkingDay: '   ' }),
    ).toThrow(BadRequestException);
  });

  it('passes when every declared key has a real value', () => {
    expect(() =>
      validateRequiredCustomVariables('RELIEVING_LETTER', { lastWorkingDay: '2026-09-30' }),
    ).not.toThrow();
  });
});

describe('renderTemplate', () => {
  it('substitutes every token with its resolved value', () => {
    const out = renderTemplate('Dear {{employee.fullName}}, code {{employee.code}}.', {
      'employee.fullName': 'Ritika Sharma',
      'employee.code': 'EMP-0042',
    });
    expect(out).toBe('Dear Ritika Sharma, code EMP-0042.');
  });

  it('throws instead of leaving a raw {{token}} in the output when unresolved', () => {
    expect(() => renderTemplate('Hello {{employee.fullName}}', {})).toThrow(BadRequestException);
  });
});

describe('resolveFixedVariables', () => {
  it('resolves every fixed key from the source object', () => {
    const resolved = resolveFixedVariables({
      employee: {
        firstName: 'Ritika',
        lastName: 'Sharma',
        employeeCode: 'EMP-0042',
        email: 'ritika@1solutions.biz',
        department: 'Operations',
        designation: 'Senior Analyst',
        dateOfJoining: new Date(Date.UTC(2024, 2, 15)),
        employmentType: 'FULL_TIME',
        workLocation: 'Delhi',
      },
      company: {
        legalName: '1Solutions Pvt Ltd',
        brandName: '1Solutions',
        address: '123 Business Park',
        website: 'https://1solutions.biz',
        supportEmail: 'hr@1solutions.biz',
      },
      documentNumber: 'APT/2026/0001',
      generatedAt: new Date(Date.UTC(2026, 8, 11)),
      signatory: { name: 'Atul Chaudhary', title: 'Director' },
    });

    expect(resolved['employee.fullName']).toBe('Ritika Sharma');
    expect(resolved['employee.dateOfJoining']).toBe('15 March 2024');
    expect(resolved['letter.documentNumber']).toBe('APT/2026/0001');
    expect(resolved['letter.date']).toBe('11 September 2026');
    expect(resolved['signatory.name']).toBe('Atul Chaudhary');
    expect(resolved['signatory.title']).toBe('Director');
  });

  it('falls back to a placeholder for missing optional employee fields', () => {
    const resolved = resolveFixedVariables({
      employee: {
        firstName: 'Ritika',
        lastName: 'Sharma',
        employeeCode: 'EMP-0042',
        email: 'ritika@1solutions.biz',
        department: null,
        designation: null,
        dateOfJoining: new Date(Date.UTC(2024, 2, 15)),
        employmentType: 'FULL_TIME',
        workLocation: null,
      },
      company: {
        legalName: '1Solutions Pvt Ltd',
        brandName: '1Solutions',
        address: null,
        website: null,
        supportEmail: 'hr@1solutions.biz',
      },
      documentNumber: 'APT/2026/0001',
      generatedAt: new Date(Date.UTC(2026, 8, 11)),
      signatory: { name: 'Atul Chaudhary', title: 'Director' },
    });

    expect(resolved['employee.department']).toBe('—');
    expect(resolved['employee.designation']).toBe('—');
    expect(resolved['employee.workLocation']).toBe('—');
    expect(resolved['company.address']).toBe('');
  });
});

describe('formatLongDate', () => {
  it('formats using UTC getters, not the host timezone', () => {
    // A date whose local rendering would shift a calendar day on a
    // negative-UTC-offset host if local getters were used instead.
    expect(formatLongDate(new Date(Date.UTC(2026, 0, 1)))).toBe('1 January 2026');
  });
});
