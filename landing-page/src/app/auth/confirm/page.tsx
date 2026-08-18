'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Mail, CheckCircle, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/integrations/supabase/client';

const VIDEO_URL = 'https://videos.pexels.com/video-files/8128311/8128311-uhd_2560_1440_25fps.mp4';

const VideoBackground = ({ videoUrl }: { videoUrl: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-black/30 z-10" />
      <video
        ref={videoRef}
        className="absolute inset-0 min-w-full min-h-full object-cover w-auto h-auto"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src={videoUrl} type="video/mp4" />
      </video>
    </div>
  );
};

function ConfirmContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const email = searchParams.get('email');

    if (!token || !type) {
      setStatus('error');
      setMessage('Invalid confirmation link. Please check your email and try again.');
      return;
    }

    const supabase = createClient();

    const verifyEmail = async () => {
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type as any,
        });

        if (error) {
          setStatus('error');
          setMessage(error.message || 'Confirmation failed. The link may have expired.');
        } else {
          setStatus('success');
          setMessage('Your email has been confirmed successfully!');
        }
      } catch {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
      <VideoBackground videoUrl={VIDEO_URL} />

      <div className="relative z-20 w-full max-w-md animate-fadeIn">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors text-sm">
          <ArrowRight size={16} className="rotate-180" />
          Back to Home
        </Link>

        <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold mb-2 relative group">
              <span className="absolute -inset-1 bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-blue-500/30 blur-xl opacity-75 group-hover:opacity-100 transition-all duration-500 animate-pulse"></span>
              <span className="relative inline-block text-3xl font-bold mb-2 text-white">
                Epix Visuals
              </span>
            </h2>
            <p className="text-white/80 text-sm">Email Confirmation</p>
          </div>

          {status === 'loading' && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 mx-auto flex items-center justify-center">
                <Loader2 size={32} className="text-purple-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">Confirming your email...</h3>
                <p className="text-white/50 text-sm">Please wait while we verify your account.</p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 mx-auto flex items-center justify-center animate-success">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">Email Confirmed!</h3>
                <p className="text-white/50 text-sm">{message}</p>
              </div>
              <div className="pt-4 space-y-3">
                <a
                  href="https://app.epixvisuals.co.ke/login"
                  className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
                >
                  Go to Dashboard Login
                  <ArrowRight size={16} />
                </a>
                <p className="text-white/40 text-xs text-center">
                  You can now sign in with your email and password
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 mx-auto flex items-center justify-center">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-2">Confirmation Failed</h3>
                <p className="text-white/50 text-sm">{message}</p>
              </div>
              <div className="pt-4 space-y-3">
                <Link
                  href="/"
                  className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 border border-white/10"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-white/40 text-xs">
              Need help?{' '}
              <a href="mailto:info@epixshots.co.ke" className="font-medium text-white hover:text-purple-300 transition-colors">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-in-out;
        }
        @keyframes success {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-success {
          animation: success 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
        <VideoBackground videoUrl={VIDEO_URL} />
        <div className="relative z-20 text-center">
          <Loader2 size={32} className="text-purple-400 animate-spin mx-auto" />
          <p className="text-white/60 mt-4 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
