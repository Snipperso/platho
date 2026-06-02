param(
  [string]$OutputPath = "",
  [string]$Label = "platho_larisa_audit"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$artifactsDir = Join-Path $root "artifacts"
if (!(Test-Path -LiteralPath $artifactsDir)) {
  New-Item -ItemType Directory -Path $artifactsDir | Out-Null
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = Join-Path $artifactsDir "$Label`_$stamp.zip"
}

if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
} else {
  $resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $root $OutputPath))
}
if (Test-Path -LiteralPath $resolvedOutput) {
  throw "Archive already exists: $resolvedOutput"
}

$forbiddenPatterns = @(
  '(^|/)\.git(/|$)',
  '(^|/)node_modules(/|$)',
  '(^|/)gitdir-probe(/|$)',
  '(^|/)\.audit-staging[^/]*(/|$)',
  '(^|/)\.edge-smoke[^/]*(/|$)',
  '^artifacts/local(/|$)',
  '^artifacts/edge-',
  '^artifacts/platho-web-static-',
  '^artifacts/.*\.zip$',
  '(^|/)Default/Login Data( For Account)?$',
  '(^|/)Default/Vpn Tokens$',
  '(^|/)Default/Network/Cookies$',
  '(^|/)IndexedDB(/|$)',
  '(^|/)Local Storage(/|$)',
  '(^|/)Session Storage(/|$)',
  '(^|/)Local State$',
  '(^|/)Secure Preferences$',
  '(^|/)History$',
  '(^|/)[^/]*\.(local|seed|mnemonic|secret|pem|key)$'
)

$safeLocalArtifactPaths = @(
  'artifacts/local/mainnet_final_manifest_draft.json',
  'artifacts/local/MAINNET_FINAL_MANIFEST_DRAFT.md',
  'artifacts/local/mainnet_deploy_packet.json',
  'artifacts/local/MAINNET_DEPLOY_PACKET.md',
  'artifacts/local/mainnet_tx_dry_run_packet.json',
  'artifacts/local/MAINNET_TX_DRY_RUN_PACKET.md'
)

