# Google Sign-In OAuth Troubleshooting Guide

## Issue: "signal is aborted without reason"

This error typically occurs when the OAuth flow fails to complete or the browser session is terminated unexpectedly.

## Root Causes & Solutions

### 1. **Scheme Mismatch**
**Problem**: The redirect scheme in code doesn't match app.json configuration.

**Check**:
- In `app.json`: `"scheme": "epix-visuals"`
- In `app/login.tsx` handleGoogleLogin: `scheme: 'epix-visuals'`

**Status**: ✅ FIXED - Both are now aligned to use "epix-visuals"

### 2. **Missing Callback Route**
**Problem**: The app doesn't have a handler for the OAuth redirect.

**Solution**: Created `app/auth/_layout.tsx` and `app/auth/callback.tsx`

**Status**: ✅ FIXED - Both files exist and are properly configured

### 3. **Intent Filter Configuration (Android)**
**Problem**: Android doesn't know how to handle the deep link scheme.

**Solution**: Added to app.json android.intentFilters:
```json
"intentFilters": [{
  "action": "android.intent.action.VIEW",
  "data": [{
    "scheme": "epix-visuals",
    "host": "auth",
    "pathPrefix": "/callback"
  }],
  "category": ["android.intent.category.BROWSABLE", "android.intent.category.DEFAULT"]
}]
```

**Status**: ✅ FIXED - Intent filters now properly configured

### 4. **Network Connectivity Issue**
**Problem**: "signal: aborted" can indicate a network connectivity problem.

**Symptoms**:
- Error occurs only on certain networks
- Works on WiFi but not cellular (or vice versa)
- Intermittent failures

**Solution**: 
- Check internet connection before attempting OAuth
- Added specific error handling for network errors in handleGoogleLogin
- Added Android internet permissions in app.json

**Status**: ✅ PARTIALLY FIXED - Permissions added, error detection implemented

### 5. **WebBrowser Session Not Properly Initialized**
**Problem**: WebBrowser.maybeCompleteAuthSession() not called or WebBrowser options incorrect.

**Check**:
```typescript
// At top of app/login.tsx:
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();

// In handleGoogleLogin:
const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
  showInRecents: true,
  presentationStyle: Platform.OS === 'ios' ? 'modal' : 'fullScreen',
  createTask: false,  // Important for proper cleanup
});
```

**Status**: ✅ FIXED - WebBrowser properly initialized and options optimized

### 6. **Token Extraction Failure**
**Problem**: Tokens not properly extracted from redirect URL.

**Solution**: Simplified token extraction by delegating to callback.tsx:
- The browser returns to `epix-visuals://auth/callback?access_token=...&refresh_token=...`
- expo-router automatically parses URL params and passes them to callback.tsx
- callback.tsx handles token extraction and session setup

**Status**: ✅ FIXED - Token extraction now delegated to dedicated callback route

### 7. **Session Not Properly Established**
**Problem**: Tokens received but session not created in Supabase client.

**Solution**: In `app/auth/callback.tsx`:
```typescript
const { error: sessionError } = await supabase.auth.setSession({
  access_token,
  refresh_token,
});

if (sessionError) throw sessionError;

// Verify session was created
const { data: { session } } = await supabase.auth.getSession();
```

**Status**: ✅ FIXED - Session verification implemented

## Testing Checklist

- [ ] 1. Verify app.json has correct scheme: `"scheme": "epix-visuals"`
- [ ] 2. Verify app/login.tsx uses correct scheme in redirectUrl
- [ ] 3. Verify app/auth/callback.tsx exists and receives token params
- [ ] 4. Clear app cache: `npm run clean` or `yarn clean`
- [ ] 5. Rebuild app: `npm start` or `yarn start` with `--clean`
- [ ] 6. Try on physical device (simulators can have issues with OAuth)
- [ ] 7. Check device has internet connectivity
- [ ] 8. Verify Google OAuth credentials are configured in Supabase
- [ ] 9. Check Supabase OAuth redirect URIs include `epix-visuals://auth/callback`

## Debug Steps

### 1. Check Console Logs
When attempting Google Sign-In, check the Expo/terminal logs for these messages:

```
[Google Sign-In] Redirect URL: epix-visuals://auth/callback
[Google Sign-In] Platform: android (or ios)
[Google Sign-In] Opening browser session
[Google Sign-In] Browser result type: success
[Google Sign-In] Success URL received
[Google Sign-In] Callback URL: epix-visuals://auth/callback?access_token=...
[Auth Callback] Processing...
[Auth Callback] Setting session with tokens
[Auth Callback] Session set successfully
```

If you see any errors, note the exact error message.

### 2. Access Diagnostics Screen
In app/login.tsx, you can access a diagnostics screen by tapping the logo 3 times to enter admin mode, then:
1. Go to `/debug-oauth` route (add it to your router)
2. Check device information, configuration, and session status

### 3. Test Network Connection
The debug screen has a "Test Connection" button to verify Supabase connectivity.

## Supabase Configuration Checklist

1. **OAuth Provider Setup**:
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Add Google OAuth credentials (Client ID, Client Secret)

2. **Redirect URIs**:
   - Must include: `epix-visuals://auth/callback`
   - On web: `https://your-domain.com/auth/callback` (if applicable)
   - In Supabase: Authentication → URL Configuration → Redirect URLs

3. **API Keys**:
   - `EXPO_PUBLIC_SUPABASE_URL` - Must be set in .env or eas.json
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Must be set in .env or eas.json

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "signal: aborted without reason" | Network/browser issue | Check connectivity, clear cache, rebuild |
| "No authentication URL received" | Supabase OAuth not configured | Check Supabase OAuth provider settings |
| "No tokens in URL" | Token extraction failed | Check URL parsing in callback.tsx |
| "Session not established" | setSession failed | Check token format and validity |
| "User cancelled" | Normal cancellation | This is expected - user clicked cancel |

## If Issue Persists

1. **Clear Everything**:
   ```bash
   # Clear cache
   npm run clean
   # or
   rm -rf node_modules .expo
   npm install
   ```

2. **Rebuild App**:
   ```bash
   npm start -- --clean
   # or
   expo start -c
   ```

3. **Check Credentials**:
   - Verify EXPO_PUBLIC_SUPABASE_URL is correct
   - Verify EXPO_PUBLIC_SUPABASE_ANON_KEY is correct
   - Verify Google OAuth keys in Supabase are correct

4. **Physical Device**:
   - Simulators have OAuth issues - use physical device
   - For Android: Use Android device with Google Play Services

5. **Rebuild Native Modules**:
   ```bash
   eas build --platform android --profile preview
   # Then install on device
   ```

## Files Modified

1. **app/login.tsx** - Improved handleGoogleLogin with better error handling
2. **app/auth/_layout.tsx** - Created layout for auth routes
3. **app/auth/callback.tsx** - OAuth callback handler with token extraction
4. **app.json** - Added Android intent filters and proper scheme configuration
5. **app/debug-oauth.tsx** - Diagnostics screen for troubleshooting

## Related Documentation

- [Supabase OAuth Documentation](https://supabase.com/docs/guides/auth/social-login)
- [Expo Web Browser Documentation](https://docs.expo.dev/versions/latest/sdk/webbrowser/)
- [Expo Auth Session Documentation](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Deep Linking with Expo Router](https://docs.expo.dev/routing/deep-linking/)
