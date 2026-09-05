param(
    [ValidateSet("list", "rollback", "prune")]
    [string] $Action = "list",
    [string] $Release = "",
    [int] $Keep = 5,
    [string] $HostName,
    [string] $RemoteUser,
    [string] $DeployKey,
    [string] $KnownHosts
)

$ErrorActionPreference = "Stop"

# Target from artifacts/local/deploy-hosts.env, never from a default baked into this public repo.
. (Join-Path $PSScriptRoot "lib\deploy-hosts.ps1")
if (-not $HostName)   { $HostName   = Get-PlathoSetting -Name "PLATHO_HOST_PRODUCTION" }
if (-not $RemoteUser) { $RemoteUser = Get-PlathoSetting -Name "PLATHO_DEPLOY_USER" }
if (-not $DeployKey)  { $DeployKey  = Get-PlathoSshKey  -Name "PLATHO_DEPLOY_KEY" }
if (-not $KnownHosts) { $KnownHosts = Get-PlathoSetting -Name "PLATHO_KNOWN_HOSTS" }

if (-not (Test-Path -LiteralPath $DeployKey)) {
    throw "Deploy key not found: $DeployKey"
}
if (-not (Test-Path -LiteralPath $KnownHosts)) {
    throw "Known hosts file not found: $KnownHosts"
}

$remoteCommand = switch ($Action) {
    "list" {
        "list"
    }
    "rollback" {
        if (-not $Release) {
            throw "Rollback requires -Release <release-name>"
        }
        "rollback $Release"
    }
    "prune" {
        if ($Keep -lt 1) {
            throw "Prune -Keep must be >= 1"
        }
        "prune keep $Keep"
    }
}

$absoluteKey = (Resolve-Path -LiteralPath $DeployKey).Path
$absoluteKnownHosts = (Resolve-Path -LiteralPath $KnownHosts).Path

$sshArgs = @(
    "-i",
    $absoluteKey,
    "-o",
    "BatchMode=yes",
    "-o",
    "UserKnownHostsFile=$absoluteKnownHosts",
    "$RemoteUser@$HostName",
    $remoteCommand
)

& ssh.exe @sshArgs
if ($LASTEXITCODE -ne 0) {
    throw "Remote static web management command failed with exit code $LASTEXITCODE"
}
