# Staff operations workspace repair

This release repairs the Staff portal error:

> Staff operations could not load / The staff operations workspace could not load.

## Root cause

The Staff V4 workspace queried several Prisma models in one `Promise.all`. The legacy database export included the main Staff tables, but did not include several later Staff V4 tables such as `staff_funding_receipts`, `staff_proof_submissions`, `broker_service_visits`, `staff_broker_customer_assignments`, `broker_agent_accounts`, `staff_network_lines`, and `staff_work_areas`. One missing table caused the complete workspace request to return 500.

## Fixes

- Added an idempotent Staff schema repair helper using `CREATE TABLE IF NOT EXISTS`.
- `/api/staff/operations` runs that repair before reading or writing Staff V4 records.
- Individual optional datasets are isolated. If one module still has a schema problem, the rest of the Staff workspace opens and reports a non-blocking warning.
- Broker assignment lookup falls back to the staff member's assigned area when newer assignment tables are unavailable.
- Broker account lookup falls back without agent-account metadata instead of crashing.
- Added the missing `serviceDay` when creating a broker service visit.
- Added proper 401/403 Staff session handling in the advanced workspace.
- Added `npm run db:fix:staff-operations` for a manual one-time database repair.
- Added `npm run check:staff-operations` for source validation.

## Recommended first run

```powershell
npm install
npx prisma generate
npm run db:fix:staff-operations
npm run db:fix:accountant-funding
npm run check:staff-operations
npm run typecheck
npm run dev
```
