import { describe, expect, it } from 'vitest';
import { buildLetterDocDefinition } from './letter-pdf.js';

const BASE_OPTIONS = {
  companyName: '1Solutions Pvt. Ltd.',
  letterTitle: 'Appointment Letter',
  documentNumber: 'APT/2026/0001',
  dateLabel: '11 September 2026',
  signatoryName: 'Atul Chaudhary',
  signatoryTitle: 'Director',
};

function contentTexts(paragraphs: string[]) {
  return buildLetterDocDefinition({ ...BASE_OPTIONS, paragraphs }).content;
}

// index 0 = reserved logo space/image, 1 = companyName, 2 = letterTitle,
// 3 = reference-no/date row, 4 = first paragraph node.
const FIRST_PARAGRAPH_INDEX = 4;

describe('buildLetterDocDefinition', () => {
  it("styles a numbered-section paragraph's first line as an upper-cased heading, the rest as body lines, and closes the section with a divider", () => {
    const content = contentTexts(['1. Appointment and Designation\nYou are appointed as Manager.']);
    const node = content[FIRST_PARAGRAPH_INDEX] as {
      stack: { text?: string; style?: string; canvas?: unknown }[];
      unbreakable: boolean;
    };
    expect(node.stack[0]).toEqual({ text: '1. APPOINTMENT AND DESIGNATION', style: 'sectionHeading' });
    expect(node.stack[1]).toEqual({ text: 'You are appointed as Manager.', style: 'body' });
    // The last stack entry is the section divider (a canvas line), kept in
    // the same unbreakable stack so it can never land separated from its
    // own section's body.
    expect(node.stack[2]).toHaveProperty('canvas');
    // The actual bug this guards: pdfmake split a heading+body `text`
    // node across a page break (confirmed by rendering a real letter) -
    // `unbreakable` on a `stack` is what actually prevents that.
    expect(node.unbreakable).toBe(true);
  });

  it('renders "- " prefixed lines in a section body as a bullet list, grouping consecutive bullets into one `ul` node', () => {
    const content = contentTexts([
      '2. Company Policies\nThese include policies relating to:\n- Code of Conduct\n- Attendance and Leave\n- Information Security\nCompliance is mandatory.',
    ]);
    const node = content[FIRST_PARAGRAPH_INDEX] as { stack: { text?: string; ul?: string[] }[] };
    expect(node.stack[1]).toEqual({ text: 'These include policies relating to:', style: 'body' });
    expect(node.stack[2]).toMatchObject({ ul: ['Code of Conduct', 'Attendance and Leave', 'Information Security'] });
    expect(node.stack[3]).toEqual({ text: 'Compliance is mandatory.', style: 'body' });
  });

  it('leaves a plain paragraph (no leading number) as a single body-styled node', () => {
    const content = contentTexts(['Dear Ritika, welcome aboard.']);
    const node = content[FIRST_PARAGRAPH_INDEX] as { text: string; style: string };
    expect(node).toEqual({ text: 'Dear Ritika, welcome aboard.', style: 'body', margin: [0, 0, 0, 6] });
  });

  it('styles a "Subject:" paragraph distinctly', () => {
    const content = contentTexts(['Subject: Appointment as Manager']);
    const node = content[FIRST_PARAGRAPH_INDEX] as { text: string; style: string };
    expect(node.style).toBe('subject');
  });

  it('replaces the unsupported ₹ glyph with "Rs. " (standard-14 fonts can\'t render it - see the class comment)', () => {
    const content = contentTexts(['Your annual compensation will be ₹9,60,000 per annum.']);
    const node = content[FIRST_PARAGRAPH_INDEX] as { text: string };
    expect(node.text).toBe('Your annual compensation will be Rs. 9,60,000 per annum.');
    expect(node.text).not.toContain('₹');
  });

  it('reserves blank header space for a future logo when none is set, and renders one in its place when supplied', () => {
    const withoutLogo = buildLetterDocDefinition({ ...BASE_OPTIONS, paragraphs: ['Body.'] });
    expect(withoutLogo.content[0]).toMatchObject({ text: '' });
    expect((withoutLogo.content[0] as { margin: number[] }).margin[1]).toBeGreaterThan(0);

    const withLogo = buildLetterDocDefinition({
      ...BASE_OPTIONS,
      paragraphs: ['Body.'],
      logoDataUri: 'data:image/png;base64,abc123',
    });
    expect(withLogo.content[0]).toMatchObject({ image: 'data:image/png;base64,abc123' });
  });

  it('includes a page-numbering footer, with an optional centered contact line above it when company contact details are supplied', () => {
    const withoutContact = buildLetterDocDefinition({ ...BASE_OPTIONS, paragraphs: ['Body.'] });
    const bareFooter = (
      withoutContact.footer as (p: number, c: number) => { stack: { columns?: { text: string }[] }[] }
    )(2, 4);
    expect(bareFooter.stack).toHaveLength(1);
    expect(bareFooter.stack[0].columns?.[1].text).toBe('Page 2 of 4');

    const withContact = buildLetterDocDefinition({
      ...BASE_OPTIONS,
      paragraphs: ['Body.'],
      companyWebsite: 'https://1solutions.biz',
      companyPhone: '+91 22 1234 5678',
      companySupportEmail: 'hr@1solutions.biz',
    });
    const fullFooter = (
      withContact.footer as (p: number, c: number) => { stack: { text?: string; columns?: unknown }[] }
    )(2, 4);
    expect(fullFooter.stack).toHaveLength(2);
    expect(fullFooter.stack[0].text).toBe('https://1solutions.biz   |   +91 22 1234 5678   |   hr@1solutions.biz');
  });

  it('labels the signatory block "Authorised Signatory"', () => {
    const doc = buildLetterDocDefinition({ ...BASE_OPTIONS, paragraphs: ['Body.'] });
    const last = doc.content[doc.content.length - 1] as { text: string };
    expect(last.text).toBe('Authorised Signatory');
  });
});
