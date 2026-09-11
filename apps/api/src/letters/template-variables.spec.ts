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

  it('captures a {{#if}} guard variable as a used token, even with no plain {{token}} of the same name nearby', () => {
    expect(extractTemplateTokens('{{#if employee.reportingManager}}fixed text only{{/if}}')).toEqual([
      'employee.reportingManager',
    ]);
  });

  it('captures both the {{#if}} guard and a distinct token substituted inside its body', () => {
    const content = '{{#if custom.probationPeriod}}Period: {{custom.probationPeriod}}{{/if}}';
    expect(extractTemplateTokens(content).sort()).toEqual(['custom.probationPeriod']);
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

  it('rejects an unknown token used as a {{#if}} guard', () => {
    expect(() =>
      validateTemplateTokens('{{#if employee.socialSecurityNumber}}x{{/if}}', 'APPOINTMENT_LETTER'),
    ).toThrow(BadRequestException);
  });

  it('rejects an unknown token hidden INSIDE a {{#if}} block\'s body', () => {
    // The whitelist must see through conditional blocks, not just the
    // {{#if}} guard itself - otherwise wrapping a bogus token in a
    // conditional would be a whitelist bypass.
    expect(() =>
      validateTemplateTokens(
        '{{#if employee.reportingManager}}{{employee.socialSecurityNumber}}{{/if}}',
        'APPOINTMENT_LETTER',
      ),
    ).toThrow(BadRequestException);
  });

  it('passes for a declared optional custom variable used inside a {{#if}} block', () => {
    expect(() =>
      validateTemplateTokens(
        '{{#if custom.probationPeriod}}Probation: {{custom.probationPeriod}}{{/if}}',
        'APPOINTMENT_LETTER',
      ),
    ).not.toThrow();
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

  it('accepts a declared OPTIONAL key alongside the required ones', () => {
    expect(() =>
      validateCustomVariables('APPOINTMENT_LETTER', {
        annualCompensation: '₹12,00,000',
        probationPeriod: '6 months',
      }),
    ).not.toThrow();
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

  it('passes when only the required key is supplied and optional ones are omitted entirely', () => {
    expect(() =>
      validateRequiredCustomVariables('APPOINTMENT_LETTER', { annualCompensation: '₹12,00,000' }),
    ).not.toThrow();
  });

  it('rejects when the required key is missing even if optional ones are supplied', () => {
    expect(() =>
      validateRequiredCustomVariables('APPOINTMENT_LETTER', { probationPeriod: '6 months' }),
    ).toThrow(BadRequestException);
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

  describe('{{#if}} conditional blocks', () => {
    it('keeps the block\'s content, substituted, when the guard resolves to a real value', () => {
      const out = renderTemplate(
        '{{#if employee.reportingManager}}You report to {{employee.reportingManager}}.{{/if}}',
        { 'employee.reportingManager': 'Atul Chaudhary' },
      );
      expect(out).toBe('You report to Atul Chaudhary.');
    });

    it('drops the block entirely (no undefined/null/— artifact) when the guard is an empty string', () => {
      const out = renderTemplate(
        'Start.{{#if employee.reportingManager}} You report to {{employee.reportingManager}}.{{/if}} End.',
        { 'employee.reportingManager': '' },
      );
      expect(out).toBe('Start. End.');
      expect(out).not.toMatch(/undefined|null/);
    });

    it('drops the block when the guard is missing from the resolved map entirely', () => {
      const out = renderTemplate('{{#if custom.probationPeriod}}x{{/if}}', {});
      expect(out).toBe('');
    });

    it('drops the block when the guard resolves to the "—" placeholder used for legacy fixed fields', () => {
      const out = renderTemplate('Dept: {{#if employee.department}}{{employee.department}}{{/if}}', {
        'employee.department': '—',
      });
      expect(out).toBe('Dept: ');
    });

    it('handles multiple independent conditional blocks in the same content', () => {
      const out = renderTemplate(
        '{{#if a}}A present.{{/if}} {{#if b}}B present.{{/if}}',
        { a: 'yes', b: '' },
      );
      expect(out).toBe('A present. ');
    });
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
        address: '221B Baker Street, Delhi',
        reportingManager: 'Atul Chaudhary',
      },
      company: {
        legalName: '1Solutions Pvt Ltd',
        brandName: '1Solutions',
        address: '123 Business Park',
        website: 'https://1solutions.biz',
        supportEmail: 'hr@1solutions.biz',
        phone: '+91 11 4567 8900',
      },
      documentNumber: 'APT/2026/0001',
      generatedAt: new Date(Date.UTC(2026, 8, 11)),
      signatory: { name: 'Atul Chaudhary', title: 'Director' },
    });

    expect(resolved['employee.fullName']).toBe('Ritika Sharma');
    expect(resolved['employee.dateOfJoining']).toBe('15 March 2024');
    expect(resolved['employee.address']).toBe('221B Baker Street, Delhi');
    expect(resolved['employee.reportingManager']).toBe('Atul Chaudhary');
    expect(resolved['company.phone']).toBe('+91 11 4567 8900');
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
        address: null,
        reportingManager: null,
      },
      company: {
        legalName: '1Solutions Pvt Ltd',
        brandName: '1Solutions',
        address: null,
        website: null,
        supportEmail: 'hr@1solutions.biz',
        phone: null,
      },
      documentNumber: 'APT/2026/0001',
      generatedAt: new Date(Date.UTC(2026, 8, 11)),
      signatory: { name: 'Atul Chaudhary', title: 'Director' },
    });

    expect(resolved['employee.department']).toBe('—');
    expect(resolved['employee.designation']).toBe('—');
    expect(resolved['employee.address']).toBe('');
    expect(resolved['employee.reportingManager']).toBe('');
    expect(resolved['company.phone']).toBe('');
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
