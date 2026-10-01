# Best-effort Windows Firewall rule for the Drivebay port.
# A normal per-user install cannot add this rule without an administrator prompt.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("add", "remove")]
  [string]$Action
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $env:LOCALAPPDATA "Drivebay\config.json"
if (-not (Test-Path -LiteralPath $configPath)) { exit 0 }
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$port = [int]$config.port
if ($port -lt 1024 -or $port -gt 65535) { exit 0 }
$rule = "Drivebay TCP $port"
if ($Action -eq "remove") {
  netsh advfirewall firewall delete rule name="$rule" | Out-Null
  exit 0
}
netsh advfirewall firewall add rule name="$rule" dir=in action=allow protocol=TCP localport=$port profile=any | Out-Null
Write-Output "Allowed inbound TCP $port in Windows Firewall."
