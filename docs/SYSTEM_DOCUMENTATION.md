# Simamia Float System Documentation

Simamia Float is a multi-role float, finance, staff operations, broker, GPS, and verification system for companies that manage field staff and agent/broker cash movement.

## Main Roles

| Role | Main workspace | Responsibility |
|---|---|---|
| `SYSTEM_DEVELOPER` | `/developer/dashboard` | technical/system oversight |
| `SUPER_ADMIN` | `/super-admin/dashboard` | companies, company admins, subscriptions, platform reporting |
| `COMPANY_ADMIN` | `/admin/dashboard`, `/company-admin/*` | company setup, users, brokers, staff assignment, approvals, GPS, reports |
| `ACCOUNTANT` | `/accountant/dashboard` | float issuing, attendance, deposits, bank verification, expenses, reports |
| `STAFF` | `/staff/dashboard` | field float, broker service, GPS, proofs, expenses, funding receipts |
| `GPS_MANAGER` | company routes | GPS device/location review where enabled |

The root route `/` redirects to `/login`. After login, `lib/auth.ts` signs a secure session cookie and redirects the user by role.

## Core Modules

### Authentication And Sessions

Files:

- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/session/route.ts`
- `lib/auth.ts`

How it works:

1. User submits username/email and password.
2. Password is verified with bcrypt.
3. A signed HTTP-only session cookie is created.
4. Role-based dashboards are selected with `getDashboardPath()`.

Production requirements:

- `AUTH_SECRET` or `SESSION_SECRET` must be set.
- HTTPS is required for secure cookies and GPS/PWA behavior.

### Super Admin

Files:

- `app/super-admin/dashboard`
- `app/api/super-admin/*`

Main responsibilities:

- create, edit, suspend, reactivate, and review companies
- create and manage company administrators
- manage subscriptions
- inspect platform-level users, reports, and audit activity
- reset user passwords where allowed

### Company Admin

Files:

- `app/admin/dashboard`
- `app/company-admin/*`
- `app/api/company-admin/*`
- `lib/company-admin-server.ts`

Main responsibilities:

- company users and branches
- broker/customer registration
- broker agent accounts and SIM/network details
- staff work-area and broker assignment
- bank verification workflow
- expenses and dual approval
- GPS devices, pings, live maps, and alerts
- service visits and proof review
- PDF/CSV reports and bank proof bundles

Important tables:

- `CompanyExpense`
- `CompanyBankVerification`
- `CompanyBankMessage`
- `CompanyGpsDevice`
- `CompanyGpsPing`
- `BrokerCustomer`
- `BrokerAgentAccount`
- `PortalDocument`
- `ApprovalDecision`
- `NetworkBalance`

### Accountant

Files:

- `app/accountant/dashboard`
- `app/api/accountant/*`
- `lib/accountant/*`

Main responsibilities:

- open and close financial days
- issue staff float/cash
- verify staff returns and bank deposits
- maintain attendance records
- manage fingerprint attendance devices
- approve or reject expenses
- compare staff proof against admin bank/reference packets
- export accountant reports

Important tables:

- `FinancialDay`
- `FloatTransaction`
- `BankDeposit`
- `Expense`
- `Attendance`
- `AccountingPeriod`
- `StaffFundingReceipt`
- `StaffProofSubmission`
- accountant-v3 models such as `AccountantAttendance`, `AccountantBankDeposit`, and `AccountantVerificationPacket`

### Staff Operations

Files:

- `app/staff/dashboard`
- `app/staff/brokers`
- `app/staff/live-locations`
- `app/staff/verification-center`
- `app/api/staff/*`
- `lib/staff/*`

Main responsibilities:

- view assigned brokers and agent accounts
- receive/confirm float and cash funding
- submit receipts, SMS proof, bank proof, and expenses
- record broker service visits
- update broker GPS points when allowed
- send live GPS pings
- view own notifications, reports, attendance, and performance

Important tables:

- `StaffNetworkLine`
- `StaffFundingReceipt`
- `StaffProofSubmission`
- `StaffFile`
- `StaffBrokerCustomerAssignment`
- `StaffWorkArea`
- `BrokerServiceVisit`
- `GpsAlert`

### Broker And Agent Accounts

Files:

- `app/api/company-admin/brokers/*`
- `app/api/staff/brokers/route.ts`
- `lib/staff/broker-scope.ts`

How it works:

1. Company Admin registers broker/customer records.
2. Each broker can have one or more agent accounts/SIM lines.
3. Staff are assigned to brokers directly or by work area.
4. Staff can view and service only brokers visible to them.
5. Location updates are scoped to assigned/visible brokers.

### GPS And Attendance

Files:

- `app/api/gps/ping/route.ts`
- `app/api/staff/gps/route.ts`
- `app/api/staff/live-locations/route.ts`
- `app/api/attendance/device-punch/route.ts`
- `app/api/fingerprint/*`
- `lib/staff/attendance.ts`

How it works:

- Staff browser GPS records pings and device status.
- Live location pages combine staff devices, broker devices, broker database coordinates, and recent visits.
- Fingerprint devices can submit morning/evening attendance.
- Cron checks can create offline and missed-return alerts.

Production requirements:

- HTTPS domain.
- Staff must allow browser location.
- `CRON_SECRET` if scheduled routes are enabled.

### Documents, Uploads, And Reports

Files:

- `app/api/company-admin/uploads/route.ts`
- `app/api/staff/upload/route.ts`
- `app/api/staff/files/[id]/route.ts`
- `app/api/company-admin/reports/export/route.ts`
- `app/api/company-admin/reports/bank-bundle/route.ts`
- `app/api/staff/operations/report/route.ts`

How it works:

- Company documents are tracked in `PortalDocument`.
- Private staff files are tracked in `StaffFile`.
- Reports generate PDFs/CSVs from database rows.
- Bank bundle reports can append linked proof files when the files are available to the server.

Production note:

- Traditional Node hosting can use the existing local folders.
- Vercel production should use object storage for persistent uploads.

## Database And Prisma

Files:

- `prisma/schema.prisma`
- `prisma.config.ts`
- `lib/prisma.ts`
- `scripts/prisma-generate-safe.mjs`

The Prisma schema is the source of truth for runtime models. The app uses a MariaDB adapter and expects these connection variables:

```env
DATABASE_HOST
DATABASE_PORT
DATABASE_USER
DATABASE_PASSWORD
DATABASE_NAME
DATABASE_CONNECTION_LIMIT
DATABASE_URL
```

Useful commands:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run db:schema:sync
npm run typecheck
npm run build
```

## How To Use The System

1. Super Admin creates a company and company admin.
2. Company Admin creates branches and users.
3. Company Admin registers brokers and agent accounts.
4. Company Admin assigns staff to brokers/work areas.
5. Accountant opens the financial day and issues float/cash.
6. Staff confirms funding, serves brokers, records GPS, and uploads proof.
7. Accountant verifies proof, deposits, attendance, and expenses.
8. Company Admin and Accountant complete dual approvals where required.
9. Reports are exported for bank proof, staff operations, and company performance.

## Deployment Checklist

1. Configure production database.
2. Set Vercel environment variables.
3. Deploy from GitHub.
4. Run Prisma schema sync.
5. Check `/api/health/database`.
6. Test `/login`.
7. Test each role dashboard.
8. Configure persistent object storage before production upload usage.
9. Enable cron jobs only after choosing the correct Vercel plan/schedule.
