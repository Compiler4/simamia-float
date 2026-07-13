import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { markOperationalAttendance } from "@/lib/staff/attendance";
import { sendNotice, sendNoticeToRoles } from "@/lib/staff/notify";
import { requireStaff } from "@/lib/staff/permissions";
import { requireAssignedBroker, requireAssignedCustomer } from "@/lib/staff/scopes";
import { dateAtNoon } from "@/lib/staff/time";
import { verifyBankDeposit } from "@/lib/staff/bank";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function required(value: unknown, name: string): string {
  const result = text(value);
  if (!result) throw new Error(`REQUIRED:${name}`);
  return result;
}

function positiveAmount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("INVALID_AMOUNT");
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("INVALID_NUMBER");
  return parsed;
}

function reference(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function lockedStatus(status: string, kind: "FLOAT" | "COLLECTION" | "DEPOSIT" | "EXPENSE") {
  const values: Record<typeof kind, string[]> = {
    FLOAT: ["APPROVED", "DEPOSITED", "REJECTED"],
    COLLECTION: ["VERIFIED", "DEPOSITED", "REJECTED"],
    DEPOSIT: ["VERIFIED"],
    EXPENSE: ["APPROVED", "REJECTED"],
  };
  return values[kind].includes(status);
}

async function audit(companyId: string, userId: string, action: string, details: string) {
  await (db as any).auditLog.create({
    data: { companyId, userId, action, module: "STAFF_FLOAT_PORTAL", details },
  });
}

async function availableBalance(companyId: string, staffId: string): Promise<number> {
  const [floats, collections, deposits] = await Promise.all([
    (db as any).floatTransaction.findMany({
      where: { companyId, OR: [{ fromUserId: staffId }, { toUserId: staffId }] },
    }),
    (db as any).staffCollection.findMany({ where: { companyId, staffId } }),
    (db as any).bankDeposit.findMany({ where: { companyId, staffId } }),
  ]);
  const n = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const received = floats
    .filter((item: any) => item.transactionType === "ACCOUNTANT_TO_STAFF" && item.toUserId === staffId && ["CONFIRMED", "APPROVED", "RETURNED", "DEPOSITED"].includes(item.status))
    .reduce((sum: number, item: any) => sum + n(item.amount), 0);
  const issued = floats
    .filter((item: any) => item.transactionType === "STAFF_TO_BROKER" && item.fromUserId === staffId && item.status !== "REJECTED")
    .reduce((sum: number, item: any) => sum + n(item.amount), 0);
  const brokerReturns = floats
    .filter((item: any) => item.transactionType === "BROKER_RETURN_TO_STAFF" && item.toUserId === staffId && !["PENDING", "ISSUED", "REJECTED"].includes(item.status))
    .reduce((sum: number, item: any) => sum + n(item.returnedAmount ?? item.amount), 0);
  const collectionCash = collections.filter((item: any) => item.status !== "REJECTED").reduce((sum: number, item: any) => sum + n(item.amount), 0);
  const returned = floats
    .filter((item: any) => item.transactionType === "STAFF_RETURN_TO_ACCOUNTANT" && item.fromUserId === staffId && item.status !== "REJECTED")
    .reduce((sum: number, item: any) => sum + n(item.returnedAmount ?? item.amount), 0);
  const banked = deposits.filter((item: any) => item.status !== "DUPLICATE_DEPOSIT").reduce((sum: number, item: any) => sum + n(item.amount), 0);
  return Math.max(0, received + brokerReturns + collectionCash - issued - returned - banked);
}

async function requireOwnedFileUrl(
  companyId: string,
  userId: string,
  url: string | null,
  allowedKinds: string[],
) {
  if (!url) return null;
  const match = url.match(/^\/api\/staff\/files\/([^/?#]+)$/);
  if (!match) throw new Error("FILE_NOT_OWNED");
  const file = await (db as any).staffFile.findFirst({
    where: {
      id: match[1],
      companyId,
      ownerUserId: userId,
      kind: { in: allowedKinds },
    },
    select: { id: true },
  });
  if (!file) throw new Error("FILE_NOT_OWNED");
  return url;
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const known: Record<string, [number, string]> = {
    UNAUTHENTICATED: [401, "Please sign in."],
    FORBIDDEN: [403, "Staff access is required."],
    STAFF_COMPANY_REQUIRED: [403, "Your staff account is not attached to a company."],
    INVALID_JSON: [400, "The request body must be valid JSON."],
    INVALID_AMOUNT: [400, "Enter an amount greater than zero."],
    INVALID_NUMBER: [400, "One of the numeric values is invalid."],
    INVALID_DATE: [400, "Enter a valid date."],
    RECORD_NOT_FOUND: [404, "The selected record was not found."],
    BROKER_NOT_FOUND: [404, "The selected active broker was not found in your company."],
    BROKER_NOT_ASSIGNED: [403, "This broker is not assigned to your staff account."],
    CUSTOMER_NOT_ASSIGNED: [403, "This customer is not assigned to your staff account."],
    ACCOUNTANT_NOT_FOUND: [404, "The selected active accountant was not found in your company."],
    CUSTOMER_NOT_FOUND: [404, "The selected customer was not found in your company."],
    INSUFFICIENT_FLOAT: [409, "The amount exceeds your available float balance."],
    TRANSACTION_LOCKED: [409, "Approved, verified, rejected, or deposited records cannot be edited."],
    RECEIPT_REQUIRED: [400, "Upload the required proof or receipt before submitting."],
    FLOAT_NOT_ASSIGNED: [403, "This float was not assigned to your staff account."],
    FLOAT_NOT_RECEIVABLE: [409, "Only an issued float can be confirmed as received."],
    FINANCIAL_HOLD: [409, "A bank mismatch is unresolved. You cannot submit another bank deposit."],
    DUPLICATE_REFERENCE: [409, "This transaction reference already exists."],
    INVALID_EXPENSE_CATEGORY: [400, "Choose a valid expense category."],
    FILE_NOT_OWNED: [403, "Use a file uploaded from your own staff account."],
  };
  if (message.startsWith("REQUIRED:")) {
    return NextResponse.json({ success: false, message: `${message.split(":")[1]} is required.` }, { status: 400 });
  }
  if (known[message]) {
    return NextResponse.json({ success: false, message: known[message][1] }, { status: known[message][0] });
  }
  const code = (error as any)?.code;
  if (code === "P2002") {
    return NextResponse.json({ success: false, message: "This reference already exists." }, { status: 409 });
  }
  if (code === "P2021" || code === "P2022") {
    return NextResponse.json(
      { success: false, message: "The database is not synchronized. Run npx prisma db push and npx prisma generate.", error: `${code}: ${message}` },
      { status: 500 },
    );
  }
  console.error("[STAFF_ACTION]", error);
  return NextResponse.json({ success: false, message: `The staff transaction failed: ${message}` }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const session = await requireStaff();
    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      throw new Error("INVALID_JSON");
    }
    const action = required(body.action, "action").toUpperCase();
    const companyId = session.companyId;

    switch (action) {
      case "RECEIVE_FLOAT":
      case "CONFIRM_FLOAT_RECEIVED": {
        const transactionId = required(body.transactionId, "transactionId");
        const transaction = await (db as any).floatTransaction.findFirst({
          where: { id: transactionId, companyId },
          include: { fromUser: true },
        });
        if (!transaction) throw new Error("RECORD_NOT_FOUND");
        if (transaction.toUserId !== session.id || transaction.transactionType !== "ACCOUNTANT_TO_STAFF") throw new Error("FLOAT_NOT_ASSIGNED");
        if (transaction.status !== "ISSUED") throw new Error("FLOAT_NOT_RECEIVABLE");

        await (db as any).floatTransaction.update({
          where: { id: transaction.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });
        await markOperationalAttendance({ companyId, userId: session.id, action: "FLOAT_RECEIVED" });
        if (transaction.fromUserId) {
          await sendNotice({
            companyId,
            userId: transaction.fromUserId,
            title: "Float confirmed",
            message: `${session.name} confirmed receipt of TZS ${Number(transaction.amount).toLocaleString()}.`,
            type: "SUCCESS",
          });
        }
        await audit(companyId, session.id, "CONFIRM_FLOAT_RECEIVED", `Confirmed float ${transaction.id}`);
        return NextResponse.json({ success: true, message: "Float received and added to your available balance." });
      }

      case "ISSUE_FLOAT": {
        const brokerId = required(body.brokerId, "brokerId");
        const amount = positiveAmount(body.amount);
        const purpose = required(body.purpose, "purpose");
        const broker = await requireAssignedBroker(session, brokerId);
        if (amount > (await availableBalance(companyId, session.id))) throw new Error("INSUFFICIENT_FLOAT");
        const receiptUrl = await requireOwnedFileUrl(
          companyId, session.id, text(body.receiptUrl) || null, ["RECEIPT", "PROOF", "OTHER"],
        );

        const transaction = await (db as any).floatTransaction.create({
          data: {
            companyId,
            fromUserId: session.id,
            toUserId: broker.id,
            transactionType: "STAFF_TO_BROKER",
            referenceNo: text(body.referenceNo) || reference("SFB"),
            amount,
            purpose,
            notes: text(body.notes) || null,
            receiptUrl,
            status: "ISSUED",
            issuedAt: new Date(),
          },
        });
        await markOperationalAttendance({ companyId, userId: session.id, action: "FLOAT_ISSUED" });
        await sendNotice({
          companyId,
          userId: broker.id,
          title: "Float issued",
          message: `${session.name} issued TZS ${amount.toLocaleString()} for ${purpose}.`,
          type: "INFO",
        });
        await audit(companyId, session.id, "ISSUE_FLOAT_TO_BROKER", `Issued ${amount} to broker ${broker.id}`);
        return NextResponse.json({ success: true, message: "Float issued to the broker successfully.", transaction });
      }

      case "RECORD_COLLECTION": {
        const brokerId = required(body.brokerId, "brokerId");
        const amount = positiveAmount(body.amount);
        const collectionDate = dateAtNoon(required(body.collectionDate, "collectionDate"));
        const broker = await requireAssignedBroker(session, brokerId);
        const receiptUrl = await requireOwnedFileUrl(
          companyId, session.id, text(body.receiptUrl) || null, ["RECEIPT", "PROOF", "OTHER"],
        );

        const collection = await (db as any).staffCollection.create({
          data: {
            companyId,
            staffId: session.id,
            brokerId,
            referenceNo: text(body.referenceNo) || reference("COL"),
            amount,
            collectionDate,
            description: text(body.description) || null,
            receiptUrl,
            status: "PENDING",
          },
        });
        await markOperationalAttendance({ companyId, userId: session.id, action: "COLLECTION_RETURNED" });
        await sendNoticeToRoles({
          companyId,
          roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
          title: "Collection awaiting verification",
          message: `${session.name} recorded TZS ${amount.toLocaleString()} from ${broker.name}.`,
          type: "INFO",
        });
        await audit(companyId, session.id, "RECORD_COLLECTION", `Recorded collection ${collection.id}`);
        return NextResponse.json({ success: true, message: "Broker collection recorded and sent for verification.", collection });
      }

      case "RETURN_TO_ACCOUNTANT":
      case "RETURN_MONEY": {
        const accountantId = required(body.accountantId, "accountantId");
        const amount = positiveAmount(body.amount);
        const receiptUrl = await requireOwnedFileUrl(
          companyId, session.id, required(body.receiptUrl, "receiptUrl"), ["RECEIPT", "PROOF", "OTHER"],
        );
        const accountant = await (db as any).user.findFirst({ where: { id: accountantId, companyId, role: "ACCOUNTANT", status: "ACTIVE" } });
        if (!accountant) throw new Error("ACCOUNTANT_NOT_FOUND");
        if (amount > (await availableBalance(companyId, session.id))) throw new Error("INSUFFICIENT_FLOAT");
        const transaction = await (db as any).floatTransaction.create({
          data: {
            companyId,
            fromUserId: session.id,
            toUserId: accountant.id,
            transactionType: "STAFF_RETURN_TO_ACCOUNTANT",
            referenceNo: text(body.referenceNo) || reference("SRA"),
            amount,
            returnedAmount: amount,
            purpose: text(body.purpose) || "Afternoon float and collection return",
            notes: text(body.notes) || null,
            receiptUrl,
            status: "RETURNED",
            returnedAt: new Date(),
          },
        });
        await markOperationalAttendance({ companyId, userId: session.id, action: "COLLECTION_RETURNED" });
        await sendNotice({
          companyId,
          userId: accountant.id,
          title: "Staff return awaiting verification",
          message: `${session.name} returned TZS ${amount.toLocaleString()} with proof of payment.`,
          type: "INFO",
        });
        await audit(companyId, session.id, "RETURN_TO_ACCOUNTANT", `Returned ${amount} to accountant ${accountant.id}`);
        return NextResponse.json({ success: true, message: "Money returned to the accountant and proof recorded.", transaction });
      }

      case "DEPOSIT_TO_BANK": {
        const unresolved = await (db as any).bankDeposit.findFirst({ where: { companyId, staffId: session.id, holdActive: true } });
        if (unresolved) throw new Error("FINANCIAL_HOLD");
        const amount = positiveAmount(body.amount);
        if (amount > (await availableBalance(companyId, session.id))) throw new Error("INSUFFICIENT_FLOAT");
        const referenceNo = required(body.referenceNo, "referenceNo");
        const bankAccount = required(body.bankAccount, "bankAccount");
        const depositDate = dateAtNoon(required(body.depositDate, "depositDate"));
        const receiptUrl = await requireOwnedFileUrl(
          companyId, session.id, text(body.receiptUrl) || null, ["BANK", "RECEIPT", "PROOF", "OTHER"],
        );
        const depositSlipUrl = await requireOwnedFileUrl(
          companyId, session.id, text(body.depositSlipUrl) || null, ["BANK", "RECEIPT", "PROOF", "OTHER"],
        );

        const duplicate = await (db as any).bankDeposit.findFirst({ where: { companyId, referenceNo } });
        const deposit = await (db as any).bankDeposit.create({
          data: {
            companyId,
            staffId: session.id,
            amount,
            referenceNo,
            bankAccount,
            depositDate,
            depositSlipUrl: depositSlipUrl || receiptUrl || null,
            bankReceiptUrl: receiptUrl || null,
            status: duplicate ? "DUPLICATE_DEPOSIT" : receiptUrl ? "PENDING" : "MISSING_RECEIPT",
            holdActive: Boolean(duplicate) || !receiptUrl,
            mismatchReason: duplicate ? "Duplicate reference number" : receiptUrl ? null : "Bank receipt is missing",
          },
        });
        await markOperationalAttendance({ companyId, userId: session.id, action: "COLLECTION_RETURNED" });
        await sendNoticeToRoles({
          companyId,
          roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
          title: duplicate ? "Duplicate bank deposit" : "Bank deposit submitted",
          message: `${session.name} submitted ${referenceNo} for TZS ${amount.toLocaleString()}.`,
          type: duplicate ? "WARNING" : "INFO",
        });
        if (duplicate || !receiptUrl) await verifyBankDeposit(deposit.id, null);
        await audit(companyId, session.id, "DEPOSIT_TO_BANK", `Submitted bank deposit ${deposit.id}`);
        return NextResponse.json({
          success: true,
          message: duplicate
            ? "Deposit saved with a financial hold because the reference is duplicated."
            : receiptUrl
              ? "Bank deposit submitted for statement verification."
              : "Deposit saved, but a financial hold was applied until a receipt is uploaded.",
          deposit,
        });
      }

      case "UPLOAD_BANK_RECEIPT":
      case "UPLOAD_PROOF_OF_PAYMENT": {
        const depositId = required(body.depositId, "depositId");
        const receiptUrl = await requireOwnedFileUrl(
          companyId, session.id, required(body.receiptUrl, "receiptUrl"), ["BANK", "RECEIPT", "PROOF", "OTHER"],
        );
        const deposit = await (db as any).bankDeposit.findFirst({ where: { id: depositId, companyId, staffId: session.id } });
        if (!deposit) throw new Error("RECORD_NOT_FOUND");
        if (lockedStatus(deposit.status, "DEPOSIT")) throw new Error("TRANSACTION_LOCKED");
        await (db as any).bankDeposit.update({
          where: { id: deposit.id },
          data: { bankReceiptUrl: receiptUrl, depositSlipUrl: deposit.depositSlipUrl || receiptUrl, status: "PENDING", mismatchReason: null },
        });
        await verifyBankDeposit(deposit.id, null);
        await audit(companyId, session.id, "UPLOAD_BANK_RECEIPT", `Uploaded receipt for ${deposit.id}`);
        return NextResponse.json({ success: true, message: "Bank receipt uploaded and comparison refreshed." });
      }

      case "SUBMIT_EXPENSE": {
        const categories = new Set(["FUEL", "TRANSPORT", "AIRTIME", "ACCOMMODATION", "REPAIRS", "STATIONERY", "MEALS", "OFFICE_EXPENSES", "EMERGENCY_EXPENSES"]);
        const category = required(body.category, "category").toUpperCase();
        if (!categories.has(category)) throw new Error("INVALID_EXPENSE_CATEGORY");
        const amount = positiveAmount(body.amount);
        const description = required(body.description, "description");
        const expenseDate = dateAtNoon(required(body.expenseDate, "expenseDate"));
        const receiptUrl = await requireOwnedFileUrl(
          companyId, session.id, text(body.receiptUrl) || null, ["EXPENSE", "RECEIPT", "PROOF", "OTHER"],
        );
        const expense = await (db as any).expense.create({
          data: {
            companyId,
            employeeId: session.id,
            expenseDate,
            category,
            amount,
            description,
            receiptUrl,
            status: "PENDING",
          },
        });
        await sendNoticeToRoles({
          companyId,
          roles: ["ACCOUNTANT", "COMPANY_ADMIN"],
          title: "Expense request submitted",
          message: `${session.name} submitted ${category.replaceAll("_", " ")} for TZS ${amount.toLocaleString()}.`,
          type: "INFO",
        });
        await audit(companyId, session.id, "SUBMIT_EXPENSE", `Submitted expense ${expense.id}`);
        return NextResponse.json({ success: true, message: "Expense request submitted for approval.", expense });
      }

      case "RECORD_SERVICE_VISIT": {
        const brokerId = text(body.brokerId) || null;
        const customerId = text(body.customerId) || null;
        if (!brokerId && !customerId) throw new Error("REQUIRED:broker or customer");
        if (brokerId) {
          await requireAssignedBroker(session, brokerId);
        }
        if (customerId) {
          await requireAssignedCustomer(session, customerId);
        }
        const activity = await (db as any).serviceActivity.create({
          data: {
            companyId,
            staffId: session.id,
            brokerId,
            customerId,
            serviceType: required(body.serviceType, "serviceType"),
            amount: optionalNumber(body.amount) || 0,
            status: "COMPLETED",
            servedAt: new Date(),
            latitude: optionalNumber(body.latitude),
            longitude: optionalNumber(body.longitude),
            locationName: text(body.locationName) || null,
            notes: text(body.notes) || null,
          },
        });
        await audit(companyId, session.id, "RECORD_SERVICE_VISIT", `Recorded visit ${activity.id}`);
        return NextResponse.json({ success: true, message: "Broker or customer visit recorded.", activity });
      }

      case "MARK_NOTIFICATION_READ": {
        const notificationId = required(body.notificationId, "notificationId");
        const notification = await (db as any).notification.findFirst({ where: { id: notificationId, companyId, userId: session.id } });
        if (!notification) throw new Error("RECORD_NOT_FOUND");
        await (db as any).notification.update({ where: { id: notification.id }, data: { isRead: true } });
        return NextResponse.json({ success: true, message: "Notification marked as read." });
      }

      case "MARK_ALL_NOTIFICATIONS_READ": {
        await (db as any).notification.updateMany({ where: { companyId, userId: session.id, isRead: false }, data: { isRead: true } });
        return NextResponse.json({ success: true, message: "All notifications marked as read." });
      }

      case "UPDATE_PROFILE": {
        const profileImageUrl = await requireOwnedFileUrl(
          companyId, session.id, required(body.profileImageUrl, "profileImageUrl"), ["PROFILE"],
        );
        await (db as any).user.update({ where: { id: session.id }, data: { profileImageUrl } });
        await audit(companyId, session.id, "UPDATE_PROFILE_IMAGE", "Updated staff profile image");
        return NextResponse.json({ success: true, message: "Profile image updated." });
      }

      default:
        return NextResponse.json({ success: false, message: `Unsupported staff action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return apiError(error);
  }
}
