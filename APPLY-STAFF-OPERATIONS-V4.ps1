param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float",
  [switch]$SkipInstall,
  [switch]$SkipDatabase,
  [switch]$SkipTypecheck
)

$ErrorActionPreference = "Stop"

$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectPath = [System.IO.Path]::GetFullPath($ProjectPath)

if (-not (Test-Path -LiteralPath $ProjectPath)) {
  throw "Project path not found: $ProjectPath"
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath "package.json"))) {
  throw "package.json was not found in $ProjectPath"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectPath "_staff_operations_v4_backup_$Timestamp"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

function Assert-NativeSuccess([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE. Your original files are available in $BackupRoot"
  }
}

$ExcludedTopLevel = @(
  "APPLY-STAFF-OPERATIONS-V4.ps1",
  "README.md",
  "manifest.json",
  "samples",
  "docs"
)

$Files = Get-ChildItem -LiteralPath $PackageRoot -Recurse -File | Where-Object {
  $Relative = $_.FullName.Substring($PackageRoot.Length).TrimStart("\", "/")
  $Top = ($Relative -split "[\\/]", 2)[0]
  $ExcludedTopLevel -notcontains $Top
}

foreach ($File in $Files) {
  $Relative = $File.FullName.Substring($PackageRoot.Length).TrimStart("\", "/")

  if ($Relative -eq "scripts\apply-staff-operations-v4.mjs") {
    continue
  }

  $Destination = Join-Path $ProjectPath $Relative
  $DestinationDirectory = Split-Path -Parent $Destination

  if (-not (Test-Path -LiteralPath $DestinationDirectory)) {
    New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
  }

  if (Test-Path -LiteralPath $Destination) {
    $BackupDestination = Join-Path $BackupRoot $Relative
    $BackupDirectory = Split-Path -Parent $BackupDestination
    New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
    Copy-Item -LiteralPath $Destination -Destination $BackupDestination -Force
  }

  Copy-Item -LiteralPath $File.FullName -Destination $Destination -Force
  Write-Host "Installed $Relative" -ForegroundColor Green
}

node (Join-Path $PackageRoot "scripts\apply-staff-operations-v4.mjs") $ProjectPath

Push-Location $ProjectPath

try {
  if (-not $SkipInstall) {
    Write-Host "`nInstalling required packages..." -ForegroundColor Cyan
    npm install
    Assert-NativeSuccess "npm install"
  }

  Write-Host "`nFormatting and validating Prisma schema..." -ForegroundColor Cyan
  npx prisma format
  Assert-NativeSuccess "Prisma format"
  npx prisma validate
  Assert-NativeSuccess "Prisma validation"

  if (-not $SkipDatabase) {
    Write-Host "`nSynchronising additive Staff Operations tables..." -ForegroundColor Cyan
    npx prisma db push

    if ($LASTEXITCODE -ne 0) {
      throw "Prisma db push failed. The database was not reset. Read the Prisma message above."
    }
  }

  Write-Host "`nGenerating Prisma Client..." -ForegroundColor Cyan
  npx prisma generate
  Assert-NativeSuccess "Prisma Client generation"

  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
  Remove-Item -Force "tsconfig.tsbuildinfo" -ErrorAction SilentlyContinue

  if (-not $SkipTypecheck) {
    Write-Host "`nRunning TypeScript validation..." -ForegroundColor Cyan
    npm run typecheck

    if ($LASTEXITCODE -ne 0) {
      throw "TypeScript validation failed. Your original files are available in $BackupRoot"
    }
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Staff Operations V4 installed successfully." -ForegroundColor Green
Write-Host "Backup: $BackupRoot" -ForegroundColor Yellow
Write-Host "Start the application with: npm run dev" -ForegroundColor Cyan
Write-Host "Staff portal: http://localhost:3000/staff/dashboard" -ForegroundColor Cyan
Write-Host "Company Admin review: http://localhost:3000/admin/staff-operations" -ForegroundColor Cyan
Write-Host "Accountant review: http://localhost:3000/accountant/staff-operations" -ForegroundColor Cyan
