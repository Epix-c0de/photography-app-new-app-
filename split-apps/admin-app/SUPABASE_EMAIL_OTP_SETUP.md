# Supabase Email OTP Setup (No Magic Links)

This project now verifies email codes with `verifyOtp({ type: 'email' })`.
If Supabase sends a magic link email, users will not be able to continue in the in-app code screen.

## Root Cause

When passwordless email uses a template with `{{ .ConfirmationURL }}`, Supabase sends a magic link.
To support 6-digit code entry, the email template must render `{{ .Token }}`.

## Dashboard Changes Required

1. Open Supabase Dashboard.
2. Go to Authentication → Providers → Email.
3. Enable Email OTP.
4. Disable Magic Link (if there is a toggle).
5. Go to Authentication → Email Templates.
6. Open the Magic Link template.
7. Use `{{ .Token }}` as visible text, not inside a link URL.
8. Save template.
9. If there is a separate OTP template, paste the same code there and save.
10. Go to Authentication → URL Configuration.
11. Set Site URL to your real app/web URL, not `https://example.com`.

## Correct Template Example

Use this exact structure in the Magic Link template:

```html
<h2>Your verification code</h2>
<p>Use this 6-digit code in the app to continue:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">{{ .Token }}</p>
```

Do not use this pattern:

```html
<a href="{{ .Token }}">Reset Password</a>
```

That still renders a clickable link UX and does not display the code properly.

## Important Template Mapping

- `signInWithOtp({ email })` uses the Magic Link template.
- `resetPasswordForEmail(email)` uses the Reset Password template.
- This app forgot-password screen now uses `signInWithOtp({ email })`, so configure the Magic Link template for OTP codes.

## If You Still See Magic Link Emails

- Make sure you edited the correct Supabase project (prod vs dev).
- Custom templates do not apply unless you click Save in the dashboard.
- Local `supabase/config.toml` templates do not affect the hosted project.

## Repo Changes Included

- Added local Supabase template config for magic-link emails:
  - `supabase/config.toml` → `[auth.email.template.magic_link]`
- Added token-based template file:
  - `supabase/templates/magic_link_otp.html`
- Updated forgot-password flow to OTP-first verification:
  - uses `signInWithOtp` for email
  - verifies with `verifyOtp({ type: 'email' })`

## End-to-End Verification Checklist

1. Trigger forgot password in the app with an existing email.
2. Confirm received email shows a 6-digit code, not a clickable sign-in link.
3. Enter the code in the app verification step.
4. Confirm app advances to new password step.
5. Reset password and confirm login works with the new password.
