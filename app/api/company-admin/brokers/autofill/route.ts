import { NextRequest, NextResponse } from "next/server";

import {
  HttpError,
  requireCompanyAdmin,
  routeError,
  text,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type BrokerFields = Record<string, unknown> & {
  agentAccounts?: Array<Record<string, unknown>>;
};

function clean(value: unknown): string {
  return text(value).replace(/\s+/g, " ").trim();
}

function assertMultipart(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.startsWith("multipart/form-data")) {
    throw new HttpError(
      "Broker auto-fill requires multipart/form-data. Send the file with FormData and do not set Content-Type manually.",
      415,
    );
  }
}

function normalizeDate(value: string): string {
  const raw = clean(value);
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const dayFirst = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().slice(0, 10);
}

function normalizeNetwork(value: string): string {
  const raw = value.toUpperCase();
  if (raw.includes("VODACOM")) return "VODACOM";
  if (raw.includes("YAS") || raw.includes("MIX")) return "YAS_MIX";
  if (raw.includes("AIRTEL")) return "AIRTEL";
  if (raw.includes("HALOTEL")) return "HALOTEL";
  return raw.includes("OTHER") ? "OTHER" : "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineValue(lines: string[], labels: string[]): string {
  const labelPattern = labels.map(escapeRegex).join("|");

  const pattern = new RegExp(
    `^(?:${labelPattern})\\s*(?:[:#*\\-]|\\s{2,})\\s*(.+)$`,
    "i",
  );

  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }

  const loose = new RegExp(
    `(?:${labelPattern})\\s*(?:[:#*\\-])\\s*([^\\n\\r]+)`,
    "i",
  );

  const match = lines.join("\n").match(loose);
  return match?.[1] ? clean(match[1]) : "";
}

function genderValue(value: string): string {
  const raw = clean(value).toUpperCase();
  if (raw === "F" || raw.startsWith("FEMALE")) return "FEMALE";
  if (raw === "M" || raw.startsWith("MALE")) return "MALE";
  return raw ? "OTHER" : "";
}

function statusValue(value: string): string {
  const raw = clean(value).toUpperCase();
  if (raw.includes("SUSP")) return "SUSPENDED";
  if (raw.includes("INACTIVE")) return "INACTIVE";
  if (raw.includes("ACTIVE")) return "ACTIVE";
  return raw ? "ACTIVE" : "";
}

function compactFields(fields: BrokerFields): BrokerFields {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : Boolean(clean(value)),
    ),
  );
}

