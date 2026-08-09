param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float"
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectPath = (Resolve-Path $ProjectPath).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectPath "_staff_ui_v8_backup_$Stamp"

$Files = @(
  "app\staff\dashboard\StaffDashboardClient.tsx",
  "app\staff\dashboard\StaffDashboard.module.css",
  "app\staff\dashboard\StaffAdvancedOperations.tsx",
  "app\staff\dashboard\StaffAdvancedOperations.module.css",
  "app\staff\dashboard\StaffLocationTracker.tsx",
  "app\staff\dashboard\LiveMap.tsx",
  "app\api\staff\unread-count\route.ts",
  "app\api\staff\gps\route.ts",
  "app\api\staff\operations\route.ts",
  "app\api\staff\operations\report\route.ts",
  "app\api\accountant\staff-attendance\route.ts",
  "app\accountant\staff-attendance\page.tsx",
  "app\accountant\staff-attendance\AccountantStaffAttendanceClient.tsx",
  "app\accountant\staff-attendance\AccountantStaffAttendance.module.css",
  "lib\staff\operations-v4.ts",
  "scripts\set-broker-auto-visit-radius.ts"
)

Write-Host "Installing Simamia Staff UI V8" -ForegroundColor Cyan
Write-Host "Project: $ProjectPath"
Write-Host "Backup:  $BackupRoot"

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

foreach ($RelativePath in $Files) {
  $Source = Join-Path $SourceRoot $RelativePath
  $Target = Join-Path $ProjectPath $RelativePath

  if (!(Test-Path $Source)) {
    throw "Package file is missing: $RelativePath"
  }

  if (Test-Path $Target) {
    $Backup = Join-Path $BackupRoot $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Backup) | Out-Null
    Copy-Item $Target $Backup -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
  Copy-Item $Source $Target -Force
}

Push-Location $ProjectPath
try {
  Write-Host "Installing map dependencies..." -ForegroundColor Cyan
  npm install leaflet
  npm install --save-dev @types/leaflet tsx

  Write-Host "Validating Prisma schema..." -ForegroundColor Cyan
  npx prisma format
  npx prisma validate

  Write-Host "Synchronizing the current schema without resetting data..." -ForegroundColor Cyan
  npx prisma db push
  npx prisma generate

  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  Remove-Item -Force tsconfig.tsbuildinfo -ErrorAction SilentlyContinue

  Write-Host "Running TypeScript validation..." -ForegroundColor Cyan
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "TypeScript reported project errors. Review the output above; the V8 files were still installed and backed up."
  }
}
finally {
  Pop-Location
}

Write-Host "" 
Write-Host "Staff UI V8 installed successfully." -ForegroundColor Green
Write-Host "Open staff portal:      http://localhost:3000/staff/dashboard" -ForegroundColor Yellow
Write-Host "Open attendance portal: http://localhost:3000/accountant/staff-attendance" -ForegroundColor Yellow
