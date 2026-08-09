$ErrorActionPreference = "Stop"

Write-Host "Installing Simamia Live Location v1.9 database synchronization..." -ForegroundColor Cyan

npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

Write-Host "Installation completed. Run: npm run dev" -ForegroundColor Green
