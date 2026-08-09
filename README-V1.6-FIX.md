# Simamia Float ERP — Live Locations v1.6

This release fixes the Leaflet/Turbopack runtime error:

```text
Cannot read properties of undefined (reading '_leaflet_pos')
```

## Root cause

The previous map used `leaflet.markercluster` with chunked loading while the Live Locations page refreshed every 15 seconds. During React development Strict Mode, page changes, or Turbopack hot reload, the old map could be removed while the marker-cluster plugin still had a pending chunk/animation. The plugin then tried to move a layer whose Leaflet position no longer existed.

## Fixes included

- Removed `leaflet.markercluster` from the Live Locations runtime.
- The Leaflet map is created once and map layers are updated without destroying the map on every data refresh.
- Cleanup cancels animation frames, clears layers, stops the map, detaches events, and removes the map safely.
- Leaflet zoom/fade/marker animations are disabled for stable embedded-dashboard rendering.
- Large agent sets use Leaflet canvas circle markers for better performance.
- Agents sharing one geocoded region/district coordinate receive a display-only spiral offset so their pointers do not hide each other.
- Only the newest valid GPS device of the logged-in Staff Officer creates the green Staff pointer.
- All assigned agents with valid stored coordinates create pointers.
- Unmapped agents remain listed and can be geocoded with **Resolve missing pointers** or accurately mapped when Staff reaches them.
- Both the quick **Mark visited & serviced** action and the full Service Visit form dispatch `simamia:service-visit-updated`.
- The Service Visits sidebar reloads from `/api/staff/service-visits`, so Live Locations and Service Visits use the same database records.

## Install

Copy this package into the project root:

```text
C:\Users\Micha\simamia-float
```

Install only the packages still required:

```powershell
npm install leaflet lucide-react
npm install -D @types/leaflet tsx
```

`leaflet.markercluster` can remain installed, but it is no longer imported. It can be removed:

```powershell
npm uninstall leaflet.markercluster @types/leaflet.markercluster
```

Regenerate Prisma and clear Turbopack:

```powershell
npx prisma format
npx prisma validate
npx prisma generate

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

npm run dev
```

Open:

```text
http://localhost:3000/staff/dashboard
```

Then choose:

```text
GPS Tracking → Live Locations
```

## Coordinate rule

A real map pointer requires numeric `latitude` and `longitude` in the database. The system never invents a street location. Agents without coordinates are listed as unmapped. Use address geocoding for an approximate district/ward/street point, then use **Mark visited & serviced** at the physical location to replace it with the Staff device's exact GPS coordinate.
