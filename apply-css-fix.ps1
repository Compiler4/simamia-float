param(
  [string]$ProjectPath = "C:\Users\Micha\simamia-float"
)

$ErrorActionPreference = "Stop"
$cssPath = Join-Path $ProjectPath "app\login\login.module.css"

if (-not (Test-Path -LiteralPath $cssPath)) {
  throw "CSS file not found: $cssPath"
}

$backupPath = "$cssPath.before-browser-compat-fix"
Copy-Item -LiteralPath $cssPath -Destination $backupPath -Force

$content = Get-Content -LiteralPath $cssPath -Raw

if ($content -notmatch "-webkit-user-select:\s*none") {
  $content = $content -replace "(?m)^(\s*)user-select:\s*none;", '$1-webkit-user-select: none;' + "`r`n" + '$1user-select: none;'
}

if ($content -notmatch "-webkit-mask-image:") {
  $maskPattern = '(?s)mask-image:\s*radial-gradient\(\s*circle at center,\s*black,\s*transparent 78%\s*\);'
  $maskReplacement = '-webkit-mask-image: radial-gradient(circle at center, black, transparent 78%);' + "`r`n" + '  mask-image: radial-gradient(circle at center, black, transparent 78%);'
  $content = [regex]::Replace($content, $maskPattern, $maskReplacement, 1)
}

if ($content -notmatch "-webkit-backdrop-filter:") {
  $content = $content -replace "(?m)^(\s*)backdrop-filter:\s*([^;]+;)", '$1-webkit-backdrop-filter: $2' + "`r`n" + '$1backdrop-filter: $2'
}

$content = $content -replace "min-height:\s*auto;", "min-height: 0;"

Set-Content -LiteralPath $cssPath -Value $content -Encoding UTF8

Write-Host "CSS compatibility fixes applied." -ForegroundColor Green
Write-Host "Backup: $backupPath"
