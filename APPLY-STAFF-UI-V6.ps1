param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float"
)

$ErrorActionPreference = "Stop"

$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectPath = (Resolve-Path $ProjectPath).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectPath "_staff_ui_v6_backup_$Timestamp"

$Files = @(
  "app\staff\dashboard\StaffAdvancedOperations.tsx",
  "app\staff\dashboard\StaffAdvancedOperations.module.css",
  "app\api\staff\operations\route.ts",
  "lib\staff\operations-v4.ts"
)

Write-Host "Simamia Staff UI V6" -ForegroundColor Cyan
Write-Host "Project: $ProjectPath" -ForegroundColor Cyan
Write-Host "Backup:  $BackupRoot" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

foreach ($RelativePath in $Files) {
  $Source = Join-Path $SourceRoot $RelativePath
  $Target = Join-Path $ProjectPath $RelativePath

  if (-not (Test-Path $Source)) {
    throw "Package file is missing: $RelativePath"
  }

  if (Test-Path $Target) {
    $Backup = Join-Path $BackupRoot $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Backup) | Out-Null
    Copy-Item $Target $Backup -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
  Copy-Item $Source $Target -Force
  Write-Host "Installed $RelativePath" -ForegroundColor Green
}

Push-Location $ProjectPath
try {
  Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
  Remove-Item -Force tsconfig.tsbuildinfo -ErrorAction SilentlyContinue

  npx prisma generate
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma Client generation failed."
  }

  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) {
    throw "TypeScript validation failed. Review the terminal output above."
  }
}
finally {
  Pop-Location
}

Write-Host "" 
Write-Host "Staff UI V6 installed successfully." -ForegroundColor Green
Write-Host "Start the project with: npm run dev" -ForegroundColor Yellow
