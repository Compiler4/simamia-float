import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDate(value: unknown): Date | null {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ success: false, message: "You are not logged in." }, { status: 401 }) };
  }
  if (user.role !== "SUPER_ADMIN") {
    return { user, response: NextResponse.json({ success: false, message: "Only Super Admin can manage subscriptions." }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;
    const { id } = await context.params;

    const existing = await prisma.subscription.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Subscription was not found." }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.companyId !== undefined) {
      const companyId = clean(body.companyId);
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) return NextResponse.json({ success: false, message: "Selected company was not found." }, { status: 404 });
      data.companyId = companyId;
    }
    if (body.plan !== undefined) {
      const plan = clean(body.plan);
      if (!plan) return NextResponse.json({ success: false, message: "Plan cannot be empty." }, { status: 422 });
      data.plan = plan;
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ success: false, message: "Amount must be a valid non-negative number." }, { status: 422 });
      data.amount = String(amount);
    }
    if (body.startsAt !== undefined) {
      const startsAt = parseDate(body.startsAt);
      if (!startsAt) return NextResponse.json({ success: false, message: "Start date is invalid." }, { status: 422 });
      data.startsAt = startsAt;
    }
    if (body.endsAt !== undefined) {
      const endsAt = parseDate(body.endsAt);
      if (!endsAt) return NextResponse.json({ success: false, message: "End date is invalid." }, { status: 422 });
      data.endsAt = endsAt;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const finalStartsAt = (data.startsAt as Date | undefined) ?? existing.startsAt;
    const finalEndsAt = (data.endsAt as Date | undefined) ?? existing.endsAt;
    if (finalEndsAt <= finalStartsAt) {
      return NextResponse.json({ success: false, message: "Subscription end date must be after the start date." }, { status: 422 });
    }

    const subscription = await prisma.$transaction(async (tx) => {
      const targetCompanyId = String(data.companyId ?? existing.companyId);
      if (data.isActive === true) {
        await tx.subscription.updateMany({
          where: { companyId: targetCompanyId, isActive: true, id: { not: id } },
          data: { isActive: false },
        });
      }

      const updated = await tx.subscription.update({
        where: { id },
        data: data as any,
        include: {
          company: { select: { id: true, name: true, code: true, status: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId: updated.companyId,
          action: "SUBSCRIPTION_UPDATED",
          module: "SUBSCRIPTION",
          details: `${auth.user!.name} updated subscription for ${updated.company.name}.`,
        },
      });
      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Subscription updated successfully.",
      subscription: { ...subscription, amount: Number(subscription.amount) },
    });
  } catch (error) {
    console.error("SUPER_ADMIN_SUBSCRIPTION_UPDATE_ERROR", error);
    return NextResponse.json({ success: false, message: "Failed to update subscription." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response || !auth.user) return auth.response!;
    const { id } = await context.params;

    const existing = await prisma.subscription.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true } } },
    });
    if (!existing) return NextResponse.json({ success: false, message: "Subscription was not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.subscription.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId: auth.user!.id,
          companyId: existing.companyId,
          action: "SUBSCRIPTION_REMOVED",
          module: "SUBSCRIPTION",
          details: `${auth.user!.name} removed subscription for ${existing.company.name}.`,
        },
      });
    });

    return NextResponse.json({ success: true, message: "Subscription removed successfully." });
  } catch (error) {
    console.error("SUPER_ADMIN_SUBSCRIPTION_DELETE_ERROR", error);
    return NextResponse.json({ success: false, message: "Failed to remove subscription." }, { status: 500 });
  }
}
