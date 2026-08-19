param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$dashboard = Join-Path $ProjectRoot "app\staff\dashboard"
$page = Join-Path $dashboard "page.tsx"
$entry = Join-Path $dashboard "StaffDashboardEntry.tsx"
$client = Join-Path $dashboard "StaffDashboardClient.tsx"

Write-Host "SIMAMIA V11 hydration verification" -ForegroundColor Cyan

foreach ($file in @($page, $entry, $client)) {
  if (-not (Test-Path $file)) {
    Write-Host "MISSING: $file" -ForegroundColor Red
    exit 1
  }
}

$pageText = Get-Content -Raw $page
$entryText = Get-Content -Raw $entry
$clientText = Get-Content -Raw $client

$checks = @(
  @{ Name = "page uses StaffDashboardEntry"; Pass = ($pageText -match 'StaffDashboardEntry') },
  @{ Name = "page does not render StaffDashboardClient directly"; Pass = ($pageText -notmatch '<StaffDashboardClient') },
  @{ Name = "entry uses next/dynamic"; Pass = ($entryText -match 'next/dynamic') },
  @{ Name = "entry disables SSR"; Pass = ($entryText -match 'ssr:\s*false') },
  @{ Name = "old hydrated state removed"; Pass = ($clientText -notmatch 'const \[hydrated,\s*setHydrated\]') },
  @{ Name = "old hydration shell removed"; Pass = ($clientText -notmatch 'StaffDashboardHydrationShell') },
  @{ Name = "old sidebar filter removed"; Pass = ($clientText -notmatch 'styles\.sidebarFilter') }
)

$failed = $false
foreach ($check in $checks) {
  if ($check.Pass) {
    Write-Host "PASS  $($check.Name)" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $($check.Name)" -ForegroundColor Red
    $failed = $true
  }
}

if ($failed) {
  Write-Host "V11 is not fully applied to this project." -ForegroundColor Red
  exit 1
}

Write-Host "V11 is installed correctly. Stop dev, remove .next, and restart if an old overlay is still visible." -ForegroundColor Green
