import { createHash, randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { recalculateExpenseDecision } from "@/lib/accountant-v3/expense-workflow";
import { syncExistingOperationalRecords } from "@/lib/accountant-v3/existing-record-sync";
import { requireAccountant } from "@/lib/accountant-v3/guard";
import {
  jsonError,
  optionalText,
  positiveAmount,
  requiredText,
} from "@/lib/accountant-v3/http";
import { syncLegacyAttendance } from "@/lib/accountant-v3/legacy-attendance";
import { notifyRoles, notifyUser } from "@/lib/accountant-v3/notifications";
import { buildAccountantControlCenterData } from "@/lib/accountant-v3/report-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function localAttendanceDate(value: unknown) {
  const key = requiredText(value, "Attendance date");
  const parsed = new Date(`${key}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Attendance date is invalid.");
  return parsed;
}

function localDayKey(value: unknown) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

async function requireActiveStaff(companyId: string, staffId: string) {
  const db = prisma as any;
  const staff = await db.user.findFirst({
    where: {
      id: staffId,
      companyId,
      role: "STAFF",
      status: "ACTIVE",
    },
  });

  if (!staff) throw new Error("The selected user is not an active STAFF user in this company.");
  return staff;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAccountant();
    await syncExistingOperationalRecords(user.companyId);
    const result = await buildAccountantControlCenterData(
      user,
      request.nextUrl.searchParams,
    );
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error, "The accountant control center could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAccountant();
    const db = prisma as any;
    const body = await request.json();
    const action = requiredText(body.action, "Action").toUpperCase();

    if (action === "SAVE_ATTENDANCE") {
      const staffId = requiredText(body.staffId, "Staff member");
      const staff = await requireActiveStaff(user.companyId, staffId);
      const attendanceDate = localAttendanceDate(body.date);
      const session = requiredText(body.session, "Attendance session").toUpperCase();
      const mark = requiredText(body.mark, "Attendance mark").toUpperCase();

      if (!["MORNING", "EVENING"].includes(session)) {
        throw new Error("Attendance session must be MORNING or EVENING.");
      }
      if (!["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(mark)) {
        throw new Error("Attendance mark must be PRESENT, ABSENT, LATE or EXCUSED.");
      }

      await db.accountantAttendanceSessionRecord.upsert({
        where: {
          companyId_staffId_attendanceDate_session: {
            companyId: user.companyId,
            staffId,
            attendanceDate,
            session,
          },
        },
        update: {
          mark,
          source: "ACCOUNTANT_MANUAL",
          checkedAt: new Date(),
          checkedById: user.id,
          deviceId: null,
          note: optionalText(body.note),
        },
        create: {
          companyId: user.companyId,
          staffId,
          attendanceDate,
          session,
          mark,
          source: "ACCOUNTANT_MANUAL",
          checkedAt: new Date(),
          checkedById: user.id,
          note: optionalText(body.note),
        },
      });

      await syncLegacyAttendance({
        companyId: user.companyId,
        staffId,
        attendanceDate,
        checkedById: user.id,
      });

      await notifyUser({
        companyId: user.companyId,
        userId: staffId,
        title: `${session.toLowerCase()} attendance recorded`,
        message: `${user.name} marked your ${session.toLowerCase()} attendance as ${mark.toLowerCase()}.`,
        type: mark === "ABSENT" ? "WARNING" : "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        message: `${staff.name ?? staff.email}'s ${session.toLowerCase()} attendance was saved.`,
      });
    }

    if (action === "BULK_ATTENDANCE") {
      const date = localAttendanceDate(body.date);
      const session = requiredText(body.session, "Attendance session").toUpperCase();
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!["MORNING", "EVENING"].includes(session)) {
        throw new Error("Attendance session must be MORNING or EVENING.");
      }
      if (!rows.length) throw new Error("At least one attendance row is required.");

      let saved = 0;
      for (const row of rows) {
        const staffId = requiredText(row.staffId, "Staff member");
        await requireActiveStaff(user.companyId, staffId);
        const mark = requiredText(row.mark, "Attendance mark").toUpperCase();
        if (!["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(mark)) continue;

        await db.accountantAttendanceSessionRecord.upsert({
          where: {
            companyId_staffId_attendanceDate_session: {
              companyId: user.companyId,
              staffId,
              attendanceDate: date,
              session,
            },
          },
          update: {
            mark,
            source: "ACCOUNTANT_MANUAL",
            checkedAt: new Date(),
            checkedById: user.id,
            note: optionalText(row.note),
          },
          create: {
            companyId: user.companyId,
            staffId,
            attendanceDate: date,
            session,
            mark,
            source: "ACCOUNTANT_MANUAL",
            checkedAt: new Date(),
            checkedById: user.id,
            note: optionalText(row.note),
          },
        });

        await syncLegacyAttendance({
          companyId: user.companyId,
          staffId,
          attendanceDate: date,
          checkedById: user.id,
        });
        saved += 1;
      }

      return NextResponse.json({
        success: true,
        message: `${saved} ${session.toLowerCase()} attendance records were saved.`,
      });
    }

    if (action === "ADD_STAFF_MONEY") {
      const staffId = requiredText(body.staffId, "Staff member");
      const staff = await requireActiveStaff(user.companyId, staffId);
      const kind = requiredText(body.kind, "Money type").toUpperCase();
      const direction = requiredText(body.direction, "Direction").toUpperCase();
      const amount = positiveAmount(body.amount);

      if (!["FLOAT", "CASH"].includes(kind)) {
        throw new Error("Money type must be FLOAT or CASH.");
      }
      if (!["ALLOCATE", "RECEIVE", "RETURN", "ADJUSTMENT"].includes(direction)) {
        throw new Error("Direction must be ALLOCATE, RECEIVE, RETURN or ADJUSTMENT.");
      }

      await db.accountantStaffMoneyEntry.create({
        data: {
          companyId: user.companyId,
          staffId,
          kind,
          direction,
          amount,
          reference: optionalText(body.reference),
          note: optionalText(body.note),
          enteredById: user.id,
          occurredAt: body.occurredAt ? new Date(String(body.occurredAt)) : new Date(),
        },
      });

      await notifyUser({
        companyId: user.companyId,
        userId: staffId,
        title: `${kind.toLowerCase()} entry posted`,
        message: `${direction.toLowerCase()} entry of TZS ${amount.toLocaleString("en-GB")} was posted to your staff cashflow.`,
        type: "INFO",
      });

      return NextResponse.json({
        success: true,
        message: `${kind} ${direction.toLowerCase()} was posted for ${staff.name ?? staff.email}.`,
      });
    }

    if (action === "DECIDE_EXPENSE") {
      const expenseId = requiredText(body.expenseId, "Expense");
      const decision = requiredText(body.decision, "Decision").toUpperCase();
      if (!["APPROVE", "REJECT"].includes(decision)) {
        throw new Error("Decision must be APPROVE or REJECT.");
      }
      if (decision === "REJECT" && !optionalText(body.reason)) {
        throw new Error("A rejection reason is required.");
      }

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
      await requireActiveStaff(user.companyId, expenseStaffId);

      await db.accountantExpenseDecision.upsert({
        where: {
          companyId_expenseId_actorRole: {
            companyId: user.companyId,
            expenseId,
            actorRole: "ACCOUNTANT",
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
          actorRole: "ACCOUNTANT",
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
        roles: ["COMPANY_ADMIN"],
        title: "Accountant expense decision",
        message: `${user.name} ${decision.toLowerCase()}d a staff expense. Final status: ${result.finalStatus}.`,
        type: decision === "APPROVE" ? "INFO" : "WARNING",
      });

      return NextResponse.json({
        success: true,
        finalStatus: result.finalStatus,
        message:
          result.finalStatus === "PENDING"
            ? "Accountant decision saved. The Company Admin decision is still required."
            : `Expense is now ${result.finalStatus.toLowerCase()}.`,
      });
    }

    if (action === "DECIDE_VERIFICATION") {
      const packetId = requiredText(body.packetId, "Verification packet");
      const decision = requiredText(body.decision, "Decision").toUpperCase();
      if (!["VERIFIED", "REJECTED"].includes(decision)) {
        throw new Error("Decision must be VERIFIED or REJECTED.");
      }
      if (decision === "REJECTED" && !optionalText(body.reason)) {
        throw new Error("A rejection reason is required.");
      }

      const packet = await db.accountantVerificationPacket.findFirst({
        where: { id: packetId, companyId: user.companyId },
      });
      if (!packet) throw new Error("Verification packet was not found.");
      if (!packet.adminReferenceUrl && !packet.adminReferenceMessage) {
        throw new Error("The Company Admin must send a reference file or message before accountant verification.");
      }

      await db.accountantVerificationPacket.update({
        where: { id: packetId },
        data: {
          status: decision,
          accountantDecisionById: user.id,
          decisionReason: optionalText(body.reason),
          decidedAt: new Date(),
        },
      });

      await notifyUser({
        companyId: user.companyId,
        userId: String(packet.staffId),
        title: `Uploaded ${String(packet.kind).toLowerCase()} ${decision.toLowerCase()}`,
        message:
          decision === "VERIFIED"
            ? "Your uploaded proof was verified against the Company Admin reference."
            : `Your uploaded proof was rejected. Reason: ${optionalText(body.reason) ?? "Not supplied"}`,
        type: decision === "VERIFIED" ? "SUCCESS" : "ERROR",
      });

      return NextResponse.json({
        success: true,
        message: `Verification packet was ${decision.toLowerCase()}.`,
      });
    }

    if (action === "DECIDE_BANK_COMPARISON") {
      const comparisonId = requiredText(body.comparisonId, "Bank comparison");
      const decision = requiredText(body.decision, "Decision").toUpperCase();
      if (!["APPROVE", "REJECT"].includes(decision)) {
        throw new Error("Decision must be APPROVE or REJECT.");
      }
      if (decision === "REJECT" && !optionalText(body.reason)) {
        throw new Error("A mismatch or rejection reason is required.");
      }

      const comparison = await db.accountantBankComparison.findFirst({
        where: { id: comparisonId, companyId: user.companyId },
      });
      if (!comparison) throw new Error("Bank comparison was not found.");
      if (!comparison.adminFileUrl && !comparison.adminReference) {
        throw new Error("The Company Admin bank reference is required before verification.");
      }

      const valuesMatch =
        Number(comparison.staffAmount ?? 0) === Number(comparison.adminAmount ?? 0) &&
        Number(comparison.adminAmount ?? 0) > 0 &&
        String(comparison.staffReference ?? "").trim().toLowerCase() ===
          String(comparison.adminReference ?? "").trim().toLowerCase() &&
        Boolean(String(comparison.adminReference ?? "").trim()) &&
        String(comparison.staffBankAccount ?? "").trim().toLowerCase() ===
          String(comparison.adminBankAccount ?? "").trim().toLowerCase() &&
        Boolean(String(comparison.adminBankAccount ?? "").trim()) &&
        localDayKey(comparison.staffDate) === localDayKey(comparison.adminDate) &&
        Boolean(localDayKey(comparison.adminDate));

      if (decision === "APPROVE" && !valuesMatch) {
        throw new Error(
          "Amount, reference, bank account or transaction date does not match the Company Admin record.",
        );
      }

      await db.accountantBankComparison.update({
        where: { id: comparisonId },
        data: {
          accountantDecision: decision,
          mismatchReason: optionalText(body.reason),
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });

      await notifyUser({
        companyId: user.companyId,
        userId: String(comparison.staffId),
        title: `Bank reconciliation ${decision === "APPROVE" ? "verified" : "rejected"}`,
        message:
          decision === "APPROVE"
            ? "Your bank proof matched the Company Admin reference and was verified."
            : `Your bank proof was rejected. Reason: ${optionalText(body.reason) ?? "Mismatch"}`,
        type: decision === "APPROVE" ? "SUCCESS" : "ERROR",
      });

      return NextResponse.json({
        success: true,
        message: `Bank comparison was ${decision === "APPROVE" ? "verified" : "rejected"}.`,
      });
    }

    if (action === "REGISTER_DEVICE") {
      const name = requiredText(body.name, "Device name");
      const serialNumber = requiredText(body.serialNumber, "Serial number");
      const rawToken = randomBytes(32).toString("hex");

      await db.accountantFingerprintDevice.upsert({
        where: {
          companyId_serialNumber: {
            companyId: user.companyId,
            serialNumber,
          },
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
        message: "Fingerprint device registered. Copy the gateway token now; it is shown only once.",
      });
    }

    if (action === "ENROLL_FINGERPRINT") {
      const deviceId = requiredText(body.deviceId, "Fingerprint device");
      const staffId = requiredText(body.staffId, "Staff member");
      const templateKey = requiredText(body.templateKey, "Vendor template key");
      await requireActiveStaff(user.companyId, staffId);

      const device = await db.accountantFingerprintDevice.findFirst({
        where: { id: deviceId, companyId: user.companyId, status: "ACTIVE" },
      });
      if (!device) throw new Error("Active fingerprint device was not found.");

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

      return NextResponse.json({
        success: true,
        message: "Staff fingerprint template reference was enrolled.",
      });
    }

    if (action === "SET_DEVICE_STATUS") {
      const deviceId = requiredText(body.deviceId, "Fingerprint device");
      const status = requiredText(body.status, "Device status").toUpperCase();
      if (!["ACTIVE", "INACTIVE", "BLOCKED"].includes(status)) {
        throw new Error("Device status must be ACTIVE, INACTIVE or BLOCKED.");
      }
      await db.accountantFingerprintDevice.updateMany({
        where: { id: deviceId, companyId: user.companyId },
        data: { status },
      });
      return NextResponse.json({ success: true, message: `Device is now ${status.toLowerCase()}.` });
    }

    if (action === "SAVE_REPORT_SNAPSHOT") {
      const reportName = requiredText(body.reportName, "Report name");
      const filters = body.filters && typeof body.filters === "object" ? body.filters : {};
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      await db.accountantReportSnapshot.create({
        data: {
          companyId: user.companyId,
          createdById: user.id,
          reportName,
          periodLabel: requiredText(body.periodLabel, "Period label"),
          filtersJson: filters,
          payloadJson: payload,
        },
      });
      return NextResponse.json({ success: true, message: "Report snapshot was saved." });
    }

    if (action === "MARK_NOTIFICATION_READ") {
      const notificationId = requiredText(body.notificationId, "Notification");
      if (typeof db.notification?.updateMany === "function") {
        await db.notification.updateMany({
          where: {
            id: notificationId,
            companyId: user.companyId,
            userId: user.id,
          },
          data: { isRead: true },
        });
      }
      return NextResponse.json({ success: true, message: "Notification marked as read." });
    }

    if (action === "MARK_ALL_NOTIFICATIONS_READ") {
      if (typeof db.notification?.updateMany === "function") {
        await db.notification.updateMany({
          where: { companyId: user.companyId, userId: user.id, isRead: false },
          data: { isRead: true },
        });
      }
      return NextResponse.json({ success: true, message: "All notifications were marked as read." });
    }

    await notifyRoles({
      companyId: user.companyId,
      roles: ["COMPANY_ADMIN"],
      title: "Unknown accountant action blocked",
      message: `${user.name} attempted unsupported accountant action ${action}.`,
      type: "WARNING",
    });
    return NextResponse.json(
      { success: false, message: `Unsupported action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    return jsonError(error, "The accountant action could not be completed.");
  }
}
