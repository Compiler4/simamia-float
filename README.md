# Simamia Accountant Manual Float Assignment

This package adds a complete Manual Cashflow workspace to the Accountant Portal.

## New workflow

The accountant can:

1. Open the financial day.
2. Open **Manual Cashflow** from the sidebar.
3. Select an active user whose role is `STAFF`.
4. Enter the float amount, date, purpose, reference, notes and optional proof.
5. Save the assignment.
6. The system creates a `FloatTransaction` with:
   - `transactionType = ACCOUNTANT_TO_STAFF`
   - `fromUserId = current accountant`
   - `toUserId = selected staff`
   - `status = ISSUED`
7. The staff officer receives a notification and confirms the float from the Staff Portal.

The same page keeps the existing manual cash-receipt form and register.

## Files

```text
app/accountant/dashboard/AccountantDashboardClient.tsx
app/accountant/dashboard/AccountantDashboard.module.css
app/api/accountant/manual-float/route.ts
```

## Database

No new Prisma model is required. The workflow uses the existing:

```prisma
model FloatTransaction
```

The model must contain:

```prisma
transactionType StaffFloatType
fromUserId       String?
toUserId         String?
referenceNo      String?
amount           Decimal
status           FloatStatus
issuedAt         DateTime?
```

The enum must contain:

```prisma
ACCOUNTANT_TO_STAFF
```

## Install

Extract this ZIP and run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\INSTALL.ps1
```

Then:

```powershell
cd C:\Users\Micha\simamia-float
npm run dev
```

## Test

While signed in as ACCOUNTANT, open:

```text
http://localhost:3000/api/accountant/manual-float
```

A GET request returns the current accountant's manual staff-float assignments.

Use the **Manual Cashflow** sidebar page to create a new assignment.
