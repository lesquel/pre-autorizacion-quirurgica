<#
.SYNOPSIS
  Instala todas las deps (backend uv + frontend npm).
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "→ backend deps (uv sync)" -ForegroundColor Cyan
Push-Location backend
uv sync
Pop-Location

Write-Host ""
Write-Host "→ frontend deps (npm ci)" -ForegroundColor Cyan
Push-Location frontend
npm ci
Pop-Location

Write-Host ""
Write-Host "✓ install completo" -ForegroundColor Green
Write-Host "  Levantá los servicios con:  .\scripts\dev.ps1   (o  make dev)"
