# SIMAMIA Float - Verification File + Close Financial Day Fix

## Verification document fix

The accountant upload gateway already supported project/public upload paths, but the seeded verification packet files were not physically present. The project now includes:

- `public/uploads/verification/seed-packet-001.pdf`
- `public/uploads/verification/seed-packet-002.pdf`
- ... through `seed-packet-012.pdf`

The files are clearly marked as development/seed attachments and are not production evidence.

`app/api/accountant/uploads/route.ts` also searches the historical `public/uploads/verification` and `public/uploads/proofs` folders by basename, in addition to the newer company-scoped upload folders.

## Financial day close rules

Closing now uses one shared settlement engine: `lib/accountant/close-day.ts`.

A day can close only when:

1. Every bank deposit recorded for that financial day is `VERIFIED` and has no active hold.
2. Every `AccountantStaffFunding` issued on or before that day is fully returned and `VERIFIED` (cancelled funding is ignored).
3. Older `FloatTransaction` staff balances reconcile to zero after verified/approved staff returns are applied.
4. No returned staff money is still waiting for accountant verification.
5. The calculated closing balance is not negative.

The close-day page now shows:

- issued staff float/cash,
- verified returned amount,
- outstanding amount,
- bank blockers,
- funding blockers,
- older float blockers,
- pending return verifications,
- exact blocking references/staff,
- a green Ready to close state when all checks pass.

The backend repeats the same checks, so bypassing the browser button cannot close an unsettled day.

No Prisma schema change is required for this patch.
