# Simamia Float

Simamia Float is a production Next.js ERP-style system for company float control, staff operations, broker tracking, accounting verification, GPS activity, bank proof review, document upload, and multi-role dashboards.

## What Is Ready

- Next.js 16 app router with Prisma 7 and MariaDB/MySQL.
- Secure login flow with role-based redirects.
- Staff, accountant, company admin, super admin, and developer workspaces.
- Real database reads and writes through Prisma and API routes.
- File upload endpoints scoped to safe public/private folders.
- PWA manifest, service worker, install prompt, offline shell fallback, route transition bar, loading screen, and app error recovery.
- GitHub-safe `.gitignore` that excludes secrets, generated clients, build output, node modules, backups, and private storage.

## Requirements

- Node.js 20 or newer.
- MySQL or MariaDB database.
- A production HTTPS domain for browser GPS and PWA install behavior.

## Local Setup

1. Install dependencies:

```powershell
npm install
```

If npm has trouble with native packages on Windows, use pnpm:

```powershell
pnpm install --config.node-linker=hoisted
pnpm approve-builds --all
pnpm rebuild
```

2. Copy the environment template:

```powershell
Copy-Item .env.example .env.local
```

3. Edit `.env.local` with the real database and secrets:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/simamia"
AUTH_SECRET="use-a-long-random-production-secret"
SESSION_SECRET="use-a-long-random-production-secret"
CRON_SECRET="use-a-long-random-production-secret"
APP_URL="https://your-domain.com"
```

4. Generate Prisma and sync the database schema:

```powershell
npm run prisma:generate
npm run db:schema:sync
```

5. Start development:

```powershell
npm run dev
```

Open `http://localhost:3000/login`.

## Production Build

Run:

```powershell
npm run typecheck
npm run build
```

The build uses real environment values. For CI or Hostinger, configure the environment variables before running `npm run build`.

## Vercel Deployment

This project now includes `vercel.json` and a dedicated Vercel guide:

- `docs/VERCEL_DEPLOYMENT.md`
- `docs/SYSTEM_DOCUMENTATION.md`

Before using the deployed app for production uploads on Vercel, connect persistent object storage such as Vercel Blob, S3, or R2. The app builds cleanly for Vercel, but runtime uploads need durable storage beyond serverless function disk.

## Hostinger Node Hosting

1. Buy a Hostinger plan that supports Node.js applications.
2. Buy or connect a domain in Hostinger hPanel.
3. Create a MySQL database in hPanel and save:
   - database host
   - database name
   - database user
   - database password
4. Upload the project to GitHub.
5. In Hostinger, create a Node.js app and connect it to the GitHub repository.
6. Set the install command:

```bash
npm install
```

7. Set the build command:

```bash
npm run build
```

8. Set the start command:

```bash
npm run start
```

9. Add environment variables in Hostinger:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DB_NAME
DATABASE_HOST=HOST
DATABASE_PORT=3306
DATABASE_USER=USER
DATABASE_PASSWORD=PASSWORD
DATABASE_NAME=DB_NAME
DATABASE_CONNECTION_LIMIT=20
AUTH_SECRET=long-random-secret
SESSION_SECRET=long-random-secret
CRON_SECRET=long-random-secret
APP_URL=https://your-domain.com
```

10. Run the database setup command from Hostinger terminal:

```bash
npm run db:schema:sync
```

11. Point the domain to the Node.js app in hPanel and enable SSL.
12. Open `https://your-domain.com/login`.

## GitHub Upload

This package is prepared so you can safely run:

```powershell
git init
git add .
git commit -m "Prepare Simamia Float for hosting"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Do not commit `.env`, `.env.local`, `.next`, `node_modules`, `generated`, private storage, or backup folders.

## Scaling Notes

The application code is structured for real production usage, but serving 1,000,000+ users depends on infrastructure as well as code:

- Use managed MySQL/MariaDB with backups, read replicas, and connection pooling.
- Run multiple Node.js instances behind a load balancer.
- Store uploaded files in object storage such as S3-compatible storage instead of only local disk.
- Put static assets and uploads behind a CDN.
- Add Redis or another shared cache for high-traffic session and dashboard workloads.
- Move heavy OCR, PDF, import, SMS, and report jobs into background workers.
- Monitor errors, slow queries, CPU, memory, and database connections before traffic grows.

## Validation Commands

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run build
```
