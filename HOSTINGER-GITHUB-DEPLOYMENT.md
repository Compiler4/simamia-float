# Hostinger And GitHub Deployment Checklist

## Before Uploading To GitHub

Run these checks locally:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run build
```

Make sure these folders are not committed:

```text
node_modules
.next
generated
storage/private
ORIGINAL-BACKUP
_seed_all_backup_*
```

## Create GitHub Repository

1. Open GitHub.
2. Click `New repository`.
3. Name it, for example `simamia-float`.
4. Keep it private if the project contains business logic you do not want public.
5. Do not add a README from GitHub because this project already has one.
6. Copy the repository URL.

From the project folder:

```powershell
git init
git add .
git commit -m "Prepare Simamia Float for hosting"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/simamia-float.git
git push -u origin main
```

## Buy Domain On Hostinger

1. Log in to Hostinger hPanel.
2. Go to `Domains`.
3. Search for the domain name.
4. Choose the domain and finish payment.
5. Open the domain DNS page after purchase.

## Create Database

1. In hPanel, open `Databases`.
2. Create a MySQL database.
3. Save the host, database name, username, and password.
4. Use those values in `DATABASE_URL`.

Example:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DB_NAME
```

## Create Node.js App

1. In hPanel, open `Websites`.
2. Select your site.
3. Open `Advanced`.
4. Choose `Node.js`.
5. Create a new Node.js application.
6. Select Node.js 20 or newer.
7. Connect the GitHub repository or upload the ZIP.
8. Set the app root to the project root.

Commands:

```bash
npm install
npm run build
npm run start
```

## Environment Variables

Add these in Hostinger:

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
STAFF_GPS_TIME_ZONE=Africa/Dar_es_Salaam
STAFF_GPS_MORNING_START=07:00
STAFF_GPS_NIGHT_STOP=19:00
```

Generate secrets locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Setup On Hostinger

Open the app terminal and run:

```bash
npm run db:schema:sync
```

Use seed/import commands only when you intentionally want to load real starting data:

```bash
npm run db:seed:all
```

## Domain And SSL

1. Point the domain to the Node.js app.
2. Enable SSL in hPanel.
3. Wait until HTTPS is active.
4. Visit:

```text
https://your-domain.com/login
```

Browser GPS and app installation require HTTPS on a real domain.
