# Seed and migration order

The installer runs the database workflow in this order:

1. Merge package scripts and required seed dependencies.
2. `npm install`
3. `npx prisma format`
4. `npx prisma validate`
5. `npx prisma migrate deploy`
6. Execute `prisma/repairs/20260726_add_missing_user_columns.sql`
7. `npx prisma db push`
8. `npx prisma generate`
9. Run `prisma/seed.ts` when it exists.
10. Run `prisma/seed-company-admin.ts` when it exists.
11. Run `prisma/seed-accountant-portal.ts` when it exists.
12. Import `prisma/data/float-agents.json`.
13. Import every `prisma/data/bank-statement*.json`.
14. Verify the imported record counts.

The import scripts are idempotent:

- brokers use `companyId + alias code`;
- agent accounts use `companyId + network + agent number`;
- import batches use `companyId + source checksum`;
- statements use `companyId + statement key`;
- bank transactions use `companyId + reference`.

Do not use `prisma migrate reset` or `prisma db push --force-reset`.
