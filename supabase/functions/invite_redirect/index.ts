import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This function handles the web redirect for invite links.
// When a client opens the invite URL on their phone:
//   1. First try to open the native app via deep link
//   2. If app not installed, redirect to the app store
//   3. Store the invite token in a cookie so the app can claim it after install

serve(async (req) => {
  const url = new URL(req.url);
  const ref = url.searchParams.get('ref') || '';
  const invite = url.searchParams.get('invite') || '';

  if (!ref || !invite) {
    return new Response('Invalid invite link', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Increment click count (fire and forget)
  supabase.rpc('increment_invite_click', { p_token: invite }).then(() => {});

  // Get platform settings for app store links
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['platform_app_android_link', 'platform_app_ios_link', 'platform_app_name']);

  const settingsMap: Record<string, string> = {};
  (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value || ''; });

  const appName = settingsMap['platform_app_name'] || 'Epix Visuals';
  const androidLink = settingsMap['platform_app_android_link'] || 'https://play.google.com/store';
  const iosLink = settingsMap['platform_app_ios_link'] || 'https://apps.apple.com';

  // Deep link to the native app
  const deepLink = `epixvisuals://join?ref=${encodeURIComponent(ref)}&invite=${encodeURIComponent(invite)}`;

  // HTML page that:
  // 1. Immediately tries to open the native app
  // 2. Falls back to app store after 2 seconds if app not installed
  // 3. Shows a nice landing page with download buttons
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${appName}</title>
  <meta name="description" content="You've been invited to view your photos on ${appName}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #080810;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      max-width: 380px;
      width: 100%;
      text-align: center;
    }
    .logo {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, #D4AF37, #F0D060);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 900;
      color: #080810;
      margin: 0 auto 24px;
    }
    h1 { font-size: 26px; font-weight: 900; margin-bottom: 10px; }
    p { color: rgba(255,255,255,0.5); font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
    .btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 16px 20px;
      border-radius: 16px;
      text-decoration: none;
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 12px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      transition: background 0.15s;
    }
    .btn:hover { background: rgba(255,255,255,0.08); }
    .btn .icon { font-size: 24px; }
    .btn .text { text-align: left; }
    .btn .sub { font-size: 11px; color: rgba(255,255,255,0.4); font-weight: 400; }
    .open-btn {
      background: linear-gradient(135deg, #D4AF37, #F0D060);
      color: #080810;
      border: none;
      margin-bottom: 20px;
      cursor: pointer;
      justify-content: center;
      font-size: 16px;
    }
    .open-btn:hover { opacity: 0.9; }
    .divider { color: rgba(255,255,255,0.2); font-size: 13px; margin-bottom: 20px; }
    #countdown { color: rgba(255,255,255,0.3); font-size: 13px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">E</div>
    <h1>View Your Photos</h1>
    <p>You've been invited to view your photos on ${appName}. Download the app to get started.</p>

    <button class="btn open-btn" onclick="tryOpenApp()">
      Open in ${appName} App
    </button>

    <div class="divider">— App not installed? Download below —</div>

    <a href="${androidLink}" class="btn" id="android-btn">
      <span class="icon">🤖</span>
      <div class="text">
        <div class="sub">Get it on</div>
        Google Play
      </div>
    </a>

    <a href="${iosLink}" class="btn">
      <span class="icon">🍎</span>
      <div class="text">
        <div class="sub">Download on the</div>
        App Store
      </div>
    </a>

    <p id="countdown"></p>
  </div>

  <script>
    const inviteToken = "${invite}";
    const adminRef = "${ref}";
    const deepLink = "${deepLink}";

    // Store invite in localStorage so the app can pick it up via web storage
    // (for PWA or web version fallback)
    try {
      localStorage.setItem('epix_invite_token', inviteToken);
      localStorage.setItem('epix_invite_ref', adminRef);
    } catch(e) {}

    function tryOpenApp() {
      window.location.href = deepLink;
    }

    // Auto-try to open the app on load
    window.addEventListener('load', function() {
      // Try to open app
      const tryOpen = setTimeout(function() {
        window.location.href = deepLink;
      }, 500);

      // If app opened, the page will blur; if not, start countdown to app store
      let countdown = 3;
      const el = document.getElementById('countdown');

      const countInterval = setInterval(function() {
        if (document.hidden) {
          clearInterval(countInterval);
          clearTimeout(tryOpen);
          el.textContent = 'Opening app...';
          return;
        }
        countdown--;
        if (countdown <= 0) {
          clearInterval(countInterval);
          // Detect iOS vs Android
          const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
          window.location.href = isIOS ? '${iosLink}' : '${androidLink}';
        } else {
          el.textContent = 'Redirecting to app store in ' + countdown + '...';
        }
      }, 1000);
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Store invite in cookie too for native app to read
      'Set-Cookie': `epix_invite=${invite}; epix_ref=${ref}; Path=/; Max-Age=86400; SameSite=Lax`,
    },
  });
});
