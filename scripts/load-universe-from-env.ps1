# Loads NSE universe into Supabase using credentials from a local .env file.
#
# Usage:
#   1. Create .env in the project root with:
#        SUPABASE_URL=https://hczusirejmqmmasssspd.supabase.co
#        SUPABASE_SERVICE_ROLE_KEY=<paste-your-service-role-key-here>
#   2. Run this script. After it finishes, delete .env to remove the key.
#
# The .env file is gitignored by the standard Next/Vite conventions, but
# you should still delete it after one-time use.

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$envFile = Join-Path $PSScriptRoot '..\.env'
if (-not (Test-Path $envFile)) {
    Write-Error ".env not found at $envFile. Create it with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $k, $v = $_ -split '=', 2
    $k = $k.Trim()
    $v = $v.Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:\$k" -Value $v
}

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_SECRET_KEY) {
    Write-Error "Both SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env"
    exit 1
}

Write-Host "Loaded env from $envFile"
Write-Host "  URL:  $($env:SUPABASE_URL)"
Write-Host "  KEY:  $($env:SUPABASE_SECRET_KEY.Length) chars"

try {
    & node scripts/load-nse-universe.mjs
} finally {
    Remove-Item Env:\SUPABASE_SECRET_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\SUPABASE_URL -ErrorAction SilentlyContinue
}
