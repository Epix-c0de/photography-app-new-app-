'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Download } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AuthSuccessPage() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const name = data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || '';
        setUserName(name);
      }
    };
    getSession();
  }, []);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      </div>

      <div className="relative z-20 w-full max-w-md animate-fadeIn">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors text-sm">
          <ArrowRight size={16} className="rotate-180" />
          Back to Home
        </Link>

        <div className="p-8 rounded-2xl backdrop-blur-sm bg-black/50 border border-white/10 text-center">
          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-2 relative group">
              <span className="absolute -inset-1 bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-blue-500/30 blur-xl opacity-75 group-hover:opacity-100 transition-all duration-500"></span>
              <span className="relative inline-block text-3xl font-bold mb-2 text-white">
                Epix Visuals
              </span>
            </h2>
          </div>

          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 mx-auto flex items-center justify-center">
              <CheckCircle size={32} className="text-green-400" />
            </div>

            <div>
              <h3 className="text-white font-bold text-xl mb-2">
                {userName ? `Welcome, ${userName}!` : 'Welcome!'}
              </h3>
              <p className="text-white/60 text-sm">
                You&apos;ve successfully signed in. Download the app to access your photo galleries, view high-resolution images, and share your beautiful moments.
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <a
                href="https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
              >
                <Download size={18} />
                Download on Play Store
              </a>
              <a
                href="https://apps.apple.com/app/epix-visuals-studios-co/id6478863262"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 border border-white/10"
              >
                <Download size={18} />
                Download on App Store
              </a>
            </div>

            <p className="text-white/40 text-xs pt-2">
              You can close this tab and open the app on your phone.
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
      `}</style>
    </div>
  );
}
