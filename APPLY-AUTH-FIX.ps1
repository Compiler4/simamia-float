$ErrorActionPreference = "Stop"

Write-Host "SIMAMIA auth fix verification" -ForegroundColor Cyan

if (-not (Test-Path ".\package.json")) {
  throw "Run this script from your SIMAMIA project root (the folder that contains package.json)."
}

if (-not (Test-Path ".\lib\auth.ts")) {
  throw "lib\auth.ts is missing. Extract the ZIP contents directly into the project root first."
}

$match = Select-String -Path ".\lib\auth.ts" -Pattern "export async function getCurrentUser" -SimpleMatch
if (-not $match) {
  throw "getCurrentUser is still missing from lib\auth.ts. The patch was not extracted over the project root."
}

Write-Host "OK: getCurrentUser export found in lib\auth.ts" -ForegroundColor Green

if (Test-Path ".\.next") {
  Remove-Item -Recurse -Force ".\.next"
  Write-Host "Removed .next cache." -ForegroundColor Green
}

Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  npx prisma generate"
Write-Host "  npm run dev"