function Normalize-ArchivePath([string]$Path) {
  return $Path.Replace("\", "/").TrimStart("/")
}

function Test-SafeLocalArtifactPath([string]$Path) {
  $normalized = Normalize-ArchivePath $Path
  return $safeLocalArtifactPaths -contains $normalized
}

function Test-ForbiddenArchivePath([string]$Path) {
  $normalized = Normalize-ArchivePath $Path
  if (Test-SafeLocalArtifactPath $normalized) {
    return $false
  }
  if ($normalized -match '^\.env' -and $normalized -ne '.env.testnet.example') {
    return $true
  }
  foreach ($pattern in $forbiddenPatterns) {
    if ($normalized -match $pattern) {
      return $true
    }
  }
  return $false
}

function Test-JsonObjectForSensitiveLocalFields($Value, [string]$PathLabel) {
  $sensitiveKeyPattern = '(?i)^(mnemonic|private[_-]?key|secret[_-]?key|seed[_-]?phrase|seed[_-]?words|api[_-]?key|bearer[_-]?token|rpc[_-]?(secret|token|key))$'
  if ($null -eq $Value) { return }

  if ($Value -is [System.Array]) {
    for ($i = 0; $i -lt $Value.Count; $i++) {
      Test-JsonObjectForSensitiveLocalFields $Value[$i] "$PathLabel[$i]"
    }
    return
  }

  if ($Value -is [System.Management.Automation.PSCustomObject]) {
    foreach ($property in $Value.PSObject.Properties) {
      if ($property.Name -match $sensitiveKeyPattern) {
        throw "Safe local artifact contains forbidden sensitive field '$($property.Name)' at $PathLabel"
      }
      Test-JsonObjectForSensitiveLocalFields $property.Value "$PathLabel.$($property.Name)"
    }
  }
}

function Assert-SafeLocalArtifactContent([string]$Path) {
  $normalized = Normalize-ArchivePath $Path
  if (!(Test-SafeLocalArtifactPath $normalized)) { return }

  $full = Join-Path $root $normalized
  if (!(Test-Path -LiteralPath $full -PathType Leaf)) { return }

  $text = Get-Content -LiteralPath $full -Raw
  $sensitiveTextPattern = '(?im)(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|(^|[^a-z])(mnemonic|private[_ -]?key|secret[_ -]?key|seed[_ -]?phrase|seed[_ -]?words|api[_ -]?key|bearer[_ -]?token|rpc[_ -]?(secret|token|key))\s*[:=]\s*\S+)'
  if ($text -match $sensitiveTextPattern) {
    throw "Safe local artifact contains forbidden secret-looking text: $normalized"
  }

  if ($normalized.EndsWith('.json')) {
    $json = $text | ConvertFrom-Json
    Test-JsonObjectForSensitiveLocalFields $json $normalized
    $hasDeployFlag = $json.PSObject.Properties.Name -contains 'production_deploy_executed'
    if ($hasDeployFlag -and $json.production_deploy_executed -ne $false) {
      throw "Safe local artifact must keep production_deploy_executed=false: $normalized"
    }
  } elseif ($normalized.EndsWith('.md')) {
    if ($text -notmatch '(?i)(Production deploy executed:\s*false|dry-run|local ignored draft)') {
      throw "Safe local markdown artifact must explicitly say it is local/dry-run/non-production: $normalized"
    }
  }
}

$gitOutput = & git -C $root ls-files --cached --others --exclude-standard
if ($LASTEXITCODE -ne 0) {
  throw "git ls-files failed"
}

$entries = New-Object System.Collections.Generic.List[string]
$blockedCandidates = New-Object System.Collections.Generic.List[string]

foreach ($line in $gitOutput) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $entryName = Normalize-ArchivePath $line
  if (Test-ForbiddenArchivePath $entryName) {
    $blockedCandidates.Add($entryName)
    continue
  }
  $full = Join-Path $root $entryName
  if (!(Test-Path -LiteralPath $full -PathType Leaf)) { continue }
  $entries.Add($entryName)
}

foreach ($entryName in $safeLocalArtifactPaths) {
  $full = Join-Path $root $entryName
  if (!(Test-Path -LiteralPath $full -PathType Leaf)) { continue }
  if (Test-ForbiddenArchivePath $entryName) {
    throw "Safe local artifact is unexpectedly forbidden: $entryName"
  }
  Assert-SafeLocalArtifactContent $entryName
  $entries.Add($entryName)
}

if ($blockedCandidates.Count -gt 0) {
  $sample = ($blockedCandidates | Select-Object -First 30) -join "`n"
  throw "Refusing to package forbidden audit archive paths:`n$sample"
}

if ($entries.Count -eq 0) {
  throw "No files selected for audit archive"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open($resolvedOutput, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($entryName in ($entries | Sort-Object -Unique)) {
    $full = Join-Path $root $entryName
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $full,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $archive.Dispose()
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedOutput)
try {
  $badEntries = @($archive.Entries | ForEach-Object { $_.FullName } | Where-Object { Test-ForbiddenArchivePath $_ })
  if ($badEntries.Count -gt 0) {
    $sample = ($badEntries | Select-Object -First 30) -join "`n"
    throw "Created archive contains forbidden paths:`n$sample"
  }
} catch {
  Remove-Item -LiteralPath $resolvedOutput -Force -ErrorAction SilentlyContinue
  throw
} finally {
  if ($archive) { $archive.Dispose() }
}

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput).Hash
$item = Get-Item -LiteralPath $resolvedOutput
$result = [pscustomobject]@{
  ok = $true
  path = $resolvedOutput
  bytes = $item.Length
  mib = [math]::Round($item.Length / 1MB, 2)
  sha256 = $hash
  entryCount = $entries.Count
}

$result | ConvertTo-Json -Depth 3
