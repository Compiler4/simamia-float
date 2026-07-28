import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { displayName, requirePortalRole } from "@/lib/accountant/auth";
import { createNotification } from "@/lib/accountant/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredText(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required.`);
  return result;
}

function optionalText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

async function targetExists(companyId: string, targetType: string, targetId: string) {
  if (targetType === "PROOF") return Boolean(await prisma.accountantStaffProof.findFirst({ where: { id: targetId, companyId } }));
  if (targetType === "BANK_DEPOSIT") return Boolean(await prisma.accountantBankDeposit.findFirst({ where: { id: targetId, companyId } }));
  if (targetType === "EXPENSE") return Boolean(await prisma.accountantExpenseRequest.findFirst({ where: { id: targetId, companyId } }));
  return targetType === "OTHER";
}

export async function POST(request: NextRequest) {
  const auth = await requirePortalRole(["COMPANY_ADMIN"]);
  if (auth.response || !auth.user) return auth.response!;

  try {
    const body = await request.json();
    const companyId = String(auth.user.companyId);
    const targetType = requiredText(body.targetType, "Target type").toUpperCase();
    const targetId = requiredText(body.targetId, "Target record");
    if (!["PROOF", "BANK_DEPOSIT", "EXPENSE", "OTHER"].includes(targetType)) throw new Error("Invalid verification target type.");
    if (!(await targetExists(companyId, targetType, targetId))) throw new Error("The target record was not found in this company.");

    const packet = await prisma.$transaction(async (tx: any) => {
      const created = await tx.accountantAdminPacket.create({
        data: {
          companyId,
          sentByAdminId: String(auth.user!.id),
          sentByAdminName: displayName(auth.user!),
          targetType,
          targetId,
          message: requiredText(body.message, "Verification message"),
          attachmentUrl: optionalText(body.attachmentUrl),
        },
      });
      await createNotification(tx, {
        companyId,
        roleTarget: "ACCOUNTANT",
        title: "Company Admin verification document received",
        message: `${displayName(auth.user!)} sent a ${targetType.replaceAll("_", " ").toLowerCase()} comparison packet.`,
        type: "INFO",
      });
      return created;
    });

    return NextResponse.json({ success: true, message: "Verification message/file sent to the accountant.", packet });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Verification packet could not be sent." },
      { status: 400 },
    );
  }
}
