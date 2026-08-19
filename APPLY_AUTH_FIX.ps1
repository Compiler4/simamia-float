param(
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
$packageJson = Join-Path $project "package.json"
$appDir = Join-Path $project "app"
$libDir = Join-Path $project "lib"
$targetAuth = Join-Path $libDir "auth.ts"
$sourceAuth = Join-Path $PSScriptRoot "lib\auth.ts"

if (-not (Test-Path -LiteralPath $packageJson)) {
  throw "package.json was not found at $project. Run this script with -ProjectRoot pointing to your SIMAMIA project."
}

if (-not (Test-Path -LiteralPath $appDir)) {
  throw "app folder was not found at $project. This does not look like the SIMAMIA Next.js project."
}

if (-not (Test-Path -LiteralPath $sourceAuth)) {
  throw "The repair package is incomplete: $sourceAuth is missing."
}

New-Item -ItemType Directory -Force -Path $libDir | Out-Null

if (Test-Path -LiteralPath $targetAuth) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backup = Join-Path $libDir "auth.ts.before-central-fix-$stamp.bak"
  Copy-Item -LiteralPath $targetAuth -Destination $backup -Force
  Write-Host "Backup created: $backup" -ForegroundColor DarkGray
}

Copy-Item -LiteralPath $sourceAuth -Destination $targetAuth -Force
Write-Host "Central auth restored: $targetAuth" -ForegroundColor Green

$content = Get-Content -LiteralPath $targetAuth -Raw
$required = @(
  "export async function getCurrentUser",
  "export async function createAuthSession",
  "export async function deleteAuthSession",
  "export function normalizeRole",
  "export function getRoleLabel",
  "export function getDashboardPath"
)

foreach ($needle in $required) {
  if (-not $content.Contains($needle)) {
    throw "Central auth verification failed. Missing: $needle"
  }
}

if ($content.Contains('from "@/lib/auth"') -or $content.Contains("from '@/lib/auth'")) {
  throw "Central auth verification failed: lib/auth.ts imports itself."
}

if ($content.Contains("requirePortalRole")) {
  throw "Central auth verification failed: requirePortalRole was found in lib/auth.ts."
}

$nextPath = Join-Path $project ".next"
if (Test-Path -LiteralPath $nextPath) {
  Remove-Item -LiteralPath $nextPath -Recurse -Force
  Write-Host "Removed stale .next cache." -ForegroundColor DarkGray
}

Write-Host "" 
Write-Host "AUTH REPAIR PASSED" -ForegroundColor Green
Write-Host "Required central exports are present." -ForegroundColor Green
Write-Host "No self-import exists." -ForegroundColor Green
Write-Host "requirePortalRole is not in lib/auth.ts." -ForegroundColor Green
Write-Host "" 
Write-Host "Next commands:" -ForegroundColor Cyan
Write-Host "  cd `"$project`""
Write-Host "  npx tsc --noEmit --incremental false"
Write-Host "  npm run dev"
