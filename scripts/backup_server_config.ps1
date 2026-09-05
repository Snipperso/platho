param(
    [string] $HostName,
    [string] $AdminUser,
    [string] $AdminKey,
    [string] $KnownHosts
)

$ErrorActionPreference = "Stop"

# Target from artifacts/local/deploy-hosts.env, never from a default baked into this public repo.
. (Join-Path $PSScriptRoot "lib\deploy-hosts.ps1")
if (-not $HostName)   { $HostName   = Get-PlathoSetting -Name "PLATHO_HOST_PRODUCTION" }
if (-not $AdminUser)  { $AdminUser  = Get-PlathoSetting -Name "PLATHO_ADMIN_USER" }
if (-not $AdminKey)   { $AdminKey   = Get-PlathoSshKey  -Name "PLATHO_ADMIN_KEY" }
if (-not $KnownHosts) { $KnownHosts = Get-PlathoSetting -Name "PLATHO_KNOWN_HOSTS" }

if (-not (Test-Path -LiteralPath $AdminKey)) {
    throw "Admin key not found: $AdminKey"
}
if (-not (Test-Path -LiteralPath $KnownHosts)) {
    throw "Known hosts file not found: $KnownHosts"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = "platho-server-config-backup-$timestamp"
$localTar = "artifacts\local\$name.tar"
$remoteDir = "/tmp/$name"
$remoteTar = "/tmp/$name.tar"
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
        throw "Remote script failed with exit code $($proc.ExitCode)"
    }
}

$remoteScript = @'
set -eu
rm -rf "__REMOTE_DIR__" "__REMOTE_TAR__"
mkdir "__REMOTE_DIR__"
for f in \
  /etc/caddy/Caddyfile \
  /etc/ssh/sshd_config \
  /etc/ssh/sshd_config.d/*.conf \
  /etc/fail2ban/jail.d/sshd.local \
  /usr/local/bin/platho-deploy-receive; do
  if [ -e "$f" ]; then
    sudo cp --parents "$f" "__REMOTE_DIR__"
  fi
done
{
  echo "Generated: \$(date -Is)"
  echo
  echo "== hostnamectl =="
  hostnamectl || true
  echo
  echo "== sshd -T selected =="
  sudo sshd -T | grep -E "^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication|allowusers|maxauthtries|logingracetime|x11forwarding|allowtcpforwarding|allowagentforwarding) "
  echo
  echo "== ufw status =="
  sudo ufw status verbose
  echo
  echo "== fail2ban sshd =="
  sudo fail2ban-client status sshd || true
  echo
  echo "== services =="
  systemctl is-active ssh caddy unattended-upgrades fail2ban || true
  echo
  echo "== current release =="
  readlink -f /srv/platho/current || true
  echo
  echo "== releases =="
  sudo find /srv/platho/releases -maxdepth 1 -mindepth 1 -type d -printf "%f\n" | sort || true
  echo
  echo "== packages =="
  dpkg-query -W -f="\${binary:Package}\t\${Version}\n" | sort
} > "__REMOTE_DIR__/SERVER_STATE.txt"
sudo chown -R "__ADMIN_USER__:__ADMIN_USER__" "__REMOTE_DIR__"
tar -C "__REMOTE_DIR__" -cf "__REMOTE_TAR__" .
rm -rf "__REMOTE_DIR__"
'@
$remoteScript = $remoteScript.Replace('__REMOTE_DIR__', $remoteDir).Replace('__REMOTE_TAR__', $remoteTar).Replace('__ADMIN_USER__', $AdminUser)

Invoke-RemoteScript $remoteScript

& scp.exe -i $absoluteKey -o BatchMode=yes -o "UserKnownHostsFile=$absoluteKnownHosts" "$AdminUser@${HostName}:$remoteTar" $localTar
if ($LASTEXITCODE -ne 0) {
    throw "Backup download failed with exit code $LASTEXITCODE"
}

Invoke-RemoteScript "rm -f '$remoteTar'"

$sha = (Get-FileHash -LiteralPath $localTar -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Output "Server config backup: $((Resolve-Path -LiteralPath $localTar).Path)"
Write-Output "SHA256: $sha"
