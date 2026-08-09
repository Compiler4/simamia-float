# Simamia Live Locations v2.1 — INVALID_DATE fix

## Cause

`app/api/staff/live-locations/route.ts` called:

```ts
const today = darDayBounds();
```

The old helper converted the missing value with:

```ts
new Date(String(undefined))
```

That produces an invalid JavaScript Date and throws `INVALID_DATE`.

## Corrected behaviour

`darDayBounds()` now:

- uses the current date when its argument is missing, null or blank;
- interprets `YYYY-MM-DD` as a Dar es Salaam calendar date;
- handles valid Date objects and ISO timestamps;
- throws `INVALID_DATE` only for an explicitly supplied invalid date.

The Live Locations route also calls it explicitly:

```ts
const today = darDayBounds(new Date());
```

## Replace these files

- `lib/staff/geo.ts`
- `app/api/staff/live-locations/route.ts`
- `app/api/staff/service-visits/route.ts`

## Commands

```powershell
Ctrl + C

npx prisma generate

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

npm run dev
```

No Prisma schema change or database migration is required for this correction.
