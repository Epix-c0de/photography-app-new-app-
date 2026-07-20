'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import { Check, ArrowRight, Mail, Download, Share2, Smartphone } from 'lucide-react';

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
    <main className="min-h-screen bg-[#080810] text-slate-100 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-[#D4AF37]/5 blur-[100px] rounded-full pointer-events-none" />

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
            <Check
              size={40}
              strokeWidth={2.5}
              className="text-emerald-400"
              style={{
                strokeDasharray: 50,
                strokeDashoffset: showCheckmark ? 0 : 50,
                transition: 'stroke-dashoffset 0.6s ease-out 0.4s',
              }}
            />
          </div>
          {showCheckmark && (
            <>
              <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-[#D4AF37]/40 animate-ping" style={{ animationDelay: '0.2s' }} />
              <div className="absolute top-2 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400/30 animate-ping" style={{ animationDelay: '0.4s' }} />
              <div className="absolute bottom-2 left-0 w-1.5 h-1.5 rounded-full bg-[#D4AF37]/30 animate-ping" style={{ animationDelay: '0.6s' }} />
            </>
          )}
        </div>

        <div style={{ animation: 'fadeUp 0.6s ease-out 0.3s both' }}>
          <h1 className="text-4xl font-black mb-3 text-white">Welcome to Epix Visuals!</h1>
          <p className="text-zinc-400 text-sm">
            Your account is ready. Redirecting to your dashboard...
          </p>
        </div>

        {/* Redirect card */}
        <div
          className="rounded-3xl p-8 space-y-5 bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50"
          style={{ animation: 'fadeUp 0.6s ease-out 0.4s both' }}
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
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-[#D4AF37]">
                {countdown}
              </span>
            </div>
            <p className="font-semibold text-zinc-400 text-sm">
              Redirecting in {countdown}s...
            </p>
          </div>

          <LiquidButton onClick={goToDashboard} size="xl" className="w-full">
            <span className="flex items-center justify-center gap-2">
              Go to Dashboard Now
              <ArrowRight size={16} />
            </span>
          </LiquidButton>
        </div>

        {/* What's next */}
        <div
          className="rounded-2xl p-6 text-left space-y-4 bg-white/[0.02] border border-white/5"
          style={{ animation: 'fadeUp 0.6s ease-out 0.5s both' }}
        >
          <h3 className="font-bold text-[#D4AF37] text-sm">What happens next:</h3>
          <ol className="space-y-3 text-xs text-zinc-400">
            {[
              { icon: Mail, text: 'Your dashboard opens — configure your M-Pesa payment number for clients' },
              { icon: Download, text: 'Download the Admin App from your dashboard to manage galleries on mobile' },
              { icon: Share2, text: 'Upload your first client gallery and share the access code' },
              { icon: Smartphone, text: 'Your clients download the Epix Visuals app and unlock their gallery' },
            ].map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="font-bold flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                  <item.icon size={12} />
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-zinc-500" style={{ animation: 'fadeUp 0.6s ease-out 0.6s both' }}>
          Need help?{' '}
          <a href="mailto:epixshots002@gmail.com" className="text-[#D4AF37]/60 hover:text-[#D4AF37] hover:underline transition-colors font-medium">
            Contact support
          </a>
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
