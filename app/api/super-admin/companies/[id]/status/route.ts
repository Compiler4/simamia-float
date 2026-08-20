import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "You are not logged in." }, { status: 401 });
    if (user.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, message: "Only Super Admin can change company status." }, { status: 403 });

    const { id } = await context.params;
    const body = await request.json();
    const status = String(body.status ?? "").trim().toUpperCase();
    if (!["ACTIVE", "SUSPENDED", "DISABLED"].includes(status)) {
      return NextResponse.json({ success: false, message: "Status must be ACTIVE, SUSPENDED or DISABLED." }, { status: 422 });
    }

    const company = await prisma.$transaction(async (tx) => {
      const updated = await tx.company.update({
        where: { id },
        data: { status: status as "ACTIVE" | "SUSPENDED" | "DISABLED" },
      });
      if (status !== "ACTIVE") {
        await tx.user.updateMany({
          where: { companyId: id, status: "ACTIVE" },
          data: { status: "SUSPENDED" },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          companyId: id,
          action: `COMPANY_${status}`,
          module: "COMPANY",
          details: `${user.name} changed ${updated.name} status to ${status}.`,
        },
      });
      return updated;
    });

    return NextResponse.json({ success: true, message: `Company status changed to ${status}.`, company });
  } catch (error) {
    console.error("SUPER_ADMIN_COMPANY_STATUS_ERROR", error);
    return NextResponse.json({ success: false, message: "Failed to update company status." }, { status: 500 });
  }
}
