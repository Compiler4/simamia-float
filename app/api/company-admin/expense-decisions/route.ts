import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  asPortalError,
  requirePortalRole,
} from "@/lib/accountant-control/auth";
import { recordExpenseDecision } from "@/lib/accountant-control/expense-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePortalRole(["COMPANY_ADMIN"]);
    const body = await request.json();
    const result = await recordExpenseDecision(prisma as any, admin, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const mapped = asPortalError(error);
    return NextResponse.json({ success: false, message: mapped.message }, { status: mapped.status });
  }
}
