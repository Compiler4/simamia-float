import { readFile } from "node:fs/promises";
import path from "node:path";

export type ProofRequirement =
  | "DATE"
  | "TIME"
  | "REFERENCE_NUMBER"
  | "FROM_PARTY"
  | "TO_PARTY"
  | "AMOUNT";

export type ProofAnalysisResult = {
  extractedText: string;
  status: "SUFFICIENT" | "INSUFFICIENT" | "MANUAL_REVIEW" | "ERROR";
  missing: ProofRequirement[];
  detected: Record<ProofRequirement, boolean>;
  note: string;
};

const DATE_PATTERNS = [
  /\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/i,
  /\b\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}\b/i,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
];

const TIME_PATTERNS = [
  /\b(?:[01]?\d|2[0-3])[:.]\d{2}(?::\d{2})?\s*(?:am|pm)?\b/i,
  /\b(?:1[0-2]|0?[1-9])[:.]\d{2}\s*(?:am|pm)\b/i,
];

const REFERENCE_PATTERNS = [
  /\b(?:ref(?:erence)?|transaction|txn|trx|receipt|confirmation|control|id|no)\s*[:#-]?\s*[a-z0-9][a-z0-9\-_/]{4,}\b/i,
  /\b[A-Z]{1,4}\d{8,}\b/i,
  /\b[a-f0-9]{12,}\b/i,
];

const AMOUNT_PATTERNS = [
  /\b(?:tzs|tshs?|amount|credited|debited|cash|float)\s*[:=]?\s*\d[\d,]*(?:\.\d{1,2})?\b/i,
  /\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\s*(?:tzs|tshs?)?\b/i,
  /\b\d{4,}(?:\.\d{1,2})?\s*(?:tzs|tshs?)\b/i,
];

const FROM_PATTERNS = [
  /\bfrom\s+[a-z0-9][a-z0-9 .&'\-]{2,}/i,
  /\b(?:sender|sent by|paid by|depositor|source)\s*[:\-]\s*[a-z0-9]/i,
];

const TO_PATTERNS = [
  /\bto\s+[a-z0-9][a-z0-9 .&'\-]{2,}/i,
  /\b(?:receiver|received by|paid to|beneficiary|destination)\s*[:\-]\s*[a-z0-9]/i,
];

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function analyseProofText(rawText: string): ProofAnalysisResult {
  const extractedText = rawText.replace(/\s+/g, " ").trim();

  if (!extractedText) {
    return {
      extractedText: "",
      status: "MANUAL_REVIEW",
      missing: [
        "DATE",
        "TIME",
        "REFERENCE_NUMBER",
        "FROM_PARTY",
        "TO_PARTY",
        "AMOUNT",
      ],
      detected: {
        DATE: false,
        TIME: false,
        REFERENCE_NUMBER: false,
        FROM_PARTY: false,
        TO_PARTY: false,
        AMOUNT: false,
      },
      note: "No readable text was extracted. A reviewer must inspect the document manually.",
    };
  }

  const detected: Record<ProofRequirement, boolean> = {
    DATE: anyMatch(extractedText, DATE_PATTERNS),
    TIME: anyMatch(extractedText, TIME_PATTERNS),
    REFERENCE_NUMBER: anyMatch(extractedText, REFERENCE_PATTERNS),
    FROM_PARTY: anyMatch(extractedText, FROM_PATTERNS),
    TO_PARTY: anyMatch(extractedText, TO_PATTERNS),
    AMOUNT: anyMatch(extractedText, AMOUNT_PATTERNS),
  };

  const missing = (Object.keys(detected) as ProofRequirement[]).filter(
    (field) => !detected[field],
  );

  return {
    extractedText,
    status: missing.length ? "INSUFFICIENT" : "SUFFICIENT",
    missing,
    detected,
    note: missing.length
      ? `Insufficient proof. Missing or unreadable: ${missing.join(", ")}.`
      : "The proof contains a readable date, time, reference, sender, receiver and amount.",
  };
}

async function extractImageText(filePath: string): Promise<string> {
  const imported = await import("tesseract.js");
  const tesseract = (imported.default || imported) as typeof imported;
  const result = await tesseract.recognize(filePath, "eng", {
    logger: () => undefined,
  });
  return result.data.text || "";
}

async function extractPdfText(filePath: string): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule.default || pdfParseModule) as unknown as (
    buffer: Buffer,
  ) => Promise<{ text?: string }>;
  const result = await pdfParse(await readFile(filePath));
  return result.text || "";
}

async function extractDocxText(filePath: string): Promise<string> {
  const imported = await import("mammoth");
  const mammoth = (imported.default || imported) as typeof imported;
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

export async function analyseProofFile(
  filePath: string,
  mimeType: string,
): Promise<ProofAnalysisResult> {
  try {
    const extension = path.extname(filePath).toLowerCase();
    let text = "";

    if (mimeType.startsWith("image/")) {
      text = await extractImageText(filePath);
    } else if (mimeType === "application/pdf" || extension === ".pdf") {
      text = await extractPdfText(filePath);
    } else if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      extension === ".docx"
    ) {
      text = await extractDocxText(filePath);
    } else if (mimeType.startsWith("text/") || extension === ".txt") {
      text = await readFile(filePath, "utf8");
    } else {
      return {
        extractedText: "",
        status: "MANUAL_REVIEW",
        missing: [
          "DATE",
          "TIME",
          "REFERENCE_NUMBER",
          "FROM_PARTY",
          "TO_PARTY",
          "AMOUNT",
        ],
        detected: {
          DATE: false,
          TIME: false,
          REFERENCE_NUMBER: false,
          FROM_PARTY: false,
          TO_PARTY: false,
          AMOUNT: false,
        },
        note: "This document type is supported for preview but not automatic text extraction.",
      };
    }

    return analyseProofText(text);
  } catch (error) {
    return {
      extractedText: "",
      status: "ERROR",
      missing: [
        "DATE",
        "TIME",
        "REFERENCE_NUMBER",
        "FROM_PARTY",
        "TO_PARTY",
        "AMOUNT",
      ],
      detected: {
        DATE: false,
        TIME: false,
        REFERENCE_NUMBER: false,
        FROM_PARTY: false,
        TO_PARTY: false,
        AMOUNT: false,
      },
      note:
        error instanceof Error
          ? `Automatic proof analysis failed: ${error.message}`
          : "Automatic proof analysis failed.",
    };
  }
}
