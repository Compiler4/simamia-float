# Simamia Float — Automatic Daytime Staff GPS v2.2

This update makes the logged-in Staff Officer's browser location start automatically during the configured morning/day work window and stop automatically at night.

## Default schedule

- Start: `06:00`
- Stop: `19:00`
- Time zone: `Africa/Dar_es_Salaam`

Add the following to `.env` to change those values:

```env
STAFF_GPS_TIME_ZONE="Africa/Dar_es_Salaam"
STAFF_GPS_MORNING_START="06:00"
STAFF_GPS_NIGHT_STOP="19:00"
```

The clock format must be `HH:mm` using the 24-hour clock.

## Included files

```text
app/api/staff/gps/route.ts
app/api/staff/gps/schedule/route.ts
app/staff/dashboard/StaffLocationTracker.tsx
app/staff/dashboard/StaffLocationTracker.module.css
app/staff/dashboard/StaffDashboardClient.tsx
app/staff/live-locations/StaffLiveLocationsClient.tsx
lib/staff/gps-schedule.ts
```

The package also contains the compatible Live Locations and Service Visits files from v2.1.

## Behaviour

1. `StaffLocationTracker` is mounted once at the root of the Staff dashboard.
2. It calls `/api/staff/gps/schedule` every 30 seconds.
3. During the configured work window it starts one `navigator.geolocation.watchPosition` watcher.
4. It saves a GPS point approximately every 15 seconds.
5. The API marks the current Staff device `ACTIVE` and marks the Staff Officer's older active devices `INACTIVE`, so only one Staff pointer is shown.
6. At the configured night stop time the watcher is cleared and the device becomes `INACTIVE`.
7. At the next morning start, the watcher starts again automatically while the Staff portal remains open.
8. Coordinates `0,0` are rejected.
9. Travel-history insertion is compatibility-safe: a legacy `gps_tracking` table problem does not cancel the main device and ping save.
10. The Live Locations page listens to the global tracker instead of starting a second GPS watcher.

## Browser permission

A web browser requires the Staff Officer to allow Location at least once. When permission is already granted, daily starting and stopping are automatic.

The browser must have the Staff portal open for browser geolocation to run reliably. A normal website cannot guarantee that GPS restarts while the browser is completely closed or the phone has terminated the tab. For continuous closed-app background tracking, a native Android application or managed device application is required.

Use `localhost` during development or HTTPS after deployment. Browser geolocation is normally blocked on insecure remote HTTP pages.

## Installation

1. Stop Next.js.
2. Extract this package into the project root and replace the included files.
3. Copy `.env.gps-schedule.example` values into the project's `.env`.
4. Run:

```powershell
cd C:\Users\Micha\simamia-float
npx prisma generate

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

npm run dev
```

5. Open:

```text
http://localhost:3000/staff/dashboard
```

6. Allow Location permission when the browser asks.

## API tests

While logged in as Staff, open:

```text
http://localhost:3000/api/staff/gps/schedule
```

During the day it should contain:

```json
{
  "success": true,
  "schedule": {
    "startTime": "06:00",
    "stopTime": "19:00",
    "isSharingWindow": true
  }
}
```

At night `isSharingWindow` becomes `false`.

The floating Staff GPS card displays one of:

- Automatic GPS active
- Automatic night stop
- GPS permission needed
- GPS unavailable/offline

## Database changes

No Prisma schema change is required. This update uses the existing `CompanyGpsDevice` and `CompanyGpsPing` models and their existing `ACTIVE` / `INACTIVE` status values.
