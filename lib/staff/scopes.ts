import { db } from "@/lib/db";
import type { StaffSession } from "./permissions";

export const relatedUserSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  profileImageUrl: true,
} as const;

export async function loadStaffAssignments(session: StaffSession) {
  const [brokerAssignments, customerAssignments] = await Promise.all([
    (db as any).staffBrokerAssignment.findMany({
      where: {
        companyId: session.companyId,
        staffId: session.id,
        status: "ACTIVE",
      },
      include: {
        broker: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
            profileImageUrl: true,
            assignedRegion: true,
            status: true,
          },
        },
      },
      orderBy: { broker: { name: "asc" } },
    }),
    (db as any).staffCustomerAssignment.findMany({
      where: {
        companyId: session.companyId,
        staffId: session.id,
        status: "ACTIVE",
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            region: true,
            address: true,
            status: true,
          },
        },
      },
      orderBy: { customer: { name: "asc" } },
    }),
  ]);

  const activeBrokerAssignments = brokerAssignments.filter(
    (row: any) => row.broker?.status === "ACTIVE",
  );
  const activeCustomerAssignments = customerAssignments.filter(
    (row: any) => row.customer?.status === "ACTIVE",
  );

  return {
    brokerAssignments: activeBrokerAssignments,
    customerAssignments: activeCustomerAssignments,
    brokerIds: activeBrokerAssignments.map((row: any) => String(row.brokerId)),
    customerIds: activeCustomerAssignments.map((row: any) => String(row.customerId)),
    brokers: activeBrokerAssignments.map((row: any) => row.broker),
    customers: activeCustomerAssignments.map((row: any) => row.customer),
  };
}

export async function requireAssignedBroker(
  session: StaffSession,
  brokerId: string,
) {
  const assignment = await (db as any).staffBrokerAssignment.findFirst({
    where: {
      companyId: session.companyId,
      staffId: session.id,
      brokerId,
      status: "ACTIVE",
      broker: {
        is: {
          companyId: session.companyId,
          role: "BROKER",
          status: "ACTIVE",
        },
      },
    },
    include: {
      broker: {
        select: relatedUserSelect,
      },
    },
  });

  if (!assignment?.broker) {
    throw new Error("BROKER_NOT_ASSIGNED");
  }

  return assignment.broker;
}

export async function requireAssignedCustomer(
  session: StaffSession,
  customerId: string,
) {
  const assignment = await (db as any).staffCustomerAssignment.findFirst({
    where: {
      companyId: session.companyId,
      staffId: session.id,
      customerId,
      status: "ACTIVE",
      customer: {
        is: {
          companyId: session.companyId,
          status: "ACTIVE",
        },
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          region: true,
          address: true,
        },
      },
    },
  });

  if (!assignment?.customer) {
    throw new Error("CUSTOMER_NOT_ASSIGNED");
  }

  return assignment.customer;
}
