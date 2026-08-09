import { db } from "../lib/db";

async function main() {
  const database = db as any;

  const [brokers, customers, devices] = await Promise.all([
    database.brokerCustomer.updateMany({
      where: { latitude: 0, longitude: 0 },
      data: { latitude: null, longitude: null },
    }),
    database.customer.updateMany({
      where: { latitude: 0, longitude: 0 },
      data: { latitude: null, longitude: null },
    }),
    database.companyGpsDevice.updateMany({
      where: { lastLatitude: 0, lastLongitude: 0 },
      data: { lastLatitude: null, lastLongitude: null },
    }),
  ]);

  console.log({
    brokerCoordinatesCleared: brokers.count,
    customerCoordinatesCleared: customers.count,
    deviceCoordinatesCleared: devices.count,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (db as any).$disconnect?.();
  });
