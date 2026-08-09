param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float",
  [string]$CompanyCode = ""
)

$ErrorActionPreference = "Stop"
$SourceRoot = $PSScriptRoot
$TargetRoot = [System.IO.Path]::GetFullPath($ProjectPath)
$SourceFull = [System.IO.Path]::GetFullPath($SourceRoot)
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $TargetRoot "_simamia_v3_backup_$Timestamp"

if (-not (Test-Path $TargetRoot)) {
  throw "Project folder not found: $TargetRoot"
}

if (-not (Test-Path (Join-Path $TargetRoot "package.json"))) {
  throw "package.json was not found in $TargetRoot"
}

Write-Host "Installing Simamia Company Admin V3 into $TargetRoot" -ForegroundColor Cyan

if ($SourceFull -ne $TargetRoot) {
  New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

  $ExcludedTopLevel = @(
    "package.json",
    "package-lock.json",
    "APPLY-V3.ps1",
    "README.md"
  )

  $SourceFiles = Get-ChildItem -Path $SourceRoot -Recurse -File
  foreach ($SourceFile in $SourceFiles) {
    $relative = $SourceFile.FullName.Substring($SourceRoot.Length).TrimStart('\', '/')
    $top = ($relative -split '[\\/]')[0]

    if ($ExcludedTopLevel -contains $relative) { continue }
    if ($top -in @("node_modules", ".next", "generated")) { continue }

    # Keep a working local Prisma CLI configuration when one already exists.
    if ($relative -eq "prisma.config.ts" -and (Test-Path (Join-Path $TargetRoot $relative))) {
      continue
    }

    $destination = Join-Path $TargetRoot $relative
    if (Test-Path $destination) {
      $backup = Join-Path $BackupRoot $relative
      New-Item -ItemType Directory -Force -Path (Split-Path $backup -Parent) | Out-Null
      Copy-Item -LiteralPath $destination -Destination $backup -Force
    }

    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item -LiteralPath $SourceFile.FullName -Destination $destination -Force
  }

  Write-Host "Existing overwritten files were backed up to $BackupRoot" -ForegroundColor Yellow
}

Set-Location $TargetRoot

Write-Host "Merging package scripts/dependencies and applying TypeScript repairs..." -ForegroundColor Cyan
node scripts/apply-v3-fixes.mjs

Write-Host "Installing and restoring dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Formatting and validating Prisma schema..." -ForegroundColor Cyan
npx prisma format
npx prisma validate

Write-Host "Synchronising the existing MySQL database without deleting data..." -ForegroundColor Cyan
npx prisma db push
npx prisma generate

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

Write-Host "Running TypeScript validation..." -ForegroundColor Cyan
npm run typecheck

if ($CompanyCode.Trim()) {
  Write-Host "Importing the supplied Excel agents and CRDB statement..." -ForegroundColor Cyan
  npm run import:all -- $CompanyCode.Trim().ToUpper()
} else {
  Write-Host "Data import skipped. Run: npm run import:all -- YOUR_COMPANY_CODE" -ForegroundColor Yellow
}

Write-Host "Repair completed. Start the portal with: npm run dev" -ForegroundColor Green
