# Simamia Float ERP — Live Locations v1.8

## Fixes included

1. Fixes `Cannot read properties of undefined (reading 'save')`.
   - The crash came from Leaflet Canvas rendering after a React/Turbopack remount.
   - The map now uses SVG vector rendering only.
   - `preferCanvas`, `leaflet.canvas()` and marker-cluster Canvas paths are not used.

2. Displays one Staff pointer only.
   - Only the newest valid device for the logged-in Staff Officer is returned.
   - A client-side guard removes duplicate Staff markers.

3. Displays every assigned mapped agent/broker pointer.
   - Direct broker assignments and active Staff work-area assignments are both accepted.
   - Invalid `0,0` coordinates are rejected.
   - Unmapped agents remain visible in the directory and are marked `Needs location`.

4. Updates visits automatically.
   - Clicking `Mark visited & serviced` captures the Staff phone GPS.
   - It creates or updates `broker_service_visits`.
   - It creates or updates the linked `service_activities` row.
   - It updates `broker_customers.latitude`, `longitude`, `attendedBy`, `attendedDate` and `attendedLocation`.
   - It dispatches `simamia:service-visit-updated` so the Service Visits sidebar reloads immediately.

5. Adds a visited and serviced agents table.
   - The Live Locations page now shows all of today's visits in a database-backed table.
   - The table includes agent, contact, service, time, location, float, cash, income, status and Edit details.

6. Keeps Service Visits editable.
   - The Service Visits sidebar polls `/api/staff/service-visits` every 15 seconds.
   - It also listens for the update event from Live Locations.
   - Each Staff-owned visit has an Edit action.

## Installation

Copy this package over the project root:

```text
C:\Users\Micha\simamia-float
```

Stop the server first:

```powershell
Ctrl + C
```

Install map dependencies:

```powershell
npm install leaflet lucide-react
npm install -D @types/leaflet tsx
```

Remove old cluster packages because they are not used:

```powershell
npm uninstall leaflet.markercluster
npm uninstall -D @types/leaflet.markercluster
```

Synchronise Prisma only when the v1.7 agent-live-location models have not already been added:

```powershell
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
```

Repair placeholder coordinates:

```powershell
npx tsx prisma/repair-zero-coordinates.ts
```

Clear stale Turbopack output:

```powershell
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

npm run dev
```

Then hard-refresh the browser with `Ctrl + Shift + R`.

## Test

1. Sign in as a Staff Officer.
2. Open `/staff/dashboard`.
3. Click `GPS Tracking -> Live Locations`.
4. Confirm that only one green `S` Staff marker appears.
5. Confirm that all assigned agents with valid coordinates appear.
6. Click `Mark visited & serviced` on an agent while physically at that location.
7. Confirm the pointer changes to serviced.
8. Confirm the visited agent appears in the table.
9. Open `Operations -> Service Visits` and confirm the same record appears with Edit.

## Location truth rule

A map pointer needs a valid latitude and longitude. An agent with no coordinate cannot be placed truthfully on the map. Use one of these methods:

- Capture GPS when Staff reaches the agent.
- Let the agent share GPS through the secure agent-location link.
- Resolve a saved region/district/ward/street address as an approximate point.

The system never uses `0,0` as a real location.
