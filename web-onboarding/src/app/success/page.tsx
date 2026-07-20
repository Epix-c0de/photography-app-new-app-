'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

export default function SuccessPage() {
  const [countdown, setCountdown] = useState(5);
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [loginToken, setLoginToken] = useState('');
  const [adminId, setAdminId] = useState('');
  const [showCheckmark, setShowCheckmark] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowCheckmark(true), 300);

    const params = new URLSearchParams(window.location.search);
    const adminIdParam = params.get('admin_id') || '';
    setAdminId(adminIdParam);

    const url = process.env.NEXT_PUBLIC_PHOTOGRAPHER_DASHBOARD_URL || 'http://localhost:3002';
    setDashboardUrl(url);

    // Generate one-time login token
    if (adminIdParam) {
      fetch('/api/generate-login-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminIdParam }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) setLoginToken(data.token);
        })
        .catch(err => console.error('Failed to generate login token:', err));
    }

    // Auto-redirect countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          const redirectUrl = loginToken
            ? `${url}/login?token=${loginToken}&email=${encodeURIComponent(adminIdParam)}`
            : url;
          window.location.href = redirectUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [loginToken]);

  const goToDashboard = () => {
    const redirectUrl = loginToken
      ? `${dashboardUrl}/login?token=${loginToken}&email=${encodeURIComponent(adminId)}`
      : dashboardUrl;
    window.location.href = redirectUrl;
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-8 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #D4AF37, transparent)', top: '-200px', left: '50%', transform: 'translateX(-50%)' }} />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        {/* Animated checkmark */}
        <div className="relative inline-block">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto transition-all duration-700"
            style={{
              background: showCheckmark ? 'rgba(34,197,94,0.1)' : 'rgba(212,175,55,0.05)',
              border: showCheckmark ? '2px solid rgba(34,197,94,0.3)' : '2px solid rgba(212,175,55,0.1)',
              transform: showCheckmark ? 'scale(1)' : 'scale(0.8)',
              opacity: showCheckmark ? 1 : 0,
            }}
          >
            <svg
              width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: showCheckmark ? 0 : 50,
                transition: 'stroke-dashoffset 0.6s ease-out 0.4s',
              }}
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          {showCheckmark && (
            <>
              <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-gold/40 animate-ping" style={{ animationDelay: '0.2s' }} />
              <div className="absolute top-2 right-0 w-1.5 h-1.5 rounded-full bg-green-400/30 animate-ping" style={{ animationDelay: '0.4s' }} />
              <div className="absolute bottom-2 left-0 w-1.5 h-1.5 rounded-full bg-gold/30 animate-ping" style={{ animationDelay: '0.6s' }} />
            </>
          )}
        </div>

        <div style={{ animation: 'fadeUp 0.6s ease-out 0.3s both' }}>
          <h1 className="text-4xl font-black mb-3" style={{ color: 'white' }}>Welcome to Epix Visuals!</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your account is ready. Redirecting to your dashboard...
          </p>
        </div>

        {/* Redirect card */}
        <div
          className="rounded-3xl p-8 space-y-5"
          style={{
            background: 'rgba(212,175,55,0.04)',
            border: '1px solid rgba(212,175,55,0.15)',
            animation: 'fadeUp 0.6s ease-out 0.4s both',
          }}
        >
          <div className="flex items-center justify-center gap-3">
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(212,175,55,0.1)" strokeWidth="2" />
                <circle
                  cx="18" cy="18" r="16" fill="none"
                  stroke="#D4AF37" strokeWidth="2" strokeLinecap="round"
                  strokeDasharray={100.53}
                  strokeDashoffset={100.53 * (1 - countdown / 5)}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color: '#D4AF37' }}>
                {countdown}
              </span>
            </div>
            <p className="font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Redirecting in {countdown}s...
            </p>
          </div>

          <LiquidButton onClick={goToDashboard} size="xl" className="w-full">
            Go to Dashboard Now →
          </LiquidButton>
        </div>

        {/* What's next */}
        <div
          className="rounded-2xl p-6 text-left space-y-4"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', animation: 'fadeUp 0.6s ease-out 0.5s both' }}
        >
          <h3 className="font-bold" style={{ color: '#D4AF37' }}>What happens next:</h3>
          <ol className="space-y-3 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {[
              'Your dashboard opens — configure your M-Pesa payment number for clients',
              'Download the Admin App from your dashboard to manage galleries on mobile',
              'Upload your first client gallery and share the access code',
              'Your clients download the Epix Visuals app and unlock their gallery',
            ].map((text, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-bold flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)', animation: 'fadeUp 0.6s ease-out 0.6s both' }}>
          Need help?{' '}
          <a href="mailto:epixshots002@gmail.com" className="font-medium hover:underline" style={{ color: '#D4AF37' }}>Contact support</a>
        </p>
      </div>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
