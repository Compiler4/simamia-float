# Simamia V3 static validation

Validation completed on 25 July 2026.

## Passed checks

- `package.json` contains `dev`, `build`, `start`, `typecheck`, database sync and data-import scripts.
- `scripts/apply-v3-fixes.mjs` passes `node --check`.
- New TypeScript files were parsed with the TypeScript compiler; only expected unresolved-module errors occurred because dependencies and the generated Prisma Client are installed/generated inside the user's full project.
- Prisma schema additions are structurally placed inside `CompanyBankVerification` and include a bank/account index.
- The upload route now stores compressed bytes as `Uint8Array`.
- The report route callback is explicitly typed.
- The dashboard contains the grand bank report button, user performance profile metrics and 10-second GPS refresh state.
- The sample grand bank report was rendered to five pages. Page 1 has no clipping or overlap; pages 2-5 preserve the supplied CRDB statement.
- The source ZIP contains no `.next`, `node_modules` or generated Prisma-client directory.

## Runtime checks required in the real project

Run these after installation:

```powershell
npm install
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
npm run typecheck
npm run build
```

A database-backed build cannot be completed in the isolated patch folder because it intentionally does not contain the user's authentication implementation, existing generated Prisma Client, MySQL credentials or all project modules.