function parseAgentAccounts(lines: string[]) {
  const accounts: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const network = normalizeNetwork(lines[index]);
    if (!network) continue;

    const blockLines = lines.slice(index, index + 8);
    const block = blockLines.join("\n");

    const simPhoneNumber =
      lineValue(blockLines, [
        "SIM phone number",
        "SIM",
        "SIM number",
        "Mobile network phone",
      ]) || (block.match(/(?:\+?255|0)\d{8,9}/)?.[0] ?? "");

    const agentNumber = lineValue(blockLines, [
      "Agent number",
      "Agent no",
      "Agent No.",
      "Account number",
    ]);

    const accountName = lineValue(blockLines, [
      "Account name",
      "Agent name",
      "Name on account",
    ]);

    if (!simPhoneNumber && !agentNumber && !accountName) continue;

    const key = `${network}:${agentNumber}:${simPhoneNumber}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    accounts.push({
      network,
      simPhoneNumber,
      agentNumber,
      accountName,
      isPrimary: accounts.length === 0,
      status: "ACTIVE",
    });
  }

  return accounts;
}

function parseText(raw: string): BrokerFields {
  try {
    const parsed = JSON.parse(raw) as BrokerFields;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const { latitude: _latitude, longitude: _longitude, ...withoutCoordinates } =
        parsed as Record<string, unknown>;

      return compactFields({
        ...withoutCoordinates,
        dateOfBirth: normalizeDate(clean(parsed.dateOfBirth)),
        registrationDate: normalizeDate(clean(parsed.registrationDate)),
        attendedDate: normalizeDate(clean(parsed.attendedDate)),
      });
    }
  } catch {
    // Continue with label extraction.
  }

  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(clean)
    .filter(Boolean);

  const fields: BrokerFields = {
    title: lineValue(lines, ["Title"]),
    firstName: lineValue(lines, ["First name", "Firstname", "Given name"]),
    surname: lineValue(lines, ["Surname", "Last name", "Family name"]),
    businessName: lineValue(lines, [
      "Registered business name",
      "Business name",
      "Company name",
    ]),
    tinNumber: lineValue(lines, ["TIN number", "TIN", "Tax identification number"]),
    officialAgentNo: lineValue(lines, [
      "Official agent number",
      "Official agent no",
    ]),
    phone: lineValue(lines, [
      "Primary mobile number",
      "Primary phone",
      "Phone number",
      "Phone",
    ]),
    alternatePhone: lineValue(lines, [
      "Alternative mobile number",
      "Alternate phone",
      "Alternative phone",
    ]),
    email: lineValue(lines, ["Email address", "Email"]),
    nationality: lineValue(lines, ["Nationality"]),
    dateOfBirth: normalizeDate(
      lineValue(lines, ["Date of birth", "Birth date", "DOB"]),
    ),
    gender: genderValue(lineValue(lines, ["Gender", "Sex"])),
    postalAddress: lineValue(lines, ["Postal address", "P.O Box", "PO Box"]),
    location: lineValue(lines, [
      "Physical business address",
      "Business address",
      "Location",
    ]),
    city: lineValue(lines, ["City", "Town"]),
    region: lineValue(lines, ["Region"]),
    district: lineValue(lines, ["District"]),
    ward: lineValue(lines, ["Ward"]),
    country: lineValue(lines, ["Country"]),
    identityType: lineValue(lines, ["Identity type", "ID type"]),
    identityNumber: lineValue(lines, [
      "Identity number",
      "ID number",
      "NIDA number",
      "Passport number",
    ]),
    identityIssuedBy: lineValue(lines, ["Identity issued by", "Issued by"]),
    identityOther: lineValue(lines, [
      "Other identity description",
      "Other identity",
    ]),
    registrationDate: normalizeDate(
      lineValue(lines, ["Registration date", "Registered date"]),
    ),
    attendedBy: lineValue(lines, ["Attended by", "Attender"]),
    attendedDate: normalizeDate(
      lineValue(lines, ["Attended date", "Attendance date"]),
    ),
    attendedLocation: lineValue(lines, [
      "Attended location",
      "Attendance location",
    ]),
    status: statusValue(lineValue(lines, ["Status"])),
    notes: lineValue(lines, ["Notes", "Remark", "Remarks"]),
    agentAccounts: parseAgentAccounts(lines),
  };

  if (!clean(fields.location)) {
    fields.location = lineValue(lines, ["Address"]);
  }

  return compactFields(fields);
}

async function extractText(file: File, bytes: Buffer): Promise<string> {
  const name = file.name.toLowerCase();
  const mime = (file.type || "").toLowerCase();

  if (
    mime.includes("text") ||
    mime.includes("json") ||
    mime.includes("csv") ||
    name.endsWith(".txt") ||
    name.endsWith(".json") ||
    name.endsWith(".csv")
  ) {
    return bytes.toString("utf8");
  }

  if (name.endsWith(".docx")) {
    const mammoth = require("mammoth") as typeof import("mammoth");
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value || "";
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = require("xlsx") as typeof import("xlsx");
    const workbook = XLSX.read(bytes, { type: "buffer" });

    return workbook.SheetNames.map((sheetName) =>
      XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]),
    ).join("\n");
  }

  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    const pdfParse = require("pdf-parse") as (
      input: Buffer,
    ) => Promise<{ text?: string }>;

    const result = await pdfParse(bytes);
    return result.text || "";
  }

  return "";
}

export async function POST(request: NextRequest) {
  try {
    await requireCompanyAdmin();

    // IMPORTANT: only this route reads FormData.
    assertMultipart(request);

    let form: FormData;

    try {
      form = await request.formData();
    } catch (error) {
      console.error("[BROKER_AUTOFILL_FORMDATA_ERROR]", error);
      throw new HttpError(
        "Could not read the uploaded broker document as multipart/form-data.",
        400,
      );
    }

    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new HttpError("Choose a broker registration document.", 422);
    }

    if (!file.size) {
      throw new HttpError("The selected broker document is empty.", 422);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new HttpError("The broker document cannot exceed 10 MB.", 413);
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    let extracted: string;

    try {
      extracted = await extractText(file, bytes);
    } catch (error) {
      console.error("[BROKER_AUTOFILL_EXTRACT_ERROR]", error);
      throw new HttpError(
        `The system could not read ${file.name}. Check that the file is valid and not corrupted.`,
        422,
      );
    }

    if (!clean(extracted)) {
      throw new HttpError(
        "No readable text was found. Use a text-based PDF, Word, Excel, CSV, JSON or TXT document.",
        422,
      );
    }

    const fields = parseText(extracted);

    return NextResponse.json(
      {
        success: true,
        fields,
        message: `Auto-fill found ${Object.keys(fields).length} broker field group(s) in ${file.name}.`,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}
