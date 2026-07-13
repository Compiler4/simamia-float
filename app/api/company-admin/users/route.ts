import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const allowedRoles = [
  "COMPANY_ADMIN",
  "ACCOUNTANT",
  "STAFF",
  "BROKER",
  "GPS_MANAGER",
];

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await requireCompanyAdmin();
    const companyId = sessionUser.companyId as string;
    const body = await request.json();
    const db = prisma as any;

    const name = text(body.name).trim();
    const username = text(body.username).trim();
    const email = text(body.email).trim().toLowerCase();
    const password = text(body.password);
    const role = text(body.role);
    const phone = text(body.phone).trim();

    if (!name || !username || !email || !password) {
      throw new HttpError(
        "Name, username, email and password are required.",
        422,
      );
    }

    if (!allowedRoles.includes(role)) {
      throw new HttpError("Invalid company user role.", 422);
    }

    const existing = await db.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      throw new HttpError("Email or username is already in use.", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const created = await db.user.create({
      data: {
        name,
        username,
        email,
        phone: phone || null,
        password: hashedPassword,
        role,
        status: text(body.status) || "ACTIVE",
        companyId,
        branchId: text(body.branchId) || null,
      },
    });

    await createAudit({
      companyId,
      actorId: sessionUser.id,
      actorName: sessionUser.name,
      actorRole: sessionUser.role,
      action: "CREATE_USER",
      module: "USERS",
      details: `Created ${name} with role ${role}.`,
    });

    return NextResponse.json({
      success: true,
      user: {
        ...created,
        password: undefined,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
