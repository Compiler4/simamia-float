import "server-only";

import { prisma } from "@/lib/prisma";

const lastSyncByCompany = new Map<string, number>();
const SYNC_COOLDOWN_MS = 10_000;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function validDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateStamp(value: unknown) {
  const parsed = validDate(value);
  return parsed ? parsed.getTime() : 0;
}

function staffIdFrom(row: any) {
  return text(
    row.staffId ??
      row.employeeId ??
      row.ownerUserId ??
      row.userId ??
      row.requestedById ??
      row.createdById,
  );
}

function staffFileKind(row: any) {
  const value = text(
    row.kind ?? row.type ?? row.fileType ?? row.category ?? row.documentType,
  ).toUpperCase();

  if (value.includes("SMS") || value.includes("MESSAGE")) return "SMS";
  if (value.includes("BANK")) return "BANK_REFERENCE";
  if (value.includes("DOCUMENT") || value.includes("REPORT")) return "DOCUMENT";
  return "PROOF";
}

async function activeStaffIds(companyId: string) {
  const db = prisma as any;
  if (typeof db.user?.findMany !== "function") return new Set<string>();

  const rows = await db.user.findMany({
    where: { companyId, role: "STAFF", status: "ACTIVE" },
    select: { id: true },
  });
  return new Set(rows.map((row: any) => text(row.id)).filter(Boolean));
}

export async function syncExistingBankDeposits(companyId: string) {
  const db = prisma as any;
  if (
    typeof db.bankDeposit?.findMany !== "function" ||
    typeof db.accountantBankComparison?.findMany !== "function"
  ) {
    return;
  }

  try {
    const staffIds = await activeStaffIds(companyId);
    const [deposits, comparisons] = await Promise.all([
      db.bankDeposit.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      db.accountantBankComparison.findMany({
        where: { companyId, depositId: { not: null } },
      }),
    ]);
    const comparisonByDeposit = new Map<string, any>(
      comparisons
        .filter((row: any) => text(row.depositId))
        .map((row: any) => [text(row.depositId), row] as [string, any]),
    );

    for (const deposit of deposits) {
      const depositId = text(deposit.id);
      const staffId = staffIdFrom(deposit);
      if (!depositId || !staffId || !staffIds.has(staffId)) continue;

      const staffAmount = number(
        deposit.amount ?? deposit.depositAmount ?? deposit.totalAmount,
      );
      const staffReference = text(
        deposit.referenceNo ??
          deposit.reference ??
          deposit.transactionReference ??
          deposit.receiptNumber,
      );
      const staffDate =
        validDate(deposit.depositDate) ??
        validDate(deposit.transactionDate) ??
        validDate(deposit.createdAt) ??
        new Date();
      const staffBankAccount = text(
        deposit.bankAccount ??
          deposit.accountNumber ??
          deposit.bankName ??
          deposit.destinationAccount,
      );
      const staffFileUrl = text(
        deposit.bankReceiptUrl ??
          deposit.depositSlipUrl ??
          deposit.receiptUrl ??
          deposit.proofUrl ??
          deposit.fileUrl,
      );

      const existing = comparisonByDeposit.get(depositId);
      if (existing) {
        if (text(existing.accountantDecision).toUpperCase() !== "PENDING") continue;
        const nextAmount = staffAmount || number(existing.staffAmount) || null;
        const nextReference = staffReference || text(existing.staffReference) || null;
        const nextBankAccount = staffBankAccount || text(existing.staffBankAccount) || null;
        const nextFileUrl = staffFileUrl || text(existing.staffFileUrl) || null;
        const changed =
          text(existing.staffId) !== staffId ||
          number(existing.staffAmount) !== number(nextAmount) ||
          text(existing.staffReference) !== text(nextReference) ||
          dateStamp(existing.staffDate) !== dateStamp(staffDate) ||
          text(existing.staffBankAccount) !== text(nextBankAccount) ||
          text(existing.staffFileUrl) !== text(nextFileUrl);

        if (changed) {
          await db.accountantBankComparison.update({
            where: { id: existing.id },
            data: {
              staffId,
              staffAmount: nextAmount,
              staffReference: nextReference,
              staffDate,
              staffBankAccount: nextBankAccount,
              staffFileUrl: nextFileUrl,
            },
          });
        }
        continue;
      }

      const created = await db.accountantBankComparison.create({
        data: {
          companyId,
          depositId,
          staffId,
          staffAmount: staffAmount || null,
          staffReference: staffReference || null,
          staffDate,
          staffBankAccount: staffBankAccount || null,
          staffFileUrl: staffFileUrl || null,
          accountantDecision: "PENDING",
        },
      });
      comparisonByDeposit.set(depositId, created);
    }
  } catch (error) {
    console.error("ACCOUNTANT_V3_BANK_DEPOSIT_SYNC_FAILED", error);
  }
}

