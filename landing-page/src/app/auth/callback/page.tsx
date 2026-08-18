'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gghqurnamjdxoriuuopf.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnaHF1cm5hbWpkeG9yaXV1b3BmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTI4MDEsImV4cCI6MjA5MTkyODgwMX0.VXEMNxA70znWq0dVK3hEkWhG8u5JVu0Z3-xLM3qQYuc';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
      setStatus('error');
      return;
    }

    const exchangeCode = async () => {
      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        window.location.href = '/auth/success';
      } catch {
        setStatus('error');
      }
    };

    exchangeCode();
  }, [searchParams]);

  if (status === 'error') {
    return (
      <div className="text-center space-y-4">
        <p className="text-white/60">Sign-in failed. Please try again.</p>
        <Link href="/" className="inline-block py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <Loader2 size={40} className="text-purple-400 animate-spin mx-auto" />
      <p className="text-white/60">Completing sign-in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
      <div className="relative z-20">
        <Suspense fallback={
          <div className="text-center space-y-4">
            <Loader2 size={40} className="text-purple-400 animate-spin mx-auto" />
            <p className="text-white/60">Loading...</p>
          </div>
        }>
          <CallbackContent />
        </Suspense>
      </div>
    </div>
  );
}
