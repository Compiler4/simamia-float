# Prisma compatibility

This update intentionally uses the fields reported by the current generated Prisma Client:

- `BrokerCustomer.latitude`, `longitude`, `address`, `ward`, `district`, `region`, `city`, `attendedBy`, `attendedDate`, `attendedLocation`
- `BrokerServiceVisit.startedAt` and relation `broker`
- `BrokerServiceVisit.serviceActivityId` loaded separately from `ServiceActivity`

It does not query the removed/unknown fields `BrokerCustomer.locationSource`, `BrokerCustomer.locationVerifiedAt`, or `BrokerServiceVisit.serviceDay`.

No new Prisma model is required for this release. Regenerate the existing client after copying the files:

```powershell
npx prisma generate
```
