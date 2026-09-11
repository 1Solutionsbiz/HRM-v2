/**
 * `pdfmake` ships no type declarations (checked - no `.d.ts` in the
 * package, and `@types/pdfmake` on npm targets the old 0.2.x `PdfPrinter`
 * API, not 0.3.x's unified `createPdf`). Minimal shim covering only the
 * surface this module actually calls.
 */
declare module 'pdfmake' {
  interface PdfMakeFontDescriptor {
    normal: string;
    bold: string;
    italics: string;
    bolditalics: string;
  }

  interface PdfMakeDocument {
    getBuffer(): Promise<Buffer>;
  }

  interface PdfMakeInstance {
    setFonts(fonts: Record<string, PdfMakeFontDescriptor>): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    setLocalAccessPolicy(callback: (path: string) => boolean): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createPdf(docDefinition: Record<string, any>): PdfMakeDocument;
  }

  const pdfMake: PdfMakeInstance;
  export default pdfMake;
}
