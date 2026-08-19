import { NextRequest } from "next/server";
import path from "node:path";
import { access, readFile } from "node:fs/promises";
import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";

import { prisma } from "@/lib/prisma";
import {
  loadCompanyReportLogo,
  resolveCompanyReportProfile,
  type CompanyReportProfile,
} from "@/lib/reports/branded-pdf";
import {
  HttpError,
  requireCompanyAdmin,
  routeError,
  text,
  toNumber,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GREEN = rgb(0.12, 0.45, 0.21);
const DARK = rgb(0.08, 0.11, 0.15);
const MUTED = rgb(0.35, 0.4, 0.45);
const LIGHT = rgb(0.95, 0.98, 0.96);
const BORDER = rgb(0.78, 0.84, 0.8);
const PUBLIC_UPLOAD_ROOT = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "public",
  "uploads",
);

function parseDate(value: string | null, end = false): Date {
  const raw = value
    ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}`
    : end
      ? "2999-12-31T23:59:59.999"
      : "2000-01-01T00:00:00.000";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError("Enter valid report dates.", 422);
  }
  return date;
}

function money(value: unknown): string {
  return `TZS ${Number(value ?? 0).toLocaleString("en-TZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value: unknown): string {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

function cleanFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function accountKey(value: unknown): string {
  return text(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function ellipsis(value: unknown, max = 45): string {
  const output = text(value).replace(/\s+/g, " ").trim();
  return output.length <= max ? output : `${output.slice(0, max - 3)}...`;
}

function publicUrlToPath(url: string): string | null {
  const clean = url.split("?")[0].replaceAll("\\", "/");
  if (!clean.startsWith("/uploads/")) return null;
  const uploadRelative = clean.replace(/^\/uploads\/?/, "");
  const absolute = path.resolve(PUBLIC_UPLOAD_ROOT, uploadRelative);
  return absolute.startsWith(`${path.resolve(PUBLIC_UPLOAD_ROOT)}${path.sep}`)
    ? absolute
    : null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(/* turbopackIgnore: true */ filePath);
    return true;
  } catch {
    return false;
  }
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  value: string,
  x: number,
  y: number,
  size: number,
  width?: number,
  colour = DARK,
) {
  let output = value;
  if (width) {
    while (output.length > 4 && font.widthOfTextAtSize(output, size) > width) {
      output = `${output.slice(0, -4)}...`;
    }
  }
  page.drawText(output, { x, y, size, font, color: colour });
}

function addStatementHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  company: CompanyReportProfile,
  companyLogo: any | null,
  bankName: string,
  accountName: string,
  accountNumber: string,
  periodLabel: string,
) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: height - 108, width, height: 108, color: GREEN });

  const logoX = 36;
  const logoY = height - 82;
  const logoSize = 54;
  page.drawRectangle({ x: logoX, y: logoY, width: logoSize, height: logoSize, color: rgb(1, 1, 1) });
  if (companyLogo) {
    const scale = Math.min((logoSize - 8) / companyLogo.width, (logoSize - 8) / companyLogo.height);
    const drawWidth = companyLogo.width * scale;
    const drawHeight = companyLogo.height * scale;
    page.drawImage(companyLogo, {
      x: logoX + (logoSize - drawWidth) / 2,
      y: logoY + (logoSize - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  } else {
    drawText(page, bold, company.name.slice(0, 2).toUpperCase(), logoX + 12, logoY + 18, 18, 32, GREEN);
  }

  drawText(page, bold, company.name || "SIMAMIA FLOAT", 102, height - 43, 19, 350, rgb(1, 1, 1));
  drawText(page, regular, "Grand Bank Proof and Transaction Report", 102, height - 66, 9.5, 350, rgb(0.9, 1, 0.93));
  drawText(page, bold, `Period: ${periodLabel}`, 102, height - 85, 7.5, 350, rgb(0.9, 1, 0.93));

  const companyDetails = [
    company.code ? `Code: ${company.code}` : "",
    company.registrationNumber ? `Reg: ${company.registrationNumber}` : "",
    company.tin ? `TIN: ${company.tin}` : "",
    company.phone ? `Tel: ${company.phone}` : "",
    company.email ? `Email: ${company.email}` : "",
    company.address ? `Address: ${company.address}` : "",
    company.website ? `Web: ${company.website}` : "",
  ].filter(Boolean);
  companyDetails.slice(0, 7).forEach((line, index) => {
    drawText(page, regular, line, width - 330, height - 27 - index * 10, 6.1, 294, rgb(0.94, 1, 0.97));
  });

  drawText(page, bold, "Account Bank Proof Statement", 36, height - 139, 18, 390);
  drawText(page, bold, bankName, width - 292, height - 134, 12, 256, GREEN);
  drawText(page, regular, accountName || "Account name not supplied", width - 292, height - 150, 7.5, 256, MUTED);
  drawText(page, regular, `Account: ${accountNumber}`, width - 292, height - 164, 7.5, 256, MUTED);
}

function addSummaryBoxes(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  startY: number,
  items: Array<{ label: string; value: string }>,
) {
  const { width } = page.getSize();
  const gap = 8;
  const cardWidth = (width - 72 - gap * (items.length - 1)) / items.length;
  items.forEach((item, index) => {
    const x = 36 + index * (cardWidth + gap);
    page.drawRectangle({
      x,
      y: startY - 54,
      width: cardWidth,
      height: 54,
      color: LIGHT,
      borderColor: BORDER,
      borderWidth: 0.7,
    });
    drawText(page, regular, item.label.toUpperCase(), x + 8, startY - 19, 7, cardWidth - 16, MUTED);
    drawText(page, bold, item.value, x + 8, startY - 39, 11, cardWidth - 16, GREEN);
  });
}

type Group = {
  key: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  rows: any[];
  documents: any[];
};

function groupRows(records: any[], documents: any[]): Group[] {
  const documentMap = new Map<string, any[]>();
  documents.forEach((document) => {
    const key = text(document.bankVerificationId);
    const current = documentMap.get(key) ?? [];
    current.push(document);
    documentMap.set(key, current);
  });

  const groups = new Map<string, Group>();
  records.forEach((record) => {
    const bankName = text(record.bankName) || "UNSPECIFIED BANK";
    const accountNumber = text(record.bankAccount) || "UNSPECIFIED ACCOUNT";
    const accountName = text(record.accountName) || text(record.receiverName);
    const key = `${bankName.toUpperCase()}::${accountNumber}`;
    const current = groups.get(key) ?? {
      key,
      bankName,
      accountName,
      accountNumber,
      rows: [],
      documents: [],
    };
    current.rows.push(record);
    current.documents.push(...(documentMap.get(text(record.id)) ?? []));
    groups.set(key, current);
  });

  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function addTransactionTablePages(
  pdf: PDFDocument,
  regular: PDFFont,
  bold: PDFFont,
  company: CompanyReportProfile,
  companyLogo: any | null,
  group: Group,
  from: Date,
  to: Date,
) {
  const rowsPerPage = 14;
  const periodLabel = `${from.toLocaleDateString("en-GB")} - ${to.toLocaleDateString("en-GB")}`;
  const total = group.rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const verified = group.rows
    .filter((row) => row.status === "VERIFIED")
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const pending = group.rows.filter((row) => row.status === "PENDING").length;
  const insufficient = group.rows.filter(
    (row) => row.proofInspectionStatus === "INSUFFICIENT",
  ).length;

  for (let offset = 0; offset < Math.max(1, group.rows.length); offset += rowsPerPage) {
    const page = pdf.addPage([PageSizes.A4[1], PageSizes.A4[0]]);
    const { width, height } = page.getSize();
    addStatementHeader(
      page,
      regular,
      bold,
      company,
      companyLogo,
      group.bankName,
      group.accountName,
      group.accountNumber,
      periodLabel,
    );
    addSummaryBoxes(page, regular, bold, height - 168, [
      { label: "Total submitted", value: money(total) },
      { label: "Verified amount", value: money(verified) },
      { label: "Pending records", value: String(pending) },
      { label: "Insufficient proofs", value: String(insufficient) },
    ]);

    const headerY = height - 242;
    const columns = [
      { label: "Posting date", width: 92 },
      { label: "Reference / details", width: 250 },
      { label: "From / to", width: 150 },
      { label: "Amount", width: 88 },
      { label: "Proof", width: 82 },
      { label: "Decision", width: 78 },
    ];
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    let x = 36;
    page.drawRectangle({ x, y: headerY, width: tableWidth, height: 28, color: GREEN });
    columns.forEach((column) => {
      drawText(page, bold, column.label.toUpperCase(), x + 5, headerY + 10, 7, column.width - 10, rgb(1, 1, 1));
      x += column.width;
    });

    const pageRows = group.rows.slice(offset, offset + rowsPerPage);
    pageRows.forEach((row, index) => {
      const y = headerY - (index + 1) * 32;
      const fill = index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.97);
      page.drawRectangle({
        x: 36,
        y,
        width: tableWidth,
        height: 32,
        color: fill,
        borderColor: BORDER,
        borderWidth: 0.45,
      });
      let cellX = 36;
      const values = [
        dateTime(row.transactionDateTime || row.depositDate),
        `${ellipsis(row.referenceNumber, 22)} - ${ellipsis(row.reviewNote || row.proofMissingFields || "Bank proof submitted", 42)}`,
        `${ellipsis(row.senderName || "N/A", 22)} / ${ellipsis(row.receiverName || "N/A", 22)}`,
        money(row.amount),
        text(row.proofInspectionStatus) || "PENDING",
        text(row.status) || "PENDING",
      ];
      values.forEach((value, columnIndex) => {
        const column = columns[columnIndex];
        drawText(page, regular, value, cellX + 5, y + 12, 6.5, column.width - 10);
        cellX += column.width;
      });
    });

    drawText(
      page,
      regular,
      `Documents linked to this account: ${group.documents.length}. Summary page ${Math.floor(offset / rowsPerPage) + 1}.`,
      36,
      28,
      7,
      width - 72,
      MUTED,
    );
  }
}

async function appendDocument(
  output: PDFDocument,
  regular: PDFFont,
  bold: PDFFont,
  document: any,
  group: Group,
) {
  const filePath = publicUrlToPath(text(document.publicUrl));
  if (!filePath || !(await fileExists(filePath))) {
    const page = output.addPage(PageSizes.A4);
    const { height } = page.getSize();
    drawText(page, bold, "Linked proof could not be embedded", 42, height - 60, 18, 500, GREEN);
    drawText(page, regular, `Bank: ${group.bankName}`, 42, height - 92, 10, 500);
    drawText(page, regular, `Account: ${group.accountNumber}`, 42, height - 112, 10, 500);
    drawText(page, regular, `Document: ${text(document.originalName)}`, 42, height - 142, 10, 500);
    drawText(page, regular, `Stored URL: ${text(document.publicUrl)}`, 42, height - 164, 8, 500, MUTED);
    return;
  }

  const bytes = await readFile(/* turbopackIgnore: true */ filePath);
  const mimeType = text(document.mimeType).toLowerCase();
  const extension = path.extname(filePath).toLowerCase();

  try {
    if (mimeType === "application/pdf" || extension === ".pdf") {
      const source = await PDFDocument.load(bytes);
      const copied = await output.copyPages(source, source.getPageIndices());
      copied.forEach((page) => output.addPage(page));
      return;
    }

    if (mimeType.includes("jpeg") || [".jpg", ".jpeg"].includes(extension)) {
      const image = await output.embedJpg(bytes);
      const page = output.addPage(PageSizes.A4);
      const { width, height } = page.getSize();
      const scale = Math.min((width - 56) / image.width, (height - 90) / image.height);
      page.drawImage(image, {
        x: (width - image.width * scale) / 2,
        y: 28,
        width: image.width * scale,
        height: image.height * scale,
      });
      drawText(page, bold, ellipsis(document.originalName, 70), 28, height - 28, 9, width - 56, GREEN);
      return;
    }

    if (mimeType.includes("png") || extension === ".png") {
      const image = await output.embedPng(bytes);
      const page = output.addPage(PageSizes.A4);
      const { width, height } = page.getSize();
      const scale = Math.min((width - 56) / image.width, (height - 90) / image.height);
      page.drawImage(image, {
        x: (width - image.width * scale) / 2,
        y: 28,
        width: image.width * scale,
        height: image.height * scale,
      });
      drawText(page, bold, ellipsis(document.originalName, 70), 28, height - 28, 9, width - 56, GREEN);
      return;
    }
  } catch (error) {
    console.warn("BANK_BUNDLE_EMBED_FAILED", document.id, error);
  }

  const page = output.addPage(PageSizes.A4);
  const { height } = page.getSize();
  drawText(page, bold, "Linked supporting document", 42, height - 60, 18, 500, GREEN);
  drawText(page, regular, `Document: ${text(document.originalName)}`, 42, height - 98, 10, 500);
  drawText(page, regular, `Type: ${text(document.mimeType)}`, 42, height - 120, 10, 500);
  drawText(page, regular, `Size: ${Number(document.sizeBytes || 0).toLocaleString()} bytes`, 42, height - 142, 10, 500);
  drawText(page, regular, "This file type is listed in the report but is not directly renderable as a PDF page.", 42, height - 180, 9, 500, MUTED);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const url = new URL(request.url);
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"), true);
    const bankFilter = text(url.searchParams.get("bank")).trim();
    const accountFilter = text(url.searchParams.get("account")).trim();

    if (from > to) {
      throw new HttpError("The report start date cannot be after the end date.", 422);
    }

    const db = prisma as any;
    const [company, rawRecords, importedStatements] = await Promise.all([
      db.company.findUnique({ where: { id: companyId } }),
      db.companyBankVerification.findMany({
        where: {
          companyId,
          depositDate: { gte: from, lte: to },
          ...(accountFilter ? { bankAccount: { contains: accountFilter } } : {}),
        },
        orderBy: [{ bankAccount: "asc" }, { depositDate: "asc" }],
      }),
      db.importedBankStatement.findMany({
        where: { companyId },
        orderBy: { importedAt: "desc" },
        select: { bankName: true, accountName: true, accountNumber: true },
      }),
    ]);

    const statementByAccount = new Map<string, any>();
    for (const statement of importedStatements) {
      const key = accountKey(statement.accountNumber);
      if (key && !statementByAccount.has(key)) statementByAccount.set(key, statement);
    }

    const records = rawRecords
      .map((record: any) => {
        const statement = statementByAccount.get(accountKey(record.bankAccount));
        return {
          ...record,
          bankName: text(statement?.bankName) || "UNSPECIFIED BANK",
          accountName: text(statement?.accountName) || "",
        };
      })
      .filter((record: any) =>
        !bankFilter || text(record.bankName).toLowerCase().includes(bankFilter.toLowerCase()),
      );

    if (!records.length) {
      throw new HttpError("No bank proof records were found for the selected period and filters.", 404);
    }

    const recordIds = records.map((record: any) => text(record.id));
    const documents = await db.portalDocument.findMany({
      where: {
        companyId,
        bankVerificationId: { in: recordIds },
      },
      orderBy: { createdAt: "asc" },
    });

    const groups = groupRows(records, documents);
    const reportCompany = await resolveCompanyReportProfile(companyId, company);
    const output = await PDFDocument.create();
    const regular = await output.embedFont(StandardFonts.Helvetica);
    const bold = await output.embedFont(StandardFonts.HelveticaBold);
    const logoBytes = await loadCompanyReportLogo(reportCompany.logoUrl);
    let companyLogo: any | null = null;
    if (logoBytes) {
      try {
        companyLogo = await output.embedPng(logoBytes);
      } catch {
        try {
          companyLogo = await output.embedJpg(logoBytes);
        } catch {
          companyLogo = null;
        }
      }
    }

    for (const group of groups) {
      addTransactionTablePages(output, regular, bold, reportCompany, companyLogo, group, from, to);
      for (const document of group.documents) {
        await appendDocument(output, regular, bold, document, group);
      }
    }

    const pages = output.getPages();
    pages.forEach((page, index) => {
      const { width } = page.getSize();
      drawText(
        page,
        regular,
        `Generated by Simamia Float - ${dateTime(new Date())} - Page ${index + 1} of ${pages.length}`,
        30,
        13,
        6.5,
        width - 60,
        MUTED,
      );
    });

    output.setTitle("Simamia Grand Bank Proof Report");
    output.setAuthor(reportCompany.name || "Simamia Float");
    output.setSubject("Bank proof documents grouped by bank and account");
    output.setCreator("Simamia Float ERP");

    const bytes = await output.save();
    const filename = cleanFileName(
      `simamia-grand-bank-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    );

    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
