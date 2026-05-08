<#
.SYNOPSIS
  Levanta backend (:8000) + frontend (:4200) en paralelo.
.DESCRIPTION
  Ctrl+C corta los dos procesos.
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "→ backend  http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "→ frontend http://localhost:4200"     -ForegroundColor Cyan
Write-Host ""

$backend  = Start-Process -FilePath "uv"  -ArgumentList "run","uvicorn","pre_autorizacion.main:app","--reload","--host","0.0.0.0","--port","8000" -WorkingDirectory "$root\backend"  -PassThru -NoNewWindow
$frontend = Start-Process -FilePath "npm" -ArgumentList "start"                                                                                  -WorkingDirectory "$root\frontend" -PassThru -NoNewWindow

try {
    while (-not $backend.HasExited -and -not $frontend.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "→ stopping..." -ForegroundColor Yellow
    if (-not $backend.HasExited)  { Stop-Process -Id $backend.Id  -Force -ErrorAction SilentlyContinue }
    if (-not $frontend.HasExited) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
}
