$ErrorActionPreference = "Stop"

Write-Host "Installing Simamia Live Locations v2.1 INVALID_DATE fix..." -ForegroundColor Cyan

npx prisma generate

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

Write-Host "Fix installed. Start the portal with: npm run dev" -ForegroundColor Green
