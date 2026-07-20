'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

type Step = 'form' | 'paying' | 'waiting' | 'verifying' | 'success' | 'error' | 'trial';

const steps = [
  { key: 'form', label: 'Details', num: 1 },
  { key: 'paying', label: 'Payment', num: 2 },
  { key: 'waiting', label: 'Confirm', num: 3 },
  { key: 'verifying', label: 'Verify', num: 4 },
  { key: 'success', label: 'Done', num: 5 },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('KES');
  const [trialDays, setTrialDays] = useState(7);
  const [dashboardUrl, setDashboardUrl] = useState('');

  const [form, setForm] = useState({
    name: '',
    studioName: '',
    email: '',
    phone: '',
    password: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_PHOTOGRAPHER_DASHBOARD_URL || 'http://localhost:3002';
    setDashboardUrl(url);

    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_admin_subscription_price', 'platform_admin_subscription_currency', 'platform_admin_trial_days'])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value || ''; });
          if (map['platform_admin_subscription_price']) setPrice(parseInt(map['platform_admin_subscription_price']));
          if (map['platform_admin_subscription_currency']) setCurrency(map['platform_admin_subscription_currency']);
          if (map['platform_admin_trial_days']) setTrialDays(parseInt(map['platform_admin_trial_days']));
        }
      });
  }, []);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Full name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email';
    if (!form.phone.trim()) errors.phone = 'Phone number is required';
    else if (!/^0[17]\d{8}$/.test(form.phone.replace(/\s/g, ''))) errors.phone = 'Enter a valid M-Pesa number (07XX or 01XX)';
    if (!form.password) errors.password = 'Password is required';
    else if (form.password.length < 8) errors.password = 'Must be at least 8 characters';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleStartTrial = async () => {
    if (!validate()) return;
    setErrorMsg('');
    setStep('paying');

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, start_trial: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      setStep('trial');
      setTimeout(() => {
        window.location.href = `${dashboardUrl}/login?token=${data.token}&email=${encodeURIComponent(form.email)}`;
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
      setStep('error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setErrorMsg('');
    setStep('paying');

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

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
          setTimeout(() => {
            window.location.href = `${dashboardUrl}/login?token=${data.token || ''}&email=${encodeURIComponent(form.email)}`;
          }, 2000);
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

  const getStepIndex = () => {
    if (step === 'form') return 0;
    if (step === 'paying') return 1;
    if (step === 'waiting') return 2;
    if (step === 'verifying') return 3;
    if (step === 'success' || step === 'trial') return 4;
    return 0;
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-5 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #D4AF37, transparent)', top: '-150px', right: '-100px' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-black tracking-tight">
            <span style={{ color: '#D4AF37' }}>Epix</span>
            <span className="text-white"> Visuals</span>
          </Link>
          <p className="text-gray-400 mt-2 text-sm">Create your photographer account</p>
        </div>

        {step !== 'error' && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.filter(s => {
              const idx = steps.indexOf(s);
              const current = getStepIndex();
              return idx <= current + 1 && idx <= 4;
            }).map((s, i, arr) => {
              const idx = steps.indexOf(s);
              const current = getStepIndex();
              const isActive = idx === current;
              const isComplete = idx < current;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className="w-6 h-px" style={{ background: isComplete ? '#D4AF37' : 'rgba(255,255,255,0.1)' }} />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: isComplete ? '#D4AF37' : isActive ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
                        color: isComplete ? '#080810' : isActive ? '#D4AF37' : 'rgba(255,255,255,0.3)',
                        border: isActive ? '1px solid rgba(212,175,55,0.4)' : '1px solid transparent',
                      }}
                    >
                      {isComplete ? '✓' : s.num}
                    </div>
                    <span className="text-xs hidden sm:inline" style={{ color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.3)' }}>
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="rounded-3xl p-8 space-y-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="mb-2">
              <h1 className="text-2xl font-black mb-1">Get started</h1>
              <p className="text-gray-400 text-sm">
                {price !== null
                  ? `${currency} ${price}/month · Cancel anytime`
                  : 'Loading pricing...'}
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {errorMsg}
              </div>
            )}

            {[
              { name: 'name', label: 'Your name', type: 'text', placeholder: 'John Kamau', required: true },
              { name: 'studioName', label: 'Studio name', type: 'text', placeholder: 'Kamau Photography (optional)', required: false },
              { name: 'email', label: 'Email address', type: 'email', placeholder: 'john@studio.co.ke', required: true },
              { name: 'phone', label: 'M-Pesa phone number', type: 'tel', placeholder: '0712345678', required: true, hint: 'Payment prompt sent to this number' },
              { name: 'password', label: 'Password', type: 'password', placeholder: 'Min. 8 characters', required: true, minLength: 8 },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  {field.label} {field.required && <span style={{ color: '#D4AF37' }}>*</span>}
                </label>
                <input
                  name={field.name}
                  type={field.type}
                  value={(form as any)[field.name]}
                  onChange={handleChange}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: fieldErrors[field.name] ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                  required={field.required}
                  minLength={field.minLength}
                />
                {fieldErrors[field.name] && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{fieldErrors[field.name]}</p>
                )}
                {field.hint && !fieldErrors[field.name] && (
                  <p className="text-xs mt-1 text-gray-500">{field.hint}</p>
                )}
              </div>
            ))}

            <div className="space-y-3 pt-2">
              <LiquidButton
                type="submit"
                size="xl"
                className="w-full"
              >
                {price !== null ? `Pay ${currency} ${price} & Create Account →` : 'Create Account →'}
              </LiquidButton>

              {trialDays > 0 && (
                <button
                  type="button"
                  onClick={handleStartTrial}
                  className="w-full py-3 rounded-2xl font-bold text-sm border border-white/10 text-white hover:border-white/20 transition-all"
                >
                  Start {trialDays}-Day Free Trial →
                </button>
              )}
            </div>

            <p className="text-center text-gray-500 text-xs">
              Already have an account?{' '}
              <Link href="/login" className="font-medium hover:underline" style={{ color: '#D4AF37' }}>Sign in</Link>
            </p>
          </form>
        )}

        {(step === 'paying' || step === 'waiting' || step === 'verifying') && (
          <div className="rounded-3xl p-10 text-center space-y-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-white/5" />
              <div
                className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(212,175,55,0.3)', borderTopColor: 'transparent' }}
              />
              <div className="absolute inset-2 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.1)' }}>
                {step === 'waiting' ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                  </svg>
                ) : step === 'verifying' ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-2">
                {step === 'paying' ? 'Initiating payment...' :
                 step === 'waiting' ? 'Check your phone' : 'Verifying payment...'}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {step === 'waiting'
                  ? `An M-Pesa prompt has been sent to ${form.phone}. Enter your PIN to confirm the payment.`
                  : 'Please wait while we confirm your payment.'}
              </p>
            </div>

            {step === 'waiting' && (
              <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                Enter your M-Pesa PIN on your phone to complete the payment
              </div>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="rounded-3xl p-10 text-center space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.1)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-green-400">Payment Successful!</h2>
            <p className="text-gray-400">Redirecting to your dashboard...</p>
          </div>
        )}

        {step === 'trial' && (
          <div className="rounded-3xl p-10 text-center space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
              style={{ background: 'rgba(34,197,94,0.1)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-green-400">Trial Activated!</h2>
            <p className="text-gray-400">Your {trialDays}-day free trial has started. Redirecting to your dashboard...</p>
          </div>
        )}

        {step === 'error' && (
          <div className="rounded-3xl p-10 text-center space-y-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-400">Something went wrong</h2>
            <p className="text-gray-400 text-sm">{errorMsg}</p>
            <button
              onClick={() => { setStep('form'); setErrorMsg(''); setFieldErrors({}); }}
              className="px-8 py-3 rounded-xl font-bold transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
