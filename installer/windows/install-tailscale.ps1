# Downloads the official Tailscale Windows installer from pkgs.tailscale.com and runs it.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$page = Invoke-WebRequest -UseBasicParsing -Uri "https://pkgs.tailscale.com/stable/"
$found = [regex]::Matches($page.Content, "tailscale-setup-(\d+\.\d+\.\d+)\.exe")
if ($found.Count -lt 1) {
  throw "Could not find the official Tailscale Windows installer on pkgs.tailscale.com"
}
$ver = $found[0].Groups[1].Value
$url = "https://pkgs.tailscale.com/stable/tailscale-setup-$ver.exe"
$dest = Join-Path $env:TEMP "tailscale-setup-$ver.exe"
Write-Output "Downloading $url"
Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest

try {
  $shaBody = (Invoke-WebRequest -UseBasicParsing -Uri "$url.sha256").Content.Trim()
  $sha = ($shaBody -split "\s+")[0].ToLower()
  $got = (Get-FileHash -Algorithm SHA256 -Path $dest).Hash.ToLower()
  if ($sha -and $got -ne $sha) {
    Remove-Item -Force $dest
    throw "Tailscale installer checksum did not match the official .sha256 file."
  }
  Write-Output "Tailscale installer checksum ok"
} catch {
  if ($_.Exception.Message -match "checksum") { throw }
  Write-Output "Continuing without a checksum file: $($_.Exception.Message)"
}

Write-Output "Starting the official Tailscale installer"
$proc = Start-Process -FilePath $dest -Wait -PassThru
exit $proc.ExitCode
