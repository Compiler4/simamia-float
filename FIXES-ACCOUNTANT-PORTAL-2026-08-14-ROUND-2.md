# Accountant Portal Reliability Fixes — Round 2 (2026-08-14)

## Included fixes

### 1. SMS & Proof Review document recovery
- Accountant proof review now prefers the linked `StaffFile` record when it exists.
- Local/historical proof paths are opened through `/api/accountant/uploads` with company-scoped authorization.
- Seed proof PDFs `seed-proof-001.pdf` through `seed-proof-012.pdf` are included under `public/uploads/proofs/` so the seeded demo records have actual reviewable files.
- Seed files are visibly labelled as demo/test evidence and must not be treated as real transaction evidence.
- When a historical/live record points to a file that is genuinely gone, Proof Review now includes **Replace/recover document**. The replacement is uploaded and the proof record is updated through the audited `REPLACE_PROOF_DOCUMENT` action.

### 2. System-wide table alignment
- Native table display semantics are enforced for `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, and `td`.
- Accountant operation-table `<th>` elements are no longer `inline-flex`.
- Header icon/text flex styling now lives inside `.opTableHeaderLabel`, while the `<th>` remains a real table cell.
- This fixes the header/body column drift shown in Expense Requests, Funding Ledger, Attendance Progress, Fingerprint Devices, Fingerprint Assignments, SMS & Proof Review, and other portal tables.
- Wide tables retain horizontal scrolling rather than breaking TH/TD alignment.

### 3. Accountant Profile & Security
The Accountant Profile page now supports:
- full name
- username
- email
- phone
- assigned region
- nationality
- physical address
- profile image
- secure password change

Sensitive account-detail changes require the current password. Password changes require the current password and enforce a minimum password policy. Passwords are verified/hashed with bcrypt and the actions are audited.

### 4. Close Financial Day blocker correction
The control remains intentional: a financial day must not close while a real bank mismatch or financial hold is unresolved.

The previous bug was that clearing a hold did not change the mismatch status, so the same record could continue blocking forever. The close-day query now considers a mismatch resolved when `holdClearedAt` is set and `holdActive` is false.

Active holds and mismatch rows that have never been investigated/cleared still block closing.

The Close Financial Day page now:
- lists every current blocker
- shows reference, staff, amount, status, hold and reason
- provides a direct **Resolve blockers in Bank Reconciliation** button
- enables Close only after the blocker count becomes zero

## Validation performed

```powershell
npx tsc --noEmit
```

TypeScript validation passes with zero type errors.

Both updated CSS files were parsed successfully with PostCSS.

## Windows refresh after replacing project files

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm install
npx prisma generate
npm run dev
```
