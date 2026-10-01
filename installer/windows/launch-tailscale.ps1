# Opens the Tailscale app if the official installer has already put it on this PC.
$ErrorActionPreference = "Stop"
$candidates = @(
  (Join-Path $env:ProgramFiles "Tailscale\Tailscale.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Tailscale\Tailscale.exe")
)
foreach ($path in $candidates) {
  if ($path -and (Test-Path -LiteralPath $path)) {
    Start-Process -FilePath $path
    Write-Output "Launched Tailscale"
    exit 0
  }
}
Write-Output "Tailscale is not installed yet. Finish its installer, then open Tailscale from the Start menu and sign in."
exit 1
