import { readFile } from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";

import { prisma } from "@/lib/prisma";

type Pdf = InstanceType<typeof PDFDocument>;

export type CompanyReportProfile = {
  id?: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  registrationNumber?: string | null;
  tin?: string | null;
  website?: string | null;
};

export type BrandedPdfColumn<Row = Record<string, unknown>> = {
  label: string;
  key?: string;
  weight?: number;
  align?: "left" | "center" | "right";
  value?: (row: Row, index: number) => unknown;
};

export type BrandedPdfInput<Row = Record<string, unknown>> = {
  company: CompanyReportProfile;
  title: string;
  subtitle?: string;
  period?: string;
  generatedBy?: string;
  reportCode?: string;
  summary?: Array<{ label: string; value: string; note?: string }>;
  columns: BrandedPdfColumn<Row>[];
  rows: Row[];
  orientation?: "portrait" | "landscape";
  footerNote?: string;
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function settingValue(settings: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = clean(settings.get(key));
    if (value) return value;
  }
  return "";
}

export async function resolveCompanyReportProfile(
  companyId: string,
  supplied?: Partial<CompanyReportProfile> | null,
): Promise<CompanyReportProfile> {
  let company: any = supplied || null;
  try {
    if (!company?.name) company = await prisma.company.findUnique({ where: { id: companyId } });
  } catch {
    // The supplied company payload is enough for reporting if the lookup fails.
  }

  let settingsRows: Array<{ key: string; value: string }> = [];
  try {
    settingsRows = await prisma.companySetting.findMany({
      where: { companyId },
      select: { key: true, value: true },
    });
  } catch {
    // Company settings are optional on older installations.
  }
  const settings = new Map(settingsRows.map((row) => [row.key, row.value]));

  return {
    id: companyId,
    name: clean(company?.name) || "SIMAMIA FLOAT",
    code: clean(company?.code) || null,
    email: clean(company?.email) || null,
    phone: clean(company?.phone) || null,
    address: clean(company?.address) || null,
    logoUrl:
      clean((company as any)?.logoUrl) ||
      settingValue(settings, [
        "company.logoUrl",
        "company.logo",
        "branding.logoUrl",
        "report.logoUrl",
      ]) ||
      null,
    registrationNumber:
      clean((company as any)?.registrationNumber) ||
      settingValue(settings, ["company.registrationNumber", "company.registration", "company.regNo"]) ||
      null,
    tin:
      clean((company as any)?.tin) ||
      settingValue(settings, ["company.tin", "company.taxNumber", "company.tinNumber"]) ||
      null,
    website:
      clean((company as any)?.website) ||
      settingValue(settings, ["company.website", "company.web"]) ||
      null,
  };
}

