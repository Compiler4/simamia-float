param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$PatchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceApp = Join-Path $PatchRoot "app"
$TargetApp = Join-Path $ProjectRoot "app"

if (-not (Test-Path $SourceApp)) {
  throw "Patch app folder was not found: $SourceApp"
}

if (-not (Test-Path $TargetApp)) {
  throw "Target Next.js app folder was not found: $TargetApp"
}

Write-Host ""
Write-Host "SIMAMIA STAFF V11 - NO-SSR HYDRATION FIX" -ForegroundColor Green
Write-Host "Stop npm run dev first (Ctrl+C) before applying this patch." -ForegroundColor Yellow
Write-Host ""

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot ".simamia-patch-backups\staff-v11-no-ssr-$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Write-Host "1/5 Backing up files that will be replaced..." -ForegroundColor Cyan
$files = Get-ChildItem -Path $SourceApp -Recurse -File
foreach ($source in $files) {
  $relative = $source.FullName.Substring($SourceApp.Length).TrimStart('\\','/')
  $target = Join-Path $TargetApp $relative
  if (Test-Path $target) {
    $backup = Join-Path $backupRoot $relative
    $backupDir = Split-Path -Parent $backup
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    Copy-Item -Path $target -Destination $backup -Force
  }
}

Write-Host "2/5 Removing stale Next.js and Turbopack output..." -ForegroundColor Cyan
$cachePaths = @(
  (Join-Path $ProjectRoot ".next"),
  (Join-Path $ProjectRoot ".turbo"),
  (Join-Path $ProjectRoot "node_modules\.cache\next")
)
foreach ($cache in $cachePaths) {
  if (Test-Path $cache) {
    Remove-Item -Path $cache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  cleared $cache" -ForegroundColor DarkGray
  }
}

Write-Host "3/5 Applying the complete staff portal replacement..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $SourceApp "*") -Destination $TargetApp -Recurse -Force

Write-Host "4/5 Verifying the hydration boundary..." -ForegroundColor Cyan
$pageFile = Join-Path $TargetApp "staff\dashboard\page.tsx"
$entryFile = Join-Path $TargetApp "staff\dashboard\StaffDashboardEntry.tsx"
$clientFile = Join-Path $TargetApp "staff\dashboard\StaffDashboardClient.tsx"

if (-not (Test-Path $entryFile)) {
  throw "StaffDashboardEntry.tsx was not installed. Check ProjectRoot."
}

$pageText = Get-Content -Raw $pageFile
$entryText = Get-Content -Raw $entryFile
$clientText = Get-Content -Raw $clientFile

if ($pageText -notmatch 'StaffDashboardEntry') {
  throw "page.tsx is not using StaffDashboardEntry. The old dashboard page is still present."
}

if ($pageText -match '<StaffDashboardClient') {
  throw "page.tsx still renders StaffDashboardClient directly. V11 was not applied correctly."
}

if ($entryText -notmatch 'ssr:\s*false') {
  throw "StaffDashboardEntry.tsx does not contain ssr: false."
}

if ($clientText -match 'StaffDashboardHydrationShell|const \[hydrated,\s*setHydrated\]') {
  throw "Old hydration-shell logic is still present in StaffDashboardClient.tsx."
}

if ($clientText -match 'styles\.sidebarFilter') {
  throw "Old sidebarFilter JSX is still present in StaffDashboardClient.tsx."
}

Write-Host "  OK: page.tsx -> StaffDashboardEntry" -ForegroundColor Green
Write-Host "  OK: StaffDashboardEntry -> dynamic(ssr:false)" -ForegroundColor Green
Write-Host "  OK: old hydration shell removed" -ForegroundColor Green

Write-Host "5/5 Patch complete." -ForegroundColor Green
Write-Host "Backup: $backupRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Now run:" -ForegroundColor Yellow
Write-Host "  cd `"$ProjectRoot`""
Write-Host "  npx prisma generate"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Open the dashboard in a new tab. If Chrome reused an old tab, use Ctrl+Shift+R once." -ForegroundColor Yellow
Write-Host "If an extension still modifies the DOM, test once in an Incognito window with extensions disabled." -ForegroundColor Yellow
