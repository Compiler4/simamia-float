# Manual fixes for the reported TypeScript errors

The installer applies these automatically. Use this page only when a local file has been changed so much that an automatic text replacement cannot match it.

## Accountant chart rows

In both accountant dashboard routes, replace:

```ts
const chartMap = new Map<string, any>(
  chartOfAccounts.map((item: any) => [String(item.code), item]),
);
```

with:

```ts
const safeChartOfAccounts = Array.isArray(chartOfAccounts)
  ? chartOfAccounts
  : [];

const chartMap = new Map<string, any>(
  safeChartOfAccounts.map((item: any) => [String(item.code), item]),
);
```

## Report callback

```ts
staffRows.filter((row: any) => row.outstandingFloat > 0)
```

## Upload Buffer type

```ts
const originalBytes = Buffer.from(await file.arrayBuffer());
let bytes: Uint8Array = originalBytes;
```

## Staff attendance action type

```ts
action:
  | "FLOAT_RECEIVED"
  | "FLOAT_ISSUED"
  | "COLLECTION_RETURNED"
  | "MONEY_RETURNED"
  | "GPS_MOVEMENT";
```

## Notification channel

```ts
const endpoint = webhookFor(channel as Channel);
```

## Required packages

```powershell
npm install leaflet pdf-lib pdf-parse xlsx
npm install --save-dev @types/leaflet
```

The package also includes `types/pdf-parse.d.ts`, so a separate `@types/pdf-parse` package is not required.
