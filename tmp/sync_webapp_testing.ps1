$src = ".claude\skills\QA-Webapp-Testing"
$globalDest = "C:\Users\marce\.claude\skills\QA-Webapp-Testing"
$oneDriveDest = "C:\Users\marce\OneDrive\Documentos\Ferramentas-IA\SKILLs\QA-Webapp-Testing"

# Global
if (-not (Test-Path $globalDest)) { New-Item -ItemType Directory -Path $globalDest -Force }
Copy-Item -Path (Join-Path $src "*") -Destination $globalDest -Recurse -Force

# OneDrive
if (-not (Test-Path $oneDriveDest)) { New-Item -ItemType Directory -Path $oneDriveDest -Force }
Copy-Item -Path (Join-Path $src "*") -Destination $oneDriveDest -Recurse -Force

Write-Host "Synced QA-Webapp-Testing to all locations!"
Get-ChildItem $src -Recurse | ForEach-Object { Write-Host $_.FullName }
