# Simamia Company Admin V3 test checklist

## Installation

- [ ] Extract outside the existing project.
- [ ] Run `APPLY-V3.ps1 -ProjectPath "C:\Users\Micha\simamia-float"`.
- [ ] Confirm a `_simamia_v3_backup_<timestamp>` directory was created.
- [ ] Confirm `npm run` lists `dev`, `build`, `start`, `typecheck` and import scripts.
- [ ] Confirm `npm run typecheck` reports no errors.
- [ ] Confirm `npm run build` succeeds.

## Database and import

- [ ] Confirm no database reset was performed.
- [ ] Run `npm run import:all -- COMPANY_CODE`.
- [ ] Confirm the import batch shows 2,273 agent rows.
- [ ] Confirm broker records retain name, MSISDN, alias and source-row metadata.
- [ ] Confirm imported agent network is `OTHER` until manually reviewed.
- [ ] Confirm the CRDB statement account is `0150959326500`.
- [ ] Confirm statement credit, debit and balance totals match the source PDF.
- [ ] Re-run import and confirm no duplicate references or agent codes are created.

## Performance

- [ ] Open Staff Performance.
- [ ] Confirm every Staff/Accountant card shows profile photo/initials.
- [ ] Confirm score, attendance, return rate, services and company income appear.
- [ ] Confirm below-target users show a warning.

## GPS

- [ ] Open GPS Tracking and keep the tab visible.
- [ ] Send new pings from a registered device.
- [ ] Confirm the marker changes within approximately 10 seconds.
- [ ] Confirm the last-refresh time changes.
- [ ] Confirm staff and broker markers remain visually distinct.

## Bank proof and report

- [ ] Submit bank proof with bank name and account details.
- [ ] Confirm records are grouped by bank/account in the grand report.
- [ ] Confirm PDF proofs are appended page-by-page.
- [ ] Confirm JPG/PNG proofs are fitted to pages.
- [ ] Confirm unsupported documents receive reference pages.
- [ ] Confirm page numbers and bank/account summaries are correct.
