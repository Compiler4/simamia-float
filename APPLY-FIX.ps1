param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float"
)

$ErrorActionPreference = "Stop"
$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Copy-WithBackup {
  param(
    [string]$Source,
    [string]$Destination
  )

  $destinationDirectory = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null

  if (Test-Path -LiteralPath $Destination) {
    Copy-Item -LiteralPath $Destination -Destination "$Destination.before-login-compat-fix" -Force
  }

  Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

Copy-WithBackup `
  -Source (Join-Path $packageRoot "lib\auth.ts") `
  -Destination (Join-Path $ProjectPath "lib\auth.ts")

Copy-WithBackup `
  -Source (Join-Path $packageRoot "app\api\auth\login\route.ts") `
  -Destination (Join-Path $ProjectPath "app\api\auth\login\route.ts")

& (Join-Path $packageRoot "apply-css-fix.ps1") -ProjectPath $ProjectPath

Push-Location $ProjectPath
try {
  Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
  Remove-Item -Force "tsconfig.tsbuildinfo" -ErrorAction SilentlyContinue

  Write-Host "Running TypeScript validation..." -ForegroundColor Cyan
  npx tsc --noEmit
}
finally {
  Pop-Location
}

Write-Host "Login compatibility repair completed." -ForegroundColor Green
Write-Host "Start the app with: npm run dev"
