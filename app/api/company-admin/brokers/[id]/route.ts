import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedStatuses = new Set(["ACTIVE", "INACTIVE", "SUSPENDED"]);
const allowedNetworks = new Set([
  "VODACOM",
  "YAS_MIX",
  "AIRTEL",
  "HALOTEL",
  "OTHER",
]);
const allowedGenders = new Set(["MALE", "FEMALE", "OTHER"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

function clean(value: unknown): string {
  return text(value).trim();
}

function optional(value: unknown): string | null {
  return clean(value) || null;
}

function serialize(item: any) {
  if (!item) return item;
  return {
    ...item,
    latitude: item.latitude == null ? null : Number(item.latitude),
    longitude: item.longitude == null ? null : Number(item.longitude),
    agentAccounts: Array.isArray(item.agentAccounts) ? item.agentAccounts : [],
  };
}

function assertJsonRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";

  if (!contentType.includes("application/json")) {
    throw new HttpError(
      "Broker updates must use application/json.",
      415,
    );
  }
}

function normalizeAccounts(rows: unknown, companyId: string, brokerCustomerId: string) {
  if (!Array.isArray(rows)) return [];

  const accounts = rows
    .filter((row: any) =>
      [row?.network, row?.simPhoneNumber, row?.agentNumber, row?.accountName].some(
        (value) => clean(value),
      ),
    )
    .map((row: any, index: number) => {
      const network = clean(row.network).toUpperCase() || "OTHER";
      const simPhoneNumber = clean(row.simPhoneNumber);
      const agentNumber = clean(row.agentNumber);
      const status = clean(row.status).toUpperCase() || "ACTIVE";

      if (!allowedNetworks.has(network) || !simPhoneNumber || !agentNumber) {
        throw new HttpError(
          `Complete network, SIM phone and agent number for account ${index + 1}, or leave the row blank.`,
          422,
        );
      }

      if (!allowedStatuses.has(status)) {
        throw new HttpError(`Invalid status for account ${index + 1}.`, 422);
      }

      return {
        companyId,
        brokerCustomerId,
        network,
        simPhoneNumber,
        agentNumber,
        accountName: optional(row.accountName),
        isPrimary: Boolean(row.isPrimary),
        status,
      };
    });

  if (accounts.length) {
    const requestedPrimary = accounts.findIndex((row: any) => row.isPrimary);
    const primaryIndex = requestedPrimary >= 0 ? requestedPrimary : 0;
    accounts.forEach((row: any, index: number) => {
      row.isPrimary = index === primaryIndex;
    });
  }

  return accounts;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = clean(user.companyId);
    const { id } = await context.params;

    if (!companyId) {
      throw new HttpError("Your account is not connected to a company.", 403);
    }

    if (!id) {
      throw new HttpError("Broker customer ID is required.", 400);
    }

    assertJsonRequest(request);

    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      throw new HttpError("Broker update contains invalid JSON.", 400);
    }

    const db = prisma as any;

    const existing = await db.brokerCustomer.findFirst({
      where: { id, companyId },
      include: { agentAccounts: true },
    });

    if (!existing) {
      throw new HttpError("Broker customer was not found.", 404);
    }

    const data: Record<string, unknown> = {};

    const textFields = [
      "code",
      "title",
      "firstName",
      "surname",
      "businessName",
      "tinNumber",
      "officialAgentNo",
      "phone",
      "alternatePhone",
      "email",
      "location",
      "region",
      "district",
      "ward",
      "address",
      "postalAddress",
      "city",
      "country",
      "nationality",
      "identityType",
      "identityNumber",
      "identityIssuedBy",
      "identityOther",
      "profileImageUrl",
      "signatureUrl",
      "attendedBy",
      "attendedSignatureUrl",
      "attendedLocation",
      "notes",
    ];

    const mandatoryTextFields = new Set([
      "firstName",
      "surname",
      "phone",
      "location",
    ]);

    for (const field of textFields) {
      if (body[field] === undefined) continue;

      const value = optional(body[field]);

      if (mandatoryTextFields.has(field) && !value) {
        throw new HttpError(`${field} cannot be empty.`, 422);
      }

      data[field] = value;
    }

    if (body.firstName !== undefined || body.surname !== undefined) {
      const firstName = clean(body.firstName ?? existing.firstName);
      const surname = clean(body.surname ?? existing.surname);

      if (!firstName || !surname) {
        throw new HttpError("First name and surname cannot be empty.", 422);
      }

      data.firstName = firstName;
      data.surname = surname;
      data.name = `${firstName} ${surname}`;
    }

    if (body.gender !== undefined) {
      const gender = clean(body.gender).toUpperCase();

      if (!allowedGenders.has(gender)) {
        throw new HttpError("Gender must be MALE, FEMALE or OTHER.", 422);
      }

      data.gender = gender;
    }

    for (const field of ["dateOfBirth", "registrationDate", "attendedDate"]) {
      if (body[field] === undefined) continue;

      const raw = clean(body[field]);

      if (!raw) {
        data[field] = null;
        continue;
      }

      const date = new Date(raw);

      if (Number.isNaN(date.getTime())) {
        throw new HttpError(`${field} is invalid.`, 422);
      }

      if (field === "dateOfBirth" && date >= new Date()) {
        throw new HttpError("Date of birth must be in the past.", 422);
      }

      data[field] = date;
    }

    if (body.status !== undefined) {
      const status = clean(body.status).toUpperCase();

      if (!allowedStatuses.has(status)) {
        throw new HttpError("Invalid broker status.", 422);
      }

      data.status = status;
    }

    // latitude and longitude are intentionally ignored here.

    const broker = await db.$transaction(async (tx: any) => {
      if (Object.keys(data).length) {
        await tx.brokerCustomer.update({
          where: { id },
          data,
        });
      }

      if (body.agentAccounts !== undefined) {
        const accounts = normalizeAccounts(body.agentAccounts, companyId, id);

        for (const account of accounts) {
          const duplicate = await tx.brokerAgentAccount.findFirst({
            where: {
              companyId,
              network: account.network,
              agentNumber: account.agentNumber,
              NOT: { brokerCustomerId: id },
            },
            select: { id: true },
          });

          if (duplicate) {
            throw new HttpError(
              `${account.network} agent number ${account.agentNumber} is already registered.`,
              409,
            );
          }
        }

        await tx.brokerAgentAccount.deleteMany({
          where: { brokerCustomerId: id },
        });

        if (accounts.length) {
          await tx.brokerAgentAccount.createMany({ data: accounts });
        }
      }

      return tx.brokerCustomer.findUnique({
        where: { id },
        include: { agentAccounts: true },
      });
    });

    try {
      await createAudit({
        companyId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: "UPDATE_BROKER",
        module: "BROKERS",
        details: `Updated ${existing.name}.`,
      });
    } catch (auditError) {
      console.error("[UPDATE_BROKER_AUDIT_ERROR]", auditError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Broker updated successfully.",
        broker: serialize(broker),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = clean(user.companyId);
    const { id } = await context.params;
    const db = prisma as any;

    if (!companyId) {
      throw new HttpError("Your account is not connected to a company.", 403);
    }

    const existing = await db.brokerCustomer.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new HttpError("Broker customer was not found.", 404);
    }

    if (clean(existing.status).toUpperCase() !== "SUSPENDED") {
      await db.brokerCustomer.update({
        where: { id },
        data: { status: "SUSPENDED" },
      });
    }

    try {
      await createAudit({
        companyId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: "SUSPEND_BROKER",
        module: "BROKERS",
        details: `Suspended ${existing.name}. Historical services were preserved.`,
      });
    } catch (auditError) {
      console.error("[SUSPEND_BROKER_AUDIT_ERROR]", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Broker suspended successfully.",
    });
  } catch (error) {
    return routeError(error);
  }
}
