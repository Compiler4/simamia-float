param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path $ProjectRoot).Path

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
  throw "package.json was not found in $ProjectRoot"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot "accountant-original-ui-backup-$timestamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$paths = @(
  "app/accountant/dashboard",
  "app/accountant/page.tsx",
  "app/accountant/control-centre",
  "app/api/accountant/control-centre",
  "app/api/accountant/dashboard",
  "app/api/accountant/actions",
  "app/api/accountant/fingerprint-devices",
  "app/api/accountant/reports",
  "app/api/accountant/upload",
  "app/api/fingerprint/attendance",
  "app/api/company-admin/expense-decisions",
  "app/api/company-admin/verification-packets",
  "app/api/staff/expense-requests",
  "app/api/staff/proofs",
  "app/api/staff/funding/confirm",
  "lib/accountant-control",
  "scripts/fix-css-compat.mjs"
)

foreach ($relative in $paths) {
  $source = Join-Path $PatchRoot $relative
  if (-not (Test-Path $source)) { continue }

  $destination = Join-Path $ProjectRoot $relative
  if (Test-Path $destination) {
    $backupDestination = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupDestination) | Out-Null
    Copy-Item -Recurse -Force $destination $backupDestination
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -Recurse -Force $source $destination
  Write-Host "Installed $relative" -ForegroundColor Green
}

$schemaFragmentTarget = Join-Path $ProjectRoot "prisma/accountant-control-centre.prisma"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $schemaFragmentTarget) | Out-Null
Copy-Item -Force (Join-Path $PatchRoot "prisma/accountant-control-centre.prisma") $schemaFragmentTarget
Copy-Item -Force (Join-Path $PatchRoot "prisma/SCHEMA-MERGE-CHECKLIST.md") (Join-Path $ProjectRoot "prisma/SCHEMA-MERGE-CHECKLIST.md")

Write-Host ""
Write-Host "Original accountant appearance and enhanced modules installed." -ForegroundColor Cyan
Write-Host "Backup: $backupRoot"
Write-Host ""
Write-Host "Next commands:" -ForegroundColor Yellow
Write-Host "  cd `"$ProjectRoot`""
Write-Host "  npm install pdf-lib xlsx"
Write-Host "  # Merge prisma/accountant-control-centre.prisma into prisma/schema.prisma"
Write-Host "  npx prisma format"
Write-Host "  npx prisma validate"
Write-Host "  npx prisma db push"
Write-Host "  npx prisma generate"
Write-Host "  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue"
Write-Host "  npm run dev"
