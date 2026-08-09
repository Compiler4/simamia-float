import { type NextRequest } from "next/server";

import {
  buildPortalData,
  errorResponse,
  number,
  parseRange,
  requireAccountant,
  text,
} from "@/lib/accountant/portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function csvCell(value: unknown): string {
  const source = value instanceof Date ? value.toISOString() : text(value);
  return `"${source.replaceAll('"', '""')}"`;
}

function makeCsv(rows: any[]): string {
  const headers = [
    "User ID",
    "Name",
    "Email",
    "Role",
    "Income",
    "Approved Expenses",
    "Net Contribution",
    "Verified Deposits",
    "Float Issued",
    "Cash Issued",
    "Transactions",
    "Present Sessions",
    "Absent Sessions",
    "Attendance Rate",
    "Performance Score",
    "Rating",
  ];
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.userId,
        row.name,
        row.email,
        row.role,
        row.income,
        row.approvedExpenses,
        number(row.income) - number(row.approvedExpenses),
        row.verifiedDeposits,
        row.floatIssued,
        row.cashIssued,
        row.transactions,
        row.attendancePresent,
        row.attendanceAbsent,
        row.attendanceRate,
        row.performanceScore,
        row.rating,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}

function xmlEscape(value: unknown): string {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function makeExcelXml(rows: any[]): string {
  const matrix = [
    [
      "User ID",
      "Name",
      "Email",
      "Role",
      "Income",
      "Approved Expenses",
      "Net Contribution",
      "Verified Deposits",
      "Float Issued",
      "Cash Issued",
      "Transactions",
      "Present",
      "Absent",
      "Attendance Rate",
      "Performance Score",
      "Rating",
    ],
    ...rows.map((row) => [
      row.userId,
      row.name,
      row.email,
      row.role,
      row.income,
      row.approvedExpenses,
      number(row.income) - number(row.approvedExpenses),
      row.verifiedDeposits,
      row.floatIssued,
      row.cashIssued,
      row.transactions,
      row.attendancePresent,
      row.attendanceAbsent,
      row.attendanceRate,
      row.performanceScore,
      row.rating,
    ]),
  ];
  const xmlRows = matrix
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => {
            const numeric = typeof cell === "number" || (/^-?\d+(\.\d+)?$/.test(text(cell)) && text(cell) !== "");
            return `<Cell><Data ss:Type="${numeric ? "Number" : "String"}">${xmlEscape(cell)}</Data></Cell>`;
          })
          .join("")}</Row>`,
    )
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Accountant Report"><Table>${xmlRows}</Table></Worksheet>
</Workbook>`;
}

function pdfEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function makePdf(lines: string[]): Buffer {
  const usable = lines.slice(0, 48);
  const stream = ["BT", "/F1 10 Tf", "42 800 Td"];
  usable.forEach((line, index) => {
    if (index > 0) stream.push("0 -15 Td");
    stream.push(`(${pdfEscape(line.slice(0, 108))}) Tj`);
  });
  stream.push("ET");
  const content = stream.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(output);
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "binary");
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAccountant();
    const range = parseRange(request.nextUrl.searchParams);
    const portal = await buildPortalData(context, range);
    const rows = portal.performance.map((row: any) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role,
      profileImageUrl: row.profileImageUrl,
      income: number(row.income),
      approvedExpenses: number(row.approvedExpenses),
      verifiedDeposits: number(row.verifiedDeposits),
      floatIssued: number(row.floatIssued),
      cashIssued: number(row.cashIssued),
      transactions: number(row.transactions),
      attendancePresent: number(row.attendancePresent),
      attendanceAbsent: number(row.attendanceAbsent),
      attendanceRate: number(row.attendanceRate),
      performanceScore: number(row.performanceScore),
      rating: row.rating,
    }));

    const report = {
      success: true,
      generatedAt: new Date().toISOString(),
      company: portal.company,
      accountant: portal.accountant,
      summary: {
        period: range.label,
        totalIncome: portal.reportSummary.totalIncome,
        totalExpenses: portal.reportSummary.totalExpenses,
        netIncome: portal.reportSummary.netIncome,
        totalDeposits: portal.reportSummary.totalDeposits,
        totalFloat: portal.reportSummary.totalFloat,
        totalCash: portal.reportSummary.totalCash,
        mostPresent: portal.mostPresent,
        mostAbsent: portal.mostAbsent,
      },
      rows,
    };

    const format = text(request.nextUrl.searchParams.get("format") || "preview").toLowerCase();
    if (format === "preview" || format === "json") {
      return Response.json(report, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    if (format === "csv") {
      return new Response(makeCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="accountant-report-${range.startKey}-${range.endKey}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "xlsx" || format === "xls") {
      return new Response(makeExcelXml(rows), {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="accountant-report-${range.startKey}-${range.endKey}.xls"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "pdf") {
      const lines = [
        `${portal.company.name} - Accountant Financial and Performance Report`,
        `Period: ${range.label}`,
        `Generated by: ${portal.accountant.name} (${portal.accountant.email})`,
        `Total income: TZS ${number(portal.reportSummary.totalIncome).toLocaleString("en-GB")}`,
        `Approved expenses: TZS ${number(portal.reportSummary.totalExpenses).toLocaleString("en-GB")}`,
        `Net income: TZS ${number(portal.reportSummary.netIncome).toLocaleString("en-GB")}`,
        `Verified deposits: TZS ${number(portal.reportSummary.totalDeposits).toLocaleString("en-GB")}`,
        "",
        "Staff performance:",
        ...rows.map(
          (row: any) =>
            `${row.name} | Attendance ${row.attendanceRate}% | Score ${row.performanceScore} | Income TZS ${number(row.income).toLocaleString("en-GB")}`,
        ),
      ];
      const pdf = makePdf(lines);
      const body = pdf.buffer.slice(
        pdf.byteOffset,
        pdf.byteOffset + pdf.byteLength,
      ) as ArrayBuffer;
      return new Response(body, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="accountant-report-${range.startKey}-${range.endKey}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json(
      { success: false, message: `Unsupported report format: ${format}.` },
      { status: 422 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
