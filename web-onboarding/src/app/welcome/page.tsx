'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Play,
  Sparkles,
  ArrowRight,
  Camera,
  Lock,
  Smartphone,
  Zap,
  BarChart3,
  Music,
  Check,
  Star,
  Shield,
  Mail,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Components (inlined for simplicity) ───

function AnimatedText({
  text,
  className = '',
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(' ');
  return (
    <span className={`inline-flex flex-wrap justify-center gap-2 ${className}`}>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block animate-fade-in opacity-0"
          style={{
 animationDelay: `${delay * 1000 + i * 0.1}s`,
 animationFillMode: 'forwards',
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

function StatsSection() {
  const stats = [
    { value: '500+', label: 'Happy Clients' },
    { value: '10K+', label: 'Photos Delivered' },
    { value: '50+', label: 'Events Covered' },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-8 md:gap-12 mt-20">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="text-center animate-fade-in"
          style={{ animationDelay: `${2 + index * 0.1}s` }}
        >
          <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#F0D060] bg-clip-text text-transparent">
            {stat.value}
          </div>
          <div className="text-zinc-400 text-sm mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function ScrollIndicator() {
  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
      style={{ animationDelay: '2s' }}
    >
      <div className="w-6 h-10 rounded-full border-2 border-zinc-600 flex justify-center pt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function WelcomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'found' | 'not-found'>('idle');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);

  const heroImage =
    'https://images.unsplash.com/photo-1531637527419-3a0a2d5f8732?q=80&w=2100&auto=format&fit=crop';

  async function handleClientLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setEmailStatus('idle');

    try {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('phone_number, temporary_name')
        .ilike('phone_number', `%${email.replace(/^0/, '254')}%`)
        .or(`phone_number.ilike.%${email}%`)
        .limit(1);

      if (error) throw error;

      if (clients && clients.length > 0) {
        setClientName(clients[0].temporary_name || 'there');
        setEmailStatus('found');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        setEmailStatus('not-found');
      }
    } catch (e) {
      setEmailStatus('not-found');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0A0A0E] to-[#0A0A0A] text-white overflow-x-hidden relative">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/70 backdrop-blur-xl border-b border-border">
        <div className="text-2xl font-black tracking-tight">
          <span className="text-[#D4AF37]">EP</span>IX VISUALS
        </div>
        <div className="flex items-center gap-4">
          <Link href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">
            Features
          </Link>
          <Link href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">
            How It Works
          </Link>
          <Link href="#testimonials" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">
            Reviews
          </Link>
          <Link href="/login" className="text-sm font-semibold text-zinc-200 hover:text-white transition-colors hidden sm:block">
            Photographer Login
          </Link>
          <button
            onClick={() => router.push('/login')}
            className="gold-gradient text-black font-bold py-2.5 px-6 rounded-xl text-sm transition-transform hover:scale-105 flex items-center gap-2"
          >
            Sign In
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ─── Particle Background ─── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#D4AF37]/20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                animation: `pulse ${2 + Math.random() * 3}s infinite ease-in-out`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-br from-[#D4AF37]/15 via-[#F0D060]/5 to-transparent blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-20 right-20 w-[300px] h-[300px] bg-gradient-to-br from-[#D4AF37]/20 to-transparent blur-[100px] rounded-full" />

        <div className="container mx-auto px-4 text-center relative z-10 pt-20">
          <div className="max-w-4xl mx-auto">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full mb-8 bg-white/5 border border-white/10 animate-fade-in"
              style={{ animationDelay: '0.2s' }}
            >
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-sm font-medium text-zinc-200">Professional Photography Portal</span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold mb-6 leading-tight">
              <AnimatedText
                text="Unlock Your Memories"
                className="justify-center text-white"
                delay={0.4}
              />
            </h1>

            <p
              className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in"
              style={{ animationDelay: '0.8s' }}
            >
              Secure, personalized photography experience with instant access to your beautiful moments
            </p>

            {/* CTA Buttons */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in"
              style={{ animationDelay: '1s' }}
            >
              <button
                onClick={() => {
                  const el = document.getElementById('client-access');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group relative overflow-hidden py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
                  boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
                }}
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Access Your Gallery</span>
              </button>
              <Link
                href="/login"
                className="py-4 px-8 rounded-xl font-bold text-lg text-zinc-200 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-600"
              >
                <Camera className="w-5 h-5" />
                <span>Photographer Login</span>
              </Link>
            </div>

            <StatsSection />
          </div>
        </div>

        <ScrollIndicator />
      </section>

      {/* ─── Showcase Section ─── */}
      <section className="relative py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 mb-6">
              <Camera size={12} /> Showcase
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Stunning galleries delivered <br />
              <span className="text-[#D4AF37]">in seconds</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              Every gallery is password-protected and beautifully presented on your phone.
            </p>
          </div>

          <div className="relative max-w-6xl mx-auto">
            {/* Phone mockups */}
            <div className="grid md:grid-cols-3 gap-8 items-center">
              <div className="relative mx-auto w-64 h-96 md:mt-12">
                <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/20 via-[#F0D060]/10 to-transparent rounded-[3rem] blur-3xl" />
                <div className="relative w-full h-full rounded-[2.5rem] border-8 border-zinc-800 shadow-2xl overflow-hidden bg-gradient-to-b from-zinc-100 to-white">
                  <div className="w-full h-6 bg-zinc-800" />
                  <div className="p-4">
                    <div className="text-center mb-4">
                      <p className="text-xs text-zinc-400">Welcome back</p>
                      <p className="font-bold text-zinc-900">Kamau Studio</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="rounded-xl p-3 bg-zinc-50 border border-zinc-100">
                        <p className="text-xs text-zinc-400">Galleries</p>
                        <p className="text-xl font-black text-[#D4AF37]">24</p>
                      </div>
                      <div className="rounded-xl p-3 bg-zinc-50 border border-zinc-100">
                        <p className="text-xs text-zinc-400">Clients</p>
                        <p className="text-xl font-black text-zinc-900">156</p>
                      </div>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-zinc-100">
                      <div className="h-24 bg-gradient-to-br from-amber-50 via-amber-100/50 to-white flex items-center justify-center">
                        <Camera className="w-6 h-6 text-[#D4AF37]/50" />
                      </div>
                      <div className="p-3 bg-white">
                        <p className="text-xs font-bold text-zinc-900">Wanjiru Wedding</p>
                        <p className="text-[10px] text-zinc-400">48 photos • Delivered</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Client Access Form ─── */}
      <section
        id="client-access"
        className="relative py-32 border-t border-zinc-800 bg-zinc-900/30"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/20 mb-6">
                <Lock size={12} /> Client Portal
              </span>
              <h2 className="text-4xl sm:text-5xl font-black mb-4 text-center">
                Access your gallery
              </h2>
              <p className="text-zinc-400 text-center max-w-xl mx-auto">
                Enter your phone number or email to check if your gallery is ready.
              </p>
            </div>

            <form onSubmit={handleClientLogin} className="space-y-4">
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4AF37]"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailStatus('idle');
                    if (e.target.value.length > 3) setClientName('');
                  }}
                  placeholder="Enter your phone number or email..."
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
                  required
                />
              </div>

              {emailStatus === 'found' && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 mb-1">
                    <Check className="w-4 h-4" />
                    <span className="font-semibold">Account found!</span>
                  </div>
                  <p className="text-sm text-zinc-300">
                    Hello <span className="text-[#D4AF37] font-semibold">{clientName}</span>. Redirecting to login...
                  </p>
                </div>
              )}

              {emailStatus === 'not-found' && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                  <div className="flex items-center justify-center gap-2 text-red-400 mb-1">
                    <AlertCircle size={16} />
                    <span className="font-semibold">No gallery found</span>
                  </div>
                  <p className="text-sm text-zinc-300">
                    No account found with this phone number. Contact your photographer to request a gallery.
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative border-t border-zinc-800 py-12 bg-zinc-900/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-2xl font-black">
              <span className="text-[#D4AF37]">EP</span>IX VISUALS
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="mailto:epixshots002@gmail.com" className="hover:text-white transition-colors">Support</a>
              <a href="https://wa.me/254712345678" className="hover:text-white transition-colors">WhatsApp</a>
            </div>
            <p className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} Epix Visuals. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
