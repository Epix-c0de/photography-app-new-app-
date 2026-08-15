'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Check,
  Shield,
  ArrowRight,
  Loader2,
  Mail,
  AlertCircle,
  X,
} from 'lucide-react';

export default function ConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'confirmed' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const code = urlParams.get('code');

    async function confirmEmail() {
      try {
        if (error) {
          setStatus('error');
          setMessage(errorDescription || 'An error occurred during confirmation.');
          return;
        }

        if (code) {
          const { error: confirmError } = await supabase.auth.exchangeCodeForSession(code);
          if (confirmError) {
            setStatus('error');
            setMessage(confirmError.message || 'Failed to confirm email.');
            return;
          }
        }

        // Check if user is confirmed
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          setStatus('error');
          setMessage('Could not verify your session.');
          return;
        }

        if (user && user.email_confirmed_at) {
          setStatus('confirmed');
          setMessage('Your email has been successfully confirmed!');

          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                router.push('/login');
              }
              return prev - 1;
            });
          }, 1000);

          return () => clearInterval(timer);
        }

        setStatus('error');
        setMessage('Your email could not be confirmed. Please try resending the confirmation email.');
      } catch (e: any) {
        setStatus('error');
        setMessage(e.message || 'Something went wrong.');
      }
    }

    confirmEmail();
  }, [router]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0A0A0E] to-[#0A0A0A] text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-br from-[#D4AF37]/15 via-[#F0D060]/5 to-transparent blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-20 right-20 w-[300px] h-[300px] bg-gradient-to-br from-[#D4AF37]/20 to-transparent blur-[100px] rounded-full" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <a href="/" className="inline-block text-4xl font-black tracking-tight group">
            <span className="bg-gradient-to-r from-[#D4AF37] to-[#F0D060] bg-clip-text text-transparent">
              EP
            </span>
            <span className="text-zinc-200">IX VISUALS</span>
          </a>
        </div>

        {status === 'loading' && (
          <div className="rounded-3xl p-8 space-y-6 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-xl border border-zinc-700/50 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/15 flex items-center justify-center border border-[#D4AF37]/30">
                <Loader2 size={28} className="text-[#D4AF37] animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">Confirming your email...</h2>
            <p className="text-sm text-zinc-400">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'confirmed' && (
          <div className="rounded-3xl p-8 space-y-6 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-xl border border-zinc-700/50 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/30">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={20} className="text-white stroke-[3]" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-black text-white">Email Confirmed!</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Thank you for confirming your email address. Your account is now verified and ready to use.
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => router.push('/login')}
                className="w-full group relative overflow-hidden py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
                  boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
                }}
              >
                <span>Continue to Login</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-xs text-zinc-500 mt-3">
                Redirecting in {countdown}...
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-3xl p-8 space-y-6 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-xl border border-red-500/20 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center border border-red-500/30">
                <AlertCircle size={28} className="text-red-400" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {message}
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <button
                onClick={() => router.push('/login')}
                className="w-full group relative overflow-hidden py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
                  boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
                }}
              >
                <span>Back to Login</span>
              </button>
              <p className="text-xs text-zinc-500">
                If the issue persists, contact support at{' '}
                <a
                  href="mailto:epixshots002@gmail.com"
                  className="text-[#D4AF37] hover:text-[#F0D060] hover:underline transition-colors"
                >
                  epixshots002@gmail.com
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Trust Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-zinc-500 text-[11px]">
          <Shield size={12} className="text-emerald-500" />
          <span>Secured by Epix Visuals</span>
        </div>
      </div>
    </main>
  );
}
