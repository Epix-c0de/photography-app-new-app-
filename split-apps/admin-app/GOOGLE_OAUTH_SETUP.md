# Google OAuth Troubleshooting Guide for EAS Builds

If Google Sign-In is failing in your production APK but works in development, follow these steps to register your EAS build's credentials with Google.

## 1. Get your SHA-1 Fingerprint from EAS
Run the following command in your terminal to get the credentials for your Android app:
```bash
npx eas credentials
```
- Select **android**
- Select the build profile (e.g., **preview** or **production**)
- Look for the **SHA-1 Fingerprint** in the output. It will look like: `AA:BB:CC:DD:EE:FF:...`

## 2. Create the Android Client ID
This tells Google that your specific app build (identified by its SHA-1) is allowed to initiate a login.
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project.
3. Go to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Select **Application type: Android**.
6. Enter your **Package Name**: `app.rork.epix_visuals_studios_co` (from your app.config.js).
7. Paste the **SHA-1 certificate fingerprint** you got from EAS in Step 1.
8. Click **Create**.
   - *Note: You don't need the ID from this step for Supabase. This just "whitelists" your app.*

## 3. Create the Web Client ID
This is the "master" ID that Supabase uses to talk to Google's backend. **Supabase requires a Web Client ID even for mobile apps.**
1. In the same **Credentials** page, click **Create Credentials > OAuth client ID** again.
2. Select **Application type: Web application**.
3. Name it "Supabase Backend".
4. (Optional) Under **Authorized redirect URIs**, add your Supabase Auth URL if prompted (e.g., `https://ujunohfpcmjywsblsoel.supabase.co/auth/v1/callback`).
5. Click **Create**.
6. **Save the Client ID and Client Secret.** These are what you will put in Supabase.

## 4. Configure Supabase Redirect URIs
Supabase must allow the deep link redirect back to your app.
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication > URL Configuration**.
3. Add the following to **Redirect URIs**:
   `epix-visuals://auth/callback`
4. Ensure your **Site URL** is set to your production URL (or any valid URL if not using a web app).

## 5. Enable Google Provider in Supabase
1. Go to **Authentication > Providers > Google**.
2. Enable the provider.
3. Enter the **Client ID** from the **Web application** (Step 3).
4. Enter the **Client Secret** from the **Web application** (Step 3).
5. Click **Save**.

## Why do I need both?
- **The Android ID** is for your *phone* to say "I am a legitimate app build." Google uses this to check your SHA-1.
- **The Web ID** is for *Supabase* to say "I am a legitimate server." Google requires a server-side secret (which only Web IDs have) to securely finalize the login.
