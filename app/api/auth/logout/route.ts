import { NextResponse } from "next/server";

import { deleteAuthSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  await deleteAuthSession();

  return NextResponse.json({
    success: true,
    message: "You have been signed out.",
  });
}

export async function GET(): Promise<Response> {
  await deleteAuthSession();

  return NextResponse.redirect(
    new URL("/login", process.env.APP_URL || "http://localhost:3000"),
  );
}
