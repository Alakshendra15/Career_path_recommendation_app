# Starts everything: local PostgreSQL (5433), ML service (8000), API (4000), each in its own window.
# Run with: npm run start:all   (from backend/)
$ErrorActionPreference = 'Continue'
$backend = Split-Path -Parent $PSScriptRoot
$aiMl    = Join-Path (Split-Path -Parent $backend) 'ai-ml'

function Free-Port($port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      Write-Host "Port $port is busy (PID $($_.OwningProcess)); stopping it..."
      Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
function Wait-Port($port, $seconds) {
  for ($i = 0; $i -lt $seconds; $i++) {
    if (Test-NetConnection localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

# 1. Clean stale state from a previous crashed run
Free-Port 5433; Free-Port 4000; Free-Port 8000
$pid_file = Join-Path $backend '.pgdata\postmaster.pid'
if (Test-Path $pid_file) {
  $old = (Get-Content $pid_file -TotalCount 1)
  if (-not (Get-Process -Id $old -ErrorAction SilentlyContinue)) { Remove-Item $pid_file -Force }
}

# 2. Database
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$backend'; npm run dev:db"
Write-Host 'Waiting for PostgreSQL...'
if (-not (Wait-Port 5433 60)) { Write-Host 'PostgreSQL did not start on 5433. Check the DB window (try as Administrator, or restart Windows).' -ForegroundColor Red; exit 1 }
Start-Sleep -Seconds 3

# 3. ML service (optional: skipped if folder missing)
if (Test-Path $aiMl) {
  Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$aiMl'; uvicorn main:app --port 8000"
} else { Write-Host "ai-ml folder not found; skipping ML service." -ForegroundColor Yellow }

# 4. API
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$backend'; npm run dev"
Write-Host 'Waiting for API...'
if (Wait-Port 4000 40) {
  Write-Host 'API is up:' -ForegroundColor Green
  try { (Invoke-RestMethod http://localhost:4000/health) | ConvertTo-Json -Compress } catch { Write-Host $_.Exception.Message }
  Write-Host 'Emulator URL: http://10.0.2.2:4000'
} else { Write-Host 'API did not start; check the API window.' -ForegroundColor Red }
