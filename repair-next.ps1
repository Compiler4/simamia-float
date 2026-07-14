param(
    [string]$ProjectPath = "C:\Users\Micha\simamia-float",
    [switch]$ReinstallDependencies,
    [switch]$UseTurbopack
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Remove-Safely([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        Write-Host "Removing $Path" -ForegroundColor DarkGray
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    }
}

if (-not (Test-Path -LiteralPath $ProjectPath)) {
    throw "Project folder was not found: $ProjectPath"
}

Set-Location -LiteralPath $ProjectPath

if (-not (Test-Path -LiteralPath "package.json")) {
    throw "package.json was not found in $ProjectPath"
}

Write-Step "Stopping Node/Next processes that are using this project"
$projectPattern = [Regex]::Escape($ProjectPath)
$projectProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -match '^(node|nodejs|npm|npx)(\.exe)?$' -and
        $_.CommandLine -and
        $_.CommandLine -match $projectPattern
    }

foreach ($process in $projectProcesses) {
    try {
        Write-Host "Stopping PID $($process.ProcessId): $($process.Name)" -ForegroundColor Yellow
        Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch {
        Write-Warning "Could not stop PID $($process.ProcessId): $($_.Exception.Message)"
    }
}

Start-Sleep -Milliseconds 800

Write-Step "Deleting corrupted Next.js and TypeScript generated output"
Remove-Safely ".next"
Remove-Safely ".turbo"
Remove-Safely "node_modules\.cache"
Remove-Safely "tsconfig.tsbuildinfo"

$nextLock = Join-Path $ProjectPath ".next\dev\lock"
if (Test-Path -LiteralPath $nextLock) {
    Remove-Item -LiteralPath $nextLock -Force -ErrorAction SilentlyContinue
}

if ($ReinstallDependencies) {
    Write-Step "Reinstalling dependencies"
    Remove-Safely "node_modules"

    if (Test-Path -LiteralPath "package-lock.json") {
        npm cache verify
        npm ci
    } else {
        npm cache verify
        npm install
    }
} else {
    Write-Step "Checking installed dependencies"
    if (-not (Test-Path -LiteralPath "node_modules\next\package.json")) {
        Write-Warning "Next.js is not installed. Installing project dependencies now."
        npm install
    }
}

Write-Step "Regenerating Prisma Client"
if (Test-Path -LiteralPath "prisma\schema.prisma") {
    npx prisma generate
} else {
    Write-Host "No prisma/schema.prisma found; Prisma generation skipped." -ForegroundColor DarkGray
}

Write-Step "Checking required application files"
$requiredFiles = @(
    "app\layout.tsx",
    "app\login\page.tsx"
)

foreach ($file in $requiredFiles) {
    if (Test-Path -LiteralPath $file) {
        Write-Host "OK  $file" -ForegroundColor Green
    } else {
        Write-Warning "Missing: $file"
    }
}

Write-Step "Starting Next.js"
if ($UseTurbopack) {
    Write-Host "Starting with Turbopack..." -ForegroundColor Green
    npx next dev
} else {
    Write-Host "Starting with Webpack to bypass the corrupted Turbopack persistence cache..." -ForegroundColor Green
    npx next dev --webpack
}
