import { describe, expect, it } from 'vitest';
import {
  LETTER_TYPE_CUSTOM_VARIABLES,
  validateTemplateTokens,
} from '../src/letters/template-variables.js';
import { CATEGORIES, LETTER_TYPES } from './letter-seed-data.js';

// Guards against the seed content and the code-owned variable whitelist
// (template-variables.ts) drifting apart - e.g. someone edits a template's
// wording here without updating LETTER_TYPE_CUSTOM_VARIABLES, which would
// otherwise only surface as a 400 the first time HR tries to generate that
// letter type in production.

function latestVersion(type: (typeof LETTER_TYPES)[number]): string {
  return type.versions[type.versions.length - 1];
}

describe('letter seed data', () => {
  it('has a unique key and numberPrefix for every letter type', () => {
    const keys = LETTER_TYPES.map((t) => t.key);
    const prefixes = LETTER_TYPES.map((t) => t.numberPrefix);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('references only known categories', () => {
    const categoryKeys = new Set(CATEGORIES.map((c) => c.key));
    for (const type of LETTER_TYPES) {
      expect(categoryKeys.has(type.categoryKey)).toBe(true);
    }
  });

  it('declares a custom-variable set for every letter type', () => {
    for (const type of LETTER_TYPES) {
      expect(LETTER_TYPE_CUSTOM_VARIABLES[type.key]).toBeDefined();
    }
  });

  it('declares at least one template version for every letter type', () => {
    for (const type of LETTER_TYPES) {
      expect(type.versions.length).toBeGreaterThan(0);
    }
  });

  // Only the LATEST version of each type is checked against today's
  // whitelist - older versions are frozen historical artifacts (append-
  // only, never re-rendered once superseded, see LetterTypeSeed's
  // comment), so they're allowed to reference variables that have since
  // been retired from the current whitelist (e.g. Appointment Letter v1's
  // custom.reportingManager, replaced by the fixed employee.reportingManager
  // in v2).
  it.each(LETTER_TYPES)('$key\'s current (latest) template version passes the variable whitelist', (type) => {
    expect(() => validateTemplateTokens(latestVersion(type), type.key)).not.toThrow();
  });

  it('every declared custom variable is actually used by its letter type\'s current template version', () => {
    for (const type of LETTER_TYPES) {
      const spec = LETTER_TYPE_CUSTOM_VARIABLES[type.key] ?? { required: [], optional: [] };
      for (const key of [...spec.required, ...spec.optional]) {
        expect(latestVersion(type)).toContain(`{{custom.${key}}}`);
      }
    }
  });
});
