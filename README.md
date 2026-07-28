# Simamia Float — Unified Company Admin Control Centre

This package replaces the separate Company Admin Staff Assignments, Imported Finance, Accountant Bridge and Staff Operations entry pages with one control-centre route.

## The three integrated UI files

Copy these files exactly:

```text
app/admin/control-centre/page.tsx
app/admin/control-centre/CompanyAdminControlCentreClient.tsx
app/admin/control-centre/CompanyAdminControlCentre.module.css
```

The client contains these modules without importing the old page clients:

- Control Overview
- Staff Areas
- Finance & Banks
- Accountant Verification
- Staff Operations

## New functionality

### Multiple staff areas

A STAFF user can have many active area records. Each record can contain:

- region;
- district;
- ward;
- street or local service area;
- notes;
- active/inactive history.

The region/district/ward tree is generated from the company’s current:

- BrokerCustomer records;
- Customer records;
- Branch records.

This means selecting a region automatically displays the districts and wards/streets that actually exist in the company database.

### Broker area filtering

A broker is displayed only when its region, city, district, ward, location, address or attended location matches one of the selected active work areas.

A broker remains uniquely owned by one staff officer. The assignment stores `workAreaId`, allowing one area to be removed without releasing brokers that belong to another area.

### Multiple company banks

The Finance & Banks module allows many accounts, including:

- CRDB;
- NMB;
- DTB;
- NBC;
- Absa;
- Stanbic;
- Exim;
- KCB;
- Equity;
- Bank of Africa;
- I&M;
- NCBA;
- Access Bank;
- Amana;
- PBZ;
- Tanzania Commercial Bank;
- any custom bank.

### Accountant document verification

Company Admin can upload a PDF, image, Word document, Excel file, CSV or text file, add a message and send it to one accountant or all company accountants.

The included Accountant page is:

```text
/accountant/verification-requests
```

The accountant can verify or reject each request and return a review note.

## API files

```text
app/api/admin/unified-control-centre/route.ts
app/api/admin/unified-control-centre/upload/route.ts
app/api/accountant/verification-requests/route.ts
app/api/staff/brokers/route.ts
```

## Compatibility redirects

The package includes redirects for:

```text
/admin/staff-assignments
/admin/accountant-bridge
/admin/imported-finance
/admin/staff-operations
```

Company Admin is redirected into the appropriate control-centre module. Accountant and other allowed roles keep their existing standalone finance/operations pages.

## Prisma installation

The package contains a complete updated schema:

```text
prisma/schema.prisma
```

It also contains the SQL migration:

```text
prisma/migrations/20260727_unified_control_centre/migration.sql
```

Use only one migration method.

### Recommended Prisma workflow

Back up the database, replace `prisma/schema.prisma`, then run:

```powershell
cd C:\Users\Micha\simamia-float

npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

### Migration workflow

When the project is using committed migrations instead of `db push`:

```powershell
npx prisma migrate deploy
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev
```

Do not run the manual SQL and `prisma migrate deploy` for the same migration twice.

## Dashboard link

Add this item to the Company Admin dashboard navigation:

```ts
{
  page: "Unified Control Centre",
  icon: LayoutDashboard,
  section: "Workspace",
}
```

When it is selected:

```ts
router.push("/admin/control-centre");
```

The dashboard broker loader should continue catching `/api/company-admin/brokers` independently so a broker-directory database issue does not stop the entire dashboard.

## Upload storage

Verification uploads are stored under:

```text
public/uploads/company-admin/<companyId>/verification/
```

For production, replace local public storage with private object storage when documents contain sensitive financial or identity information.

## Verification checklist

1. Sign in as Company Admin.
2. Open `/admin/control-centre?module=staff-areas`.
3. Choose an active STAFF user.
4. Choose a region and tick multiple districts/wards.
5. Add the selections to the draft and save.
6. Tick active areas and confirm only matching brokers appear.
7. Assign selected brokers.
8. Sign in as that STAFF user and call `/api/staff/brokers`; confirm only area brokers appear and assigned brokers have `canOperate: true`.
9. Add CRDB, NMB and another bank account.
10. Send a document to an Accountant.
11. Sign in as Accountant and open `/accountant/verification-requests`.
12. Verify or reject the request and confirm Company Admin sees the new status.

## Searchable, scrollable and paginated Company Admin tables

The Company Admin Control Centre now uses a shared `PaginatedDataTable` component for all data-heavy sections:

- Brokers in selected staff areas
- Customers assigned to the selected staff member
- Configured company bank accounts
- Imported bank statements
- Documents sent for accountant verification
- Staff float transactions
- Staff collections
- Broker service visits

Every table includes:

- Search inside the table
- Context-specific filters
- 5, 10, 25 or 50 rows per page
- Previous/next page controls
- Visible and total record counts
- Sticky table headings
- Horizontal and vertical scrolling
- Responsive mobile toolbar layout

No API, Prisma model or database migration changes are required for this UI upgrade.
