import { NextRequest } from "next/server";
import PDFDocument from "pdfkit";

import { prisma } from "@/lib/prisma";
import { HttpError, requireCompanyAdmin, routeError, text, toNumber } from "@/lib/company-admin-server";
import {
  type CompanyReportProfile,
  loadCompanyReportLogo,
  resolveCompanyReportProfile,
} from "@/lib/reports/branded-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pdf = InstanceType<typeof PDFDocument>;

type Column = {
  label: string;
  width: number;
  value: (row: any, index: number) => string;
  align?: "left" | "right" | "center";
};

function parseDate(value: string | null, end = false): Date {
  const date = value ? new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function darEsSalaamPeriodStarts(now = new Date()) {
  const offsetMs = 3 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + offsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const weekday = shifted.getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  const fromDarMidnight = (value: number) => new Date(value - offsetMs);

  return {
    day: fromDarMidnight(Date.UTC(year, month, day)),
    week: fromDarMidnight(Date.UTC(year, month, day - daysFromMonday)),
    month: fromDarMidnight(Date.UTC(year, month, 1)),
    year: fromDarMidnight(Date.UTC(year, 0, 1)),
  };
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

function addHeader(
  doc: Pdf,
  company: CompanyReportProfile,
  title: string,
  subtitle: string,
  logo: Buffer | null,
) {
  const width = doc.page.width;
  doc.save().rect(0, 0, width, 112).fill("#0b704a").restore();

  const logoX = 42;
  const logoY = 21;
  const logoSize = 58;
  doc.save().roundedRect(logoX, logoY, logoSize, logoSize, 10).fill("#ffffff").restore();
  if (logo) {
    try {
      doc.image(logo, logoX + 6, logoY + 6, {
        fit: [logoSize - 12, logoSize - 12],
        align: "center",
        valign: "center",
      });
    } catch {
      doc.fillColor("#0b704a").font("Helvetica-Bold").fontSize(18).text(
        company.name.slice(0, 2).toUpperCase(),
        logoX,
        logoY + 19,
        { width: logoSize, align: "center" },
      );
    }
  } else {
    doc.fillColor("#0b704a").font("Helvetica-Bold").fontSize(18).text(
      company.name.slice(0, 2).toUpperCase(),
      logoX,
      logoY + 19,
      { width: logoSize, align: "center" },
    );
  }

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(17).text(company.name, 112, 25, {
    width: 230,
    ellipsis: true,
  });
  doc.fillColor("#d7f4e7").font("Helvetica").fontSize(8.5).text("SIMAMIA FLOAT • COMPANY ADMIN REPORT", 112, 51, {
    width: 230,
  });
  doc.font("Helvetica-Bold").fontSize(8).text(title, 112, 69, { width: 230, ellipsis: true });

  const cardWidth = 205;
  const cardX = width - cardWidth - 42;
  doc.save().fillOpacity(0.95).roundedRect(cardX, 13, cardWidth, 88, 10).fill("#ffffff").restore();
  const details = [
    company.code ? `Code: ${company.code}` : "",
    company.registrationNumber ? `Reg: ${company.registrationNumber}` : "",
    company.tin ? `TIN: ${company.tin}` : "",
    company.phone ? `Tel: ${company.phone}` : "",
    company.email ? `Email: ${company.email}` : "",
    company.address ? `Address: ${company.address}` : "",
    company.website ? `Web: ${company.website}` : "",
  ].filter(Boolean);
  doc.fillColor("#0b5138").font("Helvetica-Bold").fontSize(7.2).text("REGISTERED COMPANY DETAILS", cardX + 10, 21, {
    width: cardWidth - 20,
    align: "right",
  });
  doc.fillColor("#263d35").font("Helvetica").fontSize(6.2).text(details.join("\n"), cardX + 10, 35, {
    width: cardWidth - 20,
    align: "right",
    lineGap: 0.8,
    ellipsis: true,
  });

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(20).text(title, 42, 132);
  doc.fillColor("#60717a").font("Helvetica").fontSize(9).text(subtitle, 42, 160, { width: width - 84 });
  doc.moveTo(42, 184).lineTo(width - 42, 184).strokeColor("#d2ded7").stroke();
  doc.y = 200;
}

function ensureSpace(doc: Pdf, height: number, onNewPage?: () => void) {
  if (doc.y + height <= doc.page.height - 52) return;
  doc.addPage({ size: "A4", margin: 42 });
  onNewPage?.();
}

function summaryCards(
  doc: Pdf,
  items: Array<{ label: string; value: string; note?: string }>,
) {
  const gap = 10;
  const width = (doc.page.width - 84 - gap * (items.length - 1)) / items.length;
  const startY = doc.y;

  items.forEach((item, index) => {
    const x = 42 + index * (width + gap);
    doc.roundedRect(x, startY, width, 76, 8).fillAndStroke("#f4faf6", "#d7e8dc");
    doc.fillColor("#5b6c63").font("Helvetica").fontSize(8).text(item.label, x + 10, startY + 12, {
      width: width - 20,
    });
    doc.fillColor("#0f5132").font("Helvetica-Bold").fontSize(13).text(item.value, x + 10, startY + 30, {
      width: width - 20,
    });
    if (item.note) {
      doc.fillColor("#7d8f85").font("Helvetica").fontSize(7).text(item.note, x + 10, startY + 53, {
        width: width - 20,
      });
    }
  });

  doc.y = startY + 91;
}

function table(doc: Pdf, title: string, rows: any[], columns: Column[]) {
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const startX = 42;
  const headerHeight = 25;
  const rowHeight = 33;

  const drawTitleAndHeader = () => {
    doc.fillColor("#1f2937").font("Helvetica-Bold").fontSize(12).text(title, startX, doc.y);
    doc.y += 20;
    const y = doc.y;
    doc.rect(startX, y, tableWidth, headerHeight).fill("#277a3e");
    let x = startX;
    for (const column of columns) {
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(column.label.toUpperCase(), x + 4, y + 8, {
          width: column.width - 8,
          align: column.align || "left",
        });
      x += column.width;
    }
    doc.y = y + headerHeight;
  };

  ensureSpace(doc, 70, drawTitleAndHeader);
  drawTitleAndHeader();

  if (!rows.length) {
    doc
      .rect(startX, doc.y, tableWidth, rowHeight)
      .fillAndStroke("#f8faf9", "#e2e8e5")
      .fillColor("#6b7280")
      .font("Helvetica")
      .fontSize(8)
      .text("No records found for this period.", startX + 6, doc.y + 11, {
        width: tableWidth - 12,
        align: "center",
      });
    doc.y += rowHeight + 18;
    return;
  }

  rows.forEach((row, index) => {
    ensureSpace(doc, rowHeight + 5, drawTitleAndHeader);
    const y = doc.y;
    doc.rect(startX, y, tableWidth, rowHeight).fillAndStroke(index % 2 ? "#f5f8f6" : "#ffffff", "#e0e7e3");
    let x = startX;
    for (const column of columns) {
      doc
        .fillColor("#1f2937")
        .font("Helvetica")
        .fontSize(6.8)
        .text(column.value(row, index), x + 4, y + 7, {
          width: column.width - 8,
          height: rowHeight - 10,
          ellipsis: true,
          align: column.align || "left",
        });
      x += column.width;
    }
    doc.y = y + rowHeight;
  });

  doc.y += 18;
}

async function pdfBuffer(build: (doc: Pdf) => void): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  build(doc);

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .fillColor("#7b8a82")
      .font("Helvetica")
      .fontSize(7)
      .text(
        `Generated ${new Date().toLocaleString("en-TZ")} • Page ${index + 1} of ${range.count}`,
        42,
        doc.page.height - 50,
        { width: doc.page.width - 84, align: "center", lineBreak: false },
      );
  }

  doc.end();
  return completed;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const url = new URL(request.url);
    const kind = (url.searchParams.get("kind") || "system").toLowerCase();
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"), true);
    if (from > to) {
      throw new HttpError("The report start date cannot be after the end date.", 422);
    }
    const periodStarts = darEsSalaamPeriodStarts();
    const db = prisma as any;

    const [
      company,
      expenses,
      bankRecords,
      services,
      visits,
      floats,
      collections,
      attendance,
      users,
      networkBalances,
      importedStatement,
      incomeVisits,
    ] = await Promise.all([
      db.company.findUnique({ where: { id: companyId } }),
      db.companyExpense.findMany({
        where: { companyId, expenseDate: { gte: from, lte: to } },
        orderBy: { expenseDate: "desc" },
      }),
      db.companyBankVerification.findMany({
        where: { companyId, depositDate: { gte: from, lte: to } },
        orderBy: { depositDate: "desc" },
      }),
      db.serviceActivity.findMany({
        where: { companyId, servedAt: { gte: from, lte: to } },
        include: { staff: true, brokerCustomer: true, broker: true, customer: true },
        orderBy: { servedAt: "desc" },
      }),
      db.brokerServiceVisit.findMany({
        where: { companyId, startedAt: { gte: from, lte: to } },
        include: { staff: true, brokerCustomer: true },
        orderBy: { startedAt: "desc" },
      }),
      db.floatTransaction.findMany({
        where: { companyId, createdAt: { gte: from, lte: to } },
        include: { fromUser: true, toUser: true, brokerCustomer: true },
        orderBy: { createdAt: "desc" },
      }),
      db.staffCollection.findMany({
        where: { companyId, collectionDate: { gte: from, lte: to } },
        include: { staff: true, broker: true, brokerCustomer: true },
        orderBy: { collectionDate: "desc" },
      }),
      db.companyAttendance.findMany({
        where: { companyId, attendanceDate: { gte: from, lte: to } },
        orderBy: [{ attendanceDate: "desc" }, { userName: "asc" }],
      }),
      db.user.findMany({
        where: { companyId, role: { in: ["STAFF", "ACCOUNTANT"] } },
        orderBy: { name: "asc" },
      }),
      db.networkBalance.findMany({ where: { companyId }, orderBy: { network: "asc" } }),
      db.importedBankStatement.findFirst({ where: { companyId }, orderBy: { periodEnd: "desc" } }),
      db.brokerServiceVisit.findMany({
        where: {
          companyId,
          serviceProvidedAt: { gte: periodStarts.year },
        },
        select: { companyIncome: true, serviceProvidedAt: true },
      }),
    ]);

    const totalDeposits = bankRecords
      .filter((item: any) => item.status === "VERIFIED")
      .reduce((sum: number, item: any) => sum + toNumber(item.amount), 0);
    const totalExpenses = expenses
      .filter((item: any) => item.status === "APPROVED")
      .reduce((sum: number, item: any) => sum + toNumber(item.amount), 0);
    const companyIncome = visits.reduce(
      (sum: number, item: any) => sum + toNumber(item.companyIncome),
      0,
    );
    const floatIssued = floats.reduce((sum: number, item: any) => sum + toNumber(item.amount), 0);
    const floatReturned = floats.reduce(
      (sum: number, item: any) => sum + toNumber(item.returnedAmount),
      0,
    );
    const outstanding = Math.max(0, floatIssued - floatReturned);
    const incomeSince = (start: Date) =>
      incomeVisits
        .filter((item: any) => item.serviceProvidedAt && new Date(item.serviceProvidedAt) >= start)
        .reduce((sum: number, item: any) => sum + toNumber(item.companyIncome), 0);
    const incomeToday = incomeSince(periodStarts.day);
    const incomeThisWeek = incomeSince(periodStarts.week);
    const incomeThisMonth = incomeSince(periodStarts.month);
    const incomeThisYear = incomeSince(periodStarts.year);

    const staffRows = users.map((employee: any) => {
      const employeeServices = services.filter((row: any) => row.staffId === employee.id);
      const employeeVisits = visits.filter((row: any) => row.staffId === employee.id);
      const employeeAttendance = attendance.filter((row: any) => row.userId === employee.id);
      const present = employeeAttendance.filter((row: any) => ["PRESENT", "LATE"].includes(row.mark)).length;
      const absent = employeeAttendance.filter((row: any) => row.mark === "ABSENT").length;
      const issued = floats
        .filter((row: any) => row.toUserId === employee.id)
        .reduce((sum: number, row: any) => sum + toNumber(row.amount), 0);
      const returnedFromIssued = floats
        .filter((row: any) => row.toUserId === employee.id)
        .reduce((sum: number, row: any) => sum + toNumber(row.returnedAmount), 0);
      const returnedAsTransaction = floats
        .filter((row: any) => row.fromUserId === employee.id && row.transactionType === "STAFF_RETURN_TO_ACCOUNTANT")
        .reduce((sum: number, row: any) => sum + toNumber(row.amount), 0);
      const returned = Math.max(returnedFromIssued, returnedAsTransaction);
      return {
        name: employee.name,
        role: employee.role,
        services: employeeServices.length,
        brokers: new Set(employeeServices.map((row: any) => row.brokerCustomerId || row.brokerId).filter(Boolean)).size,
        serviceValue: employeeServices.reduce((sum: number, row: any) => sum + toNumber(row.amount), 0),
        income: employeeVisits.reduce((sum: number, row: any) => sum + toNumber(row.companyIncome), 0),
        present,
        absent,
        floatIssued: issued,
        floatReturned: returned,
        outstandingFloat: Math.max(0, issued - returned),
      };
    });

    const title =
      kind === "accounting"
        ? "Accounting and Cash Movement Report"
        : kind === "staff"
          ? "Staff Service and Performance Report"
          : kind === "bank"
            ? "Bank Verification Report"
            : "Full System Activity Report";

    const reportCompany = await resolveCompanyReportProfile(companyId, company);
    const reportLogo = await loadCompanyReportLogo(reportCompany.logoUrl);

    const buffer = await pdfBuffer((doc) => {
      addHeader(
        doc,
        reportCompany,
        title,
        `Period: ${from.toLocaleDateString("en-GB")} - ${to.toLocaleDateString("en-GB")} • Prepared by ${user.name}`,
        reportLogo,
      );

      summaryCards(doc, [
        { label: "VERIFIED CASH IN", value: money(totalDeposits) },
        { label: "APPROVED CASH OUT", value: money(totalExpenses) },
        { label: "COMPANY INCOME", value: money(companyIncome) },
        { label: "OUTSTANDING FLOAT", value: money(outstanding) },
      ]);

      summaryCards(doc, [
        { label: "INCOME TODAY", value: money(incomeToday) },
        { label: "INCOME THIS WEEK", value: money(incomeThisWeek) },
        { label: "INCOME THIS MONTH", value: money(incomeThisMonth) },
        { label: "INCOME THIS YEAR", value: money(incomeThisYear) },
      ]);

      if (kind === "accounting" || kind === "system") {
        table(doc, "Daily financial movements", bankRecords, [
          { label: "Date", width: 68, value: (row) => dateTime(row.depositDate) },
          { label: "Reference", width: 94, value: (row) => text(row.referenceNumber) },
          { label: "From / To", width: 145, value: (row) => `${text(row.senderName) || "N/A"}\n→ ${text(row.receiverName) || "N/A"}` },
          { label: "Amount", width: 82, value: (row) => money(row.amount), align: "right" },
          { label: "Status", width: 70, value: (row) => text(row.status), align: "center" },
        ]);

        table(doc, "Approved and pending expenses", expenses, [
          { label: "Date", width: 72, value: (row) => dateTime(row.expenseDate) },
          { label: "Employee", width: 108, value: (row) => text(row.createdByName) },
          { label: "Category", width: 90, value: (row) => text(row.category) },
          { label: "Amount", width: 90, value: (row) => money(row.amount), align: "right" },
          { label: "Status", width: 99, value: (row) => text(row.status), align: "center" },
        ]);

        table(doc, "Network SIM balances", networkBalances, [
          { label: "Network", width: 86, value: (row) => text(row.network) },
          { label: "SIM card", width: 105, value: (row) => text(row.simCardNumber) },
          { label: "Account", width: 116, value: (row) => text(row.accountName) || "N/A" },
          { label: "Float", width: 78, value: (row) => money(row.floatBalance), align: "right" },
          { label: "Cash", width: 74, value: (row) => money(row.cashBalance), align: "right" },
        ]);
      }

      if (kind === "staff" || kind === "system") {
        table(doc, "Staff service summary", staffRows, [
          { label: "Staff", width: 90, value: (row) => row.name },
          { label: "Role", width: 54, value: (row) => row.role },
          { label: "Services", width: 45, value: (row) => String(row.services), align: "center" },
          { label: "Brokers", width: 45, value: (row) => String(row.brokers), align: "center" },
          { label: "Service value", width: 76, value: (row) => money(row.serviceValue), align: "right" },
          { label: "Income", width: 65, value: (row) => money(row.income), align: "right" },
          { label: "Outstanding", width: 70, value: (row) => money(row.outstandingFloat), align: "right" },
          { label: "P/A", width: 36, value: (row) => `${row.present}/${row.absent}`, align: "center" },
        ]);

        table(
          doc,
          "Unreturned float/cash by staff",
          staffRows.filter((row: any) => row.outstandingFloat > 0),
          [
            { label: "Staff", width: 145, value: (row) => row.name },
            { label: "Issued", width: 105, value: (row) => money(row.floatIssued), align: "right" },
            { label: "Returned", width: 105, value: (row) => money(row.floatReturned), align: "right" },
            { label: "Outstanding", width: 105, value: (row) => money(row.outstandingFloat), align: "right" },
          ],
        );

        table(doc, "Detailed broker services", services, [
          { label: "Date/time", width: 72, value: (row) => dateTime(row.servedAt) },
          { label: "Staff", width: 82, value: (row) => text(row.staff?.name) },
          { label: "Broker", width: 92, value: (row) => text(row.brokerCustomer?.name || row.broker?.name || row.customer?.name) },
          { label: "Service", width: 82, value: (row) => text(row.serviceType) },
          { label: "Amount", width: 74, value: (row) => money(row.amount), align: "right" },
          { label: "Location", width: 57, value: (row) => text(row.locationName) || "N/A" },
        ]);
      }

      if (kind === "bank") {
        table(doc, "Bank proof assessment", bankRecords, [
          { label: "Uploaded", width: 72, value: (row) => dateTime(row.createdAt) },
          { label: "Uploader", width: 90, value: (row) => text(row.uploadedByName) },
          { label: "Reference", width: 96, value: (row) => text(row.referenceNumber) },
          { label: "Amount", width: 78, value: (row) => money(row.amount), align: "right" },
          { label: "Proof", width: 75, value: (row) => text(row.proofInspectionStatus), align: "center" },
          { label: "Decision", width: 70, value: (row) => text(row.status), align: "center" },
        ]);
      }

      ensureSpace(doc, 105);
      doc.fillColor("#1f2937").font("Helvetica-Bold").fontSize(12).text("Bank statement snapshot", 42, doc.y);
      doc.y += 20;
      doc.roundedRect(42, doc.y, doc.page.width - 84, 74, 8).fillAndStroke("#f4faf6", "#d7e8dc");
      const y = doc.y + 12;
      doc.fillColor("#52665b").font("Helvetica").fontSize(8).text(`Account: ${text(importedStatement?.accountNumber) || "N/A"}`, 54, y);
      doc.text(`Account name: ${text(importedStatement?.accountName) || text(company?.name)}`, 54, y + 17);
      doc.text(`Available balance: ${money(importedStatement?.availableBalance)}`, 280, y);
      doc.text(`Book balance: ${money(importedStatement?.bookBalance)}`, 280, y + 17);
      doc.text(`Credit: ${money(importedStatement?.totalCredit)} • Debit: ${money(importedStatement?.totalDebit)}`, 54, y + 36, { width: 450 });
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="simamia-${kind}-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
