# Backend Restart Helper Script
# Run this in PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BACKEND RESTART HELPER" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
$currentDir = Get-Location
Write-Host "Current directory: $currentDir" -ForegroundColor Gray

if ($currentDir.Path -notlike "*SportBooking*backend*") {
    Write-Host "⚠️  Not in backend directory!" -ForegroundColor Yellow
    Write-Host "Navigating to backend..." -ForegroundColor Gray
    Set-Location "C:\Users\MSI\Downloads\SportBooking-master\SportBooking-master\backend"
}

Write-Host ""
Write-Host "📁 Working directory: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "❌ node_modules not found!" -ForegroundColor Red
    Write-Host "Running npm install..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Kill any existing node processes (optional, be careful!)
Write-Host "🔍 Checking for existing Node.js processes..." -ForegroundColor Cyan
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node.js process(es) running" -ForegroundColor Yellow
    Write-Host "⚠️  Please manually stop backend in its terminal (Ctrl+C)" -ForegroundColor Yellow
    Write-Host "Or close the terminal window" -ForegroundColor Yellow
} else {
    Write-Host "✅ No conflicting Node.js processes found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  STARTING BACKEND SERVER..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Start the server
npm start
