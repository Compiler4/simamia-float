# SIMAMIA Staff V12 — My Transactions Preview + Real GPS Map

This package is based on the V11 hydration-safe staff portal and keeps the `StaffDashboardEntry -> dynamic(..., { ssr: false })` boundary.

## What V12 fixes

### 1. My Transactions Preview false 403/ownership error

The old preview resolver required all three values to agree at once:

- owned database `id`
- requested `scope`
- requested upload `source` URL

That was too strict for aggregated My Transactions rows because one row can expose `receiptUrl` while the underlying Prisma model stores the same document under `proofUrl`, `bankReceiptUrl`, `depositSlipUrl`, or another compatible field.

V12 now:

1. queries records using the logged-in `companyId` and `staffId` first;
2. resolves by real database ID first;
3. falls back to the owned transaction reference;
4. falls back to a normalized owned source URL;
5. never uses a client-provided source to prove ownership;
6. uses the file URL from the verified database record if the UI sent a stale alias.

This keeps staff isolation while removing the false error:

`This preview does not belong to the currently logged-in Staff Officer...`

### 2. Preview buttons

My Transactions now sends:

- transaction ID
- reference number
- transaction kind
- scope
- any available proof/receipt URL

The secure preview endpoint determines the authoritative record and attachment.

### 3. Real Live Location map

The existing authenticated Live Location endpoint remains scoped to the logged-in Staff Officer and assigned brokers/agents.

V12 improves the map with switchable basemaps:

- Street map (CARTO Voyager / OpenStreetMap data)
- Classic OpenStreetMap
- Satellite imagery (Esri)

This gives a Google-Maps-like interactive street/satellite experience without requiring a Google Maps API key.

### 4. Real Travel History

New route:

`GET /api/staff/location-history`

It reads `companyGpsDevice` and GPS pings for only:

- the current `companyId`
- the current logged-in Staff Officer `ownerUserId`

Supported periods:

- DAY
- WEEK
- MONTH
- YEAR
- CUSTOM

Travel History now displays the real stored route, current/latest real location, GPS point count, distance, average speed, maximum speed and up to 120 recent movement records.

### 5. Multiple staff devices

Live history now combines GPS pings from every device owned by the same logged-in Staff Officer. Changing phone/browser during the day no longer makes part of the route disappear.

## Install on Windows

Stop every `npm run dev` process first.

From the extracted V12 folder:

```powershell
Set-ExecutionPolicy -Scope Process Bypass

.\apply-fix.ps1 -ProjectRoot "C:\Users\Micha\simamia float"
```

Verify:

```powershell
.\verify-v12.ps1 -ProjectRoot "C:\Users\Micha\simamia float"
```

Every line should show `PASS`.

Then:

```powershell
cd "C:\Users\Micha\simamia float"
npx prisma generate
npm run dev
```

Open a new browser tab and hard refresh once if necessary.

## GPS requirements

Real browser geolocation requires:

- Location permission enabled for the site;
- `localhost` during local development, or HTTPS in production;
- the Staff GPS tracker running while the officer is moving.

No fake `0,0` coordinate is accepted by the GPS API.

## Important security behavior

The Preview, Live Location and Travel History APIs all enforce the authenticated Staff session. V12 does not intentionally make any staff/company records public.
