'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import {
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Phone,
  Sparkles,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);

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
    <main className="min-h-screen bg-[#080810] text-slate-100 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#D4AF37]/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-amber-600/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block group text-3xl font-black tracking-tight">
            <span className="text-[#D4AF37] transition-transform duration-300 group-hover:scale-105 inline-block">Epix</span>
            <span className="text-white"> Visuals</span>
          </Link>
          <p className="text-zinc-400 mt-2 text-sm font-medium">Powering Kenya&apos;s Professional Photographers</p>
        </div>

        {/* Stepper Progress */}
        {step !== 'error' && (
          <div className="flex items-center justify-between mb-8 px-2">
            {steps.map((s, idx) => {
              const current = getStepIndex();
              const isActive = idx === current;
              const isComplete = idx < current;
              
              return (
                <div key={s.key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1.5 relative">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        isComplete
                          ? 'bg-[#D4AF37] text-[#080810] shadow-md shadow-[#D4AF37]/20'
                          : isActive
                          ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37] ring-4 ring-[#D4AF37]/10'
                          : 'bg-white/5 text-zinc-500 border border-white/5'
                      }`}
                    >
                      {isComplete ? <Check size={12} strokeWidth={3} /> : s.num}
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${isActive ? 'text-[#D4AF37]' : 'text-zinc-500'}`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div 
                      className={`h-[2px] w-6 sm:w-10 mx-1 rounded-full transition-colors duration-500 ${
                        idx < current ? 'bg-[#D4AF37]' : 'bg-white/10'
                      }`} 
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Main Form Box */}
        {step === 'form' && (
          <form 
            onSubmit={handleSubmit} 
            className="rounded-3xl p-6 sm:p-8 space-y-4 bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50"
          >
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Create Account</h1>
              <div className="flex items-center justify-between mt-1">
                <p className="text-zinc-400 text-xs font-medium">
                  {price !== null ? `${currency} ${price.toLocaleString()}/month · Cancel anytime` : 'Loading plan pricing...'}
                </p>
                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded-full border border-[#D4AF37]/20 flex items-center gap-1">
                  <Phone size={10} /> M-Pesa Ready
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
                <AlertCircle size={14} />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Full Name <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. John Kamau"
                  className={`w-full rounded-xl px-4 py-3 text-sm bg-white/[0.03] text-white placeholder-zinc-600 outline-none border transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] ${
                    fieldErrors.name ? 'border-red-500/50' : 'border-white/10'
                  }`}
                />
                {fieldErrors.name && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Studio/Brand Name <span className="text-zinc-500">(Optional)</span>
                </label>
                <input
                  name="studioName"
                  type="text"
                  value={form.studioName}
                  onChange={handleChange}
                  placeholder="e.g. Kamau Visuals Studio"
                  className="w-full rounded-xl px-4 py-3 text-sm bg-white/[0.03] text-white placeholder-zinc-600 outline-none border border-white/10 transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Email Address <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="john@studio.co.ke"
                  className={`w-full rounded-xl px-4 py-3 text-sm bg-white/[0.03] text-white placeholder-zinc-600 outline-none border transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] ${
                    fieldErrors.email ? 'border-red-500/50' : 'border-white/10'
                  }`}
                />
                {fieldErrors.email && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  M-Pesa Phone Number <span className="text-[#D4AF37]">*</span>
                </label>
                <div className="relative">
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="0712345678"
                    className={`w-full rounded-xl pl-4 pr-14 py-3 text-sm bg-white/[0.03] text-white placeholder-zinc-600 outline-none border transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] ${
                      fieldErrors.phone ? 'border-red-500/50' : 'border-white/10'
                    }`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                    <Sparkles size={10} /> STK
                  </span>
                </div>
                {fieldErrors.phone ? (
                  <p className="text-[11px] text-red-400 mt-1">{fieldErrors.phone}</p>
                ) : (
                  <p className="text-[11px] text-zinc-500 mt-1">Prompt sent directly to this phone</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Password <span className="text-[#D4AF37]">*</span>
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    className={`w-full rounded-xl pl-4 pr-12 py-3 text-sm bg-white/[0.03] text-white placeholder-zinc-600 outline-none border transition-all focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] ${
                      fieldErrors.password ? 'border-red-500/50' : 'border-white/10'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && <p className="text-[11px] text-red-400 mt-1">{fieldErrors.password}</p>}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <LiquidButton type="submit" size="xl" className="w-full">
                <span className="flex items-center justify-center gap-2">
                  {price !== null ? `Pay ${currency} ${price.toLocaleString()} & Access` : 'Create Account'}
                  <ArrowRight size={16} />
                </span>
              </LiquidButton>

              {trialDays > 0 && (
                <button
                  type="button"
                  onClick={handleStartTrial}
                  className="w-full py-3 rounded-xl font-semibold text-xs border border-white/10 text-zinc-300 hover:bg-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} className="text-[#D4AF37]" />
                  Start {trialDays}-Day Free Trial First
                </button>
              )}
            </div>

            <p className="text-center text-zinc-500 text-xs pt-1">
              Already have an account?{' '}
              <Link href="/login" className="text-[#D4AF37] font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}

        {/* Status Views: Paying / Waiting / Verifying */}
        {(step === 'paying' || step === 'waiting' || step === 'verifying') && (
          <div className="rounded-3xl p-8 text-center space-y-6 bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-white/5" />
              <div className="absolute inset-0 rounded-full border-2 border-t-[#D4AF37] animate-spin" />
              <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
                <Phone size={24} className="text-[#D4AF37]" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">
                {step === 'paying' && 'Initiating M-Pesa...'}
                {step === 'waiting' && 'Check Your Phone'}
                {step === 'verifying' && 'Confirming Payment...'}
              </h2>
              <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                {step === 'waiting'
                  ? `An M-Pesa PIN prompt was sent to ${form.phone}. Enter your PIN to approve.`
                  : 'We are verifying your transaction with Safaricom M-Pesa.'}
              </p>
            </div>

            {step === 'waiting' && (
              <div className="rounded-xl p-3 text-xs bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] animate-pulse flex items-center justify-center gap-2">
                <ShieldCheck size={14} />
                Keep this window open while entering your PIN
              </div>
            )}
          </div>
        )}

        {/* Status View: Success & Trial */}
        {(step === 'success' || step === 'trial') && (
          <div className="rounded-3xl p-8 text-center space-y-4 bg-white/[0.03] backdrop-blur-xl border border-emerald-500/20 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center">
              <Check size={32} className="text-emerald-400" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-emerald-400">
              {step === 'trial' ? 'Trial Activated!' : 'Payment Complete!'}
            </h2>
            <p className="text-zinc-400 text-xs">
              {step === 'trial' 
                ? `Your ${trialDays}-day trial is active. Redirecting to dashboard...`
                : 'Setting up your photography workspace now...'}
            </p>
          </div>
        )}

        {/* Status View: Error */}
        {step === 'error' && (
          <div className="rounded-3xl p-8 text-center space-y-5 bg-white/[0.03] backdrop-blur-xl border border-red-500/20 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mx-auto flex items-center justify-center">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-red-400">Transaction Stopped</h2>
              <p className="text-zinc-400 text-xs max-w-xs mx-auto">{errorMsg}</p>
            </div>
            <button
              onClick={() => { setStep('form'); setErrorMsg(''); setFieldErrors({}); }}
              className="w-full py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-[#D4AF37] to-[#F0D060] text-[#080810] hover:brightness-110 transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
