# Start Game Server Manager (backend + frontend)
Write-Host "[GSM] Stopping any existing node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

Write-Host "[GSM] Starting backend on :8080..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; node server.js"

Start-Sleep -Milliseconds 1000

Write-Host "[GSM] Starting frontend on :5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "[GSM] Done. Open http://localhost:5173" -ForegroundColor Green
