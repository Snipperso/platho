# Reads the deploy target out of artifacts/local/deploy-hosts.env — see deploy/deploy-hosts.env.example.
#
# Dot-source this AFTER the param() block (param must be a script's first statement, so the defaults there are
# left empty and filled in below), then resolve each setting:
#
#   . (Join-Path $PSScriptRoot 'lib\deploy-hosts.ps1')
#   if (-not $HostName) { $HostName = Get-PlathoSetting -Name 'PLATHO_HOST_PRODUCTION' }
#
# A missing value THROWS with the name of the setting and the path of the file. It never falls back to a
# built-in address: this whole file exists because those built-in addresses were published in a public repo,
# and a silent fallback would quietly restore the thing it removed — and could aim a deploy at the wrong box.

$script:PlathoDeployHostsFile = Join-Path $PSScriptRoot '..\..\artifacts\local\deploy-hosts.env'

function Get-PlathoSetting {
    param(
        [Parameter(Mandatory = $true)][string] $Name
    )

    # The environment wins, so a one-off target needs no edit: $env:PLATHO_HOST_PRODUCTION = '...' before the run.
    $fromEnv = [Environment]::GetEnvironmentVariable($Name)
    if (-not [string]::IsNullOrWhiteSpace($fromEnv)) { return $fromEnv.Trim() }

    if (-not (Test-Path -LiteralPath $script:PlathoDeployHostsFile)) {
        throw ("$Name is not set and $script:PlathoDeployHostsFile does not exist. " +
               "Copy deploy/deploy-hosts.env.example there and fill it in.")
    }

    foreach ($line in (Get-Content -LiteralPath $script:PlathoDeployHostsFile)) {
        $trimmed = $line.Trim()
        if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }
        $at = $trimmed.IndexOf("=")
        if ($at -lt 1) { continue }
        if ($trimmed.Substring(0, $at).Trim() -eq $Name) { return $trimmed.Substring($at + 1).Trim() }
    }

    throw ("$Name is missing from $script:PlathoDeployHostsFile. " +
           "deploy/deploy-hosts.env.example lists every setting these scripts read.")
}

# Key settings hold a BASENAME inside ~/.ssh, not a path, so the file survives being carried between machines.
function Get-PlathoSshKey {
    param(
        [Parameter(Mandatory = $true)][string] $Name
    )

    return (Join-Path $HOME (Join-Path ".ssh" (Get-PlathoSetting -Name $Name)))
}
