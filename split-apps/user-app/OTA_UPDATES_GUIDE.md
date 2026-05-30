# OTA Updates Guide - Automatic App Updates

This app now includes an **Over-the-Air (OTA) Update Engine** that automatically downloads and applies updates when your users are connected to the internet. No need to rebuild or redeploy to app stores for JavaScript changes!

## How It Works

1. **Automatic Checking**: The app checks for updates every 5 minutes and when the app comes to foreground
2. **Background Download**: Updates download automatically in the background
3. **User Notification**: Users see a banner when an update is ready to apply
4. **One-Tap Restart**: Users tap "Restart Now" to apply the update instantly

## What Can Be Updated OTA

✅ JavaScript code changes  
✅ React components  
✅ Styles and themes  
✅ Assets (images, fonts)  
✅ Logic and bug fixes  

## What Requires App Store Update

❌ Native code changes (iOS/Android native modules)  
❌ New native permissions  
❌ App icon/splash screen changes  
❌ Version number bumps  

## How to Push an OTA Update

### 1. Make Your Changes
Edit your code normally - fix bugs, add features, update UI, etc.

### 2. Test Locally
```bash
npm start
```

### 3. Publish the Update

#### For Production:
```bash
eas update --channel production --message "Your update description"
```

#### For Preview:
```bash
eas update --channel preview --message "Your update description"
```

#### For Development:
```bash
eas update --channel development --message "Your update description"
```

### 4. Users Get the Update Automatically
- Users will see a notification banner when the update downloads
- They tap "Restart Now" to apply it
- Or they can dismiss and it will apply on next app launch

## Update Channels

| Channel | Use Case | Command |
|---------|----------|---------|
| `production` | Live app users | `eas update --channel production` |
| `preview` | Testers/internal | `eas update --channel preview` |
| `development` | Development builds | `eas update --channel development` |

## Update Status Banner States

1. **Checking** - "Checking for updates..."
2. **Available** - "New Update Available" (auto-downloads)
3. **Downloading** - "Downloading Update..."
4. **Ready** - "Update Ready!" with "Restart Now" button
5. **Error** - Shows retry option if offline or failed

## Configuration Files

### app.config.js
Already configured with:
- `updates.url` - EAS Update endpoint
- `runtimeVersion.policy` - Uses app version for compatibility

### eas.json
Configured with update channels matching build channels

## Troubleshooting

### Updates Not Showing
1. Check internet connection
2. Verify you're on the correct channel
3. Check EAS dashboard for update status

### "Runtime Version Mismatch"
- OTA updates only work with the same native build
- If you change native code, you need a new build

### Debugging Updates
```bash
# Check update status
eas update:list

# View update groups
eas update:view
```

## Best Practices

1. **Test Before Publishing**: Always test on a preview channel first
2. **Small Updates**: Smaller updates download faster
3. **Clear Messages**: Use descriptive update messages
4. **Don't Force**: Let users choose when to restart
5. **Monitor**: Check EAS dashboard for update adoption

## EAS Dashboard

View and manage updates at:
https://expo.dev/accounts/[your-account]/projects/epix-visuals-studios-co/updates

## Learn More

- [Expo Updates Documentation](https://docs.expo.dev/eas-update/introduction/)
- [EAS Update CLI](https://docs.expo.dev/eas-update/develop-faster/)
