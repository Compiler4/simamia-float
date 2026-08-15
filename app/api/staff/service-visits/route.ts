import { NextResponse } from "next/server";

import { requireStaffSession } from "@/lib/staff/require-staff";
import { getServiceVisitDiagnostics } from "@/lib/staff/service-visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await requireStaffSession();
    const diagnostics = await getServiceVisitDiagnostics();
    const healthy =
      diagnostics.visitTable &&
      diagnostics.brokerTable &&
      diagnostics.missingRequiredVisitColumns.length === 0;

    return NextResponse.json({
      success: true,
      healthy,
      staff: {
        id: session.id,
        companyId: session.companyId,
      },
      diagnostics,
      recommendation: healthy
        ? "The primary broker visit store is ready."
        : "Run npx prisma db push and npx prisma generate, then clear .next.",
    });
  } catch (error) {
    console.error("[SERVICE_VISIT_DIAGNOSTICS]", error);
    return NextResponse.json(
      {
        success: false,
        message: "Service-visit diagnostics could not run.",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 },
    );
  }
}
