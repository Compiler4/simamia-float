$ErrorActionPreference = "Stop"

Write-Host "Installing Simamia Accountant Portal upgrade..." -ForegroundColor Cyan

if (-not (Test-Path "prisma/schema.prisma")) {
  throw "Run this script from the project root. prisma/schema.prisma was not found."
}

npm install pdf-lib xlsx
node scripts/apply-accountant-schema-upgrade.mjs
node scripts/integrate-accountant-dashboard.mjs
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

Write-Host "Upgrade installed. Start the project with npm run dev." -ForegroundColor Green
Write-Host "Accountant: /accountant/control-centre" -ForegroundColor Yellow
Write-Host "Company Admin: /company-admin/verification-centre" -ForegroundColor Yellow
