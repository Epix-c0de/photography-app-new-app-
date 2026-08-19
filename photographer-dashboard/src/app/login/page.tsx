'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function LoginHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing login...');

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      window.location.href = 'https://web-onboarding-seven.vercel.app/login';
      return;
    }

    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }).then(({ error }) => {
      if (error) {
        console.error('Session set failed:', error);
        setStatus('Login failed. Redirecting...');
        setTimeout(() => { window.location.href = 'https://web-onboarding-seven.vercel.app/login'; }, 2000);
      } else {
        setStatus('Welcome! Redirecting to dashboard...');
        router.replace('/dashboard');
      }
    });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">{status}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginHandler />
    </Suspense>
  );
}
