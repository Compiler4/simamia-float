$ErrorActionPreference = "Stop"

Write-Host "Installing Staff Float Officer portal dependencies..." -ForegroundColor Cyan
npm install leaflet
npm install -D @types/leaflet

Write-Host "Formatting and validating Prisma..." -ForegroundColor Cyan
npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

Write-Host "Installation complete. Start the application with npm run dev" -ForegroundColor Green
