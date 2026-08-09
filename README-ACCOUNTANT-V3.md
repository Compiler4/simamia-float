# Simamia Float ERP — Accountant Control Center V3

This is a non-destructive Next.js 16 + Prisma 7 upgrade for the existing Accountant portal. It keeps the existing dashboard, cash book, ledger, trial balance, statements, float verification, period locking and other accounting pages, then adds a new database-backed control center at:

```text
/accountant/control-center
```

## Added sidebar sections

- Overview
- Staff Expenses
- Expense Approval Matrix
- Staff Cash & Float
- Attendance Register
- Attendance Analytics
- Fingerprint Devices
- Staff Proof & SMS
- Admin Verification Documents
- Bank Reconciliation
- Financial & Performance Reports
- Notifications

## Main rules implemented

### Staff-only attendance

The attendance query fetches only users with:

```text
role = STAFF
status = ACTIVE
same companyId as the Accountant
```

Morning and evening are separate records. Manual attendance is restricted to the Accountant route. Fingerprint attendance is accepted only from a registered device. A best-effort compatibility helper also updates the existing legacy `Attendance` table so older Staff dashboards and attendance reports continue to see the verified daily result.

### Fingerprint devices

Only `ACCOUNTANT` and `COMPANY_ADMIN` routes can register devices and enrol staff template references. The system stores a vendor template key, not a raw fingerprint image.

A real fingerprint device still needs its vendor SDK, Windows service, Android service or local middleware. That bridge sends a scan to:

```text
POST /api/accountant/fingerprint/check-in
x-device-token: GENERATED_DEVICE_TOKEN
```

Example body:

```json
{
  "serialNumber": "ZK-001992",
  "templateKey": "vendor-template-28",
  "session": "MORNING"
}
```

### Dual expense approval

- Company Admin approves + Accountant approves = `APPROVED`
- Either role rejects = `REJECTED`
- Only one role has approved = `PENDING`

Company Admin actions use:

```text
/api/company-admin/accountant-bridge
```

### Staff cash plus float

The Accountant can post both `FLOAT` and `CASH` entries. The portal combines the existing `FloatTransaction` records with the new manual float/cash register, then calculates every active Staff user and the whole company:

```text
net available = system float + manual float + cash issued - float/cash returned
```

Staff cash and float transfers are treated as working capital, not company income. Generated income comes from completed company service activities across all users, which prevents returned float or allocated cash from overstating profit.

### Staff proof, SMS and documents

The control center automatically bridges existing `StaffFile` records into the verification queue. Staff can also submit new evidence through:

```text
/api/staff/verification-packets
```

The Company Admin adds a reference file or message. The Accountant compares both sides, verifies or rejects, adds a reason, and the respective Staff user receives a notification.

### Bank reconciliation

Existing `BankDeposit` records are automatically bridged into the new comparison queue. The staff bank proof is compared with Company Admin statement data. Amount, reference, transaction date and bank account must all match before the Accountant can verify it.

### Reports

The report page supports:

- Day, week, month, year and custom date range
- Preview before export or print
- PDF export
- CSV export
- Excel export
- Financial totals
- Combined income from all users
- Attendance leaders
- Staff performance
- Staff cash and float totals


## Companion workflow pages

The package includes the pages needed by all three roles, not only the Accountant API:

```text
/accountant/control-center
/company-admin/accountant-bridge
/admin/accountant-bridge              compatibility alias
/staff/verification-center
```

Use the ready-made sidebar snippets:

```text
patches/ACCOUNTANT-DASHBOARD-SIDEBAR-PATCH.txt
patches/COMPANY-ADMIN-SIDEBAR-PATCH.txt
patches/STAFF-SIDEBAR-PATCH.txt
```

The Staff page uploads proofs, documents, SMS/message evidence and bank proof. The Company Admin page supplies the official reference file/message, makes its expense decision, supplies bank statement values, and can register approved fingerprint devices. The Accountant performs the final comparison and decision.

## Upload endpoint

All three new pages use:

```text
POST /api/accountant-v3/uploads
```

Allowed types include PDF, Word, PNG, JPG, WEBP, text, CSV and Excel files. The local package stores files under `public/uploads/accountant-v3/<companyId>/<role>`. Replace this with private object storage for production.

## Copy files

Copy these folders into the project root:

```text
app/
components/
lib/
patches/
prisma/
scripts/
```

Do not delete your existing Accountant files.

## Install automatically

From PowerShell in the project root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-accountant-v3.ps1
```

The script:

1. Backs up `prisma/schema.prisma`.
2. Appends the V3 Prisma models once.
3. Installs `pdf-lib` and `xlsx`.
4. Runs Prisma format, validate, db push and generate.
5. Clears `.next`.

Then run:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000/accountant/control-center
```

## Manual install

Append this file to the end of `prisma/schema.prisma`:

```text
prisma/accountant-v3-extension.prisma
```

Then run:

```powershell
npm install pdf-lib xlsx
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

## Add the link to the existing Accountant sidebar

Use:

```text
patches/ACCOUNTANT-DASHBOARD-SIDEBAR-PATCH.txt
```

This adds an `Operations Control Center` link without replacing the existing Accountant dashboard.

## Existing project requirements

These exports must already work:

```ts
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
```

The shared Prisma client should use the generated client from:

```text
generated/prisma
```

Use only one shared Prisma singleton.

## Validation included

The package was syntax-checked across every supplied TypeScript and TSX file. A complete `tsc --noEmit` run must still be performed inside your real Simamia project because only that project contains your current Prisma client, authentication types, existing `Expense`, `Attendance`, `FloatTransaction`, `Notification` models and Next.js configuration.

Recommended final commands:

```powershell
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run typecheck
npm run dev
```

## Important production notes

- Replace plain uploaded file URLs with your existing private upload/storage route.
- Keep device tokens secret and rotate them when a device is replaced.
- Use HTTPS in production.
- A fingerprint vendor SDK is required for physical hardware communication.
- Back up MySQL before any schema operation.
