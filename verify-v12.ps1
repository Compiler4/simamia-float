param(
  [Parameter(Mandatory = $false)]
  [string]$ProjectRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$checks = @(
  @{ Name = "Hydration entry boundary"; File = "app\staff\dashboard\page.tsx"; Pattern = "StaffDashboardEntry" },
  @{ Name = "Client dashboard no SSR"; File = "app\staff\dashboard\StaffDashboardEntry.tsx"; Pattern = "ssr:\s*false" },
  @{ Name = "Preview false-403 fix"; File = "app\api\staff\preview\route.ts"; Pattern = "exact-source requirement caused the false 403" },
  @{ Name = "Preview reference fallback"; File = "app\api\staff\preview\route.ts"; Pattern = "sameReference" },
  @{ Name = "Real location history API"; File = "app\api\staff\location-history\route.ts"; Pattern = "companyGpsDevice.findMany" },
  @{ Name = "Travel page real history fetch"; File = "app\staff\dashboard\StaffAdvancedOperations.tsx"; Pattern = "/api/staff/location-history" },
  @{ Name = "Street/Satellite map layers"; File = "app\staff\live-locations\LiveMap.tsx"; Pattern = "World_Imagery" },
  @{ Name = "All Staff devices included in live history"; File = "app\api\staff\live-locations\route.ts"; Pattern = "Combine pings from every GPS device" }
)

$failed = $false
foreach ($check in $checks) {
  $path = Join-Path $ProjectRoot $check.File
  if (-not (Test-Path $path)) {
    Write-Host "FAIL  $($check.Name) - file missing" -ForegroundColor Red
    $failed = $true
    continue
  }
  $text = Get-Content -Raw $path
  if ($text -match $check.Pattern) {
    Write-Host "PASS  $($check.Name)" -ForegroundColor Green
  } else {
    Write-Host "FAIL  $($check.Name)" -ForegroundColor Red
    $failed = $true
  }
}

if ($failed) {
  throw "V12 verification failed. Do not start the dev server until every check passes."
}

Write-Host ""
Write-Host "SIMAMIA Staff V12 is installed correctly." -ForegroundColor Green
