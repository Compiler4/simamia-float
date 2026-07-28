import { NextRequest, NextResponse } from "next/server";

import { requireAccountant } from "@/lib/accountant-v3/guard";
import { jsonError } from "@/lib/accountant-v3/http";
import { buildAccountantControlCenterData } from "@/lib/accountant-v3/report-data";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  return `TZS ${Number(value ?? 0).toLocaleString("en-GB", {
    maximumFractionDigits: 2,
  })}`;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function reportRows(data: any) {
  return [
    ["SIMAMIA FLOAT ERP — ACCOUNTANT REPORT"],
    ["Period", data.period.label],
    ["Generated", new Date(data.generatedAt).toLocaleString("en-GB")],
    [],
    ["FINANCIAL SUMMARY"],
    ["Total income", money(data.summary.totalIncome)],
    ["Service income", money(data.summary.serviceIncome)],
    ["Cash issued/received by staff (working capital)", money(data.summary.staffCashReceived)],
    ["Approved expenses", money(data.summary.approvedExpenseAmount)],
    ["Net income", money(data.summary.netIncome)],
    ["System + manual staff float", money(data.summary.allocatedFloat)],
    ["Cash issued to staff", money(data.summary.allocatedCash)],
    ["Combined staff funds", money(data.summary.combinedStaffFunds)],
    [],
    ["ATTENDANCE SUMMARY"],
    ["Attendance sessions", data.summary.attendanceSessions],
    ["Present sessions", data.summary.presentSessions],
    ["Absent sessions", data.summary.absentSessions],
    ["Most present", data.mostPresent?.staffName ?? "N/A"],
    ["Most absent", data.mostAbsent?.staffName ?? "N/A"],
    [],
    ["EXPENSE APPROVALS"],
    ["Staff", "Category", "Amount", "Admin", "Accountant", "Final status"],
    ...data.expenses.map((row: any) => [
      row.staffName,
      row.category ?? row.type ?? "Expense",
      money(row.amount),
      row.adminDecision,
      row.accountantDecision,
      row.finalStatus,
    ]),
    [],
    ["STAFF ATTENDANCE PERFORMANCE"],
    ["Staff", "Present", "Absent", "Late", "Morning", "Evening", "Rate"],
    ...data.attendanceAnalytics.map((row: any) => [
      row.staffName,
      row.present,
      row.absent,
      row.late,
      row.morning,
      row.evening,
      `${row.attendanceRate}%`,
    ]),
    [],
    ["STAFF FUNDS"],
    ["Staff", "System float", "Manual float", "Cash issued", "Returned", "Net available"],
    ...data.moneySummary.map((row: any) => [
      row.staffName,
      money(row.systemFloatAllocated),
      money(row.manualFloatAllocated),
      money(Number(row.cashAllocated || 0) + Number(row.cashReceived || 0)),
      money(row.returned),
      money(row.netAvailable),
    ]),
    [],
    ["PERFORMANCE"],
    ["Staff", "Attendance", "Services", "Float transactions", "Score", "Rating"],
    ...data.performance.map((row: any) => [
      row.staffName,
      `${row.attendanceRate}%`,
      row.serviceCount,
      row.floatTransactions,
      row.score,
      row.rating,
    ]),
  ];
}

async function createPdf(data: any) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const rows = reportRows(data);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const lineHeight = 14;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  for (const row of rows) {
    if (y < margin + lineHeight) addPage();
    if (!row.length) {
      y -= lineHeight;
      continue;
    }

    const isHeading = row.length === 1;
    const line = row.map((cell: unknown) => String(cell ?? "")).join("   |   ");
    const chunks: string[] = [];
    let remaining = line;
    const maxChars = isHeading ? 78 : 95;
    while (remaining.length > maxChars) {
      let cut = remaining.lastIndexOf(" ", maxChars);
      if (cut < 20) cut = maxChars;
      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    chunks.push(remaining);

    for (const chunk of chunks) {
      if (y < margin + lineHeight) addPage();
      page.drawText(chunk, {
        x: margin,
        y,
        size: isHeading ? 11 : 8.5,
        font: isHeading ? bold : regular,
        color: isHeading ? rgb(0.08, 0.2, 0.18) : rgb(0.1, 0.12, 0.16),
      });
      y -= isHeading ? 18 : lineHeight;
    }
  }

  return await pdf.save();
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAccountant();
    const data = await buildAccountantControlCenterData(user, request.nextUrl.searchParams);
    const format = String(request.nextUrl.searchParams.get("format") ?? "pdf").toLowerCase();
    const baseName = `simamia-accountant-${data.period.startKey}-to-${data.period.endKey}`;
    const rows = reportRows(data);

    if (format === "csv") {
      const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        },
      });
    }

    if (format === "xlsx" || format === "excel") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const overview = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, overview, "Accountant Report");
      const expenseSheet = XLSX.utils.json_to_sheet(data.expenses);
      XLSX.utils.book_append_sheet(workbook, expenseSheet, "Expenses");
      const attendanceSheet = XLSX.utils.json_to_sheet(data.attendanceAnalytics);
      XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Attendance");
      const moneySheet = XLSX.utils.json_to_sheet(data.moneySummary);
      XLSX.utils.book_append_sheet(workbook, moneySheet, "Staff Funds");
      const performanceSheet = XLSX.utils.json_to_sheet(data.performance);
      XLSX.utils.book_append_sheet(workbook, performanceSheet, "Performance");
      const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    const pdf = await createPdf(data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
      },
    });
  } catch (error) {
    return jsonError(error, "The accountant report could not be exported.");
  }
}
