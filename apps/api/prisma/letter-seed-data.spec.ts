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

  it.each(LETTER_TYPES)('$key template content passes the variable whitelist', (type) => {
    expect(() => validateTemplateTokens(type.content, type.key)).not.toThrow();
  });

  it('every declared custom variable is actually used by its letter type\'s template', () => {
    for (const type of LETTER_TYPES) {
      const declared = LETTER_TYPE_CUSTOM_VARIABLES[type.key] ?? [];
      for (const key of declared) {
        expect(type.content).toContain(`{{custom.${key}}}`);
      }
    }
  });
});
