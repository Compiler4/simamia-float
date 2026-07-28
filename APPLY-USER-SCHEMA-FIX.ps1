param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float"
)

$ErrorActionPreference = "Stop"

function Step([string]$Text) {
  Write-Host "`n==> $Text" -ForegroundColor Cyan
}

$ProjectPath = (Resolve-Path $ProjectPath).Path
$PackageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepairSql = Join-Path $PackageRoot "prisma\repairs\20260726_add_missing_user_columns.sql"
$TargetRepairDirectory = Join-Path $ProjectPath "prisma\repairs"
$TargetRepairSql = Join-Path $TargetRepairDirectory "20260726_add_missing_user_columns.sql"

if (-not (Test-Path (Join-Path $ProjectPath "package.json"))) {
  throw "package.json was not found in $ProjectPath"
}

if (-not (Test-Path (Join-Path $ProjectPath "prisma\schema.prisma"))) {
  throw "prisma\schema.prisma was not found in $ProjectPath"
}

if (-not (Test-Path $RepairSql)) {
  throw "Repair SQL file was not found in the extracted package."
}

Set-Location $ProjectPath

Step "Creating repair folder"
New-Item -ItemType Directory -Force -Path $TargetRepairDirectory | Out-Null
Copy-Item -Force $RepairSql $TargetRepairSql

Step "Formatting and validating the Prisma schema"
npx prisma format
if ($LASTEXITCODE -ne 0) { throw "prisma format failed." }

npx prisma validate
if ($LASTEXITCODE -ne 0) { throw "prisma validate failed." }

Step "Adding missing users table columns without deleting data"
npx prisma db execute --file $TargetRepairSql --schema prisma/schema.prisma
if ($LASTEXITCODE -ne 0) { throw "The targeted database repair failed." }

Step "Synchronising the remaining Prisma schema"
Write-Host "This command is intentionally run WITHOUT --accept-data-loss." -ForegroundColor Yellow
npx prisma db push
if ($LASTEXITCODE -ne 0) {
  Write-Warning "prisma db push stopped. Do not use --accept-data-loss until you review the warning. The targeted users-table repair has already been applied."
}

Step "Generating Prisma Client"
npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate failed." }

Step "Clearing Next.js and TypeScript caches"
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Force tsconfig.tsbuildinfo -ErrorAction SilentlyContinue

Step "Checking TypeScript"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
  Write-Warning "The database repair completed, but TypeScript found separate code errors. Review the output above."
}

Write-Host "`nUser schema repair completed. Start the app with: npm run dev" -ForegroundColor Green
