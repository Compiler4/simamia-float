import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
} from "pdf-lib";

import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/staff/permissions";
import {
  cleanText,
  numberValue,
  periodBounds,
} from "@/lib/staff/operations-v4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportRow = {
  date: Date;
  details: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  proofUrl?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-TZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function dateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
    hour12: false,
  }).format(value);
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function safeDate(value: unknown): Date {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

async function reportSource(
  companyId: string,
  staffId: string,
  start: Date,
  end: Date,
) {
  const db = prisma as any;

  const [staff, funding, floats, collections, deposits, expenses, proofs, services] =
    await Promise.all([
      db.user.findFirst({
        where: { id: staffId, companyId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          assignedRegion: true,
          company: { select: { name: true, code: true } },
        },
      }),
      db.staffFundingReceipt.findMany({
        where: {
          companyId,
          staffId,
          issuedAt: { gte: start, lte: end },
        },
        include: {
          accountant: { select: { name: true } },
          networkLine: true,
        },
      }),
      db.floatTransaction.findMany({
        where: {
          companyId,
          OR: [{ fromUserId: staffId }, { toUserId: staffId }],
          createdAt: { gte: start, lte: end },
        },
        include: {
          fromUser: { select: { name: true } },
          toUser: { select: { name: true } },
          brokerCustomer: true,
        },
      }),
      db.staffCollection.findMany({
        where: {
          companyId,
          staffId,
          collectionDate: { gte: start, lte: end },
        },
        include: {
          brokerCustomer: true,
          broker: { select: { name: true } },
        },
      }),
      db.bankDeposit.findMany({
        where: {
          companyId,
          staffId,
          depositDate: { gte: start, lte: end },
        },
      }),
      db.expense.findMany({
        where: {
          companyId,
          employeeId: staffId,
          expenseDate: { gte: start, lte: end },
        },
      }),
      db.staffProofSubmission.findMany({
        where: {
          companyId,
          staffId,
          transactionAt: { gte: start, lte: end },
        },
        include: {
          file: {
            select: {
              storagePath: true,
              mimeType: true,
            },
          },
        },
      }),
      db.brokerServiceVisit.findMany({
        where: {
          companyId,
          staffId,
          startedAt: { gte: start, lte: end },
        },
        include: { broker: true },
      }),
    ]);

  const rows: Omit<ReportRow, "balance">[] = [];

  for (const item of funding) {
    if (item.status !== "CONFIRMED") continue;
    const total = numberValue(item.floatAmount) + numberValue(item.cashAmount);
    rows.push({
      date: safeDate(item.confirmedAt ?? item.issuedAt),
      reference: item.referenceNo,
      details: [
        "ACCOUNTANT TO STAFF",
        `FROM ${item.accountant?.name ?? "ACCOUNTANT"} TO ${staff?.name ?? "STAFF"}`,
        item.networkLine
          ? `${item.networkLine.network} ${item.networkLine.simCardNumber}`
          : "",
        `FLOAT ${money(numberValue(item.floatAmount))}; CASH ${money(
          numberValue(item.cashAmount),
        )}`,
      ]
        .filter(Boolean)
        .join(" - "),
      debit: 0,
      credit: total,
    });
  }

  for (const item of floats) {
    const amount = numberValue(item.returnedAmount ?? item.amount);
    const outgoing = item.fromUserId === staffId;
    rows.push({
      date: safeDate(
        item.returnedAt ?? item.confirmedAt ?? item.issuedAt ?? item.createdAt,
      ),
      reference: item.referenceNo ?? item.id,
      details: [
        item.transactionType,
        `FROM ${item.fromUser?.name ?? staff?.name ?? "STAFF"} TO ${
          item.brokerCustomer?.name ?? item.toUser?.name ?? "ACCOUNTANT"
        }`,
        item.purpose ?? "",
      ]
        .filter(Boolean)
        .join(" - "),
      debit: outgoing ? amount : 0,
      credit: outgoing ? 0 : amount,
      proofUrl: item.receiptUrl,
    });
  }

  for (const item of collections) {
    const amount = numberValue(item.amount);
    rows.push({
      date: safeDate(item.collectionDate),
      reference: item.referenceNo,
      details: `BROKER COLLECTION - FROM ${
        item.brokerCustomer?.name ?? item.broker?.name ?? "BROKER"
      } TO ${staff?.name ?? "STAFF"}`,
      debit: 0,
      credit: amount,
      proofUrl: item.receiptUrl,
    });
  }

  for (const item of deposits) {
    const amount = numberValue(item.amount);
    rows.push({
      date: safeDate(item.depositDate),
      reference: item.referenceNo ?? item.id,
      details: `BANK DEPOSIT - FROM ${staff?.name ?? "STAFF"} TO ${
        item.bankAccount ?? "BANK"
      }`,
      debit: amount,
      credit: 0,
      proofUrl: item.bankReceiptUrl ?? item.depositSlipUrl,
    });
  }

  for (const item of expenses) {
    const amount = numberValue(item.amount);
    rows.push({
      date: safeDate(item.expenseDate),
      reference: item.id,
      details: `EXPENSE ${item.requestMode ?? "REIMBURSEMENT"} - ${
        item.otherCategory ?? item.category
      } - ${item.description ?? ""}`,
      debit: amount,
      credit: 0,
      proofUrl: item.receiptUrl,
    });
  }

  for (const item of proofs) {
    rows.push({
      date: safeDate(item.transactionAt),
      reference: item.referenceNo,
      details: `${item.direction} - FROM ${item.senderName} TO ${
        item.receiverName
      } - PROOF ${item.status}`,
      debit: item.direction.includes("STAFF_TO") ? numberValue(item.amount) : 0,
      credit: item.direction.includes("TO_STAFF") || item.direction === "BROKER_TO_STAFF"
        ? numberValue(item.amount)
        : 0,
      proofUrl: item.proofUrl,
      storagePath: item.file?.storagePath ?? null,
      mimeType: item.file?.mimeType ?? null,
    });
  }

  for (const item of services) {
    rows.push({
      date: safeDate(item.serviceProvidedAt ?? item.startedAt),
      reference: item.id,
      details: `SERVICE VISIT - ${item.broker?.name ?? "BROKER"} - FLOAT ${money(
        numberValue(item.floatAmount),
      )}; CASH ${money(numberValue(item.cashAmount))}`,
      debit: 0,
      credit: 0,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  const completeRows: ReportRow[] = rows.map((row) => {
    balance += row.credit - row.debit;
    return { ...row, balance };
  });

  return { staff, rows: completeRows };
}

function drawHeader(
  page: PDFPage,
  font: any,
  bold: any,
  input: {
    staffName: string;
    companyName: string;
    periodLabel: string;
    totalCredit: number;
    totalDebit: number;
    closingBalance: number;
    pageNo: number;
  },
) {
  const { width, height } = page.getSize();
  page.drawRectangle({
    x: 0,
    y: height - 72,
    width,
    height: 72,
    color: rgb(0.08, 0.45, 0.25),
  });
  page.drawText("SIMAMIA FLOAT", {
    x: 38,
    y: height - 37,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText("Staff Grand Transaction Report", {
    x: 38,
    y: height - 57,
    size: 10,
    font,
    color: rgb(0.9, 1, 0.94),
  });
  page.drawText(`Page ${input.pageNo}`, {
    x: width - 78,
    y: height - 43,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText(input.staffName, {
    x: 38,
    y: height - 105,
    size: 16,
    font: bold,
    color: rgb(0.05, 0.15, 0.1),
  });
  page.drawText(input.companyName, {
    x: 38,
    y: height - 123,
    size: 10,
    font: bold,
    color: rgb(0.22, 0.35, 0.28),
  });
  page.drawText(`Period: ${input.periodLabel}`, {
    x: 38,
    y: height - 142,
    size: 9,
    font,
    color: rgb(0.22, 0.35, 0.28),
  });

  const summary = [
    `Total Credit: ${money(input.totalCredit)} TZS`,
    `Total Debit: ${money(input.totalDebit)} TZS`,
    `Closing Balance: ${money(input.closingBalance)} TZS`,
  ];
  summary.forEach((text, index) => {
    page.drawText(text, {
      x: 325,
      y: height - 104 - index * 19,
      size: 9,
      font: index === 2 ? bold : font,
      color: rgb(0.08, 0.25, 0.16),
    });
  });
}

function drawTableHeader(page: PDFPage, bold: any, y: number) {
  const columns = [
    { x: 38, width: 78, label: "Posting Date" },
    { x: 116, width: 226, label: "Details" },
    { x: 342, width: 72, label: "Reference" },
    { x: 414, width: 58, label: "Debit" },
    { x: 472, width: 58, label: "Credit" },
    { x: 530, width: 67, label: "Balance" },
  ];
  for (const column of columns) {
    page.drawRectangle({
      x: column.x,
      y: y - 18,
      width: column.width,
      height: 20,
      color: rgb(0.2, 0.55, 0.22),
      borderColor: rgb(0.1, 0.35, 0.15),
      borderWidth: 0.5,
    });
    page.drawText(column.label, {
      x: column.x + 3,
      y: y - 12,
      size: 7.5,
      font: bold,
      color: rgb(1, 1, 1),
    });
  }
}

function wrapText(text: string, max = 48): string[] {
  const words = cleanText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= max) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

async function createPdf(
  staff: any,
  rows: ReportRow[],
  periodLabel: string,
  appendProofs: boolean,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const closingBalance = rows.at(-1)?.balance ?? 0;

  const rowsPerPage = 16;
  const pages = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const page = pdf.addPage([635, 842]);
    drawHeader(page, font, bold, {
      staffName: staff?.name ?? "Staff Officer",
      companyName: staff?.company?.name ?? "Company",
      periodLabel,
      totalCredit,
      totalDebit,
      closingBalance,
      pageNo: pageIndex + 1,
    });

    let y = 660;
    drawTableHeader(page, bold, y);
    y -= 25;

    const pageRows = rows.slice(
      pageIndex * rowsPerPage,
      pageIndex * rowsPerPage + rowsPerPage,
    );

    for (const row of pageRows) {
      const detailLines = wrapText(row.details);
      const height = Math.max(30, detailLines.length * 9 + 8);
      const columns = [
        { x: 38, width: 78 },
        { x: 116, width: 226 },
        { x: 342, width: 72 },
        { x: 414, width: 58 },
        { x: 472, width: 58 },
        { x: 530, width: 67 },
      ];
      for (const column of columns) {
        page.drawRectangle({
          x: column.x,
          y: y - height,
          width: column.width,
          height,
          borderColor: rgb(0.68, 0.72, 0.69),
          borderWidth: 0.45,
        });
      }

      page.drawText(dateTime(row.date), {
        x: 41,
        y: y - 12,
        size: 6.5,
        font,
        color: rgb(0.08, 0.12, 0.1),
      });
      detailLines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: 119,
          y: y - 10 - lineIndex * 9,
          size: 6.5,
          font,
          color: rgb(0.08, 0.12, 0.1),
        });
      });
      page.drawText(cleanText(row.reference).slice(0, 17), {
        x: 345,
        y: y - 12,
        size: 6.2,
        font,
        color: rgb(0.08, 0.12, 0.1),
      });
      page.drawText(row.debit ? money(row.debit) : "0.00", {
        x: 417,
        y: y - 12,
        size: 6.2,
        font,
        color: rgb(0.25, 0.08, 0.08),
      });
      page.drawText(row.credit ? money(row.credit) : "0.00", {
        x: 475,
        y: y - 12,
        size: 6.2,
        font,
        color: rgb(0.02, 0.3, 0.12),
      });
      page.drawText(money(row.balance), {
        x: 533,
        y: y - 12,
        size: 6.2,
        font: bold,
        color: rgb(0.02, 0.2, 0.1),
      });
      y -= height;
    }

    page.drawText(`Generated ${dateTime(new Date())} - Staff data only`, {
      x: 38,
      y: 24,
      size: 7,
      font,
      color: rgb(0.35, 0.42, 0.38),
    });
  }

  if (appendProofs) {
    for (const row of rows) {
      if (!row.storagePath || !row.mimeType) continue;
      const storageRoot = path.resolve(process.cwd(), "storage", "private", "staff");
      const absolutePath = path.resolve(process.cwd(), row.storagePath);
      if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) continue;

      try {
        const bytes = await readFile(absolutePath);
        if (row.mimeType === "application/pdf") {
          const source = await PDFDocument.load(bytes);
          const copied = await pdf.copyPages(source, source.getPageIndices());
          copied.forEach((page) => pdf.addPage(page));
        } else if (
          row.mimeType === "image/png" ||
          row.mimeType === "image/jpeg" ||
          row.mimeType === "image/webp"
        ) {
          const page = pdf.addPage([595, 842]);
          let imageBytes: Uint8Array = bytes;
          let imageMime = row.mimeType;

          if (row.mimeType === "image/webp") {
            const sharpModule = await import("sharp");
            imageBytes = await sharpModule.default(bytes).png().toBuffer();
            imageMime = "image/png";
          }

          const image =
            imageMime === "image/png"
              ? await pdf.embedPng(imageBytes)
              : await pdf.embedJpg(imageBytes);
          const margin = 38;
          const bounds = page.getSize();
          const scale = Math.min(
            (bounds.width - margin * 2) / image.width,
            (bounds.height - margin * 2) / image.height,
          );
          page.drawImage(image, {
            x: (bounds.width - image.width * scale) / 2,
            y: (bounds.height - image.height * scale) / 2,
            width: image.width * scale,
            height: image.height * scale,
          });
          page.drawText(`Proof ${row.reference}`, {
            x: margin,
            y: 20,
            size: 8,
            font: bold,
            color: rgb(0.1, 0.3, 0.18),
          });
        } else {
          const page = pdf.addPage([595, 842]);
          page.drawText("Proof document reference", {
            x: 45,
            y: 780,
            size: 18,
            font: bold,
            color: rgb(0.08, 0.45, 0.25),
          });
          page.drawText(`Reference: ${cleanText(row.reference)}`, {
            x: 45,
            y: 744,
            size: 11,
            font,
            color: rgb(0.1, 0.2, 0.15),
          });
          page.drawText(`File type: ${cleanText(row.mimeType)}`, {
            x: 45,
            y: 724,
            size: 10,
            font,
            color: rgb(0.25, 0.35, 0.3),
          });
          page.drawText("The original file remains available through the secure staff preview route.", {
            x: 45,
            y: 690,
            size: 9,
            font,
            color: rgb(0.25, 0.35, 0.3),
          });
        }
      } catch (error) {
        console.warn("STAFF_REPORT_PROOF_APPEND_WARNING:", row.reference, error);
      }
    }
  }

  pdf.setTitle(`Staff Grand Report - ${staff?.name ?? "Staff"}`);
  pdf.setAuthor("Simamia Float");
  pdf.setSubject("Staff-only float, cash, proof, expense and service report");
  return pdf.save();
}

export async function GET(request: Request) {
  try {
    const session = await requireStaff();
    const url = new URL(request.url);
    const format = cleanText(url.searchParams.get("format")).toLowerCase() || "pdf";
    const appendProofs = url.searchParams.get("appendProofs") === "1";
    const bounds = periodBounds(
      url.searchParams.get("period"),
      url.searchParams.get("anchor") ?? url.searchParams.get("date"),
      url.searchParams.get("from"),
      url.searchParams.get("to"),
    );
    const { staff, rows } = await reportSource(
      session.companyId,
      session.id,
      bounds.start,
      bounds.end,
    );
    const basename = `staff-grand-report-${cleanText(staff?.username) || session.id}-${bounds.period.toLowerCase()}`;

    if (format === "csv") {
      const header = [
        "Posting Date",
        "Details",
        "Reference",
        "Debit TZS",
        "Credit TZS",
        "Running Balance TZS",
        "Proof URL",
      ];
      const body = rows.map((row) => [
        dateTime(row.date),
        row.details,
        row.reference,
        row.debit.toFixed(2),
        row.credit.toFixed(2),
        row.balance.toFixed(2),
        row.proofUrl ?? "",
      ]);
      const csv = [header, ...body]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${basename}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const bytes = await createPdf(staff, rows, bounds.label, appendProofs);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${basename}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("STAFF_REPORT_ERROR:", error);
    return Response.json(
      {
        success: false,
        message: "The staff grand report could not be generated.",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 },
    );
  }
}
