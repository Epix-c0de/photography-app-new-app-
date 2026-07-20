'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import {
  Lock,
  CreditCard,
  Smartphone,
  Zap,
  BarChart3,
  Music,
  Check,
  Star,
  ArrowRight,
  Camera,
  Shield,
  Globe,
} from 'lucide-react';

function CountUp({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const start = Date.now();
          const tick = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, hasAnimated]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

const features = [
  { icon: Lock, title: 'Private Galleries', desc: 'Every client gets a unique access code. No leaks, no sharing — total control over who sees what.' },
  { icon: CreditCard, title: 'M-Pesa Payments', desc: 'Accept Paybill or Till payments instantly. Clients unlock galleries the moment they pay.' },
  { icon: Smartphone, title: 'Mobile-First', desc: 'Manage everything from your phone. Upload, share, and track — all from the admin app.' },
  { icon: Zap, title: 'Instant Sharing', desc: 'Share access codes via WhatsApp, SMS, or QR. Clients unlock galleries in seconds.' },
  { icon: BarChart3, title: 'Smart Analytics', desc: 'Track views, downloads, and engagement. Know exactly which galleries perform best.' },
  { icon: Music, title: 'Behind the Scenes', desc: 'Share BTS content, announcements, and portfolio pieces to keep clients engaged.' },
];

const steps = [
  { num: '01', title: 'Sign Up', desc: 'Create your account in 60 seconds. Start with a free trial or pay via M-Pesa.', badge: 'Free Trial' },
  { num: '02', title: 'Upload Galleries', desc: 'Use the admin app or web dashboard to upload and organize client photos.', badge: 'Drag & Drop' },
  { num: '03', title: 'Share Access', desc: 'Send a unique access code or link. Clients download the app and view their gallery.', badge: 'One-Tap Share' },
];

const testimonials = [
  { name: 'Faith Wanjiru', handle: '@faith_portraits', role: 'Wedding Photographer', text: 'Epix Visuals transformed my business. Clients love the gallery experience, and I love getting paid instantly via M-Pesa.', rating: 5, verified: true },
  { name: 'Brian Ochieng', handle: '@brian.studio', role: 'Portrait Studio', text: 'Finally, a platform built for Kenyan photographers. The M-Pesa integration alone saves me hours every week.', rating: 5, verified: true },
  { name: 'Grace Muthoni', handle: '@grace.captures', role: 'Event Photographer', text: 'My clients think the galleries are so professional. The access code system means zero leaks — every photo stays private.', rating: 5, verified: true },
];

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('KES');

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['platform_admin_subscription_price', 'platform_admin_subscription_currency'])
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((r: any) => { map[r.key] = r.value || ''; });
          if (map['platform_admin_subscription_price']) setPrice(parseInt(map['platform_admin_subscription_price']));
          if (map['platform_admin_subscription_currency']) setCurrency(map['platform_admin_subscription_currency']);
        }
      });
  }, []);

  const navBg = scrollY > 50 ? 'rgba(8,8,16,0.95)' : 'transparent';

  return (
    <main className="min-h-screen bg-[#080810] text-zinc-100 overflow-hidden">
      {/* Navigation */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: navBg,
          backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
          borderBottom: scrollY > 50 ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <Link href="/" className="text-2xl font-black tracking-tight">
              <span className="text-[#D4AF37]">Epix</span>
              <span className="text-white"> Visuals</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm text-zinc-400 hover:text-white transition-colors">Reviews</a>
              <Link href="/signup" className="inline-flex">
                <LiquidButton size="sm">Get Started</LiquidButton>
              </Link>
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-zinc-400 hover:text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5" style={{ background: 'rgba(8,8,16,0.98)' }}>
            <div className="px-4 py-6 space-y-4">
              <a href="#features" className="block text-zinc-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="block text-zinc-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <a href="#pricing" className="block text-zinc-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#testimonials" className="block text-zinc-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
              <Link href="/signup" className="block text-center" onClick={() => setMobileMenuOpen(false)}>
                <LiquidButton className="w-full">Get Started</LiquidButton>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[#D4AF37]/8 blur-[150px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-600/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div className="text-center lg:text-left">
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm"
                style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', color: '#D4AF37', animation: 'fadeUp 0.8s ease-out' }}
              >
                <Camera size={14} />
                Built for Kenyan photographers
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[0.9] tracking-tight mb-6" style={{ animation: 'fadeUp 0.8s ease-out 0.1s both' }}>
                <span className="text-white">Your galleries.</span>
                <br />
                <span className="inline-block" style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Your brand.
                </span>
                <br />
                <span className="text-white">Your rules.</span>
              </h1>

              <p className="text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed" style={{ animation: 'fadeUp 0.8s ease-out 0.2s both' }}>
                Private galleries, M-Pesa payments, and client management — all from your phone. The all-in-one platform for professional photographers.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 mb-12" style={{ animation: 'fadeUp 0.8s ease-out 0.3s both' }}>
                <Link href="/signup" className="w-full sm:w-auto">
                  <LiquidButton size="xl" className="w-full">Start Free Trial →</LiquidButton>
                </Link>
                <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-lg border border-white/10 text-white hover:border-white/20 transition-all text-center">
                  Sign In
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0" style={{ animation: 'fadeUp 0.8s ease-out 0.4s both' }}>
                {[
                  { value: 500, suffix: '+', label: 'Photographers' },
                  { value: 15000, suffix: '+', label: 'Galleries Shared' },
                  { value: 99, suffix: '%', label: 'Uptime' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center lg:text-left">
                    <div className="text-2xl sm:text-3xl font-black text-[#D4AF37]">
                      <CountUp target={stat.value} />{stat.suffix}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Phone Mockup */}
            <div className="hidden lg:flex justify-center" style={{ animation: 'fadeUp 0.8s ease-out 0.3s both' }}>
              <div className="relative">
                {/* Glow behind phone */}
                <div className="absolute inset-0 bg-[#D4AF37]/10 blur-[80px] rounded-full scale-110" />
                {/* Phone frame */}
                <div className="relative w-[280px] h-[560px] rounded-[3rem] border-2 border-white/10 bg-[#0A0A0E] p-3 shadow-2xl shadow-black/50">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#0A0A0E] rounded-b-2xl z-10" />
                  {/* Screen content */}
                  <div className="w-full h-full rounded-[2.2rem] overflow-hidden bg-gradient-to-b from-[#111118] to-[#0A0A0E] p-4 pt-8">
                    {/* Status bar */}
                    <div className="flex items-center justify-between mb-6 px-1">
                      <span className="text-[10px] text-zinc-500">9:41</span>
                      <div className="flex gap-1">
                        <div className="w-3 h-2 rounded-sm bg-zinc-600" />
                        <div className="w-1 h-2 rounded-sm bg-zinc-600" />
                      </div>
                    </div>
                    {/* App header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[10px] text-zinc-500">Welcome back</p>
                        <p className="text-sm font-bold text-white">Kamau Studio</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F0D060] flex items-center justify-center text-[10px] font-bold text-[#080810]">K</div>
                    </div>
                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="rounded-xl p-3 bg-white/5 border border-white/5">
                        <p className="text-[10px] text-zinc-500">Galleries</p>
                        <p className="text-lg font-black text-[#D4AF37]">24</p>
                      </div>
                      <div className="rounded-xl p-3 bg-white/5 border border-white/5">
                        <p className="text-[10px] text-zinc-500">Clients</p>
                        <p className="text-lg font-black text-white">156</p>
                      </div>
                    </div>
                    {/* Gallery preview */}
                    <div className="rounded-xl overflow-hidden border border-white/5">
                      <div className="h-32 bg-gradient-to-br from-amber-900/30 via-amber-800/20 to-transparent flex items-center justify-center">
                        <Camera size={24} className="text-[#D4AF37]/40" />
                      </div>
                      <div className="p-3 bg-white/[0.02]">
                        <p className="text-xs font-bold text-white">Wanjiru Wedding</p>
                        <p className="text-[10px] text-zinc-500">48 photos • Delivered</p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Floating elements */}
                <div className="absolute -right-4 top-20 w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
                  <CreditCard size={20} className="text-[#D4AF37]" />
                </div>
                <div className="absolute -left-4 bottom-32 w-14 h-14 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                  <Lock size={16} className="text-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-[#D4AF37]/60 animate-pulse" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Zap size={12} /> How It Works
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Three steps to<br />
              <span className="text-[#D4AF37]">professional galleries</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.num} className="text-center relative group">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#D4AF37]/30 to-transparent" />
                )}
                <div className="rounded-2xl p-6 transition-all duration-300 group-hover:border-[#D4AF37]/40 group-hover:bg-white/[0.03]" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-xl font-black bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/20 text-[#D4AF37]">
                    {s.num}
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-white">{s.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-3">{s.desc}</p>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                    {s.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Shield size={12} /> Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Everything you need to<br />
              <span className="text-[#D4AF37]">run your studio</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Stop juggling spreadsheets, WhatsApp, and M-Pesa confirmations. One platform does it all.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl p-7 transition-all duration-300 hover:border-[#D4AF37]/40 hover:bg-white/[0.03] hover:-translate-y-1"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-12 h-12 rounded-xl mb-5 flex items-center justify-center bg-gradient-to-br from-[#D4AF37]/15 to-[#D4AF37]/5 border border-[#D4AF37]/15 group-hover:border-[#D4AF37]/30 transition-colors">
                    <Icon size={22} className="text-[#D4AF37]" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-white">{f.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#D4AF37]/[0.02] to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Globe size={12} /> Pricing
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Simple, honest<br />
              <span className="text-[#D4AF37]">pricing</span>
            </h2>
            <p className="text-zinc-400">One plan. No hidden fees. Cancel anytime.</p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative rounded-3xl p-8 sm:p-10 transition-all duration-300 hover:border-[#D4AF37]/50" style={{ background: 'rgba(212,175,55,0.04)', border: '2px solid rgba(212,175,55,0.3)', boxShadow: '0 0 80px rgba(212,175,55,0.08)' }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold bg-[#D4AF37] text-[#080810]">
                MOST POPULAR
              </div>

              <div className="text-center mb-8">
                <h3 className="text-2xl font-black mb-2 text-white">Photographer Pro</h3>
                <p className="text-zinc-400 text-sm">Everything you need, one price</p>
              </div>

              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-black text-[#D4AF37]">
                    {price !== null ? `${currency} ${price.toLocaleString()}` : '...'}
                  </span>
                  <span className="text-zinc-400">/month</span>
                </div>
              </div>

              <ul className="space-y-3.5 mb-10">
                {[
                  'Unlimited client galleries',
                  'M-Pesa payment integration',
                  'Access code protection',
                  'Behind-the-scenes sharing',
                  'Client messaging',
                  'Mobile admin app',
                  'Priority support',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-[#D4AF37]/15">
                      <Check size={12} className="text-[#D4AF37]" strokeWidth={3} />
                    </div>
                    <span className="text-zinc-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="block w-full">
                <LiquidButton size="xl" className="w-full">Get Started →</LiquidButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Star size={12} /> Testimonials
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Loved by photographers<br />
              <span className="text-[#D4AF37]">across Kenya</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="p-7 rounded-2xl transition-all duration-300 hover:border-[#D4AF37]/40 hover:bg-white/[0.03]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={14} className="text-[#D4AF37]" fill="#D4AF37" />
                  ))}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-gradient-to-br from-[#D4AF37] to-[#F0D060] text-[#080810]">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      {t.verified && (
                        <div className="w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center">
                          <Check size={10} className="text-[#080810]" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">{t.handle} • {t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl p-12 sm:p-16" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))', border: '1px solid rgba(212,175,55,0.2)' }}>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Ready to transform<br />
              <span className="text-[#D4AF37]">your photography business?</span>
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
              Join hundreds of Kenyan photographers who trust Epix Visuals to power their studios.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <LiquidButton size="xl" className="w-full">Start Free Trial →</LiquidButton>
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-lg border border-white/10 text-white hover:border-white/20 transition-all text-center">
                Sign In to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-xl font-black">
              <span className="text-[#D4AF37]">Epix</span>
              <span className="text-white"> Visuals</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-zinc-500 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm text-zinc-500 hover:text-white transition-colors">Reviews</a>
              <a href="mailto:epixshots002@gmail.com" className="text-sm text-zinc-500 hover:text-white transition-colors">Support</a>
            </div>
            <p className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} Epix Visuals. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
