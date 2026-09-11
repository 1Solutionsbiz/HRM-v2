import pdfMake from 'pdfmake';

/**
 * Standard-14 PDF fonts only (Helvetica) - no TTF files to ship or embed,
 * confirmed working with zero native dependencies in the throwaway spike
 * that preceded this module (see the P0/P1 handoff report). This is the
 * one new production dependency this module adds; kept deliberately
 * simple given Hostinger's documented history of breaking on
 * native/runtime-incompatible packages (Puppeteer/Playwright were ruled
 * out for exactly that reason).
 */
const STANDARD_FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
const ALLOWED_LOCAL_FONT_PATHS = new Set(
  Object.values(STANDARD_FONTS).flatMap((f) => Object.values(f)),
);

pdfMake.setFonts(STANDARD_FONTS);
// No remote resources or arbitrary local files are ever referenced by a
// letter's content (plain-text only, no images - CompanySettings.logoUrl
// is unused by this generator: embedding it would mean reopening this
// policy to read an uploaded file, and no logo has ever been uploaded in
// production, so there's nothing to test against yet - see PROJECT_STATUS.md)
// - deny both by default rather than leaving them unconfigured, and
// allow-list only the exact standard-font names pdfkit needs.
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((path) => ALLOWED_LOCAL_FONT_PATHS.has(path));

/** A paragraph whose first line looks like "12. Section Title" gets a bold, spaced-out heading treatment for that line; the rest of the paragraph (if any) renders as normal body text right after it. */
const SECTION_HEADING_PATTERN = /^(\d+\.\s+.+)$/;

/**
 * The standard-14 fonts (Helvetica etc.) only cover WinAnsi/cp1252 -
 * confirmed empirically by rendering a real Appointment Letter with a
 * ₹ compensation figure: the glyph came out as a garbled superscript mark,
 * not a rupee sign, since U+20B9 isn't in that repertoire (unlike € or £,
 * which are). HR is free to type ₹ into a custom compensation field, so
 * it's normalized here rather than trusted to render - the durable fix
 * would be embedding a real Unicode font, which is out of scope for a
 * template/content change (see the class comment on why this module
 * deliberately ships no font files). Extend this map if another
 * unsupported character turns up in a real generated letter.
 */
const UNSUPPORTED_GLYPH_REPLACEMENTS: [RegExp, string][] = [[/₹/g, 'Rs. ']];

function sanitizeForPdf(text: string): string {
  return UNSUPPORTED_GLYPH_REPLACEMENTS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

export interface LetterPdfOptions {
  companyName: string;
  letterTitle: string;
  documentNumber: string;
  dateLabel: string;
  /** Paragraphs, already rendered (variables substituted) - split on blank lines by the caller. */
  paragraphs: string[];
  signatoryName: string;
  signatoryTitle: string;
}

function buildParagraphNode(rawParagraph: string) {
  const paragraph = sanitizeForPdf(rawParagraph);
  const firstLineBreak = paragraph.indexOf('\n');
  const firstLine = firstLineBreak === -1 ? paragraph : paragraph.slice(0, firstLineBreak);
  const headingMatch = SECTION_HEADING_PATTERN.exec(firstLine.trim());

  if (headingMatch) {
    const rest = firstLineBreak === -1 ? '' : paragraph.slice(firstLineBreak + 1).trim();
    return {
      // A `stack`, not a single `text` node with multiple runs - pdfmake's
      // `unbreakable` only reliably keeps a `stack`'s children together
      // across a page boundary; on a plain multi-run `text` node it had no
      // effect (confirmed empirically: the heading still landed alone at
      // the bottom of a page with its body starting the next one).
      stack: [
        { text: headingMatch[1], style: 'sectionHeading' },
        ...(rest ? [{ text: rest, style: 'body' }] : []),
      ],
      margin: [0, 7, 0, 2] as [number, number, number, number],
      unbreakable: true,
    };
  }

  if (paragraph.startsWith('Subject:')) {
    return { text: paragraph, style: 'subject', margin: [0, 5, 0, 7] as [number, number, number, number] };
  }

  return { text: paragraph, style: 'body', margin: [0, 0, 0, 6] as [number, number, number, number] };
}

export function buildLetterDocDefinition(options: LetterPdfOptions) {
  return {
    pageSize: 'A4' as const,
    // Deliberately tighter than a first draft's [56,56,56,48]/lineHeight
    // 1.35 - that produced 6 pages for a ~3,000-word letter against an
    // explicit 3-4 page target. This density is still comfortably
    // readable at 10.25pt, confirmed by rendering and reading the actual
    // PDF, not just estimating.
    pageMargins: [42, 42, 42, 34] as [number, number, number, number],
    defaultStyle: { font: 'Helvetica', fontSize: 10.25, lineHeight: 1.16 },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [42, 0, 42, 14] as [number, number, number, number],
      columns: [
        { text: options.documentNumber, style: 'footer' },
        { text: `Page ${currentPage} of ${pageCount}`, style: 'footer', alignment: 'right' as const },
      ],
    }),
    content: [
      { text: sanitizeForPdf(options.companyName), style: 'companyName' },
      { text: options.letterTitle, style: 'letterTitle' },
      {
        columns: [
          { text: `Document No: ${options.documentNumber}`, style: 'meta' },
          { text: `Date: ${options.dateLabel}`, style: 'meta', alignment: 'right' as const },
        ],
        margin: [0, 3, 0, 14] as [number, number, number, number],
      },
      ...options.paragraphs.map(buildParagraphNode),
      { text: '\n' },
      { text: `For ${sanitizeForPdf(options.companyName)}`, style: 'forCompany' },
      { text: '\n' },
      { text: sanitizeForPdf(options.signatoryName), style: 'signatoryName' },
      { text: sanitizeForPdf(options.signatoryTitle), style: 'signatoryTitle' },
    ],
    styles: {
      companyName: { fontSize: 13.5, bold: true },
      letterTitle: { fontSize: 11.5, bold: true, margin: [0, 10, 0, 0] as [number, number, number, number] },
      meta: { fontSize: 8.25, color: '#555555' },
      subject: { fontSize: 10.25, bold: true },
      sectionHeading: { fontSize: 10.75, bold: true },
      body: { fontSize: 10.25 },
      forCompany: { fontSize: 10.25 },
      signatoryName: { fontSize: 10.25, bold: true },
      signatoryTitle: { fontSize: 9.25, color: '#555555' },
      footer: { fontSize: 7.25, color: '#888888' },
    },
  };
}

export function generateLetterPdfBuffer(options: LetterPdfOptions): Promise<Buffer> {
  const pdf = pdfMake.createPdf(buildLetterDocDefinition(options));
  return pdf.getBuffer();
}
