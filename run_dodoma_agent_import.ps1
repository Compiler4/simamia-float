param(
  [string]$Database = "simamia",
  [string]$User = "root",
  [string]$Password = "",
  [string]$HostName = "127.0.0.1",
  [int]$Port = 3306,
  [string]$MySqlExe = "C:\xampp\mysql\bin\mysql.exe"
)

$ErrorActionPreference = "Stop"
$sqlFile = Join-Path $PSScriptRoot "insert_2273_dodoma_agents_manual.sql"
if (-not (Test-Path $MySqlExe)) { throw "MySQL executable not found: $MySqlExe" }
if (-not (Test-Path $sqlFile)) { throw "SQL file not found: $sqlFile" }

$arguments = @("--host=$HostName", "--port=$Port", "--user=$User", "--default-character-set=utf8mb4", $Database)
if ($Password) { $arguments = @("--password=$Password") + $arguments }

Write-Host "Importing 2,273 agents into Dodoma Region / Dodoma Branch..." -ForegroundColor Cyan
Get-Content -Raw -Encoding UTF8 $sqlFile | & $MySqlExe @arguments
if ($LASTEXITCODE -ne 0) { throw "MySQL import failed with exit code $LASTEXITCODE." }
Write-Host "Dodoma agent import completed." -ForegroundColor Green
