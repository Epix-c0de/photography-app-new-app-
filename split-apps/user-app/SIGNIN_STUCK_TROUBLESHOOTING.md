# Google Sign-In Stuck on "Signing In..." - Troubleshooting

## What Was Fixed

1. **Added 60-second timeout** - Prevents infinite hanging
2. **Improved token extraction** - Now handles both fragment and query string params
3. **Better error messages** - Clear feedback when things go wrong
4. **Native intent handling** - Deep links are properly routed to `/auth/callback`
5. **Root layout auth route** - Added `auth` to Stack navigator
6. **Callback error handling** - Shows alerts if authentication fails

## What Could Still Cause Hanging

### 1. Deep Link Not Being Triggered
**Symptoms**: Browser closes, nothing happens
**Check**:
- In terminal, look for: `[Native Intent] Routing to auth/callback`
- If you don't see this, the deep link isn't being caught

**Solutions**:
- Clear app cache: `npm start -- --clean`
- Rebuild on device
- Check that scheme in app.json is `epix-visuals`

### 2. Supabase Not Configured
**Symptoms**: "No authentication URL received from Supabase"
**Check**:
- Supabase Dashboard → Authentication → Providers
- Google provider is enabled
- Google OAuth credentials are added

**Solutions**:
- Enable Google provider in Supabase
- Add Google OAuth Client ID and Secret
- Verify Redirect URIs include `epix-visuals://auth/callback`

### 3. Network Connectivity
**Symptoms**: Browser opens then closes with signal error
**Check**:
- Device has internet connection
- Device can reach supabase.co
- WiFi not blocking OAuth requests

**Solutions**:
- Try different network (WiFi vs cellular)
- Temporarily disable VPN if active
- Check device DNS settings

### 4. Android-Specific Issues
**Symptoms**: Works on iOS, fails on Android
**Check**:
- Device has Google Play Services installed
- Device has Google account configured
- Device OS is Android 6.0+

**Solutions**:
```bash
# Rebuild for Android specifically
eas build --platform android --profile preview
# Then install on physical device
```

### 5. Deep Link Configuration (Android)
**Symptoms**: App opens, URL shows up, but callback not triggered
**Check**:
- app.json has intentFilters configured
- Schema matches: `epix-visuals`

**Solutions**:
- Rebuild native: `eas build --platform android`
- Or do: `npm start -- --clean` and reinstall

## Console Log Checklist

When attempting Google Sign-In, you should see these logs in order:

```
✓ [Google Sign-In] Starting OAuth flow
✓ [Google Sign-In] Redirect URL: epix-visuals://auth/callback
✓ [Google Sign-In] Platform: android (or ios)
✓ [Google Sign-In] Opening browser for authentication
  (user authenticates with Google...)
✓ [Google Sign-In] Browser closed, result type: success
✓ [Google Sign-In] Success - got redirect URL
✓ [Google Sign-In] Extracted tokens: hasAccessToken: true, hasRefreshToken: true
✓ [Google Sign-In] Setting session
✓ [Google Sign-In] Session set successfully, navigating to home
✓ [Native Intent] Handling deep link: path: /auth/callback?...
✓ [Native Intent] Routing to auth/callback
✓ [Auth Callback] Started
✓ [Auth Callback] Session verified, navigating
```

If you see an error, note which line it stopped at.

## Testing Steps

### Step 1: Clear Everything
```bash
# On your device, uninstall the app

# In terminal:
npm run clean
rm -rf node_modules .expo
npm install
npm start -- --clean
```

### Step 2: Rebuild on Device
- Scan QR code with Expo Go (or use custom build)
- Wait for app to load

### Step 3: Test Google Sign-In
1. Go to login screen
2. Tap "Sign In with Google" button
3. Watch terminal for logs (Step 1 above)
4. Complete authentication when Google login appears
5. Watch for "Signing in..." to briefly show then navigate to home

### Step 4: Check Logs
- If stuck on "Signing in...", check what the last successful log was
- Compare against the checklist above
- Report which line stopped logging

## Common Error Messages

| Message | Cause | Fix |
|---------|-------|-----|
| "Google Sign-In took too long" | Timeout hit (60s) | Network issue or OAuth not working |
| "Authentication succeeded but no tokens" | Token extraction failed | Check URL format in logs |
| "No authentication URL received" | Supabase OAuth not configured | Enable Google provider in Supabase |
| "Session verification failed" | Tokens invalid | Check Supabase auth configuration |
| Browser won't open | WebBrowser issue | Rebuild app, check permissions |

## If Still Stuck

1. **Check browser opens** - Should see Google login screen
2. **Complete authentication** - Sign in with Google account
3. **Check browser closes** - Should return to app automatically
4. **Check terminal logs** - Paste relevant logs in your response

## Diagnostic Commands

In terminal while app is running:

```bash
# Check Supabase connectivity
curl -I https://your-supabase-url.com

# If using Expo Go, check deep link handling
# Open: epix-visuals://auth/callback?access_token=TEST&refresh_token=TEST
# (This won't work but shows if intent handling works)
```

## Debug Mode

To enable more verbose logging, add this to the top of app/login.tsx:

```typescript
if (__DEV__) {
  console.log = (function (original) {
    return function (...args: any[]) {
      original.apply(console, args);
    };
  })(console.log);
}
```

## Next Steps After Getting Logs

1. Share exact error message or last successful log
2. Share device info (Android/iOS, version)
3. Share network setup (WiFi, cellular, VPN)
4. Share Supabase OAuth configuration status

## Files Updated

- `app/login.tsx` - Added timeout, better error handling, token extraction
- `app/auth/callback.tsx` - Better error reporting
- `app/_layout.tsx` - Added auth route to Stack
- `app/+native-intent.tsx` - Handle auth/callback deep links
- `app/auth/_layout.tsx` - Auth route layout

