# Staff Operations V4 test checklist

## Installation

- [ ] `npm install` completes.
- [ ] `npx prisma validate` completes.
- [ ] `npx prisma db push` completes without a destructive-change warning.
- [ ] `npx prisma generate` completes.
- [ ] `npm run typecheck` completes.
- [ ] `npm run dev` starts.

## Admin/accountant setup

- [ ] Open `/admin/staff-operations` as Company Admin.
- [ ] Open `/accountant/staff-operations` as Accountant.
- [ ] Register two or more network lines for one staff member.
- [ ] Assign at least two active brokers to that staff member.
- [ ] Issue float only, cash only and float + cash records.

## Staff funding

- [ ] Staff sees only their network lines.
- [ ] Staff can confirm multiple receipts on the same date.
- [ ] Line balances increment only after confirmation.
- [ ] Daily funding totals match confirmed receipts.

## Broker and service security

- [ ] Staff sees only explicitly assigned brokers or assigned-region fallback brokers.
- [ ] Search works with one/two starting letters and multiple words.
- [ ] Issuing float to an unassigned broker returns 403.
- [ ] Recording service for an unassigned broker returns 403.
- [ ] Updating service changes the broker map location.

## Proofs and documents

- [ ] JPG/PNG/WEBP/PDF uploads complete.
- [ ] A copied SMS can populate reference, sender, receiver and amount.
- [ ] Missing proof/SMS content is rejected.
- [ ] Duplicate reference is rejected.
- [ ] Proof starts as PENDING.
- [ ] Accountant/Company Admin can verify/reject.
- [ ] Staff receives the result notification.
- [ ] Staff cannot open another staff member's file.
- [ ] Weekly folder totals and document counts are correct.

## Expenses

- [ ] OTHER category requires a custom category.
- [ ] Reimbursement, advance and direct-payment requests save.
- [ ] Expense remains PENDING until review.
- [ ] Accountant/Company Admin can approve/reject.

## GPS and attendance

- [ ] Location permission request appears after staff login.
- [ ] Staff device location reaches `/api/staff/gps`.
- [ ] Staff map pointer is green and broker pointer is purple.
- [ ] Travel route is dotted.
- [ ] Travel distance increases after real movement.
- [ ] Morning check-in and evening check-out appear read-only.
- [ ] Unserved broker reminder works.

## Reports

- [ ] DAY, WEEK, MONTH and YEAR filters change records.
- [ ] PDF includes only the logged-in staff member.
- [ ] CSV opens correctly in Excel.
- [ ] Grand PDF appends supported private proofs.
- [ ] Browser print opens from the PDF.
