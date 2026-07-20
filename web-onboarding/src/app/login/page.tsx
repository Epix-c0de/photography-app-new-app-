'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
  Mail,
  Lock,
  ShieldCheck,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_PHOTOGRAPHER_DASHBOARD_URL || 'http://localhost:3002';
    setDashboardUrl(url);

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
    <main className="min-h-screen bg-white text-zinc-900 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-[#D4AF37]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-amber-100/40 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block group text-3xl font-black tracking-tight">
            <span className="text-[#D4AF37] transition-transform duration-300 group-hover:scale-105 inline-block">Epix</span>
            <span className="text-zinc-900"> Visuals</span>
          </Link>
          <p className="text-zinc-400 mt-2 text-sm font-medium">Sign in to your photographer dashboard</p>
        </div>

        {/* Main Form Box */}
        <form
          onSubmit={handleLogin}
          className="rounded-3xl p-6 sm:p-8 space-y-5 bg-white border border-zinc-200 shadow-xl shadow-zinc-200/50"
        >
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">Welcome back</h1>
            <p className="text-zinc-400 mt-1 text-xs font-medium">Enter your credentials to access your dashboard</p>
          </div>

          {error && (
            <div className="rounded-xl p-3 text-xs bg-red-50 border border-red-200 text-red-600 flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">
                Email address <span className="text-[#D4AF37]">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@studio.co.ke"
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm bg-zinc-50 text-zinc-900 placeholder-zinc-400 outline-none border border-zinc-200 transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">
                Password <span className="text-[#D4AF37]">*</span>
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-xl pl-10 pr-12 py-3 text-sm bg-zinc-50 text-zinc-900 placeholder-zinc-400 outline-none border border-zinc-200 transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <LiquidButton
            type="submit"
            size="xl"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Access Dashboard
                <ArrowRight size={16} />
              </span>
            )}
          </LiquidButton>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 text-zinc-400 bg-white">or</span>
            </div>
          </div>

          <p className="text-center text-zinc-400 text-xs">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#D4AF37] font-semibold hover:underline">
              Get started free
            </Link>
          </p>
        </form>

        {/* Trust Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-zinc-400 text-[11px]">
          <ShieldCheck size={12} className="text-emerald-500" />
          <span>Secured with end-to-end encryption</span>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-3">
          Need help?{' '}
          <a href="mailto:epixshots002@gmail.com" className="text-[#D4AF37]/60 hover:text-[#D4AF37] hover:underline transition-colors">
            Contact support
          </a>
        </p>
      </div>
    </main>
  );
}