export async function loadCompanyReportLogo(value: string | null | undefined): Promise<Buffer | null> {
  const raw = clean(value);
  if (!raw) return null;

  try {
    if (raw.startsWith("data:")) {
      const comma = raw.indexOf(",");
      if (comma > 0) return Buffer.from(raw.slice(comma + 1), "base64");
    }

    if (/^https?:\/\//i.test(raw)) {
      const response = await fetch(raw, { cache: "no-store" });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }

    const normalized = raw.replaceAll("\\", "/");
    const root = path.resolve(/* turbopackIgnore: true */ process.cwd());
    const candidates: string[] = [];
    if (path.isAbsolute(normalized)) candidates.push(path.resolve(normalized));
    const relative = normalized.replace(/^\/+/, "");
    candidates.push(path.resolve(root, relative));
    candidates.push(path.resolve(root, "public", relative.replace(/^public\//, "")));

    for (const candidate of candidates) {
      if (!candidate.startsWith(root)) continue;
      try {
        return await readFile(candidate);
      } catch {
        // Try the next candidate.
      }
    }
  } catch {
    return null;
  }
  return null;
}

function drawCompanyIdentity(
  doc: Pdf,
  company: CompanyReportProfile,
  title: string,
  subtitle: string,
  period: string,
  logo: Buffer | null,
  reportCode: string,
) {
  const pageWidth = doc.page.width;
  doc.save().rect(0, 0, pageWidth, 112).fill("#0b704a").restore();

  const logoX = 38;
  const logoY = 22;
  const logoSize = 58;
  doc.save().roundedRect(logoX, logoY, logoSize, logoSize, 10).fill("#ffffff").restore();
  if (logo) {
    try {
      doc.image(logo, logoX + 6, logoY + 6, { fit: [logoSize - 12, logoSize - 12], align: "center", valign: "center" });
    } catch {
      doc.fillColor("#0b704a").font("Helvetica-Bold").fontSize(20).text(company.name.slice(0, 2).toUpperCase(), logoX, logoY + 18, { width: logoSize, align: "center" });
    }
  } else {
    doc.fillColor("#0b704a").font("Helvetica-Bold").fontSize(20).text(company.name.slice(0, 2).toUpperCase(), logoX, logoY + 18, { width: logoSize, align: "center" });
  }

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(19).text(company.name, 110, 25, { width: pageWidth * 0.43, ellipsis: true });
  doc.fillColor("#d7f4e7").font("Helvetica").fontSize(8.5).text(title, 110, 51, { width: pageWidth * 0.43, ellipsis: true });
  if (subtitle) doc.text(subtitle, 110, 67, { width: pageWidth * 0.43, ellipsis: true });
  if (period) doc.font("Helvetica-Bold").text(`Period: ${period}`, 110, 86, { width: pageWidth * 0.43, ellipsis: true });

  const cardWidth = Math.min(260, pageWidth * 0.36);
  const cardX = pageWidth - cardWidth - 38;
  doc.save().fillOpacity(0.95).roundedRect(cardX, 13, cardWidth, 88, 10).fill("#ffffff").restore();
  const detailLines = [
    company.code ? `Code: ${company.code}` : "",
    company.registrationNumber ? `Reg: ${company.registrationNumber}` : "",
    company.tin ? `TIN: ${company.tin}` : "",
    company.phone ? `Tel: ${company.phone}` : "",
    company.email ? `Email: ${company.email}` : "",
    company.address ? `Address: ${company.address}` : "",
    company.website ? `Web: ${company.website}` : "",
  ].filter(Boolean);
  doc.fillColor("#0b5138").font("Helvetica-Bold").fontSize(7.2).text(reportCode || "SIMAMIA REPORT", cardX + 10, 21, { width: cardWidth - 20, align: "right" });
  doc.fillColor("#263d35").font("Helvetica").fontSize(6.35).text(detailLines.join("\n"), cardX + 10, 35, { width: cardWidth - 20, align: "right", lineGap: 0.9, ellipsis: true });

  doc.y = 130;
}

function drawSummary(doc: Pdf, items: Array<{ label: string; value: string; note?: string }>) {
  if (!items.length) return;
  const count = Math.min(4, items.length);
  const gap = 8;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const width = (usable - gap * (count - 1)) / count;
  const y = doc.y;
  for (let index = 0; index < count; index += 1) {
    const item = items[index];
    const x = doc.page.margins.left + index * (width + gap);
    doc.save().roundedRect(x, y, width, 62, 8).fillAndStroke("#edf8f2", "#cae4d7").restore();
    doc.fillColor("#62786e").font("Helvetica-Bold").fontSize(6.8).text(item.label.toUpperCase(), x + 9, y + 9, { width: width - 18 });
    doc.fillColor("#103f2f").font("Helvetica-Bold").fontSize(11).text(item.value, x + 9, y + 26, { width: width - 18, ellipsis: true });
    if (item.note) doc.fillColor("#70847b").font("Helvetica").fontSize(6.5).text(item.note, x + 9, y + 45, { width: width - 18, ellipsis: true });
  }
  doc.y = y + 77;
}

function normalizedWidths<Row>(doc: Pdf, columns: BrandedPdfColumn<Row>[]) {
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const totalWeight = columns.reduce((sum, column) => sum + Math.max(0.25, column.weight || 1), 0);
  return columns.map((column) => usable * (Math.max(0.25, column.weight || 1) / totalWeight));
}

function rowValue<Row>(column: BrandedPdfColumn<Row>, row: Row, index: number) {
  if (column.value) return clean(column.value(row, index));
  if (column.key) return clean((row as any)?.[column.key]);
  return "";
}

function drawTableHeader<Row>(doc: Pdf, columns: BrandedPdfColumn<Row>[], widths: number[]) {
  const x0 = doc.page.margins.left;
  const y = doc.y;
  const height = 26;
  let x = x0;
  doc.save().rect(x0, y, widths.reduce((a, b) => a + b, 0), height).fill("#348c3d").restore();
  columns.forEach((column, index) => {
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text(column.label, x + 5, y + 9, { width: widths[index] - 10, align: column.align || "left", ellipsis: true });
    x += widths[index];
  });
  doc.y = y + height;
}

function ensureTablePage<Row>(
  doc: Pdf,
  requiredHeight: number,
  columns: BrandedPdfColumn<Row>[],
  widths: number[],
  redrawIdentity: () => void,
) {
  if (doc.y + requiredHeight <= doc.page.height - 68) return;
  doc.addPage();
  redrawIdentity();
  drawTableHeader(doc, columns, widths);
}

export async function createBrandedTablePdf<Row = Record<string, unknown>>(
  input: BrandedPdfInput<Row>,
): Promise<Buffer> {
  const logo = await loadCompanyReportLogo(input.company.logoUrl);
  const doc = new PDFDocument({
    size: "A4",
    layout: input.orientation === "portrait" ? "portrait" : "landscape",
    margin: 34,
    bufferPages: true,
    info: { Title: input.title, Author: input.company.name, Subject: input.subtitle || input.title },
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const drawIdentity = () => drawCompanyIdentity(
    doc,
    input.company,
    input.title,
    input.subtitle || "",
    input.period || "",
    logo,
    input.reportCode || "SIMAMIA REPORT",
  );

  drawIdentity();
  drawSummary(doc, input.summary || []);

  const widths = normalizedWidths(doc, input.columns);
  drawTableHeader(doc, input.columns, widths);

  if (!input.rows.length) {
    doc.fillColor("#5d7067").font("Helvetica").fontSize(9).text("No report rows were found for the selected period.", doc.page.margins.left + 6, doc.y + 15);
  }

  input.rows.forEach((row, rowIndex) => {
    const values = input.columns.map((column) => rowValue(column, row, rowIndex));
    const lineHeights = values.map((value, index) =>
      doc.font("Helvetica").fontSize(7).heightOfString(value || "-", { width: Math.max(18, widths[index] - 10), lineGap: 1 }),
    );
    const rowHeight = Math.max(24, Math.min(68, Math.max(...lineHeights, 12) + 10));
    ensureTablePage(doc, rowHeight, input.columns, widths, drawIdentity);

    const y = doc.y;
    const tableWidth = widths.reduce((a, b) => a + b, 0);
    doc.save().rect(doc.page.margins.left, y, tableWidth, rowHeight).fill(rowIndex % 2 === 0 ? "#ffffff" : "#f5f8f6").restore();

    let x = doc.page.margins.left;
    input.columns.forEach((column, columnIndex) => {
      doc.save().rect(x, y, widths[columnIndex], rowHeight).strokeColor("#afc1b8").lineWidth(0.45).stroke().restore();
      doc.fillColor(columnIndex === 0 ? "#1d4b3a" : "#263d35").font(columnIndex === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(7).text(values[columnIndex] || "-", x + 5, y + 6, {
        width: widths[columnIndex] - 10,
        height: rowHeight - 10,
        align: column.align || "left",
        ellipsis: true,
        lineGap: 1,
      });
      x += widths[columnIndex];
    });
    doc.y = y + rowHeight;
  });

  const pageRange = doc.bufferedPageRange();
  for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
    doc.switchToPage(index);
    doc.save().moveTo(doc.page.margins.left, doc.page.height - 50).lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 50).strokeColor("#c9ddd2").lineWidth(0.6).stroke().restore();
    doc.fillColor("#74877d").font("Helvetica").fontSize(6.6).text(
      input.footerNote || `Generated by ${input.generatedBy || "SIMAMIA FLOAT"}`,
      doc.page.margins.left,
      doc.page.height - 45,
      { width: doc.page.width / 2 - doc.page.margins.left, ellipsis: true, lineBreak: false },
    );
    doc.text(
      `Page ${index + 1} of ${pageRange.count}  |  ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Dar_es_Salaam" }).format(new Date())}`,
      doc.page.width / 2,
      doc.page.height - 45,
      { width: doc.page.width / 2 - doc.page.margins.right, align: "right", lineBreak: false },
    );
  }

  doc.end();
  return completed;
}
