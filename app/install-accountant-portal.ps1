$ErrorActionPreference = "Stop"

Write-Host "Validating Accountant portal schema..." -ForegroundColor Cyan
npx prisma format
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx prisma validate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Creating Accountant portal migration..." -ForegroundColor Cyan
npx prisma migrate dev --name accountant_finance_portal
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Generating Prisma Client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (Test-Path -LiteralPath ".next") {
  Remove-Item -LiteralPath ".next" -Recurse -Force
}

Write-Host ""
Write-Host "Accountant portal installation completed." -ForegroundColor Green
Write-Host "Run: npm run dev"
