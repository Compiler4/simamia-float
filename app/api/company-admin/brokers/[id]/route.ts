import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createAudit,
  requireCompanyAdmin,
  routeError,
  text,
  HttpError,
} from "@/lib/company-admin-server";

const allowedStatuses = new Set(["ACTIVE", "INACTIVE", "SUSPENDED"]);
const allowedNetworks = new Set(["VODACOM", "YAS_MIX", "AIRTEL", "HALOTEL", "OTHER"]);

function clean(value: unknown): string {
  return text(value).trim();
}

function optional(value: unknown): string | null {
  return clean(value) || null;
}

function serialize(item: any) {
  return {
    ...item,
    latitude: item.latitude == null ? null : Number(item.latitude),
    longitude: item.longitude == null ? null : Number(item.longitude),
    agentAccounts: Array.isArray(item.agentAccounts) ? item.agentAccounts : [],
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const body = await request.json();
    const db = prisma as any;

    const existing = await db.brokerCustomer.findFirst({
      where: { id, companyId },
      include: { agentAccounts: true },
    });
    if (!existing) throw new HttpError("Broker customer was not found.", 404);

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
      "postalAddress",
      "city",
      "country",
      "nationality",
      "identityType",
      "identityNumber",
      "identityIssuedBy",
      "profileImageUrl",
      "signatureUrl",
      "attendedBy",
      "attendedSignatureUrl",
      "attendedLocation",
    ]);

    for (const field of textFields) {
      if (body[field] !== undefined) {
        const value = optional(body[field]);
        if (mandatoryTextFields.has(field) && !value) {
          throw new HttpError(`${field} cannot be empty.`, 422);
        }
        data[field] = value;
      }
    }

    if (body.firstName !== undefined || body.surname !== undefined) {
      const firstName = clean(body.firstName ?? existing.firstName);
      const surname = clean(body.surname ?? existing.surname);
      if (!firstName || !surname) throw new HttpError("First name and surname cannot be empty.", 422);
      data.firstName = firstName;
      data.surname = surname;
      data.name = `${firstName} ${surname}`;
    }

    for (const field of ["dateOfBirth", "registrationDate", "attendedDate"]) {
      if (body[field] !== undefined) {
        const date = new Date(clean(body[field]));
        if (Number.isNaN(date.getTime())) throw new HttpError(`${field} is invalid.`, 422);
        data[field] = date;
      }
    }

    for (const [field, min, max] of [
      ["latitude", -90, 90],
      ["longitude", -180, 180],
    ] as const) {
      if (body[field] !== undefined) {
        if (body[field] === null || body[field] === "") {
          throw new HttpError(`${field} cannot be empty.`, 422);
        } else {
          const value = Number(body[field]);
          if (!Number.isFinite(value) || value < min || value > max) {
            throw new HttpError(`${field} must be between ${min} and ${max}.`, 422);
          }
          data[field] = value;
        }
      }
    }

    if (body.status !== undefined) {
      const status = clean(body.status).toUpperCase();
      if (!allowedStatuses.has(status)) throw new HttpError("Invalid broker status.", 422);
      data.status = status;
    }

    const broker = await db.$transaction(async (tx: any) => {
      await tx.brokerCustomer.update({ where: { id }, data });

      if (body.agentAccounts !== undefined) {
        if (!Array.isArray(body.agentAccounts) || body.agentAccounts.length === 0) {
          throw new HttpError("At least one agent account is required.", 422);
        }

        const accounts = body.agentAccounts.map((row: any, index: number) => {
          const network = clean(row.network).toUpperCase();
          const simPhoneNumber = clean(row.simPhoneNumber);
          const agentNumber = clean(row.agentNumber);
          if (!allowedNetworks.has(network) || !simPhoneNumber || !agentNumber) {
            throw new HttpError(`Complete network account ${index + 1}.`, 422);
          }
          return {
            companyId,
            brokerCustomerId: id,
            network,
            simPhoneNumber,
            agentNumber,
            accountName: clean(row.accountName) || (() => { throw new HttpError(`Account name for account ${index + 1} is required.`, 422); })(),
            isPrimary: Boolean(row.isPrimary),
            status: clean(row.status).toUpperCase() || "ACTIVE",
          };
        });
        if (!accounts.some((row: any) => row.isPrimary)) accounts[0].isPrimary = true;

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

        await tx.brokerAgentAccount.deleteMany({ where: { brokerCustomerId: id } });
        await tx.brokerAgentAccount.createMany({ data: accounts });
      }

      return tx.brokerCustomer.findUnique({
        where: { id },
        include: { agentAccounts: true },
      });
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "UPDATE_BROKER",
      module: "BROKERS",
      details: `Updated ${existing.name}.`,
    });

    return NextResponse.json({ success: true, broker: serialize(broker) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = user.companyId as string;
    const { id } = await context.params;
    const db = prisma as any;

    const existing = await db.brokerCustomer.findFirst({ where: { id, companyId } });
    if (!existing) throw new HttpError("Broker customer was not found.", 404);

    await db.brokerCustomer.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });

    await createAudit({
      companyId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: "SUSPEND_BROKER",
      module: "BROKERS",
      details: `Suspended ${existing.name}. Historical services were preserved.`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
