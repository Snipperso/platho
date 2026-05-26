param(
    [string] $HostName = "45.142.141.141",
    [string] $AdminUser = "platho",
    [string] $AdminKey = "$HOME\.ssh\platho_njalla_ed25519",
    [string] $KnownHosts = "artifacts\local\njalla_known_hosts"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $AdminKey)) {
    throw "Admin key not found: $AdminKey"
}
if (-not (Test-Path -LiteralPath $KnownHosts)) {
    throw "Known hosts file not found: $KnownHosts"
}

$absoluteKey = (Resolve-Path -LiteralPath $AdminKey).Path
$absoluteKnownHosts = (Resolve-Path -LiteralPath $KnownHosts).Path

function Quote-ProcessArgument {
    param([string] $Value)

    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    return '"' + $Value.Replace('"', '\"') + '"'
}

function Invoke-RemoteScript {
    param([string] $Script)

    $sshArgs = @(
        "-i",
        $absoluteKey,
        "-o",
        "BatchMode=yes",
        "-o",
        "UserKnownHostsFile=$absoluteKnownHosts",
        "$AdminUser@$HostName",
        "sh -s"
    )
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = "ssh.exe"
    $psi.Arguments = ($sshArgs | ForEach-Object { Quote-ProcessArgument $_ }) -join " "
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Write(($Script -replace "`r`n", "`n").Replace("`r", ""))
    $proc.StandardInput.Close()
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($stdout.Trim()) {
        Write-Output $stdout.TrimEnd()
    }
    if ($stderr.Trim()) {
        Write-Error $stderr.TrimEnd()
    }
    if ($proc.ExitCode -ne 0) {
        throw "Remote health command failed with exit code $($proc.ExitCode)"
    }
}

Write-Output "== SSH / services / firewall =="
Invoke-RemoteScript @'
set -eu
echo "-- sshd"
sudo sshd -T | grep -E "^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|allowusers|maxauthtries|logingracetime) "
echo "-- services"
systemctl is-active ssh caddy unattended-upgrades fail2ban
echo "-- ufw"
sudo ufw status | head -n 12
echo "-- release"
sudo readlink -f /srv/platho/current
sudo test -f /srv/platho/current/index.html
echo "-- disk"
df -h /srv/platho | head -n 2
'@

Write-Output "== HTTP =="
Invoke-RemoteScript @'
set -eu
echo "-- platho.app"
curl -fsSI https://platho.app/ | grep -Ei "^(HTTP/|content-type|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy)"
echo "-- canonical index redirect"
curl -fsSI https://platho.app/index.html | grep -Ei "^(HTTP/|location)"
echo "-- www redirect"
curl -fsSI https://www.platho.app/ | grep -Ei "^(HTTP/|location)"
echo "-- http redirect"
curl -fsSI http://platho.app/ | grep -Ei "^(HTTP/|location)"
'@

Write-Output "== Root SSH denial =="
$rootArgs = @(
    "-i",
    $absoluteKey,
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=8",
    "-o",
    "UserKnownHostsFile=$absoluteKnownHosts",
    "root@$HostName",
    "echo root-open"
)
$rootPsi = [System.Diagnostics.ProcessStartInfo]::new()
$rootPsi.FileName = "ssh.exe"
$rootPsi.Arguments = ($rootArgs | ForEach-Object { Quote-ProcessArgument $_ }) -join " "
$rootPsi.UseShellExecute = $false
$rootPsi.RedirectStandardOutput = $true
$rootPsi.RedirectStandardError = $true
$rootProc = [System.Diagnostics.Process]::Start($rootPsi)
$rootProc.WaitForExit()
if ($rootProc.ExitCode -eq 0) {
    throw "Root SSH login unexpectedly succeeded"
}
Write-Output "root SSH denied as expected"

Write-Output "Server health check passed."
