import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const body = await request.json();
    const db = prisma as any;

    const name = text(body.name).trim();
    const code = text(body.code).trim();

    if (!name || !code) {
      throw new HttpError("Branch name and code are required.", 422);
    }

    const branch = await db.branch.create({
      data: {
        companyId,
        name,
        code,
        region: text(body.region).trim() || null,
        address: text(body.address).trim() || null,
        status: text(body.status) || "ACTIVE",
      },
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "CREATE_BRANCH",
      module: "BRANCHES",
      details: `Created branch ${name}.`,
    });

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    return routeError(error);
  }
}
