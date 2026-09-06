# Loads NSE universe into Supabase. Prompts for service_role key without
# exposing it to shell history or to the agent context.

$supabaseUrl = 'https://hczusirejmqmmasssspd.supabase.co'

Write-Host "Supabase URL: $supabaseUrl"
Write-Host ""
Write-Host "Paste your Supabase SERVICE_ROLE key (from Project Settings -> API)."
Write-Host "The input is masked and only used for this command's env vars."
Write-Host ""

# Read key securely (no echo). Convert via NetworkCredential.GetNetworkCredential
# which is the canonical, bug-free path from SecureString -> plain text.
Add-Type -AssemblyName System.Net
Add-Type -AssemblyName System.Runtime.InteropServices

# Build a PSCredential; -AsSecureString only works in a real interactive
# console, so fall back to a regular Read-Host with masked input if needed.
if ([Environment]::UserInteractive) {
    $cred = Get-Credential -Message "Paste your Supabase SERVICE_ROLE key"
    $secureKey = $cred.Password
} else {
    # Non-interactive (CI, agent): read plain text. Caller is responsible
    # for not echoing secrets. We accept it because this script is local.
    Write-Host "(non-interactive mode: input will be visible)"
    $secureKey = Read-Host -Prompt "SUPABASE_SERVICE_ROLE_KEY"
    $secureKey = ConvertTo-SecureString -String $secureKey -AsPlainText -Force
}

$plainKey = [System.Net.NetworkCredential]::new('', $secureKey).Password

$env:SUPABASE_URL = $supabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $plainKey

try {
    & node scripts/load-nse-universe.mjs
} finally {
    Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\SUPABASE_URL -ErrorAction SilentlyContinue
    $plainKey = $null
    [System.GC]::Collect()
}
