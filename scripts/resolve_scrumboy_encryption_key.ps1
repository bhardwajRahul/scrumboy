param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$RepoRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = Split-Path -Parent $PSScriptRoot
}

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$dataDir = Join-Path $RepoRoot "data"
$canonicalPath = Join-Path $dataDir "scrumboy.env"
$legacyPath = Join-Path $RepoRoot "scrumboy.env"

function Write-Warn([string]$Message) {
  Write-Host "WARNING: $Message"
}

function Fail([string]$Message) {
  Write-Host "ERROR: $Message"
  exit 1
}

function ConvertTo-KeyBytes([string]$Value) {
  if ($null -eq $Value) {
    return $null
  }

  $trimmed = $Value.Trim()
  if ($trimmed.Length -eq 0) {
    return $null
  }

  try {
    $bytes = [Convert]::FromBase64String($trimmed)
  } catch {
    return $null
  }

  if ($bytes.Length -ne 32) {
    return $null
  }

  return $bytes
}

function Get-KeyFileInfo([string]$Path, [string]$SourceLabel) {
  $info = [ordered]@{
    Exists       = $false
    HasCandidate = $false
    Valid        = $false
    Value        = $null
    SourceLabel  = $SourceLabel
    Remediation  = "Expected either a single SCRUMBOY_ENCRYPTION_KEY=<standard base64> line or a legacy raw single-line standard base64 key."
  }

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return [pscustomobject]$info
  }

  $info.Exists = $true

  $raw = Get-Content -LiteralPath $Path -Raw
  $lines = $raw -split "`r?`n"
  $significant = New-Object System.Collections.Generic.List[string]
  $hasCommentLines = $false

  foreach ($line in $lines) {
    $trimmedLine = $line.Trim()
    if ($trimmedLine.Length -eq 0) {
      continue
    }
    if ($trimmedLine.StartsWith("#")) {
      $hasCommentLines = $true
      continue
    }
    [void]$significant.Add($trimmedLine)
  }

  if ($significant.Count -eq 0) {
    return [pscustomobject]$info
  }

  $assignmentLines = @($significant | Where-Object { $_ -match "^\s*SCRUMBOY_ENCRYPTION_KEY\s*=" })
  if ($assignmentLines.Count -gt 1) {
    return [pscustomobject]$info
  }

  if ($assignmentLines.Count -eq 1) {
    if ($significant.Count -ne 1) {
      return [pscustomobject]$info
    }

    $match = [regex]::Match($assignmentLines[0], "^\s*SCRUMBOY_ENCRYPTION_KEY\s*=\s*(.*)\s*$")
    if (-not $match.Success) {
      return [pscustomobject]$info
    }

    $value = $match.Groups[1].Value.Trim()
    $info.HasCandidate = $true
    $info.Value = $value

    if ($null -eq (ConvertTo-KeyBytes $value)) {
      return [pscustomobject]$info
    }

    $info.Valid = $true
    $info.Value = $value
    return [pscustomobject]$info
  }

  if ($hasCommentLines) {
    return [pscustomobject]$info
  }

  if ($significant.Count -ne 1) {
    return [pscustomobject]$info
  }

  $legacyValue = $significant[0].Trim()
  $info.HasCandidate = $true
  $info.Value = $legacyValue

  if ($null -eq (ConvertTo-KeyBytes $legacyValue)) {
    return [pscustomobject]$info
  }

  $info.Valid = $true
  $info.Value = $legacyValue
  return [pscustomobject]$info
}

function New-GeneratedKey() {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Write-InvalidPassThroughWarning([string]$SourceLabel) {
  Write-Warn("$SourceLabel is invalid. Passing the configured value through so Scrumboy can decide after inspecting the migrated database. If encrypted auth/security data exists, startup will fail until the correct original key is restored.")
}

$canonicalInfo = Get-KeyFileInfo -Path $canonicalPath -SourceLabel "data/scrumboy.env"
$legacyInfo = Get-KeyFileInfo -Path $legacyPath -SourceLabel "legacy root scrumboy.env"
$envValue = [Environment]::GetEnvironmentVariable("SCRUMBOY_ENCRYPTION_KEY", "Process")
$resolvedKey = $null

if (-not [string]::IsNullOrWhiteSpace($envValue)) {
  $resolvedKey = $envValue.Trim()
  if ($null -eq (ConvertTo-KeyBytes $resolvedKey)) {
    Write-InvalidPassThroughWarning("existing process environment variable SCRUMBOY_ENCRYPTION_KEY")
  }

  foreach ($fileInfo in @($canonicalInfo, $legacyInfo)) {
    if ($fileInfo.Exists -and $fileInfo.Valid -and $fileInfo.Value -ne $resolvedKey) {
      Write-Warn("Found $($fileInfo.SourceLabel) with a different key. Using existing process environment variable SCRUMBOY_ENCRYPTION_KEY.")
    }
  }
} elseif ($canonicalInfo.Exists) {
  if (-not $canonicalInfo.HasCandidate) {
    Fail("$($canonicalInfo.SourceLabel) is invalid. $($canonicalInfo.Remediation) Do not regenerate the key casually if this instance may already contain encrypted account/security data.")
  }

  $resolvedKey = $canonicalInfo.Value
  if ($canonicalInfo.Valid) {
    if ($legacyInfo.Exists -and $legacyInfo.Valid -and $legacyInfo.Value -ne $resolvedKey) {
      Write-Warn("Found legacy root scrumboy.env with a different key. Using data/scrumboy.env.")
    }
  } else {
    Write-InvalidPassThroughWarning($canonicalInfo.SourceLabel)
  }
} elseif ($legacyInfo.Exists) {
  if (-not $legacyInfo.HasCandidate) {
    Fail("$($legacyInfo.SourceLabel) is invalid. $($legacyInfo.Remediation) Do not regenerate the key casually if this instance may already contain encrypted account/security data.")
  }

  $resolvedKey = $legacyInfo.Value
  if ($legacyInfo.Valid) {
    Write-Warn("Using legacy root scrumboy.env. Preferred location is data/scrumboy.env so the key backs up with data/app.db.")
  } else {
    Write-InvalidPassThroughWarning($legacyInfo.SourceLabel)
  }
} else {
  if (-not (Test-Path -LiteralPath $dataDir -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $dataDir -Force)
  }

  $resolvedKey = New-GeneratedKey
  $canonicalLine = "SCRUMBOY_ENCRYPTION_KEY=$resolvedKey"
  Set-Content -LiteralPath $canonicalPath -Value $canonicalLine -Encoding ASCII -NoNewline
  Write-Host "Created data/scrumboy.env with a new SCRUMBOY_ENCRYPTION_KEY."
  Write-Host "Back up data/scrumboy.env together with data/app.db. Do not regenerate this key casually."
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir -PathType Container)) {
  [void](New-Item -ItemType Directory -Path $outputDir -Force)
}

Set-Content -LiteralPath $OutputPath -Value $resolvedKey -Encoding ASCII -NoNewline
exit 0
