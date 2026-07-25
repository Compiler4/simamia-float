import "dotenv/config";

import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import pdfParseImport from "pdf-parse";

import { prisma } from "../lib/prisma";

const pdfParse = pdfParseImport as unknown as (
  buffer: Buffer,
  options?: { pagerender?: (pageData: any) => Promise<string> },
) => Promise<{ text: string }>;

async function renderPageWithLayout(pageData: any): Promise<string> {
  const content = await pageData.getTextContent({ normalizeWhitespace: true });
  const rows = new Map<number, Array<{ x: number; text: string }>>();
  for (const item of content.items || []) {
    const y = Math.round(Number(item.transform?.[5] || 0) / 2) * 2;
    const x = Number(item.transform?.[4] || 0);
    const current = rows.get(y) || [];
    current.push({ x, text: String(item.str || "") });
    rows.set(y, current);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
    .join("\n");
}

function money(value: string | undefined): number {
  return Number(String(value || "0").replaceAll(",", "")) || 0;
}

function parseDate(value: string, time = "00:00:00"): Date {
  const [day, month, year] = value.replaceAll(".", "/").split("/").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
}

function requiredMatch(text: string, expression: RegExp, label: string): string {
  const value = text.match(expression)?.[1]?.trim();
  if (!value) throw new Error(`Could not read ${label} from the bank statement.`);
  return value;
}

function normalizeName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function transactionType(details: string): string | null {
  const match = details.match(/REF:[A-Z0-9]+\s+(.+?)(?:\s+FROM\s+|\s+\d{9,}\s+)/i);
  return match?.[1]?.trim().slice(0, 80) || null;
}

function senderReceiver(details: string) {
  const match = details.match(/\bFROM\s+(.+?)\s+TO\s+(.+?)(?:\s+(?:AB\d+|N\/A|Deposits?|Cash|Float|Floti|Kuweka)\b|$)/i);
  return {
    senderName: match?.[1]?.trim() || null,
    receiverName: match?.[2]?.trim() || null,
  };
}

async function main() {
  const [, , companyCodeArg, fileArg] = process.argv;
  if (!companyCodeArg || !fileArg) {
    throw new Error("Usage: npx tsx scripts/import-crdb-statement.ts COMPANY_CODE path/to/statement.pdf");
  }

  const companyCode = companyCodeArg.trim().toUpperCase();
  const filePath = path.resolve(fileArg);
  const file = await readFile(filePath);
  const checksum = crypto.createHash("sha256").update(file).digest("hex");
  const parsed = await pdfParse(file, { pagerender: renderPageWithLayout });
  const text = parsed.text.replace(/\r/g, " ").replace(/[ \t]+/g, " ");
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const flat = text.replace(/\s+/g, " ").trim();

  const company = await prisma.company.findUnique({ where: { code: companyCode } });
  if (!company) throw new Error(`Company code ${companyCode} was not found.`);

  const accountNumber = requiredMatch(flat, /Account:\s*([0-9]+)/i, "account number");
  const statementTitleIndex = lines.findIndex((line) => /^Account Bank Statement$/i.test(line));
  const accountName = statementTitleIndex >= 0 ? lines[statementTitleIndex + 1] : "";
  const branchName = statementTitleIndex >= 0 ? lines[statementTitleIndex + 2] || null : null;
  if (!accountName || /^Account:/i.test(accountName)) {
    throw new Error("Could not read account name from the bank statement.");
  }
  const period = flat.match(/Period:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!period) throw new Error("Could not read statement period.");

  const availableBalance = money(requiredMatch(flat, /Available Balance:\s*([\d,]+(?:\.\d{1,2})?)/i, "available balance"));
  const totalCredit = money(requiredMatch(flat, /Total Value for Credit:\s*([\d,]+(?:\.\d{1,2})?)/i, "total credit"));
  const totalDebit = money(requiredMatch(flat, /Total Value for Debit:\s*([\d,]+(?:\.\d{1,2})?)/i, "total debit"));
  const bookBalance = money(requiredMatch(flat, /Summary of Book Balance as at [^:]+:\s*([\d,]+(?:\.\d{1,2})?)/i, "book balance"));
  const clearedBalance = money(requiredMatch(flat, /Summary of Cleared Balance as at [^:]+:\s*([\d,]+(?:\.\d{1,2})?)/i, "cleared balance"));
  const generated = flat.match(
    /Summary of Cleared Balance[^:]*:\s*[\d,]+(?:\.\d{1,2})?\s*TZS\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/i,
  );

  const transactions: Array<Record<string, unknown>> = [];
  const transactionArea = text.slice(text.search(/REF:/i));
  const segments = transactionArea.split(/(?=REF:[A-Z0-9]+)/i);
  for (const rawSegment of segments) {
    const reference = rawSegment.match(/REF:([A-Z0-9]+)/i)?.[1];
    if (!reference) continue;
    const segment = rawSegment.replace(/\s+/g, " ").trim();
    const dates = [...segment.matchAll(/\b(\d{2}\.\d{2}\.\d{4})\b/g)].map((item) => item[1]);
    const times = [...segment.matchAll(/\b(\d{2}:\d{2}:\d{2})\b/g)].map((item) => item[1]);
    const amounts = [...segment.matchAll(/\b(\d[\d,]*\.\d{2})\b/g)].map((item) => item[1]);
    if (dates.length < 2 || times.length < 2 || amounts.length < 3) continue;
    const [debitText, creditText, balanceText] = amounts.slice(-3);
    const debit = money(debitText);
    const credit = money(creditText);
    const details = segment
      .replace(new RegExp(`\\b${dates[0].replaceAll('.', '\\.') }\\b`, 'g'), ' ')
      .replace(new RegExp(`\\b${dates[1].replaceAll('.', '\\.') }\\b`, 'g'), ' ')
      .replaceAll(times[0], ' ')
      .replaceAll(times[1], ' ')
      .replace(debitText, ' ')
      .replace(creditText, ' ')
      .replace(balanceText, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const parties = senderReceiver(details);
    transactions.push({
      reference,
      postingDate: parseDate(dates[0], times[0]),
      valueDate: parseDate(dates[1], times[1]),
      details,
      direction: credit > 0 ? "CREDIT" : "DEBIT",
      debit,
      credit,
      bookBalance: money(balanceText),
      transactionType: transactionType(details),
      senderName: parties.senderName,
      receiverName: parties.receiverName,
      externalAccountReference: details.match(/\b(?:AB)?\d{12,}\b/)?.[0] || null,
      narration: details,
    });
  }

  if (!transactions.length) {
    throw new Error("No transaction rows were parsed. Confirm this is a CRDB Account Bank Statement PDF.");
  }

  const brokers = await prisma.brokerCustomer.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, normalizedName: true, phone: true },
  });

  const batch = await prisma.dataImportBatch.upsert({
    where: { companyId_sourceChecksum: { companyId: company.id, sourceChecksum: checksum } },
    update: {
      status: "PROCESSING",
      totalRows: transactions.length,
      notes: `Re-imported ${path.basename(filePath)}.`,
    },
    create: {
      companyId: company.id,
      sourceType: "BANK_STATEMENT_PDF",
      sourceFileName: path.basename(filePath),
      sourceChecksum: checksum,
      status: "PROCESSING",
      totalRows: transactions.length,
    },
  });

  const statementKey = `${accountNumber}:${period[1]}:${period[2]}`;
  const statement = await prisma.importedBankStatement.upsert({
    where: { companyId_statementKey: { companyId: company.id, statementKey } },
    update: {
      importBatchId: batch.id,
      bankName: "CRDB BANK",
      accountName,
      branchName,
      accountNumber,
      currency: "TZS",
      periodStart: parseDate(period[1]),
      periodEnd: parseDate(period[2], "23:59:59"),
      generatedAt: generated ? parseDate(generated[1], generated[2]) : null,
      availableBalance,
      totalCredit,
      totalDebit,
      bookBalance,
      clearedBalance,
      sourceFileName: path.basename(filePath),
      sourceChecksum: checksum,
      importedAt: new Date(),
    },
    create: {
      companyId: company.id,
      importBatchId: batch.id,
      statementKey,
      bankName: "CRDB BANK",
      accountName,
      branchName,
      accountNumber,
      currency: "TZS",
      periodStart: parseDate(period[1]),
      periodEnd: parseDate(period[2], "23:59:59"),
      generatedAt: generated ? parseDate(generated[1], generated[2]) : null,
      availableBalance,
      totalCredit,
      totalDebit,
      bookBalance,
      clearedBalance,
      sourceFileName: path.basename(filePath),
      sourceChecksum: checksum,
    },
  });

  let matched = 0;
  for (const row of transactions) {
    const sender = normalizeName(String(row.senderName || ""));
    const broker = sender
      ? brokers.find((item) => {
          const candidate = normalizeName(item.normalizedName || item.name);
          return candidate === sender || candidate.includes(sender) || sender.includes(candidate);
        })
      : null;
    if (broker) matched += 1;

    await prisma.importedBankTransaction.upsert({
      where: { companyId_reference: { companyId: company.id, reference: String(row.reference) } },
      update: {
        statementId: statement.id,
        matchedBrokerCustomerId: broker?.id || null,
        ...row,
        matchStatus: broker ? "MATCHED" : row.direction === "DEBIT" ? "NOT_APPLICABLE" : "REVIEW_REQUIRED",
        matchConfidence: broker ? 100 : null,
        matchNote: broker ? `Matched sender name to ${broker.name}.` : "No exact broker-name match.",
      },
      create: {
        companyId: company.id,
        statementId: statement.id,
        matchedBrokerCustomerId: broker?.id || null,
        ...(row as any),
        matchStatus: broker ? "MATCHED" : row.direction === "DEBIT" ? "NOT_APPLICABLE" : "REVIEW_REQUIRED",
        matchConfidence: broker ? 100 : null,
        matchNote: broker ? `Matched sender name to ${broker.name}.` : "No exact broker-name match.",
      },
    });
  }

  await prisma.dataImportBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMPLETED",
      importedRows: transactions.length,
      skippedRows: 0,
      failedRows: 0,
      notes: `Imported ${transactions.length} CRDB transactions; ${matched} matched to registered brokers.`,
    },
  });

  console.log({
    company: company.name,
    accountNumber,
    period: `${period[1]} - ${period[2]}`,
    transactions: transactions.length,
    matched,
    availableBalance,
    totalCredit,
    totalDebit,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
