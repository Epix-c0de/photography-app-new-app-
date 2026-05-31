'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Step = 'email' | 'otp' | 'waiting_approval' | 'approved' | 'error';

export default function SecureLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);

  // Step 1: Request OTP + create web login request
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/web-login-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          device_info: navigator.userAgent.substring(0, 100),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setToken(data.token || '');
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/web-login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, otp, email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OTP verification failed');

      if (data.status === 'otp_failed') throw new Error('Invalid or expired OTP. Please try again.');
      if (data.status === 'expired') throw new Error('Login request expired. Please start again.');

      // OTP verified — now wait for app approval
      setStep('waiting_approval');
      startPolling();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Poll for app approval
  const startPolling = () => {
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes

    const interval = setInterval(async () => {
      attempts++;
      setPollCount(attempts);

      try {
        const res = await fetch(`/api/web-login-verify?token=${token}`);
        const data = await res.json();

        if (data.status === 'approved') {
          clearInterval(interval);
          setStep('approved');

          // Sign in the user via Supabase magic link session
          // The OTP verification already created a session — just redirect
          setTimeout(() => router.push('/dashboard'), 1500);

        } else if (data.status === 'rejected') {
          clearInterval(interval);
          setError('Login was rejected from the mobile app. If this was not you, change your password immediately.');
          setStep('error');

        } else if (data.status === 'expired' || attempts >= maxAttempts) {
          clearInterval(interval);
          setError('Login request timed out. Please start again.');
          setStep('error');
        }
      } catch {}
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-[#0A0A0E] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📸</div>
          <h1 className="text-2xl font-black" style={{ color: '#D4AF37' }}>Epix Visuals</h1>
          <p className="text-gray-400 text-sm mt-1">Photographer Dashboard</p>
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleRequestOtp} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Secure Sign In</h2>
            <p className="text-gray-400 text-sm">Enter your email. We'll send a one-time code and notify your mobile app.</p>

            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.co.ke"
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3 rounded-xl transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#D4AF37', color: '#0A0A0E' }}
            >
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="bg-[#111118] border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Enter OTP</h2>
            <p className="text-gray-400 text-sm">
              We sent a 6-digit code to <strong className="text-white">{email}</strong>. Enter it below.
            </p>

            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">{error}</div>}

            <div>
              <label className="block text-sm text-gray-400 mb-1">One-time code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full bg-[#0A0A0E] border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-yellow-500/50"
                maxLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full font-bold py-3 rounded-xl transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#D4AF37', color: '#0A0A0E' }}
            >
              {loading ? 'Verifying...' : 'Verify OTP →'}
            </button>

            <button type="button" onClick={() => { setStep('email'); setError(''); }} className="w-full text-sm text-gray-500 hover:text-gray-300">
              ← Back
            </button>
          </form>
        )}

        {/* Step 3: Waiting for app approval */}
        {step === 'waiting_approval' && (
          <div className="bg-[#111118] border border-white/5 rounded-2xl p-8 text-center space-y-5">
            <div className="w-14 h-14 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h2 className="text-xl font-bold">Approve in your app</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Open your <strong className="text-white">Epix Visuals admin app</strong> and tap the approval notification to complete sign in.
            </p>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-400">
              📱 Check your phone for the approval request
            </div>
            <p className="text-gray-600 text-xs">Waiting... ({Math.max(0, 120 - pollCount * 2)}s remaining)</p>
          </div>
        )}

        {/* Step 4: Approved */}
        {step === 'approved' && (
          <div className="bg-[#111118] border border-green-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h2 className="text-xl font-bold text-green-400">Login Approved!</h2>
            <p className="text-gray-400 text-sm">Redirecting to your dashboard...</p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="bg-[#111118] border border-red-500/20 rounded-2xl p-8 text-center space-y-5">
            <div className="text-5xl">❌</div>
            <h2 className="text-xl font-bold text-red-400">Login Failed</h2>
            <p className="text-gray-400 text-sm">{error}</p>
            <button
              onClick={() => { setStep('email'); setError(''); setOtp(''); setToken(''); }}
              className="font-bold px-8 py-3 rounded-xl"
              style={{ backgroundColor: '#D4AF37', color: '#0A0A0E' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
