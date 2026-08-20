import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const text = clean(value).toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "on"].includes(text);
}

function asDate(value: unknown): Date | null {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, message: "You are not logged in." },
        { status: 401 },
      ),
    };
  }
  if (user.role !== "SUPER_ADMIN") {
    return {
      user,
      response: NextResponse.json(
        { success: false, message: "Only Super Admin can manage subscriptions." },
        { status: 403 },
      ),
    };
  }
  return { user, response: null };
}

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response) return auth.response;

    const subscriptions = await prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: {
          select: { id: true, name: true, code: true, status: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        amount: Number(subscription.amount),
      })),
    });
  } catch (error) {
    console.error("SUPER_ADMIN_SUBSCRIPTIONS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to load subscriptions." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;

    const body = await request.json();
    const companyId = clean(body.companyId);
    const plan = clean(body.plan);
    const amountText = clean(body.amount) || "0";
    const amount = Number(amountText);
    const startsAt = asDate(body.startsAt);
    const endsAt = asDate(body.endsAt);
    const isActive = asBoolean(body.isActive, true);

    if (!companyId || !plan || !startsAt || !endsAt) {
      return NextResponse.json(
        {
          success: false,
          message: "Company, plan, start date and end date are required.",
        },
        { status: 422 },
      );
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { success: false, message: "Subscription amount must be a valid non-negative number." },
        { status: 422 },
      );
    }

    if (endsAt <= startsAt) {
      return NextResponse.json(
        { success: false, message: "Subscription end date must be after the start date." },
        { status: 422 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, status: true },
    });

    if (!company) {
      return NextResponse.json(
        { success: false, message: "The selected company was not found." },
        { status: 404 },
      );
    }

    const subscription = await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.subscription.updateMany({
          where: { companyId, isActive: true },
          data: { isActive: false },
        });
      }

      const created = await tx.subscription.create({
        data: {
          companyId,
          plan,
          amount: amountText,
          startsAt,
          endsAt,
          isActive,
        },
        include: {
          company: {
            select: { id: true, name: true, code: true, status: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId,
          action: "SUBSCRIPTION_CREATED",
          module: "SUBSCRIPTION",
          details: `${auth.user!.name} created ${plan} subscription for ${company.name}.`,
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Subscription created successfully.",
        subscription: { ...subscription, amount: Number(subscription.amount) },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("SUPER_ADMIN_SUBSCRIPTION_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to create subscription." },
      { status: 500 },
    );
  }
}
