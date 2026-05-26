param(
    [string] $HostName = "45.142.141.141",
    [string] $RemoteUser = "platho-deploy",
    [string] $DeployKey = "$HOME\.ssh\platho_deploy_ed25519",
    [string] $KnownHosts = "artifacts\local\njalla_known_hosts",
    [switch] $SkipPrepare
)

$ErrorActionPreference = "Stop"

function Run-Checked {
    param(
        [string] $File,
        [string[]] $ArgumentList
    )

    & $File @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$File failed with exit code $LASTEXITCODE"
    }
}

function Quote-ProcessArgument {
    param([string] $Value)

    if ($Value -notmatch '[\s"]') {
        return $Value
    }
    return '"' + $Value.Replace('"', '\"') + '"'
}

if (-not $SkipPrepare) {
    Run-Checked -File "node" -ArgumentList @("scripts\prepare_static_web_deploy.mjs", "--clean")
}

if (-not (Test-Path -LiteralPath $DeployKey)) {
    throw "Deploy key not found: $DeployKey"
}
if (-not (Test-Path -LiteralPath $KnownHosts)) {
    throw "Known hosts file not found: $KnownHosts"
}

$prep = Get-Content -LiteralPath "artifacts\web_static_deploy_prep.json" -Raw | ConvertFrom-Json
$bundleHash = $prep.runtime.bundleSha256
if (-not $bundleHash) {
    throw "Missing runtime.bundleSha256 in artifacts\web_static_deploy_prep.json"
}

$release = "release-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $bundleHash.Substring(0, 12)
$tarPath = "artifacts\local\platho-web-static-$release.tar"

Run-Checked -File "tar.exe" -ArgumentList @("-cf", $tarPath, "-C", $prep.outputDir, ".")

$absoluteTar = (Resolve-Path -LiteralPath $tarPath).Path
$absoluteKey = (Resolve-Path -LiteralPath $DeployKey).Path
$absoluteKnownHosts = (Resolve-Path -LiteralPath $KnownHosts).Path

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = "ssh.exe"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$sshArgs = @(
    "-i",
    $absoluteKey,
    "-o",
    "BatchMode=yes",
    "-o",
    "UserKnownHostsFile=$absoluteKnownHosts",
    "$RemoteUser@$HostName",
    $release
)
$psi.Arguments = ($sshArgs | ForEach-Object { Quote-ProcessArgument $_ }) -join " "

$proc = [System.Diagnostics.Process]::Start($psi)
$stream = [System.IO.File]::OpenRead($absoluteTar)
try {
    $stream.CopyTo($proc.StandardInput.BaseStream)
} finally {
    $stream.Dispose()
    $proc.StandardInput.Close()
}

$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

if ($stdout.Trim()) {
    Write-Output $stdout.Trim()
}
if ($stderr.Trim()) {
    Write-Error $stderr.Trim()
}
if ($proc.ExitCode -ne 0) {
    throw "Deploy failed with exit code $($proc.ExitCode)"
}

Write-Output "Static web deployed: $release"
Write-Output "Tarball: $absoluteTar"
