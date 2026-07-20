'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboardUrl, setDashboardUrl] = useState('');

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_PHOTOGRAPHER_DASHBOARD_URL || 'http://localhost:3002';
    setDashboardUrl(url);

    // Check if there's a token in URL params (from success redirect)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const emailParam = params.get('email');
    if (token && emailParam) {
      window.location.href = `${url}/login?token=${token}&email=${encodeURIComponent(emailParam)}`;
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, subscription_status, subscription_expires_at, is_lifetime')
        .eq('id', data.user.id)
        .single() as any;

      if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        await supabase.auth.signOut();
        throw new Error('This account does not have admin access.');
      }

      const isActive =
        profile.role === 'super_admin' ||
        profile.is_lifetime ||
        (profile.subscription_status === 'active' &&
          profile.subscription_expires_at &&
          new Date(profile.subscription_expires_at) > new Date());

      if (!isActive) {
        // Generate a one-time token and redirect to dashboard renewal
        const res = await fetch('/api/generate-login-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: data.user.id }),
        });
        const tokenData = await res.json();
        if (tokenData.token) {
          window.location.href = `${dashboardUrl}/login?token=${tokenData.token}&email=${encodeURIComponent(email)}&renew=1`;
        } else {
          window.location.href = `${dashboardUrl}`;
        }
        return;
      }

      // Generate one-time token for dashboard
      const res = await fetch('/api/generate-login-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: data.user.id }),
      });
      const tokenData = await res.json();

      if (tokenData.token) {
        window.location.href = `${dashboardUrl}/login?token=${tokenData.token}&email=${encodeURIComponent(email)}`;
      } else {
        window.location.href = `${dashboardUrl}`;
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-5 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #D4AF37, transparent)', top: '-150px', left: '-100px' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-3 blur-[80px]"
          style={{ background: 'radial-gradient(circle, #D4AF37, transparent)', bottom: '-100px', right: '-50px' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-black tracking-tight">
            <span style={{ color: '#D4AF37' }}>Epix</span>
            <span className="text-white"> Visuals</span>
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Sign in to your photographer account</p>
        </div>

        <div className="rounded-3xl p-8 space-y-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h1 className="text-2xl font-black mb-1">Welcome back</h1>
            <p className="text-gray-500 text-sm">Enter your credentials to access your dashboard</p>
          </div>

          {error && (
            <div className="rounded-xl p-3 text-sm flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@studio.co.ke"
                className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in →'}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 text-gray-500" style={{ background: 'rgba(255,255,255,0.03)' }}>or</span>
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium hover:underline" style={{ color: '#D4AF37' }}>Get started free</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Need help?{' '}
          <a href="mailto:epixshots002@gmail.com" className="hover:underline" style={{ color: 'rgba(212,175,55,0.6)' }}>Contact support</a>
        </p>
      </div>
    </main>
  );
}
