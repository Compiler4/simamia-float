import { NextResponse } from "next/server";

import { PortalAccessError } from "./guard";

export function jsonError(error: unknown, fallback: string) {
  if (error instanceof PortalAccessError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status },
    );
  }

  const code = String((error as any)?.code ?? "");
  if (code === "P2002") {
    return NextResponse.json(
      { success: false, message: "That record already exists." },
      { status: 409 },
    );
  }

  if (code === "P2021" || code === "P2022") {
    return NextResponse.json(
      {
        success: false,
        message:
          "The Prisma schema is not synchronized with MySQL. Run prisma db push and prisma generate.",
        details: String((error as any)?.message ?? ""),
      },
      { status: 500 },
    );
  }

  console.error("ACCOUNTANT_V3_ERROR", error);
  return NextResponse.json(
    {
      success: false,
      message: error instanceof Error ? error.message : fallback,
    },
    { status: 500 },
  );
}

export function requiredText(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

export function optionalText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

export function positiveAmount(value: unknown, label = "Amount") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return amount;
}
