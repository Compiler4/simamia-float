# Accountant dashboard 404 fix

The URL `/accountant/dashboard` requires this App Router file:

```text
app/accountant/dashboard/page.tsx
```

The previous package only had `app/accountant/page.tsx`, which creates `/accountant` but not `/accountant/dashboard`.

This fixed package uses:

- `/accountant/dashboard` as the canonical accountant portal route.
- `/accountant` as a compatibility redirect to `/accountant/dashboard`.
- `/api/accountant/dashboard` as the database API route. This API URL is separate from the page URL.

After copying the files, stop the development server and clear the Turbopack cache:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx prisma generate
npm run dev
```
