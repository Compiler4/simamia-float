$ErrorActionPreference = "Stop"

Write-Host "Installing Simamia broker visit v2.0 compatibility update..." -ForegroundColor Cyan

npm install leaflet lucide-react
npm install -D @types/leaflet tsx

npx prisma format
npx prisma validate
npx prisma db push
npx prisma generate

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

Write-Host "Installation complete. Start with: npm run dev" -ForegroundColor Green
Write-Host "Diagnostics: http://localhost:3000/api/staff/service-visits/diagnostics" -ForegroundColor Yellow
