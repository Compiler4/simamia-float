param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float"
)

$ErrorActionPreference = "Stop"
$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectPath "_login_logo_backup_$Timestamp"

$files = @(
  "app\login\login.module.css",
  "app\login\LoginForm.tsx",
  "app\login\page.tsx",
  "public\icons\icon-192x192.png",
  "public\icons\icon-512x512.png",
  "public\icons\apple-touch-icon.png",
  "public\icons\favicon-32x32.png"
)

foreach ($relative in $files) {
  $source = Join-Path $SourceRoot $relative
  $target = Join-Path $ProjectPath $relative

  if (-not (Test-Path $source)) {
    throw "Missing package file: $source"
  }

  if (Test-Path $target) {
    $backup = Join-Path $BackupRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $backup -Parent) | Out-Null
    Copy-Item -LiteralPath $target -Destination $backup -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

$nextPath = Join-Path $ProjectPath ".next"
$tsBuildInfo = Join-Path $ProjectPath "tsconfig.tsbuildinfo"

Remove-Item -Recurse -Force $nextPath -ErrorAction SilentlyContinue
Remove-Item -Force $tsBuildInfo -ErrorAction SilentlyContinue

Write-Host "Login CSS and Simamia icon files applied successfully." -ForegroundColor Green
Write-Host "Backup folder: $BackupRoot" -ForegroundColor Cyan
Write-Host "Next: cd `"$ProjectPath`"; npx tsc --noEmit; npm run dev" -ForegroundColor Yellow
