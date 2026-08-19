import { randomUUID } from "crypto";
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
      "Broker registration must be sent as application/json. File uploads must use /api/company-admin/brokers/autofill or /api/company-admin/uploads.",
      415,
    );
  }
}

function validEmail(value: string): boolean {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeAccounts(
  rows: unknown,
  companyId: string,
  brokerCustomerId = "",
) {
  if (!Array.isArray(rows)) return [];

  const accounts = rows
    .filter((row: any) =>
      [
        row?.network,
        row?.simPhoneNumber,
        row?.agentNumber,
        row?.accountName,
      ].some((value) => clean(value)),
    )
    .map((row: any, index: number) => {
      const network = clean(row.network).toUpperCase() || "OTHER";
      const simPhoneNumber = clean(row.simPhoneNumber);
      const agentNumber = clean(row.agentNumber);
      const status = clean(row.status).toUpperCase() || "ACTIVE";

      if (!allowedNetworks.has(network)) {
        throw new HttpError(
          `Invalid network for agent account ${index + 1}.`,
          422,
        );
      }

      if (!simPhoneNumber || !agentNumber) {
        throw new HttpError(
          `Complete network, SIM phone and agent number for account ${index + 1}, or leave the row blank.`,
          422,
        );
      }

      if (!allowedStatuses.has(status)) {
        throw new HttpError(
          `Invalid status for agent account ${index + 1}.`,
          422,
        );
      }

      return {
        companyId,
        ...(brokerCustomerId ? { brokerCustomerId } : {}),
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

  const submitted = new Set<string>();

  for (const account of accounts) {
    const key = `${account.network}:${account.agentNumber}`.toLowerCase();

    if (submitted.has(key)) {
      throw new HttpError(
        `${account.network} agent number ${account.agentNumber} appears more than once.`,
        409,
      );
    }

    submitted.add(key);
  }

  return accounts;
}

async function generateBrokerCode(db: any, companyId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `BRK-${Date.now().toString(36).toUpperCase()}-${Math
      .floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0")}`;

    const duplicate = await db.brokerCustomer.findFirst({
      where: { companyId, code: candidate },
      select: { id: true },
    });

    if (!duplicate) return candidate;
  }

  return `BRK-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = clean(user.companyId);

    if (!companyId) {
      throw new HttpError("Your account is not connected to a company.", 403);
    }

    const db = prisma as any;
    const search = clean(request.nextUrl.searchParams.get("search"));
    const status = clean(request.nextUrl.searchParams.get("status")).toUpperCase();
    const network = clean(request.nextUrl.searchParams.get("network")).toUpperCase();

    const where: Record<string, any> = { companyId };

    if (status && status !== "ALL") {
      if (!allowedStatuses.has(status)) {
        throw new HttpError("Invalid broker status filter.", 422);
      }
      where.status = status;
    }

    if (network && network !== "ALL") {
      if (!allowedNetworks.has(network)) {
        throw new HttpError("Invalid network filter.", 422);
      }

      where.agentAccounts = {
        some: { network },
      };
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
        { firstName: { contains: search } },
        { surname: { contains: search } },
        { businessName: { contains: search } },
        { phone: { contains: search } },
        { alternatePhone: { contains: search } },
        { email: { contains: search } },
        { identityNumber: { contains: search } },
        { location: { contains: search } },
        {
          agentAccounts: {
            some: {
              OR: [
                { agentNumber: { contains: search } },
                { simPhoneNumber: { contains: search } },
              ],
            },
          },
        },
      ];
    }

    const brokers = await db.brokerCustomer.findMany({
      where,
      include: { agentAccounts: true },
      orderBy: { createdAt: "desc" },
    });

    const locations = Array.from(
      new Set(
        brokers
          .flatMap((broker: any) => [
            clean(broker.location),
            clean(broker.ward),
            clean(broker.district),
            clean(broker.region),
            clean(broker.city),
          ])
          .filter(Boolean),
      ),
    );

    return NextResponse.json(
      {
        success: true,
        brokers: brokers.map(serialize),
        locations,
        total: brokers.length,
        summary: {
          active: brokers.filter((item: any) => item.status === "ACTIVE").length,
          inactive: brokers.filter((item: any) => item.status === "INACTIVE").length,
          suspended: brokers.filter((item: any) => item.status === "SUSPENDED").length,
          imported: 0,
        },
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

export async function POST(request: NextRequest) {
  try {
    const user = await requireCompanyAdmin();
    const companyId = clean(user.companyId);

    if (!companyId) {
      throw new HttpError("Your account is not connected to a company.", 403);
    }

    // IMPORTANT: the normal broker registration form sends JSON.
    // Do not call request.formData() in this route.
    assertJsonRequest(request);

    let body: Record<string, any>;

    try {
      body = await request.json();
    } catch {
      throw new HttpError("Broker registration contains invalid JSON.", 400);
    }

    const db = prisma as any;

    const title = clean(body.title).toUpperCase() || "MR";
    const firstName = clean(body.firstName);
    const surname = clean(body.surname);
    const name = `${firstName} ${surname}`.trim();
    const businessName = clean(body.businessName);
    const tinNumber = clean(body.tinNumber);
    const officialAgentNo = clean(body.officialAgentNo);
    const phone = clean(body.phone);
    const alternatePhone = clean(body.alternatePhone);
    const email = clean(body.email).toLowerCase();
    const nationality = clean(body.nationality);
    const gender = clean(body.gender).toUpperCase();
    const postalAddress = clean(body.postalAddress);
    const location = clean(body.location);
    const city = clean(body.city);
    const region = clean(body.region);
    const district = clean(body.district);
    const ward = clean(body.ward);
    const country = clean(body.country);
    const identityType = clean(body.identityType).toUpperCase();
    const identityNumber = clean(body.identityNumber);
    const identityIssuedBy = clean(body.identityIssuedBy);
    const status = clean(body.status).toUpperCase() || "ACTIVE";

    const required = [
      ["title", title],
      ["firstName", firstName],
      ["surname", surname],
      ["businessName", businessName],
      ["tinNumber", tinNumber],
      ["officialAgentNo", officialAgentNo],
      ["phone", phone],
      ["alternatePhone", alternatePhone],
      ["email", email],
      ["nationality", nationality],
      ["gender", gender],
      ["postalAddress", postalAddress],
      ["location", location],
      ["city", city],
      ["region", region],
      ["district", district],
      ["ward", ward],
      ["country", country],
      ["identityType", identityType],
      ["identityNumber", identityNumber],
      ["identityIssuedBy", identityIssuedBy],
    ] as const;

    const missing = required.filter(([, value]) => !value).map(([field]) => field);

    if (missing.length) {
      throw new HttpError(
        `Complete all required broker fields: ${missing.join(", ")}.`,
        422,
      );
    }

    if (!validEmail(email)) {
      throw new HttpError("Enter a valid broker email address.", 422);
    }

    if (!allowedGenders.has(gender)) {
      throw new HttpError("Gender must be MALE, FEMALE or OTHER.", 422);
    }

    if (!allowedStatuses.has(status)) {
      throw new HttpError("Invalid broker status.", 422);
    }

    const dateOfBirth = body.dateOfBirth
      ? new Date(clean(body.dateOfBirth))
      : null;
    const registrationDate = body.registrationDate
      ? new Date(clean(body.registrationDate))
      : new Date();
    const attendedDate = body.attendedDate
      ? new Date(clean(body.attendedDate))
      : null;

    if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime()) || dateOfBirth >= new Date()) {
      throw new HttpError("Enter a valid date of birth in the past.", 422);
    }

    if (Number.isNaN(registrationDate.getTime())) {
      throw new HttpError("Registration date is invalid.", 422);
    }

    if (attendedDate && Number.isNaN(attendedDate.getTime())) {
      throw new HttpError("Attended date is invalid.", 422);
    }

    let code = clean(body.code).toUpperCase();

    if (!code) {
      code = await generateBrokerCode(db, companyId);
    }

    const duplicateCode = await db.brokerCustomer.findFirst({
      where: { companyId, code },
      select: { id: true },
    });

    if (duplicateCode) {
      throw new HttpError(`Broker code ${code} is already registered.`, 409);
    }

    const duplicateIdentity = await db.brokerCustomer.findFirst({
      where: {
        companyId,
        identityType,
        identityNumber,
        status: { not: "SUSPENDED" },
      },
      select: { id: true },
    });

    if (duplicateIdentity) {
      throw new HttpError(
        `${identityType} number ${identityNumber} is already registered.`,
        409,
      );
    }

    const rawAccounts = normalizeAccounts(body.agentAccounts, companyId);

    const broker = await db.$transaction(async (tx: any) => {
      for (const account of rawAccounts) {
        const duplicate = await tx.brokerAgentAccount.findFirst({
          where: {
            companyId,
            network: account.network,
            agentNumber: account.agentNumber,
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

      const created = await tx.brokerCustomer.create({
        data: {
          companyId,
          code,
          name,
          title,
          firstName,
          surname,
          businessName,
          tinNumber,
          officialAgentNo,
          phone,
          alternatePhone,
          email,
          nationality,
          dateOfBirth,
          gender,
          postalAddress,
          location,
          address: optional(body.address) || location,
          city,
          region,
          district,
          ward,
          country,
          identityType,
          identityNumber,
          identityIssuedBy,
          identityOther: optional(body.identityOther),
          profileImageUrl: optional(body.profileImageUrl),
          signatureUrl: optional(body.signatureUrl),
          registrationDate,
          attendedBy: optional(body.attendedBy),
          attendedSignatureUrl: optional(body.attendedSignatureUrl),
          attendedDate,
          attendedLocation: optional(body.attendedLocation),
          status,
          notes: optional(body.notes),

          // latitude and longitude are intentionally NOT accepted here.
          // Broker location sharing/GPS workflows may populate them elsewhere.
        },
      });

      if (rawAccounts.length) {
        await tx.brokerAgentAccount.createMany({
          data: rawAccounts.map((account: any) => ({
            ...account,
            brokerCustomerId: created.id,
          })),
        });
      }

      return tx.brokerCustomer.findUnique({
        where: { id: created.id },
        include: { agentAccounts: true },
      });
    });

    try {
      await createAudit({
        companyId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: "CREATE_BROKER",
        module: "BROKERS",
        details: `Registered ${name} (${code}).`,
      });
    } catch (auditError) {
      console.error("[CREATE_BROKER_AUDIT_ERROR]", auditError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Broker registered successfully.",
        broker: serialize(broker),
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return routeError(error);
  }
}
