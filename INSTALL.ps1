param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float"
)

$ErrorActionPreference = "Stop"

$PackagePath =
  Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $ProjectPath

Write-Host ""
Write-Host "Simamia Accountant Manual Float Installer" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath "package.json")) {
  throw "package.json was not found in $ProjectPath"
}

$copyItems = @(
  "app\accountant\dashboard\AccountantDashboardClient.tsx",
  "app\accountant\dashboard\AccountantDashboard.module.css",
  "app\api\accountant\manual-float\route.ts"
)

$backupRoot =
  Join-Path $ProjectPath "accountant-manual-float-backup"

New-Item `
  -ItemType Directory `
  -Path $backupRoot `
  -Force |
Out-Null

foreach ($relative in $copyItems) {
  $source =
    Join-Path $PackagePath $relative

  $target =
    Join-Path $ProjectPath $relative

  if (-not (Test-Path -LiteralPath $source)) {
    throw "Package file is missing: $relative"
  }

  $targetDirectory =
    Split-Path -Parent $target

  New-Item `
    -ItemType Directory `
    -Path $targetDirectory `
    -Force |
  Out-Null

  if (Test-Path -LiteralPath $target) {
    $backupName =
      $relative.Replace("\", "__")

    Copy-Item `
      -LiteralPath $target `
      -Destination (
        Join-Path $backupRoot $backupName
      ) `
      -Force
  }

  Copy-Item `
    -LiteralPath $source `
    -Destination $target `
    -Force
}

Write-Host "Stopping project Node processes..." -ForegroundColor Yellow

$escapedProjectPath =
  [Regex]::Escape($ProjectPath)

Get-CimInstance Win32_Process |
Where-Object {
  $_.Name -match "^(node|nodejs|npm|npx)(\.exe)?$" -and
  $_.CommandLine -and
  $_.CommandLine -match $escapedProjectPath
} |
ForEach-Object {
  try {
    Stop-Process `
      -Id $_.ProcessId `
      -Force
  }
  catch {
    Write-Warning "Could not stop process $($_.ProcessId)."
  }
}

Write-Host "Validating Prisma schema..." -ForegroundColor Yellow

npx prisma validate `
  --schema=prisma/schema.prisma

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Generating Prisma Client..." -ForegroundColor Yellow

npx prisma generate `
  --schema=prisma/schema.prisma

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Removing stale Next.js output..." -ForegroundColor Yellow

Remove-Item `
  -LiteralPath ".next" `
  -Recurse `
  -Force `
  -ErrorAction SilentlyContinue

Remove-Item `
  -LiteralPath ".turbo" `
  -Recurse `
  -Force `
  -ErrorAction SilentlyContinue

Remove-Item `
  -LiteralPath "tsconfig.tsbuildinfo" `
  -Force `
  -ErrorAction SilentlyContinue

Write-Host "Running TypeScript check..." -ForegroundColor Yellow

npx tsc --noEmit

if ($LASTEXITCODE -ne 0) {
  Write-Warning "TypeScript reported an error. Review the terminal output."
}

Write-Host ""
Write-Host "Installation completed." -ForegroundColor Green
Write-Host "Start the project with: npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test after signing in as ACCOUNTANT:" -ForegroundColor Cyan
Write-Host "http://localhost:3000/api/accountant/manual-float"
