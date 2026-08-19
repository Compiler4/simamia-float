# Staff Operations legacy database compatibility repair

The warning "Some optional records were unavailable..." was not a UI-only issue. The project database was originally created from an older SQL export. Several tables already existed, so `CREATE TABLE IF NOT EXISTS` could not add fields introduced later in `prisma/schema.prisma`.

The affected Staff queries can include:

- `staff_funding_receipts`: `receiptUrl`, `verifiedById`, `verifiedAt`
- `expenses`: `createdById` and later request fields
- `staff_proof_submissions`: `documentUrl`
- `broker_service_visits`: `serviceDay`, `locationName`, `proofUrl`, `notes`
- `attendance`: `overallStatus`
- `staff_work_areas`: current Staff V4 area fields
- `users`: credential-history fields used by current auth

`lib/staff/ensure-operations-schema.ts` now performs additive column checks through `information_schema`, adds only missing columns, and backfills historical service dates and work-area names. Existing data is preserved.

Run:

```powershell
npm run db:fix:staff-operations
npx prisma generate
npm run typecheck
```

Then stop Next.js, delete `.next`, and run `npm run dev` again.
