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

describe('buildLetterDocDefinition', () => {
  it('styles a numbered-section paragraph\'s first line as a heading, keeping the rest as body text', () => {
    const content = contentTexts(['1. Appointment and Designation\nYou are appointed as Manager.']);
    // index 3 = after companyName, letterTitle, doc-number/date row
    const node = content[3] as { stack: { text: string; style: string }[]; unbreakable: boolean };
    expect(node.stack[0]).toEqual({ text: '1. Appointment and Designation', style: 'sectionHeading' });
    expect(node.stack[1]).toEqual({ text: 'You are appointed as Manager.', style: 'body' });
    // The actual bug this guards: pdfmake split a heading+body `text`
    // node across a page break (confirmed by rendering a real letter) -
    // `unbreakable` on a `stack` is what actually prevents that.
    expect(node.unbreakable).toBe(true);
  });

  it('leaves a plain paragraph (no leading number) as a single body-styled node', () => {
    const content = contentTexts(['Dear Ritika, welcome aboard.']);
    const node = content[3] as { text: string; style: string };
    expect(node).toEqual({ text: 'Dear Ritika, welcome aboard.', style: 'body', margin: [0, 0, 0, 6] });
  });

  it('styles a "Subject:" paragraph distinctly', () => {
    const content = contentTexts(['Subject: Appointment as Manager']);
    const node = content[3] as { text: string; style: string };
    expect(node.style).toBe('subject');
  });

  it('replaces the unsupported ₹ glyph with "Rs. " (standard-14 fonts can\'t render it - see the class comment)', () => {
    const content = contentTexts(['Your annual compensation will be ₹9,60,000 per annum.']);
    const node = content[3] as { text: string };
    expect(node.text).toBe('Your annual compensation will be Rs. 9,60,000 per annum.');
    expect(node.text).not.toContain('₹');
  });

  it('includes a page-numbering footer', () => {
    const doc = buildLetterDocDefinition({ ...BASE_OPTIONS, paragraphs: ['Body.'] });
    const footerNode = (doc.footer as (p: number, c: number) => { columns: { text: string }[] })(2, 4);
    expect(footerNode.columns[1].text).toBe('Page 2 of 4');
  });
});
