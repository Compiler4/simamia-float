param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Write-Host "Stop npm run dev before running this script." -ForegroundColor Yellow

$targets = @(
  (Join-Path $ProjectRoot ".next"),
  (Join-Path $ProjectRoot ".turbo"),
  (Join-Path $ProjectRoot "node_modules\.cache\next")
)

foreach ($target in $targets) {
  if (Test-Path $target) {
    Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed: $target" -ForegroundColor Green
  }
}

Write-Host "Next.js hydration caches are clean. Start again with: npm run dev" -ForegroundColor Cyan
