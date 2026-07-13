# Simamia Float — Accountant Finance Portal

This package creates a complete Accountant portal inspired by the uploaded
pastel-glass finance dashboard.

## Included files

```text
app/accountant/dashboard/page.tsx
app/accountant/dashboard/AccountantDashboardClient.tsx
app/accountant/dashboard/AccountantDashboard.module.css

app/api/accountant/dashboard/route.ts
app/api/accountant/actions/route.ts
app/api/accountant/upload/route.ts

app/api/employee/expenses/route.ts
app/api/staff/bank-deposits/route.ts

lib/accountant-server.ts

prisma/schema.prisma
prisma/seed-accountant-portal.ts
```

## Main portal sections

- Dashboard
- Open Financial Day
- Close Financial Day
- Opening Balances
- Closing Balances
- Cash Book
- General Ledger
- Trial Balance
- Balance Sheet
- Profit & Loss
- Income Statement
- Cash Flow Statement
- Bank Reconciliation
- Expense Approval
- Float Verification
- Financial Reports
- Lock Accounting Periods
- Attendance Management
- Notifications

## Database behavior

The Accountant dashboard reads real records from:

```text
Company
User
Branch
FinancialDay
Expense
BankDeposit
FloatTransaction
Attendance
Notification
ServiceActivity
CompanySetting
AuditLog
AccountingPeriod
```

## Schema additions

The integrated schema adds:

```text
Expense.reviewNote
BankDeposit.bankStatementUrl
BankDeposit.reviewedAt
BankDeposit.holdClearedAt
BankDeposit.holdClearedById
AccountingPeriodStatus
AccountingPeriod
```

The new `AccountingPeriod` model allows monthly accounting locks.

## Install

Back up the current database and schema first.

Copy the package files into the project while preserving the paths.

Replace the current schema only after reviewing the additions:

```text
prisma/schema.prisma
```

Run:

```powershell
npx prisma format
npx prisma validate
npx prisma migrate dev --name accountant_finance_portal
npx prisma generate
```

The project generator remains:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```

The existing `lib/prisma.ts` should import:

```ts
import { PrismaClient } from "../generated/prisma/client";
```

## Start

Clear the Next.js cache:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

Open:

```text
http://localhost:3000/accountant/dashboard
```

## Real database simulation

The optional seed uses an existing active Accountant and operational users from
the same company.

Run:

```powershell
npx tsx prisma/seed-accountant-portal.ts
```

The seed inserts real MySQL records for:

- Financial days
- Customer service income
- Expenses
- Bank deposits
- Float transactions
- Attendance
- Notifications

## Expense workflow

Employees submit through:

```text
POST /api/employee/expenses
```

Required JSON:

```json
{
  "category": "Fuel",
  "amount": 185000,
  "description": "Field motorcycle fuel",
  "receiptUrl": "/uploads/receipt.pdf"
}
```

Supported categories:

- Fuel
- Transport
- Airtime
- Accommodation
- Repairs
- Stationery
- Meals
- Office Expenses
- Emergency Expenses

No expense enters the Cash Book or statements until the Accountant approves it.

## Bank deposit workflow

Operational staff submit through:

```text
POST /api/staff/bank-deposits
```

Required JSON:

```json
{
  "amount": 2500000,
  "referenceNo": "DEP-2026-001",
  "bankAccount": "CRDB-OPERATIONS",
  "depositDate": "2026-07-12T09:00:00.000Z",
  "depositSlipUrl": "/uploads/slip.pdf",
  "bankReceiptUrl": "/uploads/receipt.pdf"
}
```

The Accountant portal compares:

- Amount
- Reference number
- Deposit date
- Bank account
- Deposit slip
- Bank receipt
- Bank statement

Statuses:

- VERIFIED
- AMOUNT_MISMATCH
- MISSING_RECEIPT
- DUPLICATE_DEPOSIT
- MISSING_BANK_RECORD

An unresolved mismatch:

- Blocks financial-day closing
- Places the staff member on Financial Hold
- Prevents another staff deposit
- Creates Accountant and Company Admin alerts

## Bank statement uploads

The local simulation upload route stores PDF, Excel, CSV and image files in:

```text
public/uploads/accounting/{companyId}
```

For production or serverless deployment, replace local storage with persistent
object storage.

## Attendance automation

The **Generate automatically** button evaluates:

- Float received
- Float returned
- Return cutoff time
- GPS movement

Rules implemented:

- Receives float: check-in and initially Present
- Returns before cutoff: Present
- Returns after cutoff: Late
- Does not return after cutoff: Absent
- GPS activity is added to the attendance source
- Manual adjustments are Accountant/Company Admin approved

## Notifications

In-app notifications are stored in the existing `Notification` model.

Optional SMS and email delivery can be connected through generic webhooks:

```env
EMAIL_NOTIFICATION_WEBHOOK_URL=""
SMS_NOTIFICATION_WEBHOOK_URL=""
NOTIFICATION_WEBHOOK_SECRET=""
```

The webhook receives JSON containing:

```json
{
  "channel": "email",
  "to": "recipient@example.com",
  "title": "Expense approved",
  "message": "Your expense was approved.",
  "companyId": "company-id",
  "userId": "user-id"
}
```

The `CompanyAdminSetting` values `sms`, `email` and `inApp` control which
channels are enabled.

## Events covered

- Float approved
- Float confirmed
- Expense approved
- Expense rejected
- Bank mismatch
- Deposit verified
- Attendance warning
- GPS alert
- Day opened
- Day closed
- Low cash balance
- Outstanding float reminder

## No external UI dependency

The portal does not import `lucide-react`. Icons are rendered by the included
component, avoiding another missing-module error.

Charts use SVG and CSS, so no chart package is required.
