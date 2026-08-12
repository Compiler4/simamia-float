# Simamia Float Vercel Deployment Guide

This project is a Next.js 16 App Router system using Prisma 7 with MySQL/MariaDB. The local production build has been verified with:

```powershell
npm run typecheck
npm run build
```

## 1. Required Vercel Settings

Vercel should detect the project as Next.js. The repository also includes `vercel.json` with:

```json
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "npm run build"
}
```

Use these project settings in Vercel:

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | Leave empty/default |

## 2. Environment Variables

Add these in Vercel Project Settings, for Production and Preview if needed:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DB_NAME
DATABASE_HOST=HOST
DATABASE_PORT=3306
DATABASE_USER=USER
DATABASE_PASSWORD=PASSWORD
DATABASE_NAME=DB_NAME
DATABASE_CONNECTION_LIMIT=5

AUTH_SECRET=long-random-production-secret
SESSION_SECRET=long-random-production-secret
CRON_SECRET=long-random-production-secret
APP_URL=https://your-vercel-or-custom-domain

STAFF_GPS_TIME_ZONE=Africa/Dar_es_Salaam
STAFF_GPS_MORNING_START=07:00
STAFF_GPS_NIGHT_STOP=19:00
STAFF_OFFLINE_MINUTES=15
BROKER_SERVICE_RADIUS_METERS=150
BROKER_ADDRESS_RADIUS_METERS=250
BROKER_GPS_MAX_ACCURACY_METERS=150
AGENT_GPS_MAX_ACCURACY_METERS=150
```

Use a managed MySQL/MariaDB database that accepts external/Vercel connections. Do not use `localhost`, `127.0.0.1`, or `::1` in Vercel. Those addresses point back to the Vercel function itself, so login will fail with a database connection error. For serverless hosting, keep `DATABASE_CONNECTION_LIMIT` modest unless the database provider gives a pooler.

After editing environment variables in Vercel, redeploy the project so the new values are available to the running functions.

## 3. Database Setup

After setting production environment variables, run the schema sync once against the production database:

```bash
npm run prisma:generate
npm run db:schema:sync
```

The active schema includes all runtime models used by the routes, including portal documents, approval decisions, network balances, staff network lines, staff proofs, broker agent accounts, fingerprint devices, and verification packets.

## 4. File Uploads On Vercel

The current code stores uploaded files under project folders such as `public/uploads` and `storage/private/staff`. This works on a traditional Node host with persistent disk. Vercel Functions are not a persistent file server for runtime uploads.

For serious production use on Vercel, connect persistent object storage before relying on upload-heavy modules:

- Use Vercel Blob, S3, Cloudflare R2, or another object store.
- Keep database rows in `PortalDocument` and `StaffFile`, but store the actual file bytes in object storage.
- For private staff files, serve downloads through authenticated API routes, not direct public links.

The app now builds and deploys cleanly, but persistent upload storage is an infrastructure requirement for live production operation on Vercel.

## 5. Optional Cron Jobs

The project has cron-ready routes:

| Route | Purpose |
|---|---|
| `/api/staff/cron/evaluate` | staff offline, missed return, and outstanding float checks |
| `/api/cron/accountant-attendance-missing` | accountant attendance missing-record alerts |

Both routes expect:

```http
Authorization: Bearer CRON_SECRET
```

Vercel Cron automatically sends this header when the project has a `CRON_SECRET` environment variable. Add cron schedules only after choosing a Vercel plan that supports your desired frequency.

## 6. Deployment Steps

1. Push the fixed project to GitHub.
2. Import the GitHub repository in Vercel.
3. Add all environment variables.
4. Deploy.
5. Run database schema sync against the production database.
6. Open `/api/health/database`.
7. Open `/login`.
8. Sign in by role and test each dashboard.

If `/api/health/database` fails, fix the database environment variables before testing login. A successful login requires the same database connection used by the health endpoint.

## 7. Post-Deploy Smoke Test

Use this checklist immediately after deployment:

| Area | Test |
|---|---|
| Database | `/api/health/database` returns success |
| Auth | login redirects each role to its dashboard |
| Super Admin | company, company admin, subscription pages load |
| Company Admin | dashboard, brokers, staff networks, reports load |
| Accountant | dashboard, bank verification, attendance, reports load |
| Staff | dashboard, brokers, GPS, proofs, expenses load |
| GPS | browser location prompt works over HTTPS |
| Reports | PDF/CSV report endpoints return downloadable files |
| Uploads | confirm persistent object storage before production use |

## References

- Vercel project configuration: https://vercel.com/docs/project-configuration/vercel-json
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel Blob storage: https://vercel.com/docs/vercel-blob
- Next.js Turbopack and webpack build option: https://nextjs.org/docs/app/api-reference/turbopack
