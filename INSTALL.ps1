$ErrorActionPreference = "Stop"

Write-Host "Installing Live Location v1.7 dependencies..." -ForegroundColor Cyan
npm install leaflet lucide-react
npm install -D @types/leaflet tsx

Write-Host "Removing unstable marker cluster packages..." -ForegroundColor Cyan
npm uninstall leaflet.markercluster 2>$null
npm uninstall -D @types/leaflet.markercluster 2>$null

Write-Host "Formatting and validating Prisma..." -ForegroundColor Cyan
npx prisma format
npx prisma validate

Write-Host "Synchronising MySQL and generating Prisma Client..." -ForegroundColor Cyan
npx prisma db push
npx prisma generate

Write-Host "Repairing invalid 0,0 coordinates..." -ForegroundColor Cyan
npx tsx prisma/repair-zero-coordinates.ts

if (Test-Path ".next") {
  Write-Host "Removing stale Next.js build..." -ForegroundColor Cyan
  Remove-Item -Recurse -Force ".next"
}

Write-Host "Installation completed. Run npm run dev." -ForegroundColor Green
