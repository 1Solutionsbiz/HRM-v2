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
  companyWebsite?: string | null;
  companyPhone?: string | null;
  companySupportEmail?: string | null;
  /**
   * Base64 data URI for the company logo. Deliberately never sourced from
   * CompanySettings.logoUrl today - there is no upload endpoint for it
   * anywhere in the API, so it is always unset in production. Until that
   * exists, the header simply reserves the space (see HEADER_LOGO_HEIGHT)
   * without an image.
   */
  logoDataUri?: string | null;
}

/** A thin rule under each numbered section, matching the reference appointment-letter format supplied 2026-09-11. */
function sectionDivider() {
  return {
    canvas: [{ type: 'line' as const, x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 0.75, lineColor: '#cccccc' }],
    margin: [0, 8, 0, 0] as [number, number, number, number],
  };
}

/**
 * A line starting with "- " is a bullet item; runs of consecutive bullet
 * lines become one `ul` node, and everything else becomes its own
 * body-styled line - this is what lets a template section (see
 * letter-seed-data.ts) render as a labelled list instead of one dense
 * paragraph, without needing any richer template syntax.
 */
function buildBodyNodes(rest: string) {
  const lines = rest.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const nodes: Record<string, unknown>[] = [];
  let bulletBuffer: string[] = [];
  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      nodes.push({ ul: bulletBuffer, style: 'body', margin: [0, 2, 0, 2] });
      bulletBuffer = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith('- ')) {
      bulletBuffer.push(line.slice(2));
    } else {
      flushBullets();
      nodes.push({ text: line, style: 'body' });
    }
  }
  flushBullets();
  return nodes;
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
      // the bottom of a page with its body starting the next one). The
      // divider is included in the same stack so a section's closing rule
      // can never be separated from its own body.
      stack: [
        { text: headingMatch[1].toUpperCase(), style: 'sectionHeading' },
        ...buildBodyNodes(rest),
        sectionDivider(),
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

/** Reserved header height (pt) when no logo is set, so adding one later doesn't reflow the page. */
const HEADER_LOGO_RESERVED_HEIGHT = 32;

export function buildLetterDocDefinition(options: LetterPdfOptions) {
  const contactLine = [options.companyWebsite, options.companyPhone, options.companySupportEmail]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join('   |   ');

  return {
    pageSize: 'A4' as const,
    // Deliberately tighter than a first draft's [56,56,56,48]/lineHeight
    // 1.35 - that produced 6 pages for a ~3,000-word letter against an
    // explicit 3-4 page target. This density is still comfortably
    // readable at 10.25pt, confirmed by rendering and reading the actual
    // PDF, not just estimating.
    pageMargins: [42, 42, 42, 44] as [number, number, number, number],
    defaultStyle: { font: 'Helvetica', fontSize: 10.25, lineHeight: 1.16 },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [42, 0, 42, 14] as [number, number, number, number],
      stack: [
        ...(contactLine
          ? [{ text: sanitizeForPdf(contactLine), style: 'footer', alignment: 'center' as const }]
          : []),
        {
          columns: [
            { text: options.documentNumber, style: 'footer' },
            { text: `Page ${currentPage} of ${pageCount}`, style: 'footer', alignment: 'right' as const },
          ],
          margin: [0, 2, 0, 0] as [number, number, number, number],
        },
      ],
    }),
    content: [
      // Reserved space for a company logo - CompanySettings.logoUrl has no
      // upload endpoint anywhere in the API today, so logoDataUri is
      // always unset in production; this keeps the header's shape stable
      // for whenever that changes rather than rendering a placeholder box.
      ...(options.logoDataUri
        ? [{ image: options.logoDataUri, width: 130, margin: [0, 0, 0, 10] as [number, number, number, number] }]
        : [{ text: '', margin: [0, HEADER_LOGO_RESERVED_HEIGHT, 0, 0] as [number, number, number, number] }]),
      { text: sanitizeForPdf(options.companyName), style: 'companyName' },
      { text: options.letterTitle, style: 'letterTitle' },
      {
        columns: [
          { text: `Reference No.: ${options.documentNumber}`, style: 'meta' },
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
      { text: 'Authorised Signatory', style: 'signatoryTitle' },
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
