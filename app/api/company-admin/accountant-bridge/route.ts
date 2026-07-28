import { createHash, randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { recalculateExpenseDecision } from "@/lib/accountant-v3/expense-workflow";
import { syncExistingOperationalRecords } from "@/lib/accountant-v3/existing-record-sync";
import { requireCompanyAdmin } from "@/lib/accountant-v3/guard";
import { jsonError, optionalText, positiveAmount, requiredText } from "@/lib/accountant-v3/http";
import { notifyRoles, notifyUser } from "@/lib/accountant-v3/notifications";

export const dynamic = "force-dynamic";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function activeStaff(companyId: string, staffId: string) {
  const db = prisma as any;
  const staff = await db.user.findFirst({
    where: { id: staffId, companyId, role: "STAFF", status: "ACTIVE" },
  });
  if (!staff) throw new Error("The selected user is not an active STAFF user.");
  return staff;
}

export async function GET() {
  try {
    const user = await requireCompanyAdmin();
    await syncExistingOperationalRecords(user.companyId);
    const db = prisma as any;
    const [packets, expenses, decisions, bankComparisons, devices, staff] = await Promise.all([
      db.accountantVerificationPacket.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.expense.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.accountantExpenseDecision.findMany({
        where: { companyId: user.companyId },
      }),
      db.accountantBankComparison.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      db.accountantFingerprintDevice.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: "desc" },
      }),
      db.user.findMany({
        where: { companyId: user.companyId, role: "STAFF", status: "ACTIVE" },
        select: { id: true, name: true, email: true },
      }),
    ]);

    const staffMap = new Map(staff.map((item: any) => [String(item.id), item]));
    const staffExpenses = expenses.filter((expense: any) => {
      const staffId = String(
        expense.employeeId ?? expense.staffId ?? expense.requestedById ?? expense.userId ?? "",
      );
      return staffMap.has(staffId);
    });

    return NextResponse.json({
      success: true,
      packets,
      staff,
      expenses: staffExpenses.map((expense: any) => {
        const staffId = String(
          expense.employeeId ?? expense.staffId ?? expense.requestedById ?? expense.userId ?? "",
        );
        const staffUser = staffMap.get(staffId) as any;
        return {
          ...expense,
          staffId,
          staffName: String(staffUser?.name ?? staffUser?.email ?? "Staff"),
          decisions: decisions.filter((item: any) => item.expenseId === expense.id),
        };
      }),
      bankComparisons,
      devices,
    });
  } catch (error) {
    return jsonError(error, "Company Admin accountant bridge could not load.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const db = prisma as any;
    const body = await request.json();
    const action = requiredText(body.action, "Action").toUpperCase();

    if (action === "DECIDE_EXPENSE") {
      const expenseId = requiredText(body.expenseId, "Expense");
      const decision = requiredText(body.decision, "Decision").toUpperCase();
      if (!["APPROVE", "REJECT"].includes(decision)) throw new Error("Decision must be APPROVE or REJECT.");
      if (decision === "REJECT" && !optionalText(body.reason)) throw new Error("A rejection reason is required.");

      const expense = await db.expense.findFirst({
        where: { id: expenseId, companyId: user.companyId },
      });
      if (!expense) throw new Error("Expense request was not found.");
      const expenseStaffId = String(
        expense.employeeId ??
          expense.staffId ??
          expense.requestedById ??
          expense.userId ??
          "",
      );
      await activeStaff(user.companyId, expenseStaffId);

      await db.accountantExpenseDecision.upsert({
        where: {
          companyId_expenseId_actorRole: {
            companyId: user.companyId,
            expenseId,
            actorRole: "COMPANY_ADMIN",
          },
        },
        update: {
          actorUserId: user.id,
          decision,
          reason: optionalText(body.reason),
          decidedAt: new Date(),
        },
        create: {
          companyId: user.companyId,
          expenseId,
          actorUserId: user.id,
          actorRole: "COMPANY_ADMIN",
          decision,
          reason: optionalText(body.reason),
          decidedAt: new Date(),
        },
      });

      const result = await recalculateExpenseDecision({
        companyId: user.companyId,
        expenseId,
      });
      await notifyRoles({
        companyId: user.companyId,
        roles: ["ACCOUNTANT"],
        title: "Company Admin expense decision",
        message: `${user.name} ${decision.toLowerCase()}d an expense. Final status: ${result.finalStatus}.`,
        type: decision === "APPROVE" ? "INFO" : "WARNING",
      });

      return NextResponse.json({
        success: true,
        finalStatus: result.finalStatus,
        message:
          result.finalStatus === "PENDING"
            ? "Company Admin decision saved. Accountant decision is still required."
            : `Expense is now ${result.finalStatus.toLowerCase()}.`,
      });
    }

    if (action === "ADD_VERIFICATION_REFERENCE") {
      const packetId = requiredText(body.packetId, "Verification packet");
      const packet = await db.accountantVerificationPacket.findFirst({
        where: { id: packetId, companyId: user.companyId },
      });
      if (!packet) throw new Error("Verification packet was not found.");
      const adminReferenceMessage = optionalText(body.adminReferenceMessage);
      const adminReferenceUrl = optionalText(body.adminReferenceUrl);
      if (!adminReferenceMessage && !adminReferenceUrl) {
        throw new Error("Add a Company Admin reference message or file URL.");
      }

      await db.accountantVerificationPacket.update({
        where: { id: packetId },
        data: {
          adminReferenceMessage,
          adminReferenceUrl,
          status: "READY_FOR_ACCOUNTANT",
        },
      });

      await notifyRoles({
        companyId: user.companyId,
        roles: ["ACCOUNTANT"],
        title: "Verification reference received",
        message: `Company Admin reference is ready for a staff ${String(packet.kind).toLowerCase()} verification.`,
        type: "INFO",
      });

      return NextResponse.json({
        success: true,
        message: "Reference was sent to the Accountant for verification.",
      });
    }

    if (action === "UPSERT_BANK_REFERENCE") {
      const staffId = requiredText(body.staffId, "Staff member");
      await activeStaff(user.companyId, staffId);
      const comparisonId = optionalText(body.comparisonId);
      const depositId = optionalText(body.depositId);
      const adminAmount = positiveAmount(body.adminAmount, "Admin statement amount");
      const adminReference = requiredText(body.adminReference, "Admin statement reference");
      const adminBankAccount = requiredText(body.adminBankAccount, "Admin bank account");

      const existing = comparisonId
        ? await db.accountantBankComparison.findFirst({
            where: { id: comparisonId, companyId: user.companyId },
          })
        : depositId
          ? await db.accountantBankComparison.findFirst({
              where: { companyId: user.companyId, depositId },
            })
          : null;

      const data = {
        companyId: user.companyId,
        depositId,
        staffId,
        staffAmount: body.staffAmount ? Number(body.staffAmount) : existing?.staffAmount ?? null,
        staffReference: optionalText(body.staffReference) ?? existing?.staffReference ?? null,
        staffDate: body.staffDate ? new Date(String(body.staffDate)) : existing?.staffDate ?? null,
        staffBankAccount: optionalText(body.staffBankAccount) ?? existing?.staffBankAccount ?? null,
        staffFileUrl: optionalText(body.staffFileUrl) ?? existing?.staffFileUrl ?? null,
        adminAmount,
        adminReference,
        adminDate: body.adminDate ? new Date(String(body.adminDate)) : new Date(),
        adminBankAccount,
        adminFileUrl: optionalText(body.adminFileUrl),
        accountantDecision: "PENDING",
        mismatchReason: null,
        reviewedById: null,
        reviewedAt: null,
      };

      const comparison = existing
        ? await db.accountantBankComparison.update({ where: { id: existing.id }, data })
        : await db.accountantBankComparison.create({ data });

      await notifyRoles({
        companyId: user.companyId,
        roles: ["ACCOUNTANT"],
        title: "Bank statement reference ready",
        message: `A Company Admin bank record is ready for accountant comparison (${adminReference}).`,
        type: "INFO",
      });

      return NextResponse.json({
        success: true,
        comparison,
        message: "Bank reference was sent to the Accountant.",
      });
    }

    if (action === "REGISTER_DEVICE") {
      const name = requiredText(body.name, "Device name");
      const serialNumber = requiredText(body.serialNumber, "Serial number");
      const rawToken = randomBytes(32).toString("hex");
      await db.accountantFingerprintDevice.upsert({
        where: {
          companyId_serialNumber: { companyId: user.companyId, serialNumber },
        },
        update: {
          name,
          locationLabel: optionalText(body.locationLabel),
          accessTokenHash: hashToken(rawToken),
          status: "ACTIVE",
          registeredById: user.id,
        },
        create: {
          companyId: user.companyId,
          name,
          serialNumber,
          locationLabel: optionalText(body.locationLabel),
          accessTokenHash: hashToken(rawToken),
          status: "ACTIVE",
          registeredById: user.id,
        },
      });
      return NextResponse.json({
        success: true,
        token: rawToken,
        message: "Device registered. Copy the token now; it is displayed only once.",
      });
    }

    if (action === "SET_DEVICE_STATUS") {
      const deviceId = requiredText(body.deviceId, "Device");
      const status = requiredText(body.status, "Device status").toUpperCase();
      if (!["ACTIVE", "INACTIVE", "BLOCKED"].includes(status)) {
        throw new Error("Device status must be ACTIVE, INACTIVE or BLOCKED.");
      }
      const device = await db.accountantFingerprintDevice.findFirst({
        where: { id: deviceId, companyId: user.companyId },
      });
      if (!device) throw new Error("Fingerprint device was not found.");

      await db.accountantFingerprintDevice.update({
        where: { id: deviceId },
        data: { status },
      });

      await notifyRoles({
        companyId: user.companyId,
        roles: ["ACCOUNTANT"],
        title: "Fingerprint device status changed",
        message: `${user.name} changed ${device.name} to ${status.toLowerCase()}.`,
        type: status === "BLOCKED" ? "WARNING" : "INFO",
      });

      return NextResponse.json({
        success: true,
        message: `${device.name} is now ${status.toLowerCase()}.`,
      });
    }

    if (action === "ENROLL_FINGERPRINT") {
      const deviceId = requiredText(body.deviceId, "Device");
      const staffId = requiredText(body.staffId, "Staff member");
      const templateKey = requiredText(body.templateKey, "Vendor template key");
      await activeStaff(user.companyId, staffId);
      const device = await db.accountantFingerprintDevice.findFirst({
        where: { id: deviceId, companyId: user.companyId, status: "ACTIVE" },
      });
      if (!device) throw new Error("Active device was not found.");

      await db.accountantFingerprintEnrollment.upsert({
        where: {
          companyId_deviceId_staffId: {
            companyId: user.companyId,
            deviceId,
            staffId,
          },
        },
        update: { templateKey, enrolledById: user.id },
        create: {
          companyId: user.companyId,
          deviceId,
          staffId,
          templateKey,
          enrolledById: user.id,
        },
      });
      return NextResponse.json({ success: true, message: "Fingerprint enrollment saved." });
    }

    return NextResponse.json(
      { success: false, message: `Unsupported action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    return jsonError(error, "Company Admin accountant bridge action failed.");
  }
}
