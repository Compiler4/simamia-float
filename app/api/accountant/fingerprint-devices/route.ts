import { randomBytes } from "node:crypto";
import { type NextRequest } from "next/server";

import { db } from "@/lib/db";
import {
  PortalError,
  audit,
  errorResponse,
  requireAccountant,
  sha256,
  text,
} from "@/lib/accountant/portal";

const prisma = db as any;

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function payload() {
  const context = await requireAccountant();
  const [devices, enrolments, staff] = await Promise.all([
    prisma.attendanceDevice.findMany({
      where: { companyId: context.companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendanceDeviceEnrollment.findMany({
      where: { companyId: context.companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        companyId: context.companyId,
        role: "STAFF",
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        profileImageUrl: true,
        assignedRegion: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const userMap = new Map(staff.map((user: any) => [String(user.id), user]));
  return {
    context,
    data: {
      success: true,
      devices,
      enrolments: enrolments.map((row: any) => ({
        ...row,
        user: userMap.get(String(row.userId)) || null,
      })),
      staff,
    },
  };
}

export async function GET() {
  try {
    const { data } = await payload();
    return Response.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAccountant();
    const body = await request.json();
    const action = text(body.action).toUpperCase();

    if (action === "REGISTER_DEVICE") {
      const name = text(body.name).trim();
      const serialNumber = text(body.serialNumber).trim();
      if (!name || !serialNumber) {
        throw new PortalError("Device name and serial number are required.", 422);
      }
      const deviceSecret = randomBytes(32).toString("hex");
      const device = await prisma.attendanceDevice.create({
        data: {
          companyId: context.companyId,
          name,
          serialNumber,
          location: text(body.location).trim() || null,
          vendor: text(body.vendor).trim() || null,
          apiKeyHash: sha256(deviceSecret),
          status: "ACTIVE",
          registeredById: context.accountantId,
        },
      });
      await audit(context, "REGISTER_DEVICE", "FINGERPRINT", {
        deviceId: device.id,
        serialNumber,
      });
      return Response.json({
        success: true,
        message: "Fingerprint device registered successfully.",
        deviceSecret,
      });
    }

    if (action === "ENROL_USER") {
      const deviceId = text(body.deviceId).trim();
      const userId = text(body.userId).trim();
      const externalUserCode = text(body.externalUserCode).trim();
      if (!deviceId || !userId || !externalUserCode) {
        throw new PortalError(
          "Device, STAFF user and external user code are required.",
          422,
        );
      }
      const [device, user] = await Promise.all([
        prisma.attendanceDevice.findFirst({
          where: { id: deviceId, companyId: context.companyId },
        }),
        prisma.user.findFirst({
          where: {
            id: userId,
            companyId: context.companyId,
            role: "STAFF",
            status: "ACTIVE",
          },
        }),
      ]);
      if (!device) throw new PortalError("Fingerprint device was not found.", 404);
      if (!user) throw new PortalError("Active STAFF user was not found.", 404);
      await prisma.attendanceDeviceEnrollment.upsert({
        where: { deviceId_userId: { deviceId, userId } },
        update: {
          externalUserCode,
          fingerLabel: text(body.fingerLabel).trim() || null,
          isActive: true,
          enrolledById: context.accountantId,
        },
        create: {
          companyId: context.companyId,
          deviceId,
          userId,
          externalUserCode,
          fingerLabel: text(body.fingerLabel).trim() || null,
          isActive: true,
          enrolledById: context.accountantId,
        },
      });
      await audit(context, "ENROL_USER", "FINGERPRINT", {
        deviceId,
        userId,
        externalUserCode,
      });
      return Response.json({
        success: true,
        message: `${user.name} enrolled on ${device.name}.`,
      });
    }

    if (action === "ROTATE_SECRET") {
      const deviceId = text(body.deviceId).trim();
      const device = await prisma.attendanceDevice.findFirst({
        where: { id: deviceId, companyId: context.companyId },
      });
      if (!device) throw new PortalError("Fingerprint device was not found.", 404);
      const deviceSecret = randomBytes(32).toString("hex");
      await prisma.attendanceDevice.update({
        where: { id: deviceId },
        data: { apiKeyHash: sha256(deviceSecret) },
      });
      await audit(context, "ROTATE_SECRET", "FINGERPRINT", { deviceId });
      return Response.json({
        success: true,
        message: "Device secret rotated. Copy the new secret now.",
        deviceSecret,
      });
    }

    if (action === "SET_DEVICE_STATUS") {
      const deviceId = text(body.deviceId).trim();
      const status = text(body.status).toUpperCase();
      if (!["ACTIVE", "INACTIVE", "REVOKED"].includes(status)) {
        throw new PortalError("Invalid fingerprint device status.", 422);
      }
      const updated = await prisma.attendanceDevice.updateMany({
        where: { id: deviceId, companyId: context.companyId },
        data: { status },
      });
      if (!updated.count) {
        throw new PortalError("Fingerprint device was not found.", 404);
      }
      await audit(context, "SET_DEVICE_STATUS", "FINGERPRINT", {
        deviceId,
        status,
      });
      return Response.json({
        success: true,
        message: `Fingerprint device status changed to ${status}.`,
      });
    }

    throw new PortalError(`Unsupported fingerprint action: ${action}.`, 422);
  } catch (error) {
    return errorResponse(error);
  }
}
