import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireCompanyAdmin } from "@/lib/admin/permissions";
import { sendNotice } from "@/lib/staff/notify";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Please sign in."],
    FORBIDDEN: [403, "Company Admin access is required."],
    COMPANY_REQUIRED: [403, "Your account is not attached to a company."],
    STAFF_NOT_FOUND: [404, "The active staff officer was not found."],
    BROKER_NOT_FOUND: [404, "The active broker was not found."],
    CUSTOMER_NOT_FOUND: [404, "The active customer was not found."],
    ASSIGNMENT_NOT_FOUND: [404, "The assignment was not found."],
  };
  if (message.startsWith("REQUIRED:")) {
    return NextResponse.json(
      { success: false, message: `${message.split(":")[1]} is required.` },
      { status: 400 },
    );
  }
  if (known[message]) {
    return NextResponse.json(
      { success: false, message: known[message][1] },
      { status: known[message][0] },
    );
  }
  console.error("[STAFF_ASSIGNMENT]", error);
  return NextResponse.json(
    { success: false, message: "The assignment operation failed." },
    { status: 500 },
  );
}

function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`REQUIRED:${name}`);
  return result;
}

async function activeStaff(companyId: string, id: string) {
  const user = await (db as any).user.findFirst({
    where: { id, companyId, role: "STAFF", status: "ACTIVE" },
    select: { id: true, name: true, username: true, email: true, profileImageUrl: true },
  });
  if (!user) throw new Error("STAFF_NOT_FOUND");
  return user;
}

