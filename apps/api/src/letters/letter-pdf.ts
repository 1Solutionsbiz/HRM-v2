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
// letter's content (plain-text only, no images in P1 - see the class
// comment on logoUrl in schema.prisma) - deny both by default rather than
// leaving them unconfigured, and allow-list only the exact standard-font
// names pdfkit needs.
pdfMake.setUrlAccessPolicy(() => false);
pdfMake.setLocalAccessPolicy((path) => ALLOWED_LOCAL_FONT_PATHS.has(path));

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

export function buildLetterDocDefinition(options: LetterPdfOptions) {
  return {
    pageSize: 'A4' as const,
    pageMargins: [56, 56, 56, 64] as [number, number, number, number],
    defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.35 },
    content: [
      { text: options.companyName, style: 'companyName' },
      { text: options.letterTitle, style: 'letterTitle' },
      {
        columns: [
          { text: `Document No: ${options.documentNumber}`, style: 'meta' },
          { text: `Date: ${options.dateLabel}`, style: 'meta', alignment: 'right' as const },
        ],
        margin: [0, 4, 0, 20] as [number, number, number, number],
      },
      ...options.paragraphs.map((paragraph) => ({
        text: paragraph,
        style: 'body',
        margin: [0, 0, 0, 10] as [number, number, number, number],
      })),
      { text: '\n' },
      { text: options.signatoryName, style: 'signatoryName' },
      { text: options.signatoryTitle, style: 'signatoryTitle' },
    ],
    styles: {
      companyName: { fontSize: 15, bold: true },
      letterTitle: { fontSize: 13, bold: true, margin: [0, 16, 0, 0] as [number, number, number, number] },
      meta: { fontSize: 9, color: '#555555' },
      body: { fontSize: 11 },
      signatoryName: { fontSize: 11, bold: true },
      signatoryTitle: { fontSize: 10, color: '#555555' },
    },
  };
}

export function generateLetterPdfBuffer(options: LetterPdfOptions): Promise<Buffer> {
  const pdf = pdfMake.createPdf(buildLetterDocDefinition(options));
  return pdf.getBuffer();
}
