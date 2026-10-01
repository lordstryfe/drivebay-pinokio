# Writes the port, mode, and first-run account chosen in setup.
# Username and password are UTF-16 files from the installer, deleted before this script exits.
$ErrorActionPreference = "Stop"

$homeDir = $env:DRIVEBAY_HOME
if (-not $homeDir) { throw "DRIVEBAY_HOME is not set" }
$portText = $env:DRIVEBAY_PORT
$mode = $env:DRIVEBAY_MODE
$version = $env:DRIVEBAY_VERSION
$userFile = $env:DRIVEBAY_SETUP_USER_FILE
$passFile = $env:DRIVEBAY_SETUP_PASSWORD_FILE

if ($mode -ne "tailscale" -and $mode -ne "regular") { throw "Mode must be tailscale or regular" }
$port = 0
if (-not [int]::TryParse($portText, [ref]$port)) { throw "Port is not a number" }
if ($port -lt 1024 -or $port -gt 65535) { throw "Port must be from 1024 to 65535" }

try {
  $userName = [System.IO.File]::ReadAllText($userFile, [System.Text.Encoding]::Unicode).Trim().Trim([char]0)
  $password = [System.IO.File]::ReadAllText($passFile, [System.Text.Encoding]::Unicode).Trim([char]0)
} finally {
  foreach ($secretFile in @($userFile, $passFile)) {
    if ($secretFile -and (Test-Path -LiteralPath $secretFile)) {
      $len = (Get-Item -LiteralPath $secretFile).Length
      [System.IO.File]::WriteAllBytes($secretFile, (New-Object byte[] $len))
      Remove-Item -LiteralPath $secretFile -Force
    }
  }
}

if (-not $userName) { throw "Username is required" }
if (-not $password -or $password.Length -lt 8) { throw "Password must be at least 8 characters" }

New-Item -ItemType Directory -Force -Path (Join-Path $homeDir "data") | Out-Null
$config = @{ port = $port; mode = $mode; version = $version } | ConvertTo-Json -Compress
$pending = @{ username = $userName; password = $password } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText((Join-Path $homeDir "config.json"), $config)
[System.IO.File]::WriteAllText((Join-Path $homeDir "drivebay.port"), "$port")
[System.IO.File]::WriteAllText((Join-Path $homeDir "pending-account.json"), $pending)
if ($mode -eq "tailscale") {
  Write-Output "Saved Drivebay port $port (tailscale). No router port forward is required."
} else {
  Write-Output "Saved Drivebay port $port (regular). Forward this port on your router."
}
