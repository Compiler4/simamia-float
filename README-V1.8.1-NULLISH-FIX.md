# Simamia Float ERP — v1.8.1 Nullish Coalescing Fix

## Fixed build error

Next.js/Turbopack rejects JavaScript that mixes `??` with `||` without explicit parentheses.

The old expression was:

```ts
assignedArea:
  assignment?.assignedArea ??
  [matchingArea?.street, matchingArea?.ward, matchingArea?.district, matchingArea?.region]
    .filter(Boolean)
    .join(", ") ||
  null,
```

The corrected code builds the area label first, then uses explicit grouping:

```ts
const matchedAreaLabel = [
  matchingArea?.street,
  matchingArea?.ward,
  matchingArea?.district,
  matchingArea?.region,
]
  .filter((value): value is string => Boolean(value))
  .join(", ");

assignedArea:
  assignment?.assignedArea ??
  (matchedAreaLabel || null),
```

## Install

Replace:

```text
lib/staff/broker-scope.ts
```

Then run:

```powershell
Ctrl + C
npx prisma generate
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}
npm run dev
```

Do not edit generated files inside `.next`.
