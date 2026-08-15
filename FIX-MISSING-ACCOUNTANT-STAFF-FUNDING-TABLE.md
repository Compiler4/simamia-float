# Fix: `accountant_staff_fundings` table does not exist

The Prisma model already exists in `prisma/schema.prisma`, but older databases may not contain its mapped MySQL/TiDB table.

## Fast, targeted repair

From the project root:

```powershell
npm run db:fix:accountant-funding
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

The repair is additive. It creates `accountant_staff_fundings` only when it does not already exist and then verifies the table through Prisma.

## Deployment migration

A matching additive migration is included at:

`prisma/migrations/20260814193500_add_accountant_staff_fundings/migration.sql`

Use the project's normal database deployment procedure for hosted environments.

## Alternative schema-wide development sync

The project already defines `npm run db:sync` as `prisma db push`. This can synchronize all schema differences, not only this one table. The targeted repair above is preferable when you only want to fix this missing table.
