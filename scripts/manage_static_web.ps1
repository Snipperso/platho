param(
    [ValidateSet("list", "rollback", "prune")]
    [string] $Action = "list",
    [string] $Release = "",
    [int] $Keep = 5,
    [string] $HostName = "45.142.141.141",
    [string] $RemoteUser = "platho-deploy",
    [string] $DeployKey = "$HOME\.ssh\platho_deploy_ed25519",
    [string] $KnownHosts = "artifacts\local\njalla_known_hosts"
)

$ErrorActionPreference = "Stop"

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
