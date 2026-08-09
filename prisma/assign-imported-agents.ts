import "dotenv/config";

import { db } from "../lib/db";

async function main() {
  const staffEmail =
    process.env.ASSIGN_STAFF_EMAIL?.trim();

  if (!staffEmail) {
    throw new Error(
      "Set ASSIGN_STAFF_EMAIL to the Staff Officer who should receive the imported agents.",
    );
  }

  const database = db as any;
  const staff = await database.user.findFirst({
    where: {
      email: staffEmail,
      role: "STAFF",
      status: "ACTIVE",
      companyId: {
        not: null,
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      email: true,
    },
  });

  if (!staff?.companyId) {
    throw new Error(
      `No active Staff account was found for ${staffEmail}.`,
    );
  }

  const agents =
    await database.brokerCustomer.findMany({
      where: {
        companyId: staff.companyId,
        status: "ACTIVE",
        isImported: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

  let assigned = 0;

  for (
    let index = 0;
    index < agents.length;
    index += 100
  ) {
    const batch = agents.slice(
      index,
      index + 100,
    );

    await database.$transaction(
      batch.map(
        (agent: {
          id: string;
          name: string;
        }) =>
          database.staffBrokerCustomerAssignment.upsert({
            where: {
              companyId_brokerCustomerId: {
                companyId:
                  staff.companyId,
                brokerCustomerId:
                  agent.id,
              },
            },
            update: {
              staffId: staff.id,
              status: "ACTIVE",
              endedAt: null,
              assignedArea:
                "Imported agent directory",
              notes:
                `Assigned to ${staff.name} by the imported-agent assignment script.`,
            },
            create: {
              companyId:
                staff.companyId,
              staffId: staff.id,
              brokerCustomerId:
                agent.id,
              status: "ACTIVE",
              assignedArea:
                "Imported agent directory",
              notes:
                `Assigned to ${staff.name} by the imported-agent assignment script.`,
            },
          }),
      ),
    );

    assigned += batch.length;
    console.log(
      `Assigned ${assigned}/${agents.length} imported agents.`,
    );
  }

  console.log(
    `Completed: ${assigned} imported agents assigned to ${staff.name} <${staff.email}>.`,
  );
}

main()
  .catch((error) => {
    console.error(
      "AGENT_ASSIGNMENT_FAILED",
      error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (db as any).$disconnect();
  });
