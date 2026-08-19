# SIMAMIA Staff Dashboard V11 — definitive hydration repair

## Why V10 could still fail

The previous version rendered a server-side `StaffDashboardHydrationShell` while `StaffDashboardClient` switched to the full interactive dashboard after a `useEffect`. In normal production hydration this often works, but during Next.js dev/Turbopack Fast Refresh the client can preserve component state while the server sends fresh HTML. The result is exactly the reported mismatch:

- server: `<main class="...shell" aria-busy="true" data-hydration-shell="staff-dashboard"><aside ...>`
- client: `<main class="...shell "><button class="...backdrop ...">...`

V11 removes that two-tree design completely.

## V11 architecture

`app/staff/dashboard/page.tsx` remains a Server Component. It authenticates the user and passes serializable user data and the Tanzania reference date to:

`app/staff/dashboard/StaffDashboardEntry.tsx`

`StaffDashboardEntry.tsx` is a tiny Client Component and loads the large dashboard with:

```tsx
const StaffDashboardClient = dynamic(
  () => import("./StaffDashboardClient"),
  { ssr: false, loading: () => <StaffDashboardBootScreen /> },
);
```

The real dashboard therefore is not server-rendered. GPS, Leaflet, `navigator`, `localStorage`, image compression and other browser-only logic can no longer produce an SSR hydration mismatch inside the staff workspace.

## Install

1. Stop the running dev server with `Ctrl+C`.
2. Extract this ZIP.
3. Open PowerShell in the extracted folder.
4. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\apply-fix.ps1 -ProjectRoot "C:\Users\Micha\simamia float"
```

5. Start again:

```powershell
cd "C:\Users\Micha\simamia float"
npx prisma generate
npm run dev
```

6. Open `/staff/dashboard` in a new tab. A single `Ctrl+Shift+R` is enough if Chrome kept an older tab.

## Verify the files before starting Next.js

```powershell
.\verify-hydration-fix.ps1 -ProjectRoot "C:\Users\Micha\simamia float"
```

All checks must say `PASS`.

You can also manually check:

```powershell
Select-String -Path "C:\Users\Micha\simamia float\app\staff\dashboard\page.tsx" -Pattern "StaffDashboardEntry|StaffDashboardClient"
Select-String -Path "C:\Users\Micha\simamia float\app\staff\dashboard\StaffDashboardEntry.tsx" -Pattern "next/dynamic|ssr: false"
```

The page should use `StaffDashboardEntry`, and `StaffDashboardEntry.tsx` should contain `ssr: false`.

## If the same old stack trace appears

If the overlay still says `StaffDashboardClient` is rendered directly by `StaffDashboardPage`, the running project is not using the V11 `page.tsx`. Confirm the path is exactly `C:\Users\Micha\simamia float`, stop all old Next.js terminals, remove `.next`, and restart.

The stack trace also shows a Chrome extension content script. Extensions can alter DOM before hydration. V11 removes the application-level mismatch, but if a mismatch remains after V11 verifies successfully, test once in an Incognito window with extensions disabled to separate extension DOM changes from application code.

## Included functionality

V11 keeps all V9/V10 staff features: authenticated staff-only data, main-content period filter, secure financial previews, report-style fallback previews, attendance dashboard, staff GPS pings, live map, assigned broker/agent markers, service visits, settlement, bank verification, expenses, transactions, performance, reports, notifications and profile flows.
