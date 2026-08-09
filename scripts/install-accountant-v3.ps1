$ErrorActionPreference = "Stop"

Write-Host "Simamia Float ERP — Accountant Control Center V3" -ForegroundColor Green
Write-Host "Run this script from the project root after copying the package folders." -ForegroundColor Yellow

$schemaPath = Join-Path (Get-Location) "prisma\schema.prisma"
$extensionPath = Join-Path (Get-Location) "prisma\accountant-v3-extension.prisma"

if (-not (Test-Path -LiteralPath $schemaPath)) {
  throw "prisma/schema.prisma was not found."
}

if (-not (Test-Path -LiteralPath $extensionPath)) {
  throw "prisma/accountant-v3-extension.prisma was not found."
}

$schema = Get-Content -LiteralPath $schemaPath -Raw
$backup = "$schemaPath.accountant-v3-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item -LiteralPath $schemaPath -Destination $backup
Write-Host "Schema backup: $backup" -ForegroundColor Cyan

if ($schema -notmatch "model\s+AccountantAttendanceSessionRecord\s*\{") {
  Add-Content -LiteralPath $schemaPath -Value "`r`n"
  Get-Content -LiteralPath $extensionPath -Raw | Add-Content -LiteralPath $schemaPath
  Write-Host "Accountant V3 Prisma extension appended." -ForegroundColor Cyan
}
else {
  Write-Host "Accountant V3 models already exist; schema was not appended again." -ForegroundColor Yellow
}

Write-Host "Installing report export dependencies..." -ForegroundColor Cyan
npm install pdf-lib xlsx
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Formatting Prisma schema..." -ForegroundColor Cyan
npx prisma format
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Validating Prisma schema..." -ForegroundColor Cyan
npx prisma validate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Applying non-destructive database additions..." -ForegroundColor Cyan
npx prisma db push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Generating Prisma Client..." -ForegroundColor Cyan
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (Test-Path -LiteralPath ".next") {
  Remove-Item -LiteralPath ".next" -Recurse -Force
}

Write-Host "Installation completed." -ForegroundColor Green
Write-Host "Start: npm run dev"
Write-Host "Open: http://localhost:3000/accountant/control-center"
