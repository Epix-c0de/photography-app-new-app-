# Diagnostic Report: Dev Environment Instability

**Date:** 2026-02-13  
**Project:** NEW APP TEMPLATE  

## 1. Issues Identified

### A. Metro Bundler Cache Corruption
- **Error:** `Error: Unable to deserialize cloned data` from `metro-file-map`.
- **Root Cause:** Corrupted binary cache files in `metro-file-map` (DiskCacheManager). This typically occurs when the Node version changes, dependencies are updated, or the process is forcibly terminated while writing to the cache.
- **Impact:** Prevents the development server from starting.

### B. Ngrok Tunnel Timeout
- **Error:** `CommandError: ngrok tunnel took too long to connect.`
- **Root Cause:** 
  1. **Missing Authentication:** Ngrok now requires an account and authtoken for most tunnel operations. The local configuration check revealed a missing or empty `ngrok.yml` or missing auth token.
  2. **Network/Timeout:** The tunnel setup timed out before a connection could be established.
- **Impact:** Prevents the app from being accessible via the tunnel (required for easy device testing).

## 2. Remediation Applied

### A. Automated Cache Safeguards
- **Action:** Implemented a robust `prestart` script in `package.json`.
- **Logic:** Automatically detects and forcibly removes Metro cache directories (`%TEMP%\metro-cache`, `node_modules\.cache\metro`, `%LOCALAPPDATA%\Metro`) *before* every start attempt.
- **Benefit:** Prevents "stale cache" errors by ensuring a clean state on every launch.

### B. Startup Resilience (Retry Logic)
- **Action:** Created `scripts/start-tunnel-retry.js` and `npm run start-retry` command.
- **Logic:** Wraps the startup command in a monitor that detects exit codes. If the process crashes (e.g., due to a transient tunnel timeout), it automatically retries with exponential back-off (2s, 4s, 8s...).
- **Benefit:** Reduces manual intervention for transient network glitches.

### C. Diagnostic Tooling
- **Action:** Created `remediate-dev-env.ps1` PowerShell script.
- **Capabilities:**
  - Clears all Metro cache locations.
  - Checks for Ngrok configuration and presence of auth token.
  - Verifies basic connectivity to Supabase.

## 3. Preventive Measures & Next Steps

1. **Configure Ngrok Token (CRITICAL):**
   - You must authenticate ngrok to prevent timeout/connection errors.
   - Run: `ngrok config add-authtoken <YOUR_TOKEN>`
   - Sign up at [dashboard.ngrok.com](https://dashboard.ngrok.com) if you don't have a token.

2. **Use the New Commands:**
   - **Daily Start:** `npm run start-retry` (includes auto-retry and cache cleaning).
   - **Troubleshooting:** `npm run remediate` (runs the diagnostic script).

3. **Supabase Connectivity:**
   - Ensure `EXPO_PUBLIC_SUPABASE_URL` is reachable from your network. The diagnostic script performs a basic check.
