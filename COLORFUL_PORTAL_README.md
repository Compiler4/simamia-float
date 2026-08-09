# Simamia Colourful Accountant Portal

This package is the complete Accountant portal with the working `/accountant/dashboard` route and its Prisma-backed APIs.

## Main visual improvements

- Deep blue, cyan, green and violet sidebar
- Material Symbols icons in navigation, card headings, forms, filters and tables
- Light-coloured main workspace
- Coloured financial cards and module panels
- Coloured table headers, zebra rows and contextual table icons
- Iconic form labels and focus states
- Responsive desktop, tablet and mobile layouts
- Safari-compatible `-webkit-backdrop-filter`
- Reduced-motion accessibility support

## Copy into the project

Copy the contents into the root of:

```text
C:\Users\Micha\simamia-float\
```

The key route structure is:

```text
app/accountant/page.tsx
app/accountant/dashboard/page.tsx
app/accountant/AccountantDashboardClient.tsx
app/accountant/AccountantDashboard.module.css
```

The included APIs are:

```text
app/api/accountant/dashboard/route.ts
app/api/accountant/actions/route.ts
app/api/accountant/manual-float/route.ts
app/api/accountant/control-centre/route.ts
app/api/accountant/fingerprint-devices/route.ts
app/api/accountant/reports/route.ts
app/api/accountant/upload/route.ts
```

Keep your existing `lib/auth.ts`, `lib/db.ts`, authentication routes, environment variables and active `prisma/schema.prisma`.

## Restart after copying

```powershell
cd C:\Users\Micha\simamia-float
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx prisma validate
npx prisma generate
npm run dev
```

Open:

```text
http://localhost:3000/accountant/dashboard
```

The API can be checked at:

```text
http://localhost:3000/api/accountant/dashboard
```
