import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createNotification,
  requireCompanyMember,
  routeError,
} from "@/lib/company-admin-server";

export async function POST() {
  try {
    const user = await requireCompanyMember([
      "COMPANY_ADMIN",
      "ACCOUNTANT",
      "STAFF",
      "GPS_MANAGER",
    ]);
    const companyId = user.companyId as string;
    const db = prisma as any;

    const overdue = await db.brokerServiceVisit.findMany({
      where: {
        companyId,
        status: "PROOF_PENDING",
        proofUrl: null,
        serviceProvidedAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
      include: { staff: true, brokerCustomer: true },
      take: 100,
    });

    for (const visit of overdue) {
      await db.brokerServiceVisit.update({
        where: { id: visit.id },
        data: { status: "LATE_PROOF" },
      });

      const location =
        visit.staffLatitude == null
          ? "current location unavailable"
          : `${Number(visit.staffLatitude).toFixed(5)}, ${Number(
              visit.staffLongitude,
            ).toFixed(5)}`;

      await createNotification({
        companyId,
        targetRole: "COMPANY_ADMIN",
        title: "Service proof overdue",
        message: `${visit.staff.name} has not uploaded proof for ${visit.brokerCustomer.name} within the required time. Current recorded location: ${location}. Required: date/time, reference, sender, receiver and amount.`,
        type: "ERROR",
        link: "/admin/dashboard?section=gps",
      });

      await createNotification({
        companyId,
        targetUserId: visit.staffId,
        title: "Your service proof is overdue",
        message: `Upload proof for ${visit.brokerCustomer.name} immediately.`,
        type: "ERROR",
        link: "/dashboard",
      });
    }

    return NextResponse.json({ success: true, overdue: overdue.length });
  } catch (error) {
    return routeError(error);
  }
}
