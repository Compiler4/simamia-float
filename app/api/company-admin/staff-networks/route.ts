import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertFinancialDayOpen } from "@/lib/accountant/accounting";
import {
  cleanText,
  numberValue,
  serialize,
} from "@/lib/staff/operations-v4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set([
  "SYSTEM_DEVELOPER",
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "ACCOUNTANT",
]);

async function requireManager() {
  const user = await getCurrentUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  if (!user.companyId) throw new Error("COMPANY_REQUIRED");
  if (!ADMIN_ROLES.has(String(user.role).toUpperCase())) {
    throw new Error("ROLE_REQUIRED");
  }
  return {
    id: String(user.id),
    name: String(user.name),
    role: String(user.role).toUpperCase(),
    companyId: String(user.companyId),
  };
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  const known: Record<string, [number, string]> = {
    AUTH_REQUIRED: [401, "Authentication is required."],
    COMPANY_REQUIRED: [403, "Your account is not assigned to a company."],
    ROLE_REQUIRED: [403, "Company Admin or Accountant access is required."],
    STAFF_NOT_FOUND: [404, "The selected active staff member was not found."],
    BROKER_NOT_FOUND: [404, "The selected active broker was not found."],
    ASSIGNMENT_NOT_FOUND: [404, "The selected broker assignment was not found."],
    NETWORK_LINE_NOT_FOUND: [404, "The selected staff network line was not found."],
    INVALID_NETWORK: [422, "Select a supported mobile network."],
    INVALID_PURPOSE: [422, "Select FLOAT, CASH or BOTH."],
    INVALID_VALUE: [422, "Enter a float amount, cash amount, or both."],
    DUPLICATE_LINE: [409, "This SIM line is already registered in the company."],
    FINANCIAL_DAY_NOT_OPEN: [409, "Financial operations are at rest. The Accountant must open today’s financial day before staff funding can be issued."],
    FINANCIAL_DAY_DATE_MISMATCH: [409, "The open financial day does not match today. Close the old day and open the correct financial day first."],
  };
  const result = known[code] ?? [500, "The staff network operation could not be completed."];
  return NextResponse.json(
    {
      success: false,
      message: result[1],
      details:
        process.env.NODE_ENV === "development"
          ? code
          : undefined,
    },
    { status: result[0] },
  );
}

async function requireStaff(db: any, companyId: string, staffId: string) {
  const staff = await db.user.findFirst({
    where: {
      id: staffId,
      companyId,
      role: "STAFF",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      assignedRegion: true,
    },
  });
  if (!staff) throw new Error("STAFF_NOT_FOUND");
  return staff;
}

function generatedReference(): string {
  return `AFR-${Date.now().toString(36).toUpperCase()}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase()}`;
}

