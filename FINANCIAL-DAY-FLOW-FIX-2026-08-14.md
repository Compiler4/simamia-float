# SIMAMIA Financial Day Flow Fix — 2026-08-14

## Operating rule

SIMAMIA now uses one financial operating state for each company:

- `ACTIVE` — exactly one `FinancialDay` has status `OPEN`. Controlled financial work may be posted.
- `REST` — no `FinancialDay` is `OPEN`. Financial posting endpoints reject new financial work until the Accountant opens the next day.

## Open Financial Day

1. Accountant selects the financial date.
2. The accounting month must not be locked.
3. No other financial day may already be OPEN.
4. The same date must not already have a financial-day record. A CLOSED day cannot be silently reopened.
5. If a previous CLOSED day exists, its closing balance is automatically carried forward as the new opening balance.
6. If this is the first financial day, the Accountant enters the verified starting balance.
7. The new day is created as `OPEN`, audited, and financial operations become ACTIVE.

## During an OPEN day

The server enforces the financial-day state; disabling buttons in the UI is not the security control.

Guarded financial actions include:

- accountant staff float/cash issue
- accountant manual receipts
- accountant expense creation/decision
- accountant bank deposit review and financial-hold clearing
- accountant float approval/rejection
- journal/cash-book posting through `postBalancedEntry`
- staff confirmation, float issue, collection, return, bank deposit, proof, expense and service operations
- staff standalone bank-deposit and expense endpoints
- Company Admin staff funding and automatically approved company expenses

If no financial day is open, these return HTTP 409 with a clear REST-state message.

## Close Financial Day

Close is allowed only for an OPEN day and only when `getCloseDaySettlement()` reports `canClose: true`.

The check includes:

- all staff float/cash issued is fully returned and verified
- returned amounts waiting for Accountant verification still block close
- legacy staff float transactions reconcile to zero outstanding
- current-day bank deposits are VERIFIED and have no active hold
- the calculated closing balance is not negative

On successful close:

- live `cashIn`, `cashOut` and `closingBalance` are saved
- status changes to `CLOSED`
- `closedById` and `closedAt` are recorded
- the action is audited
- financial operations switch to REST
- the next OPEN day will automatically carry this closing balance forward

## Important files

- `lib/accountant/accounting.ts` — Tanzania day boundaries + financial-day guard + journal posting guard
- `lib/accountant/actions.ts` — canonical OPEN_DAY/CLOSE_DAY workflow and Accountant financial actions
- `lib/accountant/close-day.ts` — settlement and closing preview
- `lib/accountant/portal.ts` — dashboard `financialDayControl` state
- `app/accountant/AccountantDashboardClient.tsx` — ACTIVE/REST UI and closing blockers
- `app/api/accountant/actions/route.ts` — canonical action endpoint
- legacy accountant action endpoints now delegate to the canonical service

## Validation

The repaired source was checked with:

```powershell
npx tsc --noEmit --incremental false
```

and passed with zero TypeScript errors in the prepared source.
