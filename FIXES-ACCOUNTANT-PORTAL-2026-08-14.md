# SIMAMIA Float — Accountant / Reporting Reliability Pass

Date: 2026-08-14

## Implemented

- Financial Day cannot close while bank mismatches or active holds remain unresolved; the UI shows blocker count/details and the API persists a blocker reason.
- Staff Expense Request, Float Verification, SMS/Proof Review and Admin Verification file links use one authenticated accountant upload gateway that resolves legacy/private/local paths.
- Accountant expense Approve/Reject now writes the selected final status immediately and keeps approval-decision audit records.
- Expenses created by Company Admin are automatically APPROVED.
- Reopen Request now creates an actual pending AccountantPeriodReopenRequest visible to Company Admin and approved reopen requests synchronize the legacy AccountingPeriod back to OPEN.
- Attendance filter now applies to the displayed attendance report table after Apply Filter.
- Financial/Performance/Funding/Attendance/Fingerprint/Admin-document tables use native table-cell layout so TH and TD columns remain aligned.
- Global table-cell reliability styling plus subtle non-interactive glass polish across role dashboards.
- Shared branded PDF table engine for Accountant reports with registered company logo/details, summaries, repeated headers, aligned columns and correct page footers.
- Company Admin report export and bank proof bundle receive the same registered company identity.
- Staff Grand Transaction Report receives registered company identity while preserving ledger-style reporting.
- Company Settings now lets Company Admin upload the report logo and save Registration Number, TIN and Website used by PDF exporters.

## Validation

- `tsc --noEmit --pretty false`: PASS, zero TypeScript errors.
- Branded PDF smoke render: PASS, aligned tables, repeated page identity, no blank footer-only pages.
- Full Next production build could not be completed in this Linux sandbox because the uploaded `node_modules` contain Windows-native Next/SWC/esbuild binaries and Prisma attempted to download a Linux engine while outbound package download is unavailable. Run `npm install` (or your normal package install) on the target machine and then `npm run build`.

## Deployment note for uploaded files

The project currently writes uploads to local filesystem paths. On serverless hosts, local runtime storage may be ephemeral. The new gateway fixes resolvable legacy paths, but files that a host has already deleted cannot be reconstructed. For permanent production uploads, use durable object storage (for example S3-compatible storage or another persistent upload service) and save that durable URL in the database.
