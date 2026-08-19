# Super Admin Sidebar Repair — 2026-08-16

The Super Admin dashboard navigation was upgraded so every sidebar module has a durable URL and an immediate client-side state transition.

## Main changes

- Every sidebar item is now an anchor with a real `/super-admin/dashboard?module=...` URL.
- Clicking a module switches the content immediately without a full page refresh.
- Browser Back/Forward changes the selected module correctly.
- Mobile sidebar closes after a module is selected.
- Active module highlighting is persistent and accessible with `aria-current="page"`.
- If `/api/super-admin/dashboard` has a temporary error, the warning is shown without trapping the user on an error screen; module navigation still works using safe empty dashboard data.
- A current-module command strip and refresh control were added.
- Sidebar styling was upgraded with module descriptions, active-state indicator, status badge, glass effects, and responsive collapsed/mobile states.

## Validation

Run:

```powershell
npm run check:super-admin
npm run typecheck
```

The existing route, portal and role validators can also be run:

```powershell
npm run check:routes
npm run check:portals
npm run check:roles
```
