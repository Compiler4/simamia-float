import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "barakanicolaus4@gmail.com";
const ADMIN_NAME = "baraka";
const ADMIN_USERNAME = "baraka";

async function main() {
  const password = process.env.SIMAMIA_ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      "SIMAMIA_ADMIN_PASSWORD is missing. Set it before running this script.",
    );
  }

  console.log("Searching for administrator...");

  const existing = await prisma.user.findFirst({
    where: {
      email: ADMIN_EMAIL,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!existing) {
    throw new Error(
      `Administrator ${ADMIN_EMAIL} does not exist. Create the user first.`,
    );
  }

  console.log("Generating bcrypt password hash...");

  const passwordHash = await bcrypt.hash(password, 12);

  console.log("Updating administrator...");

  const user = await prisma.user.update({
    where: {
      id: existing.id,
    },
    data: {
      name: ADMIN_NAME,
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,

      passwordHash,

      // SIMAMIA has historically used SUPER_ADMIN for the
      // system-wide administrator.
      role: "SUPER_ADMIN",

      status: "ACTIVE",

      // System/Super Admin is not restricted to one company.
      companyId: null,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      status: true,
      companyId: true,
    },
  });

  const passwordWorks = await bcrypt.compare(
    password,
    passwordHash,
  );

  console.log("");
  console.log("========================================");
  console.log("SYSTEM ADMIN REPAIRED");
  console.log("========================================");
  console.log(user);
  console.log("");
  console.log(
    `Password verification: ${passwordWorks ? "PASS" : "FAIL"}`,
  );

  if (!passwordWorks) {
    throw new Error("Password verification failed.");
  }
}

main()
  .catch((error) => {
    console.error("");
    console.error("ADMIN_REPAIR_ERROR:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });