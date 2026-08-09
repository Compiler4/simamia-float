import "dotenv/config";

import { db } from "../lib/db";
import { geocodeTanzaniaAddress } from "../lib/staff/geocode-broker";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? "");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const database = db as any;
  const companyCode = String(process.env.GEOCODE_COMPANY_CODE || "").trim();
  const limit = positiveInteger(process.env.GEOCODE_LIMIT, 100);
  const delayMs = Math.max(
    1100,
    positiveInteger(process.env.GEOCODE_DELAY_MS, 1200),
  );

  const company = companyCode
    ? await database.company.findUnique({ where: { code: companyCode } })
    : await database.company.findFirst({ orderBy: { createdAt: "asc" } });

  if (!company) {
    throw new Error(
      "No company was found. Set GEOCODE_COMPANY_CODE to the company code.",
    );
  }

  const brokers = await database.brokerCustomer.findMany({
    where: {
      companyId: company.id,
      status: "ACTIVE",
      OR: [{ latitude: null }, { longitude: null }],
    },
    orderBy: [{ region: "asc" }, { district: "asc" }, { name: "asc" }],
    take: limit,
  });

  console.log(
    `Resolving up to ${brokers.length} broker addresses for ${company.name}.`,
  );

  let resolved = 0;
  let skipped = 0;

  for (const broker of brokers) {
    try {
      const location = await geocodeTanzaniaAddress(broker);

      if (!location) {
        skipped += 1;
        console.warn(`No result: ${broker.code} ${broker.name}`);
      } else {
        await database.brokerCustomer.update({
          where: { id: broker.id },
          data: {
            latitude: location.latitude,
            longitude: location.longitude,
            attendedLocation: location.displayName,
          },
        });

        resolved += 1;
        console.log(
          `Resolved ${broker.code} ${broker.name} -> ${location.latitude}, ${location.longitude} (${location.precision})`,
        );
      }
    } catch (error) {
      skipped += 1;
      console.error(
        `Failed ${broker.code} ${broker.name}:`,
        error instanceof Error ? error.message : error,
      );
    }

    await sleep(delayMs);
  }

  console.log({ company: company.code, resolved, skipped, processed: brokers.length });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (db as any).$disconnect?.();
  });
