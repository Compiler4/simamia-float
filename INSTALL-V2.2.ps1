$ErrorActionPreference = "Stop"

Write-Host "Installing Simamia automatic daytime Staff GPS..." -ForegroundColor Cyan

if (-not (Test-Path "package.json")) {
  throw "Run this script from the Simamia Float project root."
}

Write-Host "Regenerating Prisma Client..." -ForegroundColor Yellow
npx prisma generate

if (Test-Path ".next") {
  Write-Host "Removing stale Next.js/Turbopack output..." -ForegroundColor Yellow
  Remove-Item -Recurse -Force ".next"
}

Write-Host "Installation preparation completed." -ForegroundColor Green
Write-Host "Confirm STAFF_GPS_TIME_ZONE, STAFF_GPS_MORNING_START and STAFF_GPS_NIGHT_STOP in .env, then run npm run dev." -ForegroundColor Green
