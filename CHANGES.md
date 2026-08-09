# Exact changes to the original portal

## Preserved

- Original `AccountantDashboardClient.tsx` implementation.
- Original `AccountantDashboard.module.css` visual design.
- Original page components for the financial day, books, statements, periods, float verification, notifications and profile.
- Original dashboard API and action API supplied with the portal.

## Added to the original client

1. Imported `AccountantOperationsCentre`.
2. Added the following `PageKey` values:
   - Staff Expense Requests
   - Staff Funding Ledger
   - Attendance Progress
   - Fingerprint Devices
   - SMS & Proof Review
   - Admin Verification Documents
   - Performance Reports
3. Added those items to the existing sidebar groups.
4. Mapped the following existing pages to enhanced versions while keeping the same shell:
   - Manual Cashflow
   - Expense Approval
   - Bank Reconciliation
   - Financial Reports
   - Attendance Management
5. Added `AccountantOperationsCentre.tsx` and a matching original-style CSS module.

## CSS diagnostics fixed

- Added `-webkit-backdrop-filter` beside every `backdrop-filter`.
- Removed `scrollbar-width` and `scrollbar-color` declarations that caused compatibility diagnostics.
- Kept WebKit scrollbar styling, gradients, colours, border radii, shadows and animation timing.

## API additions

- Unified enhanced accountant data and actions.
- Fingerprint device management and secure punch ingestion.
- STAFF expense and proof submission.
- Company Admin comparison packets and expense decisions.
- STAFF funding confirmation.
- PDF, CSV and XLSX reporting.
- Secure accounting document uploads.
