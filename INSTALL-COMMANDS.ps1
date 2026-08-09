$ErrorActionPreference = "Stop"

Set-Location "C:\Users\Micha\simamia-float"

Write-Host "Stopping Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue |
Stop-Process -Force

Write-Host "Formatting and validating schema..." -ForegroundColor Yellow
npx prisma format --schema=prisma/schema.prisma
npx prisma validate --schema=prisma/schema.prisma

Write-Host "Applying the BrokerCustomer migration..." -ForegroundColor Yellow
npx prisma migrate dev --name add_broker_customer --schema=prisma/schema.prisma

Write-Host "Deleting old generated clients and caches..." -ForegroundColor Yellow
Remove-Item -Recurse -Force generated\prisma -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.prisma -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .turbo -ErrorAction SilentlyContinue
Remove-Item -Force tsconfig.tsbuildinfo -ErrorAction SilentlyContinue

Write-Host "Generating the new Prisma Client..." -ForegroundColor Yellow
npx prisma generate --schema=prisma/schema.prisma

Write-Host "Checking for brokerCustomer delegate..." -ForegroundColor Yellow
$delegate = Get-ChildItem generated\prisma -Recurse -File |
Select-String -SimpleMatch "brokerCustomer" |
Select-Object -First 1

if (-not $delegate) {
  throw "brokerCustomer was not found in generated\prisma."
}

Write-Host "brokerCustomer delegate was generated successfully." -ForegroundColor Green
Write-Host "Run: npm run dev" -ForegroundColor Cyan
