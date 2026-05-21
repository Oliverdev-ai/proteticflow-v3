[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Set-IfMissing {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name, "Process"))) {
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
    Write-Output "env:set $Name=$Value"
  } else {
    Write-Output "env:ok  $Name=$([Environment]::GetEnvironmentVariable($Name, 'Process'))"
  }
}

$userProfile = [Environment]::GetEnvironmentVariable("USERPROFILE", "Process")
if ([string]::IsNullOrWhiteSpace($userProfile)) {
  $homeDrive = [Environment]::GetEnvironmentVariable("HOMEDRIVE", "Process")
  $homePath = [Environment]::GetEnvironmentVariable("HOMEPATH", "Process")
  $userName = [Environment]::GetEnvironmentVariable("USERNAME", "Process")
  $systemDrive = [Environment]::GetEnvironmentVariable("SystemDrive", "Process")

  if (
    -not [string]::IsNullOrWhiteSpace($homeDrive) -and
    -not [string]::IsNullOrWhiteSpace($homePath)
  ) {
    $userProfile = "$homeDrive$homePath"
  } elseif (
    -not [string]::IsNullOrWhiteSpace($systemDrive) -and
    -not [string]::IsNullOrWhiteSpace($userName)
  ) {
    $userProfile = Join-Path $systemDrive "Users\$userName"
  } elseif (-not [string]::IsNullOrWhiteSpace($userName)) {
    $userProfile = "C:\Users\$userName"
  }
}

$homeDrive = ""
$homePath = ""
if ($userProfile -match "^[A-Za-z]:\\") {
  $homeDrive = $userProfile.Substring(0, 2)
  $homePath = $userProfile.Substring(2)
}

Set-IfMissing -Name "SystemRoot" -Value "C:\WINDOWS"
Set-IfMissing -Name "WINDIR" -Value "C:\WINDOWS"
Set-IfMissing -Name "ComSpec" -Value "C:\WINDOWS\System32\cmd.exe"
Set-IfMissing -Name "APPDATA" -Value (Join-Path $userProfile "AppData\Roaming")
Set-IfMissing -Name "LOCALAPPDATA" -Value (Join-Path $userProfile "AppData\Local")

if (-not [string]::IsNullOrWhiteSpace($homeDrive)) {
  Set-IfMissing -Name "HOMEDRIVE" -Value $homeDrive
}

if (-not [string]::IsNullOrWhiteSpace($homePath)) {
  Set-IfMissing -Name "HOMEPATH" -Value $homePath
}

Write-Output "codex-env-bootstrap: done"
