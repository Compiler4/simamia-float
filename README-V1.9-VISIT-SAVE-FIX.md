# Simamia Float ERP — Live Location Visit Save Fix v1.9

This release fixes the message **“Broker visit could not be updated”** and removes the duplicated visited-agents table from Live Locations.

## Why the update was failing

The previous save workflow treated all of the following as one required operation:

1. Save `broker_service_visits`.
2. Save or update `service_activities`.
3. Update broker attendance metadata.
4. Update broker coordinates.

When an optional `service_activities` link or an older broker attendance column was not synchronized, the entire visit appeared to fail even though the essential visit record could be saved.

The new workflow uses `broker_service_visits` as the source of truth:

1. Save or update today's broker visit first.
2. Update the broker's real GPS coordinate and attendance metadata with a compatibility fallback.
3. Synchronize `service_activities` separately.
4. Return success when the visit was saved, while returning a visible warning if an optional link needs database synchronization.

A fast double-click is also handled by reloading and updating today's existing visit instead of creating a duplicate.

## New Live Location behaviour

Clicking **Mark visited & serviced** now:

- Captures the logged-in Staff Officer's current browser GPS.
- Confirms the broker is assigned directly or belongs to the Staff work area.
- Creates or updates today's `broker_service_visits` record.
- Sets status to `COMPLETED`.
- Sets service type to `BROKER_VISIT_SERVICE`.
- Saves latitude, longitude, accuracy, arrival time and service time.
- Replaces an old approximate broker point with the captured GPS point.
- Updates `attendedBy`, `attendedDate` and `attendedLocation` when those columns exist.
- Synchronizes the linked `service_activities` record when available.
- Refreshes Live Locations immediately.
- Signals the Service Visits sidebar and writes a local synchronization timestamp.

A stale or approximate existing broker coordinate no longer blocks the quick update. The Staff Officer must still have the broker in their assignment scope.

## Service Visits layout

The duplicated HTML table has been removed from Live Locations.

Live Locations keeps a compact **Today's broker service visits** card list. The complete editable records are displayed under:

`Operations → Service Visits`

That section is now named **Today's Broker Service Visits** and:

- Loads only today's database records.
- Refreshes immediately when the Live Location button succeeds.
- Checks the database every 5 seconds while open.
- Refreshes when the page becomes visible again.
- Shows broker, time, status, float and cash.
- Provides an Edit button for service type, float, cash, income, status, location and notes.

## Files changed

- `lib/staff/service-visits.ts`
- `app/api/staff/service-visits/route.ts`
- `app/api/staff/live-locations/route.ts`
- `app/staff/live-locations/StaffLiveLocationsClient.tsx`
- `app/staff/dashboard/StaffAdvancedOperations.tsx`
- `lib/staff/broker-scope.ts` retains the previous nullish-coalescing syntax fix.

## Installation

Stop Next.js and extract this package into your project root:

```powershell
Ctrl + C
cd C:\Users\Micha\simamia-float
```

Synchronize the database and regenerate Prisma Client:

```powershell
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
```

Clear stale Turbopack output:

```powershell
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

npm run dev
```

Perform a hard browser refresh with `Ctrl + Shift + R`.

## Test

1. Sign in as Staff.
2. Open `GPS Tracking → Live Locations`.
3. Allow browser location permission.
4. Click **Mark visited & serviced** on an assigned broker.
5. Confirm the broker marker changes to visited/serviced.
6. Open `Operations → Service Visits`.
7. Confirm the broker appears under **Today's visited and serviced brokers**.
8. Click **Edit** to add float, cash, income, service type or notes.

## Development diagnostics

When a database error still occurs, the API now returns:

- `message`
- `code`
- `stage`
- `details` in development

The terminal also logs `[STAFF_SERVICE_VISITS]` with the exact Prisma error. Do not edit files under `.next`; replace the source files and clear `.next`.
