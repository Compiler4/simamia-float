import { prisma } from "@/lib/prisma";

const VALID_MARKS = new Set(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);

/**
 * Keeps the pre-existing Attendance table aligned with the new morning/evening
 * register. The V3 workflow remains the source of truth for session detail.
 *
 * This helper intentionally uses the dynamic Prisma delegate so the package can
 * be merged into projects whose legacy Attendance model has small differences.
 * A legacy-sync failure is logged but never rolls back the verified V3 record.
 */
export async function syncLegacyAttendance(input: {
  companyId: string;
  staffId: string;
  attendanceDate: Date;
  checkedById: string;
}) {
  const db = prisma as any;

  if (
    typeof db.attendance?.findFirst !== "function" ||
    typeof db.accountantAttendanceSessionRecord?.findMany !== "function"
  ) {
    return;
  }

  try {
    const sessions = await db.accountantAttendanceSessionRecord.findMany({
      where: {
        companyId: input.companyId,
        staffId: input.staffId,
        attendanceDate: input.attendanceDate,
      },
      orderBy: { session: "asc" },
    });

    if (!sessions.length) return;

    const morning = sessions.find((item: any) => item.session === "MORNING");
    const evening = sessions.find((item: any) => item.session === "EVENING");
    const marks = sessions
      .map((item: any) => String(item.mark ?? "").toUpperCase())
      .filter((mark: string) => VALID_MARKS.has(mark));

    const status =
      marks.length > 0 && marks.every((mark: string) => mark === "ABSENT")
        ? "ABSENT"
        : marks.includes("LATE")
          ? "LATE"
          : marks.includes("PRESENT")
            ? "PRESENT"
            : "EXCUSED";

    const existing = await db.attendance.findFirst({
      where: {
        companyId: input.companyId,
        userId: input.staffId,
        date: input.attendanceDate,
      },
    });

    const baseData: Record<string, unknown> = {
      status,
      checkInAt: morning?.checkedAt ?? existing?.checkInAt ?? null,
      checkOutAt: evening?.checkedAt ?? existing?.checkOutAt ?? null,
      notes: [
        "Verified by Accountant Control Center V3.",
        morning ? `Morning: ${String(morning.mark).toLowerCase()}.` : "Morning: not marked.",
        evening ? `Evening: ${String(evening.mark).toLowerCase()}.` : "Evening: not marked.",
      ].join(" "),
    };

    if (existing) {
      const updateData = {
        ...baseData,
        ...(Object.prototype.hasOwnProperty.call(existing, "source")
          ? { source: existing.source || "MANUAL" }
          : {}),
      };

      await db.attendance.update({
        where: { id: existing.id },
        data: updateData,
      });
      return;
    }

    const createVariants: Array<Record<string, unknown>> = [
      {
        companyId: input.companyId,
        userId: input.staffId,
        date: input.attendanceDate,
        source: "MANUAL",
        markedById: input.checkedById,
        ...baseData,
      },
      {
        companyId: input.companyId,
        userId: input.staffId,
        date: input.attendanceDate,
        source: "MANUAL",
        ...baseData,
      },
      {
        companyId: input.companyId,
        userId: input.staffId,
        date: input.attendanceDate,
        ...baseData,
      },
    ];

    let lastError: unknown = null;
    for (const data of createVariants) {
      try {
        await db.attendance.create({ data });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  } catch (error) {
    console.error("ACCOUNTANT_V3_LEGACY_ATTENDANCE_SYNC_FAILED", {
      companyId: input.companyId,
      staffId: input.staffId,
      attendanceDate: input.attendanceDate.toISOString(),
      error,
    });
  }
}
