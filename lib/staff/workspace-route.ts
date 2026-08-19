import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendNotice, sendNoticeToRoles } from "@/lib/staff/notify";
import { requireStaff } from "@/lib/staff/permissions";
import { ensureStaffOperationsSchema } from "@/lib/staff/ensure-operations-schema";
import {
  assignedBrokerCustomers,
  cleanText,
  isoWeekKey,
  localDateKey,
  numberValue,
  parseProofText,
  periodBounds,
  positiveAmount,
  requireAssignedBroker,
  requireOwnedStaffFile,
  responseError,
  serialize,
} from "@/lib/staff/operations-v4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type JsonBody = Record<string, unknown>;

async function softQuery<T>(
  label: string,
  task: () => Promise<T>,
  fallback: T,
  warnings: string[],
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`STAFF_OPERATIONS_${label}_FALLBACK:`, message);
    warnings.push(`${label}: ${message}`);
    return fallback;
  }
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function reference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 7)
    .toUpperCase()}`;
}

function dateValue(value: unknown): Date {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
}

function normaliseDirection(value: unknown): string {
  const direction = cleanText(value).toUpperCase();
  const allowed = new Set([
    "ACCOUNTANT_TO_STAFF",
    "STAFF_TO_BROKER",
    "BROKER_TO_STAFF",
    "STAFF_TO_ACCOUNTANT",
    "STAFF_TO_BANK",
    "EXPENSE_PAYMENT",
    "OTHER",
  ]);
  return allowed.has(direction) ? direction : "OTHER";
}

function normaliseProofKind(value: unknown): string {
  const kind = cleanText(value).toUpperCase();
  const allowed = new Set([
    "SMS_SCREENSHOT",
    "BANK_SLIP",
    "BANK_RECEIPT",
    "BANK_STATEMENT",
    "PDF",
    "DOCUMENT",
    "IMAGE",
    "SERVICE_PROOF",
    "EXPENSE_RECEIPT",
    "OTHER",
  ]);
  return allowed.has(kind) ? kind : "OTHER";
}

function groupWeekly(input: {
  proofs: any[];
  deposits: any[];
  expenses: any[];
}) {
  const folders = new Map<string, any>();

  function folder(key: string) {
    if (!folders.has(key)) {
      folders.set(key, {
        weekKey: key,
        totalValue: 0,
        proofValue: 0,
        depositValue: 0,
        expenseValue: 0,
        documentCount: 0,
        items: [],
      });
    }
    return folders.get(key);
  }

  for (const row of input.proofs) {
    const key = cleanText(row.weekKey) || isoWeekKey(row.transactionAt);
    const group = folder(key);
    const amount = numberValue(row.amount);
    group.totalValue += amount;
    group.proofValue += amount;
    group.documentCount += 1;
    group.items.push({
      id: row.id,
      source: "PROOF",
      date: row.transactionAt,
      reference: row.referenceNo,
      amount,
      status: row.status,
      url: row.proofUrl,
      label: `${row.senderName} to ${row.receiverName}`,
    });
  }

  for (const row of input.deposits) {
    const key = isoWeekKey(row.depositDate);
    const group = folder(key);
    const amount = numberValue(row.amount);
    group.totalValue += amount;
    group.depositValue += amount;

    const depositDocuments = [
      row.bankReceiptUrl
        ? { suffix: "receipt", url: row.bankReceiptUrl, label: "Bank receipt" }
        : null,
      row.depositSlipUrl && row.depositSlipUrl !== row.bankReceiptUrl
        ? { suffix: "slip", url: row.depositSlipUrl, label: "Deposit slip" }
        : null,
    ].filter(Boolean) as Array<{ suffix: string; url: string; label: string }>;

    group.documentCount += depositDocuments.length;
    for (const document of depositDocuments) {
      group.items.push({
        id: `${row.id}:${document.suffix}`,
        source: "BANK_DEPOSIT",
        date: row.depositDate,
        reference: row.referenceNo ?? row.id,
        amount,
        status: row.status,
        url: document.url,
        label: `${document.label} · ${row.bankAccount ?? "Bank deposit"}`,
      });
    }
  }

  for (const row of input.expenses) {
    if (!row.receiptUrl) continue;
    const key = isoWeekKey(row.expenseDate);
    const group = folder(key);
    const amount = numberValue(row.amount);
    group.totalValue += amount;
    group.expenseValue += amount;
    group.documentCount += 1;
    group.items.push({
      id: row.id,
      source: "EXPENSE",
      date: row.expenseDate,
      reference: row.id,
      amount,
      status: row.status,
      url: row.receiptUrl,
      label: row.otherCategory || row.category,
    });
  }

  return Array.from(folders.values())
    .map((row) => ({
      ...row,
      totalValue: Number(row.totalValue.toFixed(2)),
      proofValue: Number(row.proofValue.toFixed(2)),
      depositValue: Number(row.depositValue.toFixed(2)),
      expenseValue: Number(row.expenseValue.toFixed(2)),
      items: row.items.sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    }))
    .sort((a, b) => String(b.weekKey).localeCompare(String(a.weekKey)));
}

function ownTransactionRows(input: {
  staffId: string;
  funding: any[];
  floats: any[];
  collections: any[];
  deposits: any[];
  expenses: any[];
  proofs: any[];
  services: any[];
}) {
  const rows: any[] = [];

  for (const row of input.funding) {
    rows.push({
      id: `funding:${row.id}`,
      date: row.confirmedAt ?? row.issuedAt,
      source: "FUNDING",
      type: "ACCOUNTANT_TO_STAFF",
      from: row.accountant?.name ?? "Accountant",
      to: row.staff?.name ?? "Staff",
      reference: row.referenceNo,
      floatAmount: numberValue(row.floatAmount),
      cashAmount: numberValue(row.cashAmount),
      amount: numberValue(row.floatAmount) + numberValue(row.cashAmount),
      status: row.status,
      proofUrl: null,
    });
  }

  for (const row of input.floats) {
    const from =
      row.fromUserId === input.staffId
        ? row.fromUser?.name ?? "Staff"
        : row.fromUser?.name ?? "Accountant";
    const to =
      row.toUserId === input.staffId
        ? row.toUser?.name ?? "Staff"
        : row.brokerCustomer?.name ?? row.toUser?.name ?? "Broker";
    rows.push({
      id: `float:${row.id}`,
      date: row.returnedAt ?? row.confirmedAt ?? row.issuedAt ?? row.createdAt,
      source: "FLOAT",
      type: row.transactionType,
      from,
      to,
      reference: row.referenceNo ?? row.id,
      floatAmount: numberValue(row.returnedAmount ?? row.amount),
      cashAmount: 0,
      amount: numberValue(row.returnedAmount ?? row.amount),
      status: row.status,
      proofUrl: row.receiptUrl,
    });
  }

  for (const row of input.collections) {
    rows.push({
      id: `collection:${row.id}`,
      date: row.collectionDate,
      source: "COLLECTION",
      type: "BROKER_TO_STAFF",
      from: row.brokerCustomer?.name ?? row.broker?.name ?? "Broker",
      to: row.staff?.name ?? "Staff",
      reference: row.referenceNo,
      floatAmount: 0,
      cashAmount: numberValue(row.amount),
      amount: numberValue(row.amount),
      status: row.status,
      proofUrl: row.receiptUrl,
    });
  }

  for (const row of input.deposits) {
    rows.push({
      id: `deposit:${row.id}`,
      date: row.depositDate,
      source: "BANK_DEPOSIT",
      type: "STAFF_TO_BANK",
      from: row.staff?.name ?? "Staff",
      to: row.bankAccount ?? "Bank",
      reference: row.referenceNo ?? row.id,
      floatAmount: 0,
      cashAmount: numberValue(row.amount),
      amount: numberValue(row.amount),
      status: row.status,
      proofUrl: row.bankReceiptUrl ?? row.depositSlipUrl,
    });
  }

  for (const row of input.expenses) {
    rows.push({
      id: `expense:${row.id}`,
      date: row.expenseDate,
      source: "EXPENSE",
      type: row.requestMode ?? "REIMBURSEMENT",
      from: row.employee?.name ?? "Staff",
      to: row.requestedAction ?? row.otherCategory ?? row.category,
      reference: row.id,
      floatAmount: 0,
      cashAmount: numberValue(row.amount),
      amount: numberValue(row.amount),
      status: row.status,
      proofUrl: row.receiptUrl,
    });
  }

  for (const row of input.proofs) {
    rows.push({
      id: `proof:${row.id}`,
      date: row.transactionAt,
      source: "PROOF",
      type: row.direction,
      from: row.senderName,
      to: row.receiverName,
      reference: row.referenceNo,
      floatAmount: 0,
      cashAmount: numberValue(row.amount),
      amount: numberValue(row.amount),
      status: row.status,
      proofUrl: row.proofUrl,
    });
  }

  for (const row of input.services) {
    rows.push({
      id: `service:${row.id}`,
      date: row.serviceProvidedAt ?? row.startedAt,
      source: "SERVICE",
      type: row.serviceType ?? "BROKER_SERVICE",
      from: row.staff?.name ?? "Staff",
      to: row.broker?.name ?? "Broker",
      reference: row.id,
      floatAmount: numberValue(row.floatAmount),
      cashAmount: numberValue(row.cashAmount),
      amount: numberValue(row.floatAmount) + numberValue(row.cashAmount),
      status: row.status,
      proofUrl: null,
    });
  }

  return rows.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireStaff();
    const db = prisma as any;
    const schema = await ensureStaffOperationsSchema();
    const warnings = [...schema.warnings];
    const url = new URL(request.url);
    const search = cleanText(url.searchParams.get("search")).toLowerCase();
    const bounds = periodBounds(
      url.searchParams.get("period"),
      url.searchParams.get("anchor") ?? url.searchParams.get("date"),
      url.searchParams.get("from"),
      url.searchParams.get("to"),
    );

    const staff = await db.user.findFirst({
      where: {
        id: session.id,
        companyId: session.companyId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        assignedRegion: true,
        profileImageUrl: true,
        company: { select: { id: true, name: true, code: true } },
      },
    });

    if (!staff) {
      return NextResponse.json(
        { success: false, message: "The active staff account could not be loaded." },
        { status: 404 },
      );
    }

    const [
      accountants,
      funding,
      assignedBrokers,
      floats,
      collections,
      deposits,
      expenses,
      proofs,
      services,
      attendance,
      devices,
      pings,
      alerts,
      notifications,
      performance,
    ] = await Promise.all([
      softQuery(
        "ACCOUNTANTS",
        () =>
          db.user.findMany({
            where: {
              companyId: session.companyId,
              role: "ACCOUNTANT",
              status: "ACTIVE",
            },
            select: { id: true, name: true, email: true, phone: true },
            orderBy: { name: "asc" },
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "FUNDING",
        () =>
          db.staffFundingReceipt.findMany({
            where: {
              companyId: session.companyId,
              staffId: session.id,
              issuedAt: { gte: bounds.start, lte: bounds.end },
            },
            include: {
              accountant: { select: { id: true, name: true, email: true } },
              staff: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ issuedAt: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "BROKERS",
        () => assignedBrokerCustomers(session.companyId, session.id),
        [] as any[],
        warnings,
      ),
      softQuery(
        "FLOATS",
        () =>
          db.floatTransaction.findMany({
            where: {
              companyId: session.companyId,
              OR: [{ fromUserId: session.id }, { toUserId: session.id }],
              createdAt: { gte: bounds.start, lte: bounds.end },
            },
            include: {
              fromUser: { select: { id: true, name: true, email: true } },
              toUser: { select: { id: true, name: true, email: true } },
              brokerCustomer: true,
            },
            orderBy: [{ createdAt: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "COLLECTIONS",
        () =>
          db.staffCollection.findMany({
            where: {
              companyId: session.companyId,
              staffId: session.id,
              collectionDate: { gte: bounds.start, lte: bounds.end },
            },
            include: {
              staff: { select: { id: true, name: true } },
              broker: { select: { id: true, name: true } },
              brokerCustomer: true,
            },
            orderBy: [{ collectionDate: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "DEPOSITS",
        () =>
          db.bankDeposit.findMany({
            where: {
              companyId: session.companyId,
              staffId: session.id,
              depositDate: { gte: bounds.start, lte: bounds.end },
            },
            include: {
              staff: { select: { id: true, name: true } },
              accountant: { select: { id: true, name: true } },
            },
            orderBy: [{ depositDate: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "EXPENSES",
        () =>
          db.expense.findMany({
            where: {
              companyId: session.companyId,
              employeeId: session.id,
              expenseDate: { gte: bounds.start, lte: bounds.end },
            },
            include: {
              employee: { select: { id: true, name: true } },
              reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: [{ expenseDate: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "PROOFS",
        () =>
          db.staffProofSubmission.findMany({
            where: {
              companyId: session.companyId,
              staffId: session.id,
              transactionAt: { gte: bounds.start, lte: bounds.end },
            },
            include: {
              broker: {
                include: {
                  agentAccounts: {
                    where: { status: "ACTIVE" },
                    orderBy: [{ isPrimary: "desc" }, { network: "asc" }],
                  },
                },
              },
              verifiedBy: { select: { id: true, name: true, role: true } },
              file: {
                select: {
                  id: true,
                  originalName: true,
                  mimeType: true,
                  sizeBytes: true,
                },
              },
            },
            orderBy: [{ transactionAt: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "SERVICE_VISITS",
        () =>
          db.brokerServiceVisit.findMany({
            where: {
              companyId: session.companyId,
              staffId: session.id,
              startedAt: { gte: bounds.start, lte: bounds.end },
            },
            include: {
              staff: { select: { id: true, name: true } },
              broker: true,
              device: true,
              proofSubmissions: true,
            },
            orderBy: [{ startedAt: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "ATTENDANCE",
        () =>
          db.attendance.findMany({
            where: {
              companyId: session.companyId,
              userId: session.id,
              date: { gte: bounds.start, lte: bounds.end },
              source: { startsWith: "ACCOUNTANT_VERIFIED" },
            },
            orderBy: [{ date: "asc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "GPS_DEVICES",
        () =>
          db.companyGpsDevice.findMany({
            where: { companyId: session.companyId, ownerUserId: session.id },
            orderBy: [{ lastSeenAt: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "GPS_PINGS",
        () =>
          db.companyGpsPing.findMany({
            where: {
              companyId: session.companyId,
              device: { ownerUserId: session.id },
              capturedAt: { gte: bounds.start, lte: bounds.end },
            },
            orderBy: [{ capturedAt: "asc" }],
            take: 5000,
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "GPS_ALERTS",
        () =>
          db.gpsAlert.findMany({
            where: {
              companyId: session.companyId,
              userId: session.id,
              createdAt: { gte: bounds.start, lte: bounds.end },
            },
            orderBy: [{ createdAt: "desc" }],
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "NOTIFICATIONS",
        () =>
          db.notification.findMany({
            where: { companyId: session.companyId, userId: session.id },
            orderBy: [{ createdAt: "desc" }],
            take: 300,
          }),
        [] as any[],
        warnings,
      ),
      softQuery(
        "PERFORMANCE",
        () =>
          db.performanceRecord.findMany({
            where: { companyId: session.companyId, userId: session.id },
            orderBy: [{ year: "desc" }, { month: "desc" }],
            take: 24,
          }),
        [] as any[],
        warnings,
      ),
    ]);

    const brokerIdsServed = new Set(
      services.map((row: any) => String(row.brokerCustomerId)),
    );
    const unservedBrokers = assignedBrokers.filter(
      (broker: any) => !brokerIdsServed.has(String(broker.id)),
    );

    const filteredBrokers = assignedBrokers.filter((broker: any) => {
      if (!search) return true;
      const words = search.split(/\s+/).filter(Boolean);
      const haystack = [
        broker.code,
        broker.name,
        broker.businessName,
        broker.phone,
        broker.alternatePhone,
        broker.location,
        broker.region,
        broker.district,
        broker.ward,
        broker.address,
        broker.assignedArea,
      ]
        .map(cleanText)
        .join(" ")
        .toLowerCase();
      return words.every((word) => haystack.includes(word));
    });

    const transactions = ownTransactionRows({
      staffId: session.id,
      funding,
      floats,
      collections,
      deposits,
      expenses,
      proofs,
      services,
    });

    const weeklyFolders = groupWeekly({ proofs, deposits, expenses });
    const confirmedFunding = funding.filter((row: any) => row.status === "CONFIRMED");
    const pendingFunding = funding.filter((row: any) => row.status === "PENDING");

    const fundingByDay = Array.from(
      confirmedFunding.reduce((map: Map<string, any>, row: any) => {
        const key = localDateKey(row.confirmedAt ?? row.issuedAt);
        const current = map.get(key) ?? {
          date: key,
          entries: 0,
          floatAmount: 0,
          cashAmount: 0,
          totalAmount: 0,
        };
        current.entries += 1;
        current.floatAmount += numberValue(row.floatAmount);
        current.cashAmount += numberValue(row.cashAmount);
        current.totalAmount += numberValue(row.floatAmount) + numberValue(row.cashAmount);
        map.set(key, current);
        return map;
      }, new Map()).values(),
    ).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));

    const totalDistanceKm = pings.reduce((total: number, row: any, index: number) => {
      if (index === 0) return total;
      const previous = pings[index - 1];
      const rad = (value: number) => (value * Math.PI) / 180;
      const earth = 6371;
      const dLat = rad(numberValue(row.latitude) - numberValue(previous.latitude));
      const dLng = rad(numberValue(row.longitude) - numberValue(previous.longitude));
      const q =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(numberValue(previous.latitude))) *
          Math.cos(rad(numberValue(row.latitude))) *
          Math.sin(dLng / 2) ** 2;
      return total + earth * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
    }, 0);

    const attendanceJourney = attendance.map((row: any) => ({
      ...row,
      morning: row.checkInAt
        ? { mark: "PRESENT", time: row.checkInAt }
        : { mark: "ABSENT", time: null },
      evening: row.checkOutAt
        ? { mark: "PRESENT", time: row.checkOutAt }
        : { mark: "ABSENT", time: null },
    }));

    const stats = {
      assignedBrokers: assignedBrokers.length,
      unservedBrokers: unservedBrokers.length,
      pendingFunding: pendingFunding.length,
      totalFundingFloat: confirmedFunding.reduce(
        (sum: number, row: any) => sum + numberValue(row.floatAmount),
        0,
      ),
      totalFundingCash: confirmedFunding.reduce(
        (sum: number, row: any) => sum + numberValue(row.cashAmount),
        0,
      ),
      pendingProofs: proofs.filter((row: any) => row.status === "PENDING").length,
      verifiedProofs: proofs.filter((row: any) => row.status === "VERIFIED").length,
      totalProofValue: proofs.reduce(
        (sum: number, row: any) => sum + numberValue(row.amount),
        0,
      ),
      serviceVisits: services.length,
      totalServiceFloat: services.reduce(
        (sum: number, row: any) => sum + numberValue(row.floatAmount),
        0,
      ),
      totalServiceCash: services.reduce(
        (sum: number, row: any) => sum + numberValue(row.cashAmount),
        0,
      ),
      distanceKm: Number(totalDistanceKm.toFixed(2)),
    };

    return NextResponse.json({
      success: true,
      degraded: warnings.length > 0,
      warnings,
      period: {
        name: bounds.period,
        label: bounds.label,
        start: bounds.start,
        end: bounds.end,
      },
      staff,
      accountants,
      funding,
      fundingByDay,
      brokers: filteredBrokers,
      allAssignedBrokers: assignedBrokers,
      unservedBrokers,
      floats,
      collections,
      deposits,
      expenses,
      proofs,
      services,
      attendance: attendanceJourney,
      devices,
      pings,
      alerts,
      notifications,
      performance,
      transactions,
      weeklyFolders,
      stats,
    });
  } catch (error) {
    console.error("STAFF_OPERATIONS_GET_ERROR:", error);
    const result = responseError(error);
    return NextResponse.json(
      {
        success: false,
        message:
          result.status === 500
            ? "The staff operations workspace could not load."
            : result.message,
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: result.status },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    const db = prisma as any;
    await ensureStaffOperationsSchema();
    let body: JsonBody;

    try {
      body = (await request.json()) as JsonBody;
    } catch {
      return NextResponse.json(
        { success: false, message: "The request body must contain valid JSON." },
        { status: 400 },
      );
    }

    const action = cleanText(body.action).toUpperCase();

    if (action === "CONFIRM_FUNDING") {
      const id = cleanText(body.id ?? body.fundingId);
      const funding = await db.staffFundingReceipt.findFirst({
        where: {
          id,
          companyId: session.companyId,
          staffId: session.id,
        },
      });

      if (!funding) throw new Error("FUNDING_NOT_FOUND");
      if (funding.status !== "PENDING") throw new Error("FUNDING_ALREADY_HANDLED");

      const now = new Date();
      const result = await db.$transaction(async (tx: any) => {
        const updated = await tx.staffFundingReceipt.update({
          where: { id: funding.id },
          data: {
            status: "CONFIRMED",
            confirmedAt: now,
          },
          include: {
            accountant: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        if (funding.floatTransactionId) {
          await tx.floatTransaction.update({
            where: { id: funding.floatTransactionId },
            data: {
              status: "CONFIRMED",
              confirmedAt: now,
              lockedAt: now,
            },
          });
        }

        return updated;
      });

      await Promise.all([
        sendNotice({
          companyId: session.companyId,
          userId: session.id,
          title: "Float and cash receipt confirmed",
          message: `You confirmed ${funding.referenceNo}.`,
          type: "SUCCESS",
        }),
        sendNoticeToRoles({
          companyId: session.companyId,
          roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
          title: "Staff funding confirmed",
          message: `${session.name} confirmed ${funding.referenceNo}.`,
          type: "SUCCESS",
          excludeUserId: session.id,
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: "Float and cash receipt confirmed successfully.",
        funding: serialize(result),
      });
    }

    if (action === "SUBMIT_PROOF") {
      const smsText = cleanText(body.smsText);
      const parsed = parseProofText(smsText);
      const referenceNo = cleanText(
        body.referenceNo ?? body.transactionId ?? parsed.referenceNo,
      ).toUpperCase();
      const transactionId = cleanText(
        body.transactionId ?? parsed.transactionId ?? referenceNo,
      ).toUpperCase();
      const senderName = cleanText(body.senderName ?? parsed.senderName);
      const receiverName = cleanText(body.receiverName ?? parsed.receiverName);
      const amount = numberValue(body.amount) || parsed.amount;

      if (!referenceNo || !senderName || !receiverName || amount <= 0) {
        throw new Error("PROOF_FIELDS_MISSING");
      }

      const proofFile = await requireOwnedStaffFile(
        session.companyId,
        session.id,
        body.proofUrl,
        ["PROOF", "RECEIPT", "BANK", "EXPENSE", "OTHER"],
      );
      if (!proofFile && !smsText) throw new Error("PROOF_CONTENT_REQUIRED");

      const duplicate = await db.staffProofSubmission.findFirst({
        where: {
          companyId: session.companyId,
          referenceNo,
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_REFERENCE");

      const brokerCustomerId = cleanText(body.brokerCustomerId) || null;
      if (brokerCustomerId) {
        await requireAssignedBroker(
          session.companyId,
          session.id,
          brokerCustomerId,
        );
      }

      const requestedServiceVisitId = cleanText(body.serviceVisitId) || null;
      let serviceVisitId: string | null = null;
      if (requestedServiceVisitId) {
        const visit = await db.brokerServiceVisit.findFirst({
          where: {
            id: requestedServiceVisitId,
            companyId: session.companyId,
            staffId: session.id,
          },
          select: { id: true },
        });
        if (!visit) throw new Error("SERVICE_VISIT_NOT_OWNED");
        serviceVisitId = String(visit.id);
      }

      const transactionAt = dateValue(body.transactionAt);
      const proof = await db.staffProofSubmission.create({
        data: {
          companyId: session.companyId,
          staffId: session.id,
          brokerCustomerId,
          serviceVisitId,
          fileId: proofFile?.id ?? null,
          direction: normaliseDirection(body.direction),
          kind: normaliseProofKind(body.kind),
          referenceNo,
          transactionId: transactionId || null,
          senderName,
          receiverName,
          amount,
          transactionAt,
          smsText: smsText || null,
          proofUrl: proofFile?.url ?? null,
          weekKey: isoWeekKey(transactionAt),
          status: "PENDING",
        },
        include: {
          broker: {
            include: {
              agentAccounts: {
                where: { status: "ACTIVE" },
                orderBy: [{ isPrimary: "desc" }, { network: "asc" }],
              },
            },
          },
          file: true,
        },
      });

      if (serviceVisitId) {
        await db.brokerServiceVisit.update({
          where: { id: serviceVisitId },
          data: {
            status: "PROOF_PENDING",
            proofUploadedAt: new Date(),
          },
        });
      }

      await sendNoticeToRoles({
        companyId: session.companyId,
        roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
        title: "Receipt or SMS proof awaiting verification",
        message: `${session.name} submitted ${referenceNo} for TZS ${amount.toLocaleString()}.`,
        type: "INFO",
        excludeUserId: session.id,
      });

      return NextResponse.json(
        {
          success: true,
          message: "Proof submitted and is pending verification.",
          proof: serialize(proof),
        },
        { status: 201 },
      );
    }

    if (action === "SUBMIT_EXPENSE_REQUEST") {
      const category = cleanText(body.category).toUpperCase() || "OTHER";
      const otherCategory =
        category === "OTHER" ? cleanText(body.otherCategory) : null;
      if (category === "OTHER" && !otherCategory) {
        return NextResponse.json(
          { success: false, message: "Enter the other expense category." },
          { status: 422 },
        );
      }

      const receipt = await requireOwnedStaffFile(
        session.companyId,
        session.id,
        body.receiptUrl,
        ["EXPENSE", "RECEIPT", "PROOF"],
      );

      const requestMode = cleanText(body.requestMode).toUpperCase();
      const allowedModes = new Set([
        "REIMBURSEMENT",
        "ADVANCE_REQUEST",
        "DIRECT_PAYMENT_REQUEST",
      ]);

      const expense = await db.expense.create({
        data: {
          companyId: session.companyId,
          employeeId: session.id,
          reviewedById: null,
          expenseDate: dateValue(body.expenseDate),
          category,
          otherCategory,
          requestMode: allowedModes.has(requestMode)
            ? requestMode
            : "REIMBURSEMENT",
          requestedAction: cleanText(body.requestedAction) || null,
          amount: positiveAmount(body.amount),
          description: cleanText(body.description) || "Staff expense request",
          receiptUrl: receipt?.url ?? null,
          status: "PENDING",
        },
      });

      await sendNoticeToRoles({
        companyId: session.companyId,
        roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
        title: "Expense request awaiting approval",
        message: `${session.name} submitted ${category === "OTHER" ? otherCategory : category}.`,
        type: "INFO",
        excludeUserId: session.id,
      });

      return NextResponse.json(
        {
          success: true,
          message: "Expense request submitted for accountant approval.",
          expense: serialize(expense),
        },
        { status: 201 },
      );
    }

    if (action === "RECORD_SERVICE") {
      const brokerCustomerId = cleanText(body.brokerCustomerId);
      const broker = await requireAssignedBroker(
        session.companyId,
        session.id,
        brokerCustomerId,
      );
      const staffLatitude = Number(body.staffLatitude ?? body.latitude);
      const staffLongitude = Number(body.staffLongitude ?? body.longitude);
      if (!validCoordinate(staffLatitude, staffLongitude)) {
        throw new Error("SERVICE_LOCATION_REQUIRED");
      }

      const brokerLatitude =
        body.brokerLatitude === null || body.brokerLatitude === undefined || body.brokerLatitude === ""
          ? staffLatitude
          : Number(body.brokerLatitude);
      const brokerLongitude =
        body.brokerLongitude === null || body.brokerLongitude === undefined || body.brokerLongitude === ""
          ? staffLongitude
          : Number(body.brokerLongitude);

      if (!validCoordinate(brokerLatitude, brokerLongitude)) {
        throw new Error("SERVICE_LOCATION_REQUIRED");
      }

      const floatAmount = numberValue(body.floatAmount);
      const cashAmount = numberValue(body.cashAmount);
      const recentDevice = await db.companyGpsDevice.findFirst({
        where: {
          companyId: session.companyId,
          ownerUserId: session.id,
        },
        orderBy: { lastSeenAt: "desc" },
      });

      const now = new Date();
      const serviceType =
        cleanText(body.serviceType) || "FLOAT_AND_CASH_SERVICE";
      const nonFinancialService = [
        "BROKER_SUPPORT",
        "DOCUMENT_COLLECTION",
        "OTHER_SERVICE",
      ].includes(serviceType);

      if (floatAmount < 0 || cashAmount < 0) {
        throw new Error("NO_VALUE");
      }

      if (floatAmount + cashAmount <= 0 && !nonFinancialService) {
        throw new Error("NO_VALUE");
      }

      const today = periodBounds("DAY", localDateKey(now));
      const existingVisit = await db.brokerServiceVisit.findFirst({
        where: {
          companyId: session.companyId,
          staffId: session.id,
          brokerCustomerId: broker.id,
          startedAt: { gte: today.start, lte: today.end },
          status: { not: "CANCELLED" },
        },
        orderBy: { startedAt: "desc" },
      });

      const result = await db.$transaction(async (tx: any) => {
        const activityData = {
          companyId: session.companyId,
          staffId: session.id,
          brokerId: null,
          brokerCustomerId: broker.id,
          customerId: null,
          serviceType,
          amount: floatAmount + cashAmount,
          status: "COMPLETED",
          servedAt: now,
          latitude: staffLatitude,
          longitude: staffLongitude,
          locationName:
            cleanText(body.locationName) ||
            broker.location ||
            broker.assignedArea ||
            null,
          notes: [
            cleanText(body.notes),
            `Service type ${serviceType}.`,
            `Float TZS ${floatAmount}; Cash TZS ${cashAmount}.`,
          ]
            .filter(Boolean)
            .join(" "),
        };

        const activity = existingVisit?.serviceActivityId
          ? await tx.serviceActivity.update({
              where: { id: existingVisit.serviceActivityId },
              data: activityData,
            })
          : await tx.serviceActivity.create({
              data: activityData,
            });

        const visitData = {
          deviceId: recentDevice?.id ?? existingVisit?.deviceId ?? null,
          serviceActivityId: activity.id,
          status: "PROOF_PENDING",
          serviceType,
          communicationNote: cleanText(body.notes) || null,
          floatAmount,
          cashAmount,
          companyIncome: numberValue(body.companyIncome),
          staffLatitude,
          staffLongitude,
          brokerLatitude,
          brokerLongitude,
          distanceMeters: 0,
          locationMatched: true,
          arrivedAt: existingVisit?.arrivedAt ?? now,
          serviceProvidedAt: now,
          proofDueAt: new Date(now.getTime() + 60 * 60 * 1000),
        };

        const visit = existingVisit
          ? await tx.brokerServiceVisit.update({
              where: { id: existingVisit.id },
              data: visitData,
              include: { broker: true },
            })
          : await tx.brokerServiceVisit.create({
              data: {
                companyId: session.companyId,
                staffId: session.id,
                brokerCustomerId: broker.id,
                serviceDay: today.start,
                startedAt: now,
                ...visitData,
              },
              include: { broker: true },
            });

        await tx.brokerCustomer.update({
          where: { id: broker.id },
          data: {
            latitude: brokerLatitude,
            longitude: brokerLongitude,
            attendedBy: session.name,
            attendedDate: now,
            attendedLocation:
              cleanText(body.locationName) ||
              broker.location ||
              broker.assignedArea ||
              null,
          },
        });

        return { activity, visit };
      });

      const serviceMessage =
        `${session.name} serviced ${broker.name} (${serviceType.replaceAll("_", " ")}): ` +
        `float TZS ${floatAmount.toLocaleString()} and cash TZS ${cashAmount.toLocaleString()}.`;

      await Promise.all([
        sendNotice({
          companyId: session.companyId,
          userId: session.id,
          title: "Broker service saved",
          message: serviceMessage,
          type: "SUCCESS",
        }),
        sendNoticeToRoles({
          companyId: session.companyId,
          roles: ["COMPANY_ADMIN", "ACCOUNTANT", "GPS_MANAGER"],
          title: "Broker service updated",
          message: serviceMessage,
          type: "SUCCESS",
          excludeUserId: session.id,
        }),
      ]);

      return NextResponse.json(
        {
          success: true,
          message: "Broker location and service report updated successfully.",
          result: serialize(result),
        },
        { status: existingVisit ? 200 : 201 },
      );
    }

    if (action === "CHECK_MISSED_BROKERS") {
      const brokers = await assignedBrokerCustomers(session.companyId, session.id);
      const bounds = periodBounds("DAY", localDateKey());
      const visits = await db.brokerServiceVisit.findMany({
        where: {
          companyId: session.companyId,
          staffId: session.id,
          startedAt: { gte: bounds.start, lte: bounds.end },
        },
        select: { brokerCustomerId: true },
      });
      const visited = new Set(visits.map((row: any) => String(row.brokerCustomerId)));
      const missed = brokers.filter((broker: any) => !visited.has(String(broker.id)));

      if (missed.length) {
        const message = `${missed.length} assigned broker${missed.length === 1 ? "" : "s"} still require service today.`;
        await sendNotice({
          companyId: session.companyId,
          userId: session.id,
          title: "Unserved broker reminder",
          message,
          type: "WARNING",
        });
      }

      return NextResponse.json({
        success: true,
        message: missed.length
          ? `${missed.length} broker service reminder(s) created.`
          : "All assigned brokers have been serviced today.",
        missed: missed.map((broker: any) => ({
          id: broker.id,
          name: broker.name,
          location: broker.location,
        })),
      });
    }

    if (action === "MARK_NOTIFICATION_READ") {
      const id = cleanText(body.id ?? body.notificationId);
      const notification = await db.notification.findFirst({
        where: {
          id,
          companyId: session.companyId,
          userId: session.id,
        },
      });
      if (!notification) {
        return NextResponse.json(
          { success: false, message: "The notification was not found." },
          { status: 404 },
        );
      }
      await db.notification.update({
        where: { id: notification.id },
        data: { isRead: true },
      });
      return NextResponse.json({
        success: true,
        message: "Notification marked as read.",
      });
    }

    throw new Error("UNSUPPORTED_ACTION");
  } catch (error) {
    console.error("STAFF_OPERATIONS_POST_ERROR:", error);
    const result = responseError(error);
    return NextResponse.json(
      {
        success: false,
        message:
          result.status === 500
            ? "The staff operation could not be completed."
            : result.message,
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: result.status },
    );
  }
}
