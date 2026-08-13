# Simamia Float Hostinger Deployment Guide

This guide prepares Simamia Float for a live Hostinger Node.js deployment with a real MySQL/MariaDB database, PWA installation on mobile and Windows, and staff GPS tracking over HTTPS.

## 1. What Hostinger Must Provide

- Node.js 20 or newer.
- MySQL or MariaDB database.
- SSL enabled on the production domain.
- A Node.js app process that can run `npm run start`.
- A private upload/storage folder if you will use proof, report, and staff file modules.

Browser GPS and PWA install behavior require HTTPS in production. Location permission cannot be granted during installation itself; the browser asks for permission when the installed app opens and the staff tracker starts.

## 2. Import The Database

The SQL dump supplied for this project is:

```text
C:/Users/Micha/Downloads/simamia (1).sql
```

It is a MariaDB/phpMyAdmin export for the `simamia` database. Import it into the Hostinger database using one of these methods:

### Option A: phpMyAdmin

1. Open Hostinger hPanel.
2. Go to Databases.
3. Open phpMyAdmin for the production database.
4. Select the empty production database.
5. Open Import.
6. Upload `simamia (1).sql`.
7. Run the import.

### Option B: Hostinger Terminal

Upload the SQL file to the server, then run:

```bash
mysql -h HOST -P 3306 -u USER -p DATABASE_NAME < "simamia (1).sql"
```

After import, open:

```text
https://your-domain.com/api/health/database
```

The endpoint should return `success: true` before login is tested.

## 3. Environment Variables

Add these variables in Hostinger's Node.js app environment:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE_NAME
DATABASE_HOST=HOST
DATABASE_PORT=3306
DATABASE_USER=USER
DATABASE_PASSWORD=PASSWORD
DATABASE_NAME=DATABASE_NAME
DATABASE_CONNECTION_LIMIT=20
ALLOW_LOCAL_DATABASE_IN_PRODUCTION=0

AUTH_SECRET=long-random-secret
SESSION_SECRET=long-random-secret
CRON_SECRET=long-random-secret
APP_URL=https://your-domain.com

STAFF_GPS_TIME_ZONE=Africa/Dar_es_Salaam
STAFF_GPS_MORNING_START=07:00
STAFF_GPS_NIGHT_STOP=19:00
STAFF_OFFLINE_MINUTES=15
BROKER_SERVICE_RADIUS_METERS=150
BROKER_ADDRESS_RADIUS_METERS=250
BROKER_GPS_MAX_ACCURACY_METERS=150
AGENT_GPS_MAX_ACCURACY_METERS=150
```

If Hostinger gives you a database host such as `localhost` because the Node app and MySQL are on the same server, set:

```env
ALLOW_LOCAL_DATABASE_IN_PRODUCTION=1
```

Only do this on Hostinger/self-hosted servers. Keep it `0` on Vercel because Vercel cannot reach your local computer or XAMPP.

Do not put Stripe, SMS, or any third-party API key in `DATABASE_PASSWORD`. Use only the real MySQL/MariaDB password.

## 4. Build And Start Commands

Use these commands in Hostinger:

```bash
npm install
npm run build
npm run start
```

The `start` script runs:

```bash
node scripts/start-next.mjs
```

The start helper binds to `0.0.0.0` and uses Hostinger's `PORT` environment variable when present. If Hostinger does not provide `PORT`, it falls back to `3000`.

## 5. PWA Installation

The project includes:

- `app/manifest.ts`
- `public/sw.js`
- `components/AppInstallPrompt.tsx`

Users can install the app from Chrome, Edge, Android Chrome, and other PWA-capable browsers. On iPhone/iPad, users normally install from Safari using Share, then Add to Home Screen.

After installation:

- The app opens from the phone or Windows app launcher.
- The service worker keeps the login shell available.
- API and database calls stay live and are never cached by the service worker.

## 6. Staff GPS Permission

The project includes:

- `components/StaffGpsGate.tsx`
- `app/staff/dashboard/StaffLocationTracker.tsx`
- `app/api/staff/gps/route.ts`
- `app/api/staff/gps/schedule/route.ts`

When a signed-in Staff user opens the app, the global GPS gate checks the session role. If the role is `STAFF`, it mounts the tracker and asks the browser for location permission during the configured work window.

For GPS to work:

- The site must be opened over HTTPS.
- The device Location setting must be enabled.
- The browser must be allowed to access Location.
- The user must be signed in as a Staff account.

If permission is denied, the system records the event and shows a prompt to enable GPS again.

## 7. Login Troubleshooting

If login says the database is not connected:

1. Open `/api/health/database`.
2. Check `diagnostics.configured.hostKind`.
3. If it says `local`, your hosted app is still using `localhost` or `127.0.0.1`.
4. If it says `private-network`, your hosted app is using a LAN IP such as `192.168.x.x`.
5. Replace the database values with a Hostinger reachable hostname.
6. Restart or redeploy the Node.js app.

If login says the password is invalid, reset that user's password in the database or through an admin workflow. The app expects bcrypt password hashes in the `users.passwordHash` column.

## 8. Production Smoke Test

After deployment, test in this order:

1. `/api/health/database`
2. `/login`
3. Super Admin dashboard
4. Company Admin dashboard
5. Accountant dashboard
6. Staff dashboard
7. Broker dashboard
8. GPS permission prompt on a real phone over HTTPS
9. Broker/customer filtering
10. Float issue, return, deposit, approval, report, proof upload, and dashboard refresh flows

If the health endpoint fails, fix the database first. Login and role dashboards depend on the same connection.

## 9. Scaling Notes

For larger multi-company usage:

- Keep every user, staff, broker, transaction, report, and GPS row scoped by `companyId`.
- Use a managed MySQL/MariaDB database with backups and slow-query monitoring.
- Keep database connection limits realistic for the hosting plan.
- Move uploaded files to object storage when traffic grows.
- Put long OCR, import, report, notification, and reconciliation jobs into background workers.
- Add Redis or another shared cache before running many Node.js instances.
