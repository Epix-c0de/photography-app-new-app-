'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SuccessPage() {
  const [countdown, setCountdown] = useState(5);
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [adminAppAndroid, setAdminAppAndroid] = useState('https://play.google.com/store');
  const [adminAppIos, setAdminAppIos] = useState('https://apps.apple.com');

  useEffect(() => {
    // Determine photographer dashboard URL
    const url = process.env.NEXT_PUBLIC_PHOTOGRAPHER_DASHBOARD_URL || 'http://localhost:3002';
    setDashboardUrl(url);

    // Fetch the admin app download links set by super admin
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_admin_app_android_link', 'platform_admin_app_ios_link'])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value || ''; });
          if (map['platform_admin_app_android_link']) setAdminAppAndroid(map['platform_admin_app_android_link']);
          if (map['platform_admin_app_ios_link']) setAdminAppIos(map['platform_admin_app_ios_link']);
        }
      });

    // Auto-redirect to photographer dashboard after 5 seconds
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = url;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const goToDashboard = () => {
    window.location.href = dashboardUrl;
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080810' }}>
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Success animation */}
        <div className="relative inline-block">
          <div className="text-7xl animate-bounce">🎉</div>
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold text-white">✓</div>
        </div>

        <div>
          <h1 className="text-4xl font-black mb-3" style={{ color: 'white' }}>Payment Successful!</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your Epix Visuals account is now active. You're being redirected to your dashboard.
          </p>
        </div>

        {/* Redirect card */}
        <div className="rounded-3xl p-8 space-y-5" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
              {countdown}
            </div>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Redirecting to your dashboard in {countdown}s...
            </p>
          </div>

          <button onClick={goToDashboard}
            className="w-full py-4 rounded-2xl font-black text-lg transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
            Go to Dashboard Now →
          </button>
        </div>

        {/* What's next */}
        <div className="rounded-2xl p-6 text-left space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="font-bold" style={{ color: '#D4AF37' }}>What happens next:</h3>
          <ol className="space-y-3 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <li className="flex gap-3">
              <span className="font-bold flex-shrink-0" style={{ color: '#D4AF37' }}>1.</span>
              <span>Your dashboard opens — configure your M-Pesa payment number for clients</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold flex-shrink-0" style={{ color: '#D4AF37' }}>2.</span>
              <span>Download the <strong style={{ color: 'white' }}>Epix Visuals Admin App</strong> from the dashboard to manage galleries on mobile</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold flex-shrink-0" style={{ color: '#D4AF37' }}>3.</span>
              <span>Upload your first client gallery and share the access code</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold flex-shrink-0" style={{ color: '#D4AF37' }}>4.</span>
              <span>Your clients download the Epix Visuals app and unlock their gallery</span>
            </li>
          </ol>
        </div>

        {/* Admin App download */}
        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <p className="text-sm font-semibold" style={{ color: '#D4AF37' }}>📱 Download the Admin App now</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Sign in with the email and password you just created to start managing your galleries on mobile.
          </p>
          <div className="flex gap-3 justify-center">
            <a href={adminAppAndroid} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xl">🤖</span>
              <div className="text-left">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Get it on</p>
                <p className="text-sm font-bold text-white">Google Play</p>
              </div>
            </a>
            <a href={adminAppIos} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xl">🍎</span>
              <div className="text-left">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Download on</p>
                <p className="text-sm font-bold text-white">App Store</p>
              </div>
            </a>
          </div>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Also available from <strong style={{ color: 'white' }}>Settings</strong> inside your dashboard
          </p>
        </div>

        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Need help?{' '}
          <a href="mailto:epixshots002@gmail.com" style={{ color: '#D4AF37' }}>Contact support</a>
        </p>
      </div>
    </main>
  );
}
