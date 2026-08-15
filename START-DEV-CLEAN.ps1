param(
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "SIMAMIA development server startup" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot"
Write-Host "Port:    $Port"

$connections = @(
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
)

if ($connections.Count -gt 0) {
  $ownerIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($ownerId in $ownerIds) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerId" -ErrorAction SilentlyContinue
    $processName = if ($processInfo) { [string]$processInfo.Name } else { '' }
    $commandLine = if ($processInfo) { [string]$processInfo.CommandLine } else { '' }

    $looksLikeNode = $processName -match '^node(\.exe)?$'
    $looksLikeNext = $commandLine -match 'next|simamia'

    if ($looksLikeNode -or $looksLikeNext) {
      Write-Host "Stopping stale development process PID $ownerId ($processName) using port $Port..." -ForegroundColor Yellow
      Stop-Process -Id $ownerId -Force -ErrorAction Stop
    }
    else {
      throw "Port $Port is used by PID $ownerId ($processName), which does not look like the SIMAMIA/Next.js development process. Stop that application manually or start SIMAMIA on another port."
    }
  }

  Start-Sleep -Milliseconds 800
}

$stillBusy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($stillBusy) {
  throw "Port $Port is still in use. Run: netstat -ano | findstr :$Port"
}

Write-Host "Port $Port is free. Starting Next.js..." -ForegroundColor Green
& npx next dev --hostname 0.0.0.0 --port $Port
exit $LASTEXITCODE
