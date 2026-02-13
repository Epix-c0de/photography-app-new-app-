<#
.SYNOPSIS
    Remediates Metro Bundler cache corruption and Ngrok tunnel issues.
.DESCRIPTION
    This script performs the following actions:
    1. Clears Metro Bundler cache from multiple locations (Temp, local .cache, AppData).
    2. Validates Ngrok configuration and checks for authentication token.
    3. Performs basic network connectivity checks to Supabase.
    4. Provides instructions for starting the development environment with retry logic.
.EXAMPLE
    .\remediate-dev-env.ps1
#>

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "      Rork Dev Environment Remediation Tool       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# -------------------------------------------------------------------------
# 1. Metro Cache Cleanup
# -------------------------------------------------------------------------
Write-Host "`n[1/3] Cleaning Metro Bundler Cache..." -ForegroundColor Yellow

$metroCacheDirs = @(
    "$env:TEMP\metro-cache",
    "$PWD\node_modules\.cache\metro",
    "$env:LOCALAPPDATA\Metro"
)

$clearedCount = 0

foreach ($dir in $metroCacheDirs) {
    if (Test-Path $dir) {
        Write-Host "  Found cache at: $dir" -NoNewline
        try {
            Remove-Item -Recurse -Force $dir -ErrorAction Stop
            Write-Host " [CLEARED]" -ForegroundColor Green
            $clearedCount++
        } catch {
            Write-Host " [FAILED]" -ForegroundColor Red
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

if ($clearedCount -eq 0) {
    Write-Host "  No cache directories found (clean)." -ForegroundColor Gray
}

# -------------------------------------------------------------------------
# 2. Ngrok Configuration Check
# -------------------------------------------------------------------------
Write-Host "`n[2/3] Checking Ngrok Configuration..." -ForegroundColor Yellow

$ngrokConfigPath = "$env:USERPROFILE\.config\ngrok\ngrok.yml"

if (Test-Path $ngrokConfigPath) {
    Write-Host "  Ngrok config found at: $ngrokConfigPath" -ForegroundColor Green
    # Simple check for authtoken in the file content
    $content = Get-Content $ngrokConfigPath -Raw
    if ($content -match "authtoken:") {
        Write-Host "  Auth token detected in config." -ForegroundColor Green
    } else {
        Write-Host "  WARNING: 'authtoken' not found in config file." -ForegroundColor Yellow
        Write-Host "  Action Required: Run 'ngrok config add-authtoken <YOUR_TOKEN>'" -ForegroundColor Magenta
    }
} else {
    Write-Host "  WARNING: Ngrok config file not found." -ForegroundColor Yellow
    Write-Host "  Path checked: $ngrokConfigPath" -ForegroundColor Gray
    Write-Host "  Action Required: Run 'ngrok config add-authtoken <YOUR_TOKEN>'" -ForegroundColor Magenta
}

# Check if ngrok is in PATH
try {
    $ngrokVersion = ngrok --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Ngrok CLI is installed: $ngrokVersion" -ForegroundColor Green
    } else {
        Write-Host "  Ngrok CLI check returned error code." -ForegroundColor Gray
    }
} catch {
    Write-Host "  Ngrok CLI not found in PATH (managed by Expo internally)." -ForegroundColor Gray
}

# -------------------------------------------------------------------------
# 3. Connectivity Check
# -------------------------------------------------------------------------
Write-Host "`n[3/3] Verifying Connectivity..." -ForegroundColor Yellow

$supabaseUrl = $env:EXPO_PUBLIC_SUPABASE_URL
if (-not [string]::IsNullOrEmpty($supabaseUrl)) {
    Write-Host "  Checking connection to Supabase..."
    try {
        $request = [System.Net.WebRequest]::Create($supabaseUrl)
        $request.Timeout = 5000
        $response = $request.GetResponse()
        Write-Host "  Supabase is reachable." -ForegroundColor Green
        $response.Close()
    } catch {
        Write-Host "  WARNING: Failed to connect to Supabase." -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  Skipping Supabase check (EXPO_PUBLIC_SUPABASE_URL not set)." -ForegroundColor Gray
}

# -------------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------------
Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "Remediation Complete." -ForegroundColor Cyan
Write-Host "To start the project with robust retry logic, run:"
Write-Host "  npm run start-retry" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
