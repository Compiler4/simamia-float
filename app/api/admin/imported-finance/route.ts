import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set([
  "SYSTEM_DEVELOPER",
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "ACCOUNTANT",
]);

function integerParam(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function text(value: string | null): string {
  return String(value ?? "").trim();
}

function plain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (
        item &&
        typeof item === "object" &&
        typeof item.toNumber === "function"
      ) {
        return item.toNumber();
      }

      return item;
    }),
  ) as T;
}

function startOfDay(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export async function GET(request: Request) {
  try {
    const user = (await getCurrentUser()) as any;

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please sign in." },
        { status: 401 },
      );
    }

    if (!ALLOWED_ROLES.has(String(user.role))) {
      return NextResponse.json(
        { success: false, message: "Finance import access is required." },
        { status: 403 },
      );
    }

    if (!user.companyId) {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is not attached to a company.",
        },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const companyId = String(user.companyId);
    const agentPage = integerParam(url.searchParams.get("agentPage"), 1, 1, 100000);
    const agentPageSize = integerParam(
      url.searchParams.get("agentPageSize"),
      25,
      10,
      100,
    );
    const transactionPage = integerParam(
      url.searchParams.get("transactionPage"),
      1,
      1,
      100000,
    );
    const transactionPageSize = integerParam(
      url.searchParams.get("transactionPageSize"),
      25,
      10,
      100,
    );
    const agentSearch = text(url.searchParams.get("agentSearch"));
    const transactionSearch = text(
      url.searchParams.get("transactionSearch"),
    );
    const matchStatus = text(url.searchParams.get("matchStatus"));
    const direction = text(url.searchParams.get("direction"));

    const agentWhere: any = {
      companyId,
      isImported: true,
    };

    if (agentSearch) {
      agentWhere.OR = [
        { name: { contains: agentSearch } },
        { phone: { contains: agentSearch } },
        { code: { contains: agentSearch } },
        { sourceAgentName: { contains: agentSearch } },
      ];
    }

    const transactionWhere: any = { companyId };

    if (transactionSearch) {
      transactionWhere.OR = [
        { reference: { contains: transactionSearch } },
        { senderName: { contains: transactionSearch } },
        { details: { contains: transactionSearch } },
        {
          matchedBrokerCustomer: {
            is: { name: { contains: transactionSearch } },
          },
        },
      ];
    }

    if (
      ["MATCHED", "REVIEW_REQUIRED", "UNMATCHED", "NOT_APPLICABLE"].includes(
        matchStatus,
      )
    ) {
      transactionWhere.matchStatus = matchStatus;
    }

    if (["CREDIT", "DEBIT"].includes(direction)) {
      transactionWhere.direction = direction;
    }

    const [
      company,
      latestAgentBatch,
      statement,
      agentCount,
      agents,
      transactionCount,
      transactions,
      matchedCount,
      reviewCount,
      unmatchedCount,
      notApplicableCount,
    ] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true, code: true },
      }),
      db.dataImportBatch.findFirst({
        where: { companyId, sourceType: "EXCEL_AGENT_MASTER" },
        orderBy: { importedAt: "desc" },
      }),
      db.importedBankStatement.findFirst({
        where: { companyId },
        orderBy: [{ periodEnd: "desc" }, { importedAt: "desc" }],
      }),
      db.brokerCustomer.count({ where: agentWhere }),
      db.brokerCustomer.findMany({
        where: agentWhere,
        select: {
          id: true,
          code: true,
          name: true,
          phone: true,
          location: true,
          status: true,
          sourceRowNumber: true,
          sourceSheetName: true,
          sourceAgentName: true,
          sourceMsisdn: true,
          sourceAliasCode: true,
          importedAt: true,
        },
        orderBy: [{ name: "asc" }, { code: "asc" }],
        skip: (agentPage - 1) * agentPageSize,
        take: agentPageSize,
      }),
      db.importedBankTransaction.count({ where: transactionWhere }),
      db.importedBankTransaction.findMany({
        where: transactionWhere,
        include: {
          matchedBrokerCustomer: {
            select: {
              id: true,
              code: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: [{ postingDate: "desc" }, { createdAt: "desc" }],
        skip: (transactionPage - 1) * transactionPageSize,
        take: transactionPageSize,
      }),
      db.importedBankTransaction.count({
        where: { companyId, matchStatus: "MATCHED" },
      }),
      db.importedBankTransaction.count({
        where: { companyId, matchStatus: "REVIEW_REQUIRED" },
      }),
      db.importedBankTransaction.count({
        where: { companyId, matchStatus: "UNMATCHED" },
      }),
      db.importedBankTransaction.count({
        where: { companyId, matchStatus: "NOT_APPLICABLE" },
      }),
    ]);

    if (!company) {
      return NextResponse.json(
        { success: false, message: "Company not found." },
        { status: 404 },
      );
    }

    const statementTransactions = statement
      ? await db.importedBankTransaction.findMany({
          where: { companyId, statementId: statement.id },
          select: {
            postingDate: true,
            debit: true,
            credit: true,
          },
          orderBy: { postingDate: "asc" },
        })
      : [];

    const dailyMap = new Map<
      string,
      { date: string; credit: number; debit: number; net: number; count: number }
    >();

    for (const row of statementTransactions) {
      const date = startOfDay(row.postingDate);
      const current = dailyMap.get(date) ?? {
        date,
        credit: 0,
        debit: 0,
        net: 0,
        count: 0,
      };
      const credit = Number(row.credit ?? 0);
      const debit = Number(row.debit ?? 0);
      current.credit += credit;
      current.debit += debit;
      current.net += credit - debit;
      current.count += 1;
      dailyMap.set(date, current);
    }

    return NextResponse.json(
      plain({
        success: true,
        company,
        stats: {
          importedAgents: latestAgentBatch?.importedRows ?? agentCount,
          displayedAgentMatches: agentCount,
          uniqueMsisdn: latestAgentBatch?.importedRows ?? agentCount,
          uniqueAliasCodes: latestAgentBatch?.importedRows ?? agentCount,
          statementTransactions:
            matchedCount + reviewCount + unmatchedCount + notApplicableCount,
          matchedCount,
          reviewCount,
          unmatchedCount,
          notApplicableCount,
          matchRate:
            matchedCount + reviewCount + unmatchedCount > 0
              ? (matchedCount /
                  (matchedCount + reviewCount + unmatchedCount)) *
                100
              : 0,
        },
        importBatch: latestAgentBatch,
        statement,
        dailySeries: [...dailyMap.values()],
        agents: {
          rows: agents,
          page: agentPage,
          pageSize: agentPageSize,
          total: agentCount,
          totalPages: Math.max(1, Math.ceil(agentCount / agentPageSize)),
        },
        transactions: {
          rows: transactions,
          page: transactionPage,
          pageSize: transactionPageSize,
          total: transactionCount,
          totalPages: Math.max(
            1,
            Math.ceil(transactionCount / transactionPageSize),
          ),
        },
      }),
    );
  } catch (error) {
    const code = (error as any)?.code;
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error("[IMPORTED_FINANCE_API]", error);

    return NextResponse.json(
      {
        success: false,
        message:
          code === "P2021" || code === "P2022"
            ? "The imported finance database is not synchronized. Run npx prisma db push and npx prisma generate."
            : "Imported finance data could not be loaded.",
        code,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 500 },
    );
  }
}
