import { createHash, timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  calendarDateInDar,
  currentHourInDar,
  darDate,
} from "@/lib/accountant/date-range";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  try {
    const a = Buffer.from(left, "hex");
    const b = Buffer.from(right, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function overallStatus(morning: string | null, evening: string | null) {
  if (!morning && !evening) return "NOT_MARKED";
  if (!morning || !evening) return "PARTIAL";
  const presentLike = (value: string) => value === "PRESENT" || value === "LATE";
  if (presentLike(morning) && presentLike(evening)) return "PRESENT";
  if (morning === "ABSENT" && evening === "ABSENT") return "ABSENT";
  return "MIXED";
}

export async function POST(request: NextRequest) {
  try {
    const deviceKey = String(request.headers.get("x-device-key") ?? "").trim();
    if (!deviceKey) return NextResponse.json({ success: false, message: "Missing x-device-key." }, { status: 401 });

    const body = await request.json();
    const serialNumber = String(body.serialNumber ?? "").trim();
    const externalUserCode = String(body.externalUserCode ?? "").trim();
    if (!serialNumber || !externalUserCode) throw new Error("serialNumber and externalUserCode are required.");

    const device = await prisma.accountantFingerprintDevice.findFirst({
      where: { serialNumber, status: "ACTIVE" },
    });
    const storedHash = device?.secretHash ?? device?.accessTokenHash ?? "";
    if (!device || !storedHash || !safeEqualHex(hashSecret(deviceKey), storedHash)) {
      return NextResponse.json({ success: false, message: "The fingerprint device is not authorised." }, { status: 401 });
    }

    const enrolment = await prisma.accountantFingerprintEnrollment.findFirst({
      where: { deviceId: device.id, externalUserCode, active: true },
    });
    if (!enrolment) throw new Error("The fingerprint user code is not enrolled on this device.");
    const enrolledUserId = enrolment.userId ?? enrolment.staffId;
    if (!enrolledUserId) throw new Error("The fingerprint enrolment is not linked to a staff account.");

    const idCandidates: Array<string | number> = /^\d+$/.test(enrolledUserId)
      ? [Number(enrolledUserId), enrolledUserId]
      : [enrolledUserId];
    const companyCandidates: Array<string | number> = /^\d+$/.test(device.companyId)
      ? [Number(device.companyId), device.companyId]
      : [device.companyId];
    let staff: any = null;
    for (const companyCandidate of companyCandidates) {
      for (const idCandidate of idCandidates) {
        try {
          staff = await prisma.user.findFirst({
            where: { id: idCandidate, companyId: companyCandidate, role: "STAFF" } as any,
            select: { id: true, name: true, username: true, email: true, role: true },
          } as any);
          if (staff) break;
        } catch {
          // Retry using the alternate Int/String ID representation.
        }
      }
      if (staff) break;
    }
    if (!staff) throw new Error("The enrolled account is not a STAFF account in this company.");

    const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new Error("occurredAt is invalid.");
    const dateText = calendarDateInDar(occurredAt);
    const date = darDate(dateText);
    const requestedSession = String(body.session ?? "AUTO").toUpperCase();
    const session = requestedSession === "MORNING" || requestedSession === "EVENING"
      ? requestedSession
      : currentHourInDar(occurredAt) < 13 ? "MORNING" : "EVENING";

    const existing = await prisma.accountantAttendance.findUnique({
      where: { companyId_userId_date: { companyId: device.companyId, userId: enrolledUserId, date } },
    });
    const morningStatus = session === "MORNING" ? "PRESENT" : existing?.morningStatus ?? null;
    const eveningStatus = session === "EVENING" ? "PRESENT" : existing?.eveningStatus ?? null;

    await prisma.$transaction(async (tx: any) => {
      await tx.accountantAttendance.upsert({
        where: { companyId_userId_date: { companyId: device.companyId, userId: enrolledUserId, date } },
        update: {
          ...(session === "MORNING"
            ? { morningStatus: "PRESENT", morningSource: "FINGERPRINT", checkInAt: occurredAt }
            : { eveningStatus: "PRESENT", eveningSource: "FINGERPRINT", checkOutAt: occurredAt }),
          markedById: `DEVICE:${device.id}`,
          overallStatus: overallStatus(morningStatus, eveningStatus),
        },
        create: {
          companyId: device.companyId,
          userId: enrolledUserId,
          date,
          morningStatus,
          eveningStatus,
          morningSource: session === "MORNING" ? "FINGERPRINT" : null,
          eveningSource: session === "EVENING" ? "FINGERPRINT" : null,
          checkInAt: session === "MORNING" ? occurredAt : null,
          checkOutAt: session === "EVENING" ? occurredAt : null,
          markedById: `DEVICE:${device.id}`,
          overallStatus: overallStatus(morningStatus, eveningStatus),
        },
      });
      await tx.accountantFingerprintDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      await createNotification(tx, {
        companyId: device.companyId,
        roleTarget: "ACCOUNTANT",
        title: "Fingerprint attendance received",
        message: `${(staff as any).name ?? (staff as any).username ?? "STAFF user"} recorded the ${session.toLowerCase()} session on ${device.name}.`,
        type: "INFO",
      });
    });

    return NextResponse.json({ success: true, message: `${session} attendance recorded.`, date: dateText, userId: enrolledUserId });
  } catch (error) {
    console.error("[FINGERPRINT PUNCH]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Fingerprint punch failed." },
      { status: 400 },
    );
  }
}
