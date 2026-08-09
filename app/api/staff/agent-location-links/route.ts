import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { createLocationToken, hashLocationToken } from "@/lib/security/location-token";
import { requireVisibleBrokerCustomer } from "@/lib/staff/broker-scope";
import { requireStaffSession } from "@/lib/staff/require-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown, maximum = 191): string {
  return String(value ?? "").trim().slice(0, maximum);
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession();
    const body = await request.json();
    const brokerCustomerId = text(body.brokerCustomerId);

    if (!brokerCustomerId) {
      return NextResponse.json(
        { success: false, message: "Select an assigned agent first." },
        { status: 400 },
      );
    }

    const broker = await requireVisibleBrokerCustomer(
      session.companyId,
      session.id,
      brokerCustomerId,
    );

    const token = createLocationToken();
    const tokenHash = hashLocationToken(token);
    const database = db as any;

    await database.brokerAgentLocationDevice.upsert({
      where: { brokerCustomerId },
      create: {
        companyId: session.companyId,
        brokerCustomerId,
        label: `${broker.businessName || broker.name} location sharing`,
        tokenHash,
        status: "ACTIVE",
      },
      update: {
        label: `${broker.businessName || broker.name} location sharing`,
        tokenHash,
        status: "ACTIVE",
      },
    });

    const origin = new URL(request.url).origin;
    const shareUrl = `${origin}/agent-location/${encodeURIComponent(token)}`;

    return NextResponse.json({
      success: true,
      message: "A secure live-location link was created. Send it only to this assigned agent.",
      broker: {
        id: broker.id,
        name: broker.businessName || broker.name,
      },
      shareUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const known: Record<string, [number, string]> = {
      UNAUTHENTICATED: [401, "Authentication is required."],
      FORBIDDEN: [403, "Staff access is required."],
      STAFF_COMPANY_REQUIRED: [403, "The Staff account is not connected to a company."],
      BROKER_NOT_ASSIGNED: [403, "This agent is outside your assigned work."],
      BROKER_DIRECT_ASSIGNMENT_REQUIRED: [403, "This agent must be directly assigned before a location link can be created."],
    };

    if (known[message]) {
      return NextResponse.json(
        { success: false, message: known[message][1] },
        { status: known[message][0] },
      );
    }

    console.error("[STAFF_AGENT_LOCATION_LINK]", error);
    return NextResponse.json(
      {
        success: false,
        message: "The agent live-location link could not be created.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 },
    );
  }
}
