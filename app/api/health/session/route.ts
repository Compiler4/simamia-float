import { NextResponse } from "next/server";

import { getAuthConfigurationStatus } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const status = getAuthConfigurationStatus();

  return NextResponse.json(
    {
      success: status.configured && status.strongEnough,
      message:
        status.configured && status.strongEnough
          ? "SIMAMIA authentication session signing is configured."
          : "SIMAMIA authentication signing secret is missing or too short.",
      configuration: {
        configured: status.configured,
        source: status.source,
        strongEnough: status.strongEnough,
        secretLength: status.length,
        cookieName: "simamia_session",
        secureCookie: process.env.NODE_ENV === "production",
      },
      checkedAt: new Date().toISOString(),
    },
    {
      status: status.configured && status.strongEnough ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
