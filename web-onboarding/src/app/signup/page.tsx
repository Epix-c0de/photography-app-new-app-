'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Step = 'form' | 'paying' | 'waiting' | 'verifying' | 'success' | 'error';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');

  const [form, setForm] = useState({
    name: '',
    studioName: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.phone || !form.password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }

    setErrorMsg('');
    setStep('paying');

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      setCheckoutRequestId(data.checkout_request_id);
      setStep('waiting');
      startPolling(data.checkout_request_id, data.admin_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStep('error');
    }
  };

  const startPolling = (checkoutId: string, adminId: string) => {
    let attempts = 0;
    const maxAttempts = 45;

    const interval = setInterval(async () => {
      attempts++;

      if (attempts > 10) setStep('verifying');

      try {
        const res = await fetch(`/api/subscription-status?checkout_request_id=${checkoutId}&admin_id=${adminId}`);
        const data = await res.json();

        if (data.status === 'success') {
          clearInterval(interval);
          setStep('success');
          setTimeout(() => router.push('/success'), 2000);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setErrorMsg('Payment was unsuccessful. Please try again.');
          setStep('error');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setErrorMsg('Payment timed out. If you were charged, contact support.');
          setStep('error');
        }
      } catch {}
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-black text-gold">Epix Visuals</Link>
          <p className="text-gray-400 mt-2 text-sm">Create your photographer account</p>
        </div>

        {/* Form step */}
        {step === 'form' && (
          <form onSubmit={handleSubmit} className="bg-card border border-white/5 rounded-3xl p-8 space-y-5">
            <h1 className="text-2xl font-black mb-2">Get started</h1>
            <p className="text-gray-400 text-sm mb-6">KES 500/month · Cancel anytime</p>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Your name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="John Kamau"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Studio name</label>
              <input
                name="studioName"
                value={form.studioName}
                onChange={handleChange}
                placeholder="Kamau Photography"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address *</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john@studio.co.ke"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">M-Pesa phone number *</label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                placeholder="0712345678"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50 transition-colors"
                required
              />
              <p className="text-gray-500 text-xs mt-1">We'll send the KES 500 payment prompt to this number.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password *</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50 transition-colors"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gold text-black font-bold py-4 rounded-2xl hover:opacity-90 transition-opacity text-lg mt-2"
            >
              Pay KES 500 & Create Account →
            </button>

            <p className="text-center text-gray-500 text-xs">
              Already have an account?{' '}
              <Link href="/login" className="text-gold hover:underline">Sign in</Link>
            </p>
          </form>
        )}

        {/* Payment states */}
        {(step === 'paying' || step === 'waiting' || step === 'verifying') && (
          <div className="bg-card border border-white/5 rounded-3xl p-10 text-center space-y-6">
            <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
            <div>
              <h2 className="text-xl font-bold mb-2">
                {step === 'paying' ? 'Initiating payment...' :
                 step === 'waiting' ? 'Check your phone!' : 'Verifying payment...'}
              </h2>
              <p className="text-gray-400 text-sm">
                {step === 'waiting'
                  ? `An M-Pesa prompt has been sent to ${form.phone}. Enter your PIN to confirm.`
                  : 'Please wait while we confirm your payment.'}
              </p>
            </div>
            {step === 'waiting' && (
              <div className="bg-gold/10 border border-gold/20 rounded-xl p-4 text-sm text-gold">
                💡 Enter your M-Pesa PIN on your phone to complete the KES 500 payment.
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="bg-card border border-green-500/20 rounded-3xl p-10 text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-black text-green-400">Payment Successful!</h2>
            <p className="text-gray-400">Your account is now active. Redirecting...</p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="bg-card border border-red-500/20 rounded-3xl p-10 text-center space-y-6">
            <div className="text-5xl">❌</div>
            <h2 className="text-xl font-bold text-red-400">Something went wrong</h2>
            <p className="text-gray-400 text-sm">{errorMsg}</p>
            <button
              onClick={() => { setStep('form'); setErrorMsg(''); }}
              className="bg-gold text-black font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