export async function GET(request: Request) {
  try {
    const manager = await requireManager();
    const db = prisma as any;
    const url = new URL(request.url);
    const staffId = cleanText(url.searchParams.get("staffId"));

    const [staff, lines, funding, brokers, assignments] = await Promise.all([
      db.user.findMany({
        where: {
          companyId: manager.companyId,
          role: "STAFF",
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
        },
        orderBy: { name: "asc" },
      }),
      db.staffNetworkLine.findMany({
        where: {
          companyId: manager.companyId,
          ...(staffId ? { staffId } : {}),
        },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              email: true,
              assignedRegion: true,
            },
          },
        },
        orderBy: [{ staffId: "asc" }, { isPrimary: "desc" }, { network: "asc" }],
      }),
      db.staffFundingReceipt.findMany({
        where: {
          companyId: manager.companyId,
          ...(staffId ? { staffId } : {}),
        },
        include: {
          staff: { select: { id: true, name: true, email: true } },
          accountant: { select: { id: true, name: true, email: true } },
          networkLine: true,
        },
        orderBy: { issuedAt: "desc" },
        take: 500,
      }),
      db.brokerCustomer.findMany({
        where: {
          companyId: manager.companyId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          code: true,
          name: true,
          businessName: true,
          phone: true,
          location: true,
          region: true,
          district: true,
          ward: true,
          address: true,
          latitude: true,
          longitude: true,
        },
        orderBy: [{ location: "asc" }, { name: "asc" }],
        take: 10000,
      }),
      db.staffBrokerCustomerAssignment.findMany({
        where: {
          companyId: manager.companyId,
          ...(staffId ? { staffId } : {}),
        },
        include: {
          staff: { select: { id: true, name: true, assignedRegion: true } },
          brokerCustomer: true,
        },
        orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      }),
    ]);

    return NextResponse.json({
      success: true,
      staff,
      lines: serialize(lines),
      funding: serialize(funding),
      brokers: serialize(brokers),
      assignments: serialize(
        assignments.map((assignment: any) => ({
          ...assignment,
          broker: assignment.brokerCustomer,
        })),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const manager = await requireManager();
    const db = prisma as any;
    const body = (await request.json()) as Record<string, unknown>;
    const action = cleanText(body.action).toUpperCase();

    if (action === "UPSERT_NETWORK_LINE") {
      const staffId = cleanText(body.staffId);
      const staff = await requireStaff(db, manager.companyId, staffId);
      const network = cleanText(body.network).toUpperCase();
      const purpose = cleanText(body.purpose).toUpperCase() || "BOTH";
      const allowedNetworks = new Set([
        "VODACOM",
        "YAS_MIX",
        "AIRTEL",
        "HALOTEL",
        "OTHER",
      ]);
      const allowedPurposes = new Set(["FLOAT", "CASH", "BOTH"]);
      if (!allowedNetworks.has(network)) throw new Error("INVALID_NETWORK");
      if (!allowedPurposes.has(purpose)) throw new Error("INVALID_PURPOSE");

      const simCardNumber = cleanText(body.simCardNumber);
      if (!simCardNumber) {
        return NextResponse.json(
          { success: false, message: "SIM card phone number is required." },
          { status: 422 },
        );
      }

      const id = cleanText(body.id);
      const duplicate = await db.staffNetworkLine.findFirst({
        where: {
          companyId: manager.companyId,
          network,
          simCardNumber,
          ...(id ? { NOT: { id } } : {}),
        },
        select: { id: true },
      });
      if (duplicate) throw new Error("DUPLICATE_LINE");

      const data = {
        companyId: manager.companyId,
        staffId,
        network,
        simCardNumber,
        agentNumber: cleanText(body.agentNumber) || null,
        accountName: cleanText(body.accountName) || staff.name,
        purpose,
        assignedArea: cleanText(body.assignedArea) || staff.assignedRegion || null,
        isPrimary: Boolean(body.isPrimary),
        status: cleanText(body.status).toUpperCase() || "ACTIVE",
      };

      const line = id
        ? await db.staffNetworkLine.update({
            where: { id },
            data,
          })
        : await db.staffNetworkLine.create({ data });

      if (data.isPrimary) {
        await db.staffNetworkLine.updateMany({
          where: {
            companyId: manager.companyId,
            staffId,
            NOT: { id: line.id },
          },
          data: { isPrimary: false },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Staff network SIM line saved successfully.",
        line: serialize(line),
      });
    }

    if (action === "ASSIGN_BROKER") {
      const staffId = cleanText(body.staffId);
      const brokerCustomerId = cleanText(body.brokerCustomerId);
      const staff = await requireStaff(db, manager.companyId, staffId);
      const broker = await db.brokerCustomer.findFirst({
        where: {
          id: brokerCustomerId,
          companyId: manager.companyId,
          status: "ACTIVE",
        },
      });
      if (!broker) throw new Error("BROKER_NOT_FOUND");

      const assignment = await db.staffBrokerCustomerAssignment.upsert({
        where: {
          companyId_brokerCustomerId: {
            companyId: manager.companyId,
            brokerCustomerId,
          },
        },
        create: {
          companyId: manager.companyId,
          staffId,
          brokerCustomerId,
          assignedById: manager.id,
          assignedArea:
            cleanText(body.assignedArea) ||
            broker.ward ||
            broker.district ||
            broker.location ||
            staff.assignedRegion ||
            null,
          status: "ACTIVE",
          notes: cleanText(body.notes) || null,
        },
        update: {
          staffId,
          assignedById: manager.id,
          assignedArea:
            cleanText(body.assignedArea) ||
            broker.ward ||
            broker.district ||
            broker.location ||
            staff.assignedRegion ||
            null,
          status: "ACTIVE",
          endedAt: null,
          notes: cleanText(body.notes) || null,
        },
        include: {
          staff: { select: { id: true, name: true } },
          brokerCustomer: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Broker assigned to the staff service area.",
        assignment: serialize({ ...assignment, broker: assignment.brokerCustomer }),
      });
    }

    if (action === "CHANGE_ASSIGNMENT_STATUS") {
      const id = cleanText(body.id);
      const status = cleanText(body.status).toUpperCase();
      if (!id || !["ACTIVE", "INACTIVE"].includes(status)) {
        return NextResponse.json(
          { success: false, message: "Choose an assignment and a valid status." },
          { status: 422 },
        );
      }

      const current = await db.staffBrokerCustomerAssignment.findFirst({
        where: { id, companyId: manager.companyId },
        select: { id: true },
      });
      if (!current) throw new Error("ASSIGNMENT_NOT_FOUND");

      const assignment = await db.staffBrokerCustomerAssignment.update({
        where: { id },
        data: {
          status,
          endedAt: status === "INACTIVE" ? new Date() : null,
          assignedById: manager.id,
        },
        include: {
          staff: { select: { id: true, name: true } },
          brokerCustomer: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: status === "ACTIVE"
          ? "Broker assignment activated."
          : "Broker assignment deactivated.",
        assignment: serialize({ ...assignment, broker: assignment.brokerCustomer }),
      });
    }

    if (action === "ISSUE_FUNDING") {
      await assertFinancialDayOpen(manager.companyId, new Date());
      const staffId = cleanText(body.staffId);
      const staff = await requireStaff(db, manager.companyId, staffId);
      const networkLineId = cleanText(body.networkLineId) || null;
      const floatAmount = numberValue(body.floatAmount);
      const cashAmount = numberValue(body.cashAmount);
      if (
        floatAmount < 0 ||
        cashAmount < 0 ||
        floatAmount + cashAmount <= 0
      ) {
        throw new Error("INVALID_VALUE");
      }

      let networkLine: any = null;
      if (networkLineId) {
        networkLine = await db.staffNetworkLine.findFirst({
          where: {
            id: networkLineId,
            companyId: manager.companyId,
            staffId,
            status: "ACTIVE",
          },
        });
        if (!networkLine) throw new Error("NETWORK_LINE_NOT_FOUND");
      }

      const referenceNo =
        cleanText(body.referenceNo).toUpperCase() || generatedReference();

      const result = await db.$transaction(async (tx: any) => {
        let floatTransaction: any = null;

        if (floatAmount > 0) {
          floatTransaction = await tx.floatTransaction.create({
            data: {
              companyId: manager.companyId,
              fromUserId: manager.id,
              toUserId: staffId,
              approvedById: manager.id,
              transactionType: "ACCOUNTANT_TO_STAFF",
              referenceNo: `${referenceNo}-F`,
              amount: floatAmount,
              purpose:
                cleanText(body.note) ||
                `Funding for ${networkLine?.network ?? "staff operations"}`,
              status: "ISSUED",
              issuedAt: new Date(),
            },
          });
        }

        const funding = await tx.staffFundingReceipt.create({
          data: {
            companyId: manager.companyId,
            staffId,
            accountantId: manager.id,
            networkLineId,
            floatTransactionId: floatTransaction?.id ?? null,
            referenceNo,
            floatAmount,
            cashAmount,
            note: cleanText(body.note) || null,
            status: "PENDING",
            issuedAt: new Date(),
          },
          include: {
            staff: { select: { id: true, name: true, email: true } },
            accountant: { select: { id: true, name: true } },
            networkLine: true,
          },
        });

        return { funding, floatTransaction };
      });

      await db.notification.create({
        data: {
          companyId: manager.companyId,
          userId: staffId,
          title: "New float and cash receipt",
          message: `${manager.name} issued ${referenceNo}: float TZS ${floatAmount.toLocaleString()} and cash TZS ${cashAmount.toLocaleString()}. Confirm it in Receive & Confirm Float.`,
          type: "INFO",
          isRead: false,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: `Funding issued to ${staff.name}. Staff confirmation is pending.`,
          result: serialize(result),
        },
        { status: 201 },
      );
    }

    if (action === "CHANGE_LINE_STATUS") {
      const id = cleanText(body.id);
      const status = cleanText(body.status).toUpperCase();
      const line = await db.staffNetworkLine.findFirst({
        where: { id, companyId: manager.companyId },
      });
      if (!line) throw new Error("NETWORK_LINE_NOT_FOUND");
      const updated = await db.staffNetworkLine.update({
        where: { id },
        data: {
          status: ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)
            ? status
            : "INACTIVE",
        },
      });
      return NextResponse.json({
        success: true,
        message: "Network line status updated.",
        line: serialize(updated),
      });
    }

    throw new Error("UNSUPPORTED_ACTION");
  } catch (error) {
    console.error("STAFF_NETWORK_ADMIN_ERROR:", error);
    return errorResponse(error);
  }
}
