import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ResourceRouteContext = {
  params: Promise<{
    resources: string;
    id: string;
  }>;
};

type DynamicModel = {
  findFirst: (args: {
    where: {
      id: string;
      companyId: string;
    };
    select?: {
      id: boolean;
    };
  }) => Promise<{ id: string } | null>;

  update: (args: {
    where: {
      id: string;
    };
    data: Record<string, unknown>;
  }) => Promise<unknown>;

  delete: (args: {
    where: {
      id: string;
    };
  }) => Promise<unknown>;
};

function getModel(resource: string): DynamicModel | null {
  const db = prisma as unknown as Record<string, DynamicModel>;

  const models: Record<string, DynamicModel | undefined> = {
    branches: db.branch,
    products: db.product,
    customers: db.customer,
    services: db.serviceActivity,
    gps: db.gpsTracking,
  };

  return models[resource] ?? null;
}

function prepareUpdateData(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  const protectedFields = new Set([
    "id",
    "companyId",
    "createdAt",
    "updatedAt",
  ]);

  const decimalFields = new Set([
    "price",
    "amount",
    "speed",
    "distanceTraveled",
  ]);

  const integerFields = new Set([
    "stock",
    "stops",
    "geofenceViolations",
  ]);

  const dateFields = new Set([
    "servedAt",
    "recordedAt",
  ]);

  for (const [key, value] of Object.entries(body)) {
    if (protectedFields.has(key)) {
      continue;
    }

    if (decimalFields.has(key)) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        data[key] = null;
        continue;
      }

      const numericValue = Number(value);

      if (!Number.isFinite(numericValue)) {
        throw new Error(`${key} must be a valid number.`);
      }

      data[key] = String(value);
      continue;
    }

    if (integerFields.has(key)) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        data[key] = null;
        continue;
      }

      const numericValue = Number(value);

      if (!Number.isInteger(numericValue)) {
        throw new Error(`${key} must be a valid integer.`);
      }

      data[key] = numericValue;
      continue;
    }

    if (dateFields.has(key)) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        data[key] = null;
        continue;
      }

      const dateValue = new Date(String(value));

      if (Number.isNaN(dateValue.getTime())) {
        throw new Error(`${key} must be a valid date.`);
      }

      data[key] = dateValue;
      continue;
    }

    data[key] = value === "" ? null : value;
  }

  return data;
}

export async function PATCH(
  request: NextRequest,
  context: ResourceRouteContext,
): Promise<Response> {
  try {
    const user = await getCurrentUser();

    /*
     * The folder is named [resources], so the generated
     * parameter is also named "resources".
     */
    const { resources, id } = await context.params;
    const resource = resources.trim().toLowerCase();

    if (
      !user ||
      user.role !== "COMPANY_ADMIN" ||
      !user.companyId
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    if (!id?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Record ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const model = getModel(resource);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid resource: ${resource}.`,
        },
        {
          status: 400,
        },
      );
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "The request body must contain valid JSON.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !requestBody ||
      typeof requestBody !== "object" ||
      Array.isArray(requestBody)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The request body must be a JSON object.",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Confirm ownership before updating. This prevents one
     * company administrator from updating another company's data.
     */
    const existingRecord = await model.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Record not found or it does not belong to your company.",
        },
        {
          status: 404,
        },
      );
    }

    const data = prepareUpdateData(
      requestBody as Record<string, unknown>,
    );

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid fields were provided for updating.",
        },
        {
          status: 400,
        },
      );
    }

    const saved = await model.update({
      where: {
        id,
      },
      data,
    });

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: `${resource.toUpperCase()}_UPDATED`,
        module: "COMPANY_ADMIN",
        details: `${user.name ?? user.email} updated a ${resource} record.`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Record updated successfully.",
        data: saved,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "COMPANY_ADMIN_RESOURCE_UPDATE_ERROR:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    const isValidationError =
      message.includes("must be a valid");

    return NextResponse.json(
      {
        success: false,
        message: isValidationError
          ? message
          : "Failed to update record.",
        error:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      {
        status: isValidationError ? 400 : 500,
      },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: ResourceRouteContext,
): Promise<Response> {
  try {
    const user = await getCurrentUser();

    /*
     * Match the [resources] folder name.
     */
    const { resources, id } = await context.params;
    const resource = resources.trim().toLowerCase();

    if (
      !user ||
      user.role !== "COMPANY_ADMIN" ||
      !user.companyId
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        {
          status: 401,
        },
      );
    }

    if (!id?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Record ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    const model = getModel(resource);

    if (!model) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid resource: ${resource}.`,
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Confirm the record belongs to the logged-in administrator's
     * company before deleting it.
     */
    const existingRecord = await model.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Record not found or it does not belong to your company.",
        },
        {
          status: 404,
        },
      );
    }

    await model.delete({
      where: {
        id,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: `${resource.toUpperCase()}_REMOVED`,
        module: "COMPANY_ADMIN",
        details: `${user.name ?? user.email} removed a ${resource} record.`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Record removed successfully.",
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "COMPANY_ADMIN_RESOURCE_DELETE_ERROR:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    return NextResponse.json(
      {
        success: false,
        message: "Failed to remove record.",
        error:
          process.env.NODE_ENV === "development"
            ? message
            : undefined,
      },
      {
        status: 500,
      },
    );
  }
}