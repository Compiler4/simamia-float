declare module "pdf-parse" {
  type PdfParseOptions = {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
    version?: string;
  };

  type PdfParseResult = {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  };

  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;

  export = pdfParse;
}
