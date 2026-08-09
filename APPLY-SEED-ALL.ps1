param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float",
  [string]$CompanyCode = "SIMAMIA",
  [switch]$SkipExistingSeeds,
  [switch]$SkipDataImport,
  [switch]$SkipBaseline
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Step([string]$Text) {
  Write-Host "`n==> $Text" -ForegroundColor Cyan
}

function Run([string]$Command, [string[]]$Arguments) {
  Write-Host "$Command $($Arguments -join ' ')" -ForegroundColor DarkGray
  & $Command @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE."
  }
}

function Run-Capture([string]$Command, [string[]]$Arguments) {
  Write-Host "$Command $($Arguments -join ' ')" -ForegroundColor DarkGray
  $Output = & $Command @Arguments 2>&1
  $ExitCode = $LASTEXITCODE
  $Output | ForEach-Object { Write-Host $_ }

  return [pscustomobject]@{
    ExitCode = $ExitCode
    Text = ($Output | Out-String)
  }
}

$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Test-Path $ProjectPath)) {
  throw "Project directory was not found: $ProjectPath"
}

$ProjectPath = (Resolve-Path $ProjectPath).Path

if (-not (Test-Path (Join-Path $ProjectPath "package.json"))) {
  throw "package.json was not found in $ProjectPath"
}

if (-not (Test-Path (Join-Path $ProjectPath "prisma\schema.prisma"))) {
  throw "prisma\schema.prisma was not found in $ProjectPath"
}

$CompanyCode = $CompanyCode.Trim().ToUpperInvariant()
if (-not $CompanyCode) {
  throw "CompanyCode cannot be empty."
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectPath "_seed_all_backup_$Timestamp"

$FilesToCopy = @(
  "prisma\seed-client.ts",
  "prisma\import-float-agents-json.ts",
  "prisma\import-bank-statement-json.ts",
  "prisma\seed-data-folder.ts",
  "prisma\verify-seeded-data.ts",
  "prisma\data\float-agents.json",
  "prisma\data\bank-statement-2026-07-16-to-17.json",
  "prisma\data\import-manifest.json",
  "prisma\data\source\float data_063712.xlsx",
  "prisma\data\source\accountTransactionHistory (16).pdf",
  "prisma\migrations\20260726150000_import_data_support\migration.sql",
  "prisma\repairs\20260726_add_missing_user_columns.sql",
  "scripts\run-all-seeds.mjs",
  "scripts\patch-package-json.mjs",
  "docs\SEEDING_ORDER.md",
  "docs\DATA_MAPPING.md"
)

Step "Copying seed, migration and uploaded-data files"

foreach ($RelativePath in $FilesToCopy) {
  $Source = Join-Path $PackageRoot $RelativePath

  if (-not (Test-Path $Source)) {
    Write-Host "Skipping missing package file: $RelativePath" -ForegroundColor Yellow
    continue
  }

  $Target = Join-Path $ProjectPath $RelativePath
  $TargetDirectory = Split-Path -Parent $Target
  New-Item -ItemType Directory -Force -Path $TargetDirectory | Out-Null

  if (Test-Path $Target) {
    $BackupTarget = Join-Path $BackupRoot $RelativePath
    $BackupDirectory = Split-Path -Parent $BackupTarget
    New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
    Copy-Item -LiteralPath $Target -Destination $BackupTarget -Force
  }

  Copy-Item -LiteralPath $Source -Destination $Target -Force
}

Step "Merging package.json scripts and dependencies"
Run "node" @(
  (Join-Path $ProjectPath "scripts\patch-package-json.mjs"),
  $ProjectPath
)

Set-Location $ProjectPath

Step "Installing dependencies"
Run "npm" @("install")

Step "Formatting and validating Prisma"
Run "npx" @("prisma", "format")
Run "npx" @("prisma", "validate")

$UserRepair = Join-Path $ProjectPath "prisma\repairs\20260726_add_missing_user_columns.sql"
if (Test-Path $UserRepair) {
  Step "Applying idempotent user-column repair"
  # Prisma 7 reads the datasource from prisma.config.ts. --schema is not supported here.
  Run "npx" @(
    "prisma",
    "db",
    "execute",
    "--file",
    $UserRepair
  )
}

Step "Synchronising schema with the existing database"
Write-Host "No destructive reset or --accept-data-loss flag is used." -ForegroundColor Yellow
Run "npx" @("prisma", "db", "push")

if (-not $SkipBaseline) {
  Step "Baselining migration history for the existing non-empty database"
  $MigrationRoot = Join-Path $ProjectPath "prisma\migrations"
  $MigrationDirectories = Get-ChildItem -LiteralPath $MigrationRoot -Directory |
    Where-Object { $_.Name -match '^\d+_.+' } |
    Sort-Object Name

  foreach ($Migration in $MigrationDirectories) {
    $Result = Run-Capture "npx" @(
      "prisma",
      "migrate",
      "resolve",
      "--applied",
      $Migration.Name
    )

    if ($Result.ExitCode -ne 0) {
      if (
        $Result.Text -match "P3008" -or
        $Result.Text -match "already recorded as applied" -or
        $Result.Text -match "already been applied"
      ) {
        Write-Host "Migration already recorded: $($Migration.Name)" -ForegroundColor Yellow
      } else {
        throw "Could not baseline migration $($Migration.Name)."
      }
    }
  }
} else {
  Write-Host "Skipped migration baselining." -ForegroundColor Yellow
}

Step "Checking and deploying pending migrations"
Run "npx" @("prisma", "migrate", "deploy")

Step "Generating Prisma Client"
Run "npx" @("prisma", "generate")

$env:SEED_COMPANY_CODE = $CompanyCode

if ($SkipExistingSeeds) {
  $env:SKIP_EXISTING_SEEDS = "1"
} else {
  Remove-Item Env:\SKIP_EXISTING_SEEDS -ErrorAction SilentlyContinue
}

if (-not $SkipDataImport) {
  Step "Running application seeds and uploaded-data imports"
  Run "npm" @(
    "run",
    "db:seed:all",
    "--",
    $CompanyCode
  )
} else {
  Write-Host "Skipped data import and seed runner." -ForegroundColor Yellow
}

Step "Clearing Next.js and TypeScript caches"
Remove-Item -Recurse -Force (Join-Path $ProjectPath ".next") -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $ProjectPath "tsconfig.tsbuildinfo") -ErrorAction SilentlyContinue

Write-Host "`nDatabase migration and seeding completed successfully." -ForegroundColor Green
Write-Host "Company code: $CompanyCode" -ForegroundColor Green
Write-Host "Backup directory: $BackupRoot" -ForegroundColor Green
Write-Host "`nStart the application with: npm run dev" -ForegroundColor Cyan