export async function syncExistingStaffFiles(companyId: string) {
  const db = prisma as any;
  if (
    typeof db.staffFile?.findMany !== "function" ||
    typeof db.accountantVerificationPacket?.findMany !== "function"
  ) {
    return;
  }

  try {
    const staffIds = await activeStaffIds(companyId);
    const [files, packets] = await Promise.all([
      db.staffFile.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      db.accountantVerificationPacket.findMany({
        where: { companyId, staffFileId: { not: null } },
      }),
    ]);
    const packetByFile = new Map<string, any>(
      packets
        .filter((row: any) => text(row.staffFileId))
        .map((row: any) => [text(row.staffFileId), row] as [string, any]),
    );

    for (const file of files) {
      const staffFileId = text(file.id);
      const staffId = staffIdFrom(file);
      if (!staffFileId || !staffId || !staffIds.has(staffId)) continue;

      const staffFileUrl = text(
        file.fileUrl ??
          file.url ??
          file.path ??
          file.documentUrl ??
          file.proofUrl ??
          file.receiptUrl,
      );
      const staffMessage = text(
        file.message ??
          file.smsText ??
          file.content ??
          file.description ??
          file.notes ??
          file.caption,
      );
      if (!staffFileUrl && !staffMessage) continue;

      const existing = packetByFile.get(staffFileId);
      if (existing) {
        if (["VERIFIED", "REJECTED"].includes(text(existing.status).toUpperCase())) {
          continue;
        }
        const nextKind = staffFileKind(file);
        const nextFileUrl = staffFileUrl || text(existing.staffFileUrl) || null;
        const nextMessage = staffMessage || text(existing.staffMessage) || null;
        const changed =
          text(existing.staffId) !== staffId ||
          text(existing.kind) !== nextKind ||
          text(existing.staffFileUrl) !== text(nextFileUrl) ||
          text(existing.staffMessage) !== text(nextMessage);

        if (changed) {
          await db.accountantVerificationPacket.update({
            where: { id: existing.id },
            data: {
              staffId,
              kind: nextKind,
              staffFileUrl: nextFileUrl,
              staffMessage: nextMessage,
            },
          });
        }
        continue;
      }

      const created = await db.accountantVerificationPacket.create({
        data: {
          companyId,
          staffId,
          staffFileId,
          kind: staffFileKind(file),
          staffFileUrl: staffFileUrl || null,
          staffMessage: staffMessage || null,
          status: "WAITING_ADMIN_REFERENCE",
        },
      });
      packetByFile.set(staffFileId, created);
    }
  } catch (error) {
    console.error("ACCOUNTANT_V3_STAFF_FILE_SYNC_FAILED", error);
  }
}

export async function syncExistingOperationalRecords(companyId: string) {
  const now = Date.now();
  const previous = lastSyncByCompany.get(companyId) ?? 0;
  if (now - previous < SYNC_COOLDOWN_MS) return;
  lastSyncByCompany.set(companyId, now);

  await Promise.allSettled([
    syncExistingBankDeposits(companyId),
    syncExistingStaffFiles(companyId),
  ]);
}