export async function GET() {
  try {
    const session = await requireCompanyAdmin();
    const [staff, brokers, customers, brokerAssignments, customerAssignments] = await Promise.all([
      (db as any).user.findMany({
        where: { companyId: session.companyId, role: "STAFF", status: "ACTIVE" },
        select: { id: true, name: true, username: true, email: true, profileImageUrl: true },
        orderBy: { name: "asc" },
      }),
      (db as any).user.findMany({
        where: { companyId: session.companyId, role: "BROKER", status: "ACTIVE" },
        select: { id: true, name: true, username: true, email: true, profileImageUrl: true, assignedRegion: true },
        orderBy: { name: "asc" },
      }),
      (db as any).customer.findMany({
        where: { companyId: session.companyId, status: "ACTIVE" },
        select: { id: true, name: true, email: true, phone: true, region: true, address: true },
        orderBy: { name: "asc" },
        take: 5000,
      }),
      (db as any).staffBrokerAssignment.findMany({
        where: { companyId: session.companyId, status: "ACTIVE" },
        include: {
          staff: { select: { id: true, name: true, username: true, email: true, profileImageUrl: true } },
          broker: { select: { id: true, name: true, username: true, email: true, profileImageUrl: true, assignedRegion: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      (db as any).staffCustomerAssignment.findMany({
        where: { companyId: session.companyId, status: "ACTIVE" },
        include: {
          staff: { select: { id: true, name: true, username: true, email: true, profileImageUrl: true } },
          customer: { select: { id: true, name: true, email: true, phone: true, region: true, address: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      staff,
      brokers,
      customers,
      brokerAssignments,
      customerAssignments,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCompanyAdmin();
    const body = await request.json();
    const action = required(body.action, "action").toUpperCase();

    if (action === "ASSIGN_BROKER") {
      const staffId = required(body.staffId, "staffId");
      const brokerId = required(body.brokerId, "brokerId");
      const [staff, broker] = await Promise.all([
        activeStaff(session.companyId, staffId),
        (db as any).user.findFirst({
          where: { id: brokerId, companyId: session.companyId, role: "BROKER", status: "ACTIVE" },
          select: { id: true, name: true, email: true },
        }),
      ]);
      if (!broker) throw new Error("BROKER_NOT_FOUND");

      const previousAssignment = await (db as any).staffBrokerAssignment.findUnique({
        where: { companyId_brokerId: { companyId: session.companyId, brokerId } },
        include: { staff: { select: { id: true, name: true } } },
      });

      const assignment = await (db as any).staffBrokerAssignment.upsert({
        where: { companyId_brokerId: { companyId: session.companyId, brokerId } },
        create: {
          companyId: session.companyId,
          staffId,
          brokerId,
          assignedById: session.id,
          status: "ACTIVE",
          startedAt: new Date(),
          notes: text(body.notes) || null,
        },
        update: {
          staffId,
          assignedById: session.id,
          status: "ACTIVE",
          startedAt: new Date(),
          endedAt: null,
          notes: text(body.notes) || null,
        },
        include: { staff: true, broker: true },
      });

      if (previousAssignment?.staffId && previousAssignment.staffId !== staffId) {
        await sendNotice({
          companyId: session.companyId,
          userId: previousAssignment.staffId,
          title: "Broker reassigned",
          message: `${broker.name} is no longer assigned to your Staff Float Officer account. Your historical transactions remain visible.`,
          type: "INFO",
        });
      }

      await Promise.all([
        sendNotice({
          companyId: session.companyId,
          userId: staff.id,
          title: "Broker assigned",
          message: `${broker.name} is now assigned to your Staff Float Officer account.`,
          type: "INFO",
        }),
        sendNotice({
          companyId: session.companyId,
          userId: broker.id,
          title: "Staff officer assigned",
          message: `${staff.name} is now your assigned Staff Float Officer.`,
          type: "INFO",
        }),
      ]);

      return NextResponse.json({ success: true, message: "Broker assigned successfully.", assignment });
    }

    if (action === "UNASSIGN_BROKER") {
      const assignmentId = required(body.assignmentId, "assignmentId");
      const result = await (db as any).staffBrokerAssignment.updateMany({
        where: { id: assignmentId, companyId: session.companyId, status: "ACTIVE" },
        data: { status: "INACTIVE", endedAt: new Date() },
      });
      if (!result.count) throw new Error("ASSIGNMENT_NOT_FOUND");
      return NextResponse.json({ success: true, message: "Broker assignment removed." });
    }

    if (action === "ASSIGN_CUSTOMER") {
      const staffId = required(body.staffId, "staffId");
      const customerId = required(body.customerId, "customerId");
      const [staff, customer] = await Promise.all([
        activeStaff(session.companyId, staffId),
        (db as any).customer.findFirst({
          where: { id: customerId, companyId: session.companyId, status: "ACTIVE" },
          select: { id: true, name: true },
        }),
      ]);
      if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

      const previousAssignment = await (db as any).staffCustomerAssignment.findUnique({
        where: { companyId_customerId: { companyId: session.companyId, customerId } },
      });

      const assignment = await (db as any).staffCustomerAssignment.upsert({
        where: { companyId_customerId: { companyId: session.companyId, customerId } },
        create: {
          companyId: session.companyId,
          staffId,
          customerId,
          assignedById: session.id,
          status: "ACTIVE",
          startedAt: new Date(),
          notes: text(body.notes) || null,
        },
        update: {
          staffId,
          assignedById: session.id,
          status: "ACTIVE",
          startedAt: new Date(),
          endedAt: null,
          notes: text(body.notes) || null,
        },
        include: { staff: true, customer: true },
      });

      if (previousAssignment?.staffId && previousAssignment.staffId !== staffId) {
        await sendNotice({
          companyId: session.companyId,
          userId: previousAssignment.staffId,
          title: "Customer reassigned",
          message: `${customer.name} is no longer assigned to your Staff Float Officer account. Your historical transactions remain visible.`,
          type: "INFO",
        });
      }

      await sendNotice({
        companyId: session.companyId,
        userId: staff.id,
        title: "Customer assigned",
        message: `${customer.name} is now assigned to your Staff Float Officer account.`,
        type: "INFO",
      });

      return NextResponse.json({ success: true, message: "Customer assigned successfully.", assignment });
    }

    if (action === "UNASSIGN_CUSTOMER") {
      const assignmentId = required(body.assignmentId, "assignmentId");
      const result = await (db as any).staffCustomerAssignment.updateMany({
        where: { id: assignmentId, companyId: session.companyId, status: "ACTIVE" },
        data: { status: "INACTIVE", endedAt: new Date() },
      });
      if (!result.count) throw new Error("ASSIGNMENT_NOT_FOUND");
      return NextResponse.json({ success: true, message: "Customer assignment removed." });
    }

    return NextResponse.json({ success: false, message: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
