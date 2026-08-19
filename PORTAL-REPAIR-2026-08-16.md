# SIMAMIA portal repair - 2026-08-16

This project copy repairs the portal failures reported in Company Admin, Staff and Accountant.

## Repaired areas

- Company Admin collection APIs now have working POST handlers for users, branches, expenses, bank verification uploads, network balances and GPS devices.
- Bank verification decisions use PATCH on `/api/company-admin/bank-verifications/[id]`.
- Grand Bank Proof Report no longer queries the non-existent `CompanyBankVerification.bankName` field. Bank/account labels are derived from imported bank statement metadata by account number.
- Staff `/api/staff/operations` is restored as a JSON API instead of accidentally returning the report/PDF route response.
- `/staff`, `/accountant`, `/developer`, `/super-admin`, and generic `/dashboard` have safe role-aware entry routes.
- The stale encoded `agent-location/%5Btoken%5D` route was removed; the valid `[token]` route remains.
- Legacy uploaded expense receipts can be served through the durable upload gateway, and the development-only seeded `seed-expense-002.pdf` placeholder is present.
- Accountant OPEN_DAY / CLOSE_DAY use the existing guarded financial-day workflow and settlement checks. Closing is blocked until staff funding/returns and bank controls are balanced.

## Database note

The Accountant close-day workflow requires the `accountant_staff_fundings` table. On an existing database, run the provided non-destructive repair script:

```powershell
npm run db:fix:accountant-funding
```

Do not use `prisma migrate reset` or a force reset on a database containing real data.

## Verify after extraction

```powershell
npm install
npx prisma generate
npm run db:fix:accountant-funding
npm run check:routes
npm run check:portals
npm run typecheck
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

The ZIP intentionally excludes `.env`. Copy your existing `.env` into the new project before running it.
