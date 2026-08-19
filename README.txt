SIMAMIA COMPANY ADMIN — BROKER + UPLOAD CONTENT-TYPE FIX
============================================================

THIS PACKAGE FIXES
------------------
1. "Content-Type was not one of multipart/form-data or application/x-www-form-urlencoded"
2. JSON broker registration accidentally reaching request.formData()
3. Multipart uploads accidentally carrying Content-Type: application/json
4. Manually setting multipart/form-data without a boundary
5. Broker create/update route separation
6. Broker auto-fill route separation
7. Profile/signature/general Company Admin upload parsing
8. Manual broker latitude/longitude fields removed from Manage Brokers
9. Better endpoint-specific client errors

FILES
-----
CompanyAdminDashboardClient.tsx

app/api/company-admin/brokers/route.ts
app/api/company-admin/brokers/[id]/route.ts
app/api/company-admin/brokers/autofill/route.ts
app/api/company-admin/uploads/route.ts

HOW REQUESTS NOW WORK
---------------------

Normal broker registration:
POST /api/company-admin/brokers
Content-Type: application/json
Server reads: request.json()

Broker update:
PATCH /api/company-admin/brokers/:id
Content-Type: application/json
Server reads: request.json()

Broker auto-fill:
POST /api/company-admin/brokers/autofill
Body: FormData
DO NOT SET Content-Type
Server reads: request.formData()

Profile/signature/general uploads:
POST /api/company-admin/uploads
Body: FormData
DO NOT SET Content-Type
Server reads: request.formData()

IMPORTANT
---------
Never do this for FormData:

headers: {
  "Content-Type": "multipart/form-data"
}

and never do this:

headers: {
  "Content-Type": "application/json"
},
body: formData

The browser must generate:
multipart/form-data; boundary=...

INSTALL
-------
1. Stop npm run dev.
2. Back up your current files.
3. Copy every file from this package to the same project path.
4. Delete .next:
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
5. Run:
   npx prisma generate
6. Start:
   npm run dev

DEPENDENCIES FOR AUTO-FILL
--------------------------
Your auto-fill route uses these packages for document extraction:

npm install mammoth xlsx pdf-parse

If they are already installed, do not reinstall them.

UPLOAD STORAGE NOTE
-------------------
The provided /api/company-admin/uploads route stores files under:

public/uploads/company-admin/<companyId>/

This works for local Node.js development and a persistent Node server.

If production is deployed to a serverless/read-only filesystem, replace the writeFile
storage block with durable object storage (for example your existing storage provider).
The multipart parsing fix itself stays the same.

DATABASE DOCUMENT NOTE
----------------------
The uploaded dashboard shows document records with fields such as:
originalName, mimeType, sizeBytes, proofStatus, storagePath/publicUrl.

The attached source does not include the Prisma model for those document records.
Therefore this upload route intentionally returns a complete document object without
guessing and potentially breaking your unknown Prisma schema.

If your current upload route already persists document metadata correctly, keep that
Prisma create section and replace only its request parsing with the multipart guard
and formData logic from this file.
