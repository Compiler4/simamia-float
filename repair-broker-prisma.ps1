param(
  [switch]$UseDbPush
)

$ErrorActionPreference = "Stop"

$ProjectPath = "C:\Users\Micha\simamia-float"
Set-Location $ProjectPath

Write-Host ""
Write-Host "Simamia Broker Prisma Delegate Repair" -ForegroundColor Cyan
Write-Host ""

$schemaPath = Join-Path $ProjectPath "prisma\schema.prisma"
$generatedPath = Join-Path $ProjectPath "generated\prisma"

if (-not (Test-Path -LiteralPath $schemaPath)) {
  throw "prisma\schema.prisma was not found."
}

$schema = Get-Content -LiteralPath $schemaPath -Raw

if ($schema -notmatch "(?m)^\s*model\s+BrokerCustomer\s*\{") {
  throw @"
BrokerCustomer is missing from prisma\schema.prisma.

Open:
  prisma\BROKER-SCHEMA-MERGE.prisma.txt

Merge the enum, Company relation and model into the real:
  prisma\schema.prisma
"@
}

if ($schema -notmatch "brokerCustomers\s+BrokerCustomer\[\]") {
  throw @"
The existing Company model is missing:

  brokerCustomers BrokerCustomer[]

Add it inside model Company.
"@
}

if ($schema -notmatch 'output\s*=\s*"\.\./generated/prisma"') {
  throw @"
The Prisma generator must use:

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

The supplied lib/prisma.ts imports ../generated/prisma/client.
"@
}

Write-Host "Stopping Node processes for this project..." -ForegroundColor Yellow

$escapedProjectPath = [Regex]::Escape($ProjectPath)

Get-CimInstance Win32_Process |
Where-Object {
  $_.Name -match "^(node|nodejs|npm|npx)(\.exe)?$" -and
  $_.CommandLine -and
  $_.CommandLine -match $escapedProjectPath
} |
ForEach-Object {
  try {
    Stop-Process -Id $_.ProcessId -Force
  }
  catch {
    Write-Warning "Could not stop process $($_.ProcessId)."
  }
}

Write-Host "Checking lib/prisma.ts import..." -ForegroundColor Yellow

$prismaFile = Get-Content -LiteralPath "lib\prisma.ts" -Raw

if ($prismaFile -match 'from\s+"@prisma/client"') {
  throw @"
lib/prisma.ts still imports PrismaClient from @prisma/client.

Replace it with the supplied lib/prisma.ts, which imports:
  ../generated/prisma/client
"@
}

Write-Host "Formatting schema..." -ForegroundColor Yellow
npx prisma format
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Validating schema..." -ForegroundColor Yellow
npx prisma validate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($UseDbPush) {
  Write-Host "Applying schema using db push..." -ForegroundColor Yellow
  npx prisma db push
}
else {
  Write-Host "Creating/applying migration..." -ForegroundColor Yellow
  npx prisma migrate dev --name add_broker_customers
}

if ($LASTEXITCODE -ne 0) {
  throw @"
Database synchronization failed.

For your LOCAL development database, retry with:
  .\repair-broker-prisma.ps1 -UseDbPush
"@
}

Write-Host "Removing the stale generated client..." -ForegroundColor Yellow

if (Test-Path -LiteralPath $generatedPath) {
  Remove-Item -LiteralPath $generatedPath -Recurse -Force
}

Write-Host "Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path -LiteralPath $generatedPath)) {
  throw "generated\prisma was not created."
}

$delegate = Get-ChildItem -LiteralPath $generatedPath -Recurse -File |
  Where-Object { $_.Extension -in ".ts", ".js", ".d.ts" } |
  Select-String -SimpleMatch "brokerCustomer" |
  Select-Object -First 1

if (-not $delegate) {
  throw @"
Prisma Client was generated, but brokerCustomer is still missing.

Confirm that BrokerCustomer is in the real prisma\schema.prisma and that
prisma generate is reading that schema.
"@
}

Write-Host "brokerCustomer delegate found." -ForegroundColor Green

Write-Host "Clearing Next.js caches..." -ForegroundColor Yellow
Remove-Item -LiteralPath ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "tsconfig.tsbuildinfo" -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Repair completed successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Start one server only:" -ForegroundColor Cyan
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Then open:" -ForegroundColor Cyan
Write-Host "  http://localhost:3000/api/health/brokers"
Write-Host "  http://localhost:3000/api/company-admin/brokers"
