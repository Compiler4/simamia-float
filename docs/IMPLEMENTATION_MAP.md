# V3 implementation map

| Requirement | Main implementation |
|---|---|
| Restore `npm run dev` | `scripts/apply-v3-fixes.mjs`, merged `package.json` scripts |
| Preserve existing dependencies | Installer excludes source `package.json`; merge script edits target package safely |
| Fix ten TypeScript errors | `scripts/apply-v3-fixes.mjs`, `types/pdf-parse.d.ts`, dependency merge |
| Avoid Prisma data loss | `APPLY-V3.ps1` uses `prisma db push`, never `migrate reset` |
| User performance profile cards | `CompanyAdminDashboardClient.tsx`, `.performanceCardStats` CSS |
| Moving live GPS | 10-second visible-tab refresh in `GpsPage`; existing device/ping map data updates |
| Excel agent import | `scripts/import-float-agents.ts` |
| Combined Excel/PDF import | `scripts/import-all-data.ts` |
| CRDB statement import | `scripts/import-crdb-statement.ts` |
| Bank name/account grouping | `CompanyBankVerification.bankName`, `accountName`, compound index |
| Grand proof PDF | `/api/company-admin/reports/bank-bundle` |
| Append PDFs/images | `pdf-lib` route copies PDF pages and embeds JPG/PNG proofs |
| Sample output | `samples/sample-grand-bank-proof-report.pdf` |
| Safe installation/backup | `APPLY-V3.ps1` |
