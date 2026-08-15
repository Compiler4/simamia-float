param(
  [string]$ProjectRoot = "C:\Users\Micha\simamia float"
)

$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$Files = @(
  "lib\accountant\accounting.ts",
  "lib\accountant\actions.ts",
  "lib\accountant\portal.ts",
  "lib\staff\operations-v4.ts",
  "app\accountant\AccountantDashboardClient.tsx",
  "app\api\accountant\accountant\actions\route.ts",
  "app\api\accountant\accountant\accountant\actions\route.ts",
  "app\api\staff\actions\route.ts",
  "app\api\staff\operations\route.ts",
  "app\api\staff\bank-deposits\route.ts",
  "app\api\staff\expense-requests\route.ts",
  "app\api\employee\expenses\route.ts",
  "app\api\company-admin\staff-networks\route.ts",
  "app\api\company-admin\expenses\route.ts"
)

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "Project root was not found: $ProjectRoot"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProjectRoot "backup-financial-day-flow-$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null

foreach ($relative in $Files) {
  $source = Join-Path $PatchRoot $relative
  $target = Join-Path $ProjectRoot $relative
  if (-not (Test-Path $source)) {
    throw "Patch file is missing: $relative"
  }
  if (Test-Path $target) {
    $backupFile = Join-Path $backup $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupFile) | Out-Null
    Copy-Item $target $backupFile -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item $source $target -Force
}

Copy-Item (Join-Path $PatchRoot "FINANCIAL-DAY-FLOW-FIX-2026-08-14.md") (Join-Path $ProjectRoot "FINANCIAL-DAY-FLOW-FIX-2026-08-14.md") -Force

Write-Host "Financial-day source files installed." -ForegroundColor Green
Write-Host "Backup: $backup"

Push-Location $ProjectRoot
try {
  if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
  }
  Write-Host "Run these commands next:" -ForegroundColor Cyan
  Write-Host "  npx prisma generate"
  Write-Host "  npx tsc --noEmit --incremental false"
  Write-Host "  npm run dev"
} finally {
  Pop-Location
}
