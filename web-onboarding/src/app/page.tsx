'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { LiquidButton } from '@/components/ui/liquid-glass-button';

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
  { icon: '🔒', title: 'Private Galleries', desc: 'Every client gets a unique access code. No leaks, no sharing — total control over who sees what.' },
  { icon: '💳', title: 'M-Pesa Payments', desc: 'Accept Paybill or Till payments instantly. Clients unlock galleries the moment they pay.' },
  { icon: '📱', title: 'Mobile-First', desc: 'Manage everything from your phone. Upload, share, and track — all from the admin app.' },
  { icon: '⚡', title: 'Instant Sharing', desc: 'Share access codes via WhatsApp, SMS, or QR. Clients unlock galleries in seconds.' },
  { icon: '📊', title: 'Smart Analytics', desc: 'Track views, downloads, and engagement. Know exactly which galleries perform best.' },
  { icon: '🎵', title: 'Behind the Scenes', desc: 'Share BTS content, announcements, and portfolio pieces to keep clients engaged.' },
];

const steps = [
  { num: '01', title: 'Sign Up', desc: 'Create your account in 60 seconds. Start with a free trial or pay via M-Pesa.' },
  { num: '02', title: 'Upload Galleries', desc: 'Use the admin app or web dashboard to upload and organize client photos.' },
  { num: '03', title: 'Share Access', desc: 'Send a unique access code or link. Clients download the app and view their gallery.' },
];

const testimonials = [
  { name: 'Faith Wanjiru', role: 'Wedding Photographer', text: 'Epix Visuals transformed my business. Clients love the gallery experience, and I love getting paid instantly via M-Pesa.', rating: 5 },
  { name: 'Brian Ochieng', role: 'Portrait Studio', text: 'Finally, a platform built for Kenyan photographers. The M-Pesa integration alone saves me hours every week.', rating: 5 },
  { name: 'Grace Muthoni', role: 'Event Photographer', text: 'My clients think the galleries are so professional. The access code system means zero leaks — every photo stays private.', rating: 5 },
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
    <main className="min-h-screen bg-background text-white overflow-hidden">
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
              <span style={{ color: '#D4AF37' }}>Epix</span>
              <span className="text-white"> Visuals</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm text-gray-400 hover:text-white transition-colors">Reviews</a>
              <Link
                href="/signup"
                className="hidden md:inline-flex px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}
              >
                Get Started
              </Link>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/5" style={{ background: 'rgba(8,8,16,0.98)' }}>
            <div className="px-4 py-6 space-y-4">
              <a href="#features" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
              <a href="#pricing" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#testimonials" className="block text-gray-400 hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
              <Link
                href="/signup"
                className="block text-center px-6 py-3 rounded-xl font-bold transition-all"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute w-[600px] h-[600px] rounded-full opacity-10 blur-[120px]"
            style={{
              background: 'radial-gradient(circle, #D4AF37, transparent)',
              top: '-200px',
              right: '-100px',
              animation: 'float 8s ease-in-out infinite',
            }}
          />
          <div
            className="absolute w-[400px] h-[400px] rounded-full opacity-5 blur-[100px]"
            style={{
              background: 'radial-gradient(circle, #D4AF37, transparent)',
              bottom: '-100px',
              left: '-50px',
              animation: 'float 10s ease-in-out infinite reverse',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm"
            style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.2)',
              color: '#D4AF37',
              animation: 'fadeUp 0.8s ease-out',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Built for Kenyan photographers
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[0.9] tracking-tight mb-6"
            style={{ animation: 'fadeUp 0.8s ease-out 0.1s both' }}
          >
            <span className="text-white">Your galleries.</span>
            <br />
            <span
              className="inline-block"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #F0D060)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Your brand.
            </span>
            <br />
            <span className="text-white">Your rules.</span>
          </h1>

          <p
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ animation: 'fadeUp 0.8s ease-out 0.2s both' }}
          >
            Private galleries, M-Pesa payments, and client management — all from your phone. The all-in-one platform for professional photographers.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            style={{ animation: 'fadeUp 0.8s ease-out 0.3s both' }}
          >
            <Link href="/signup" className="w-full sm:w-auto">
              <LiquidButton size="xl" className="w-full">Start Free Trial →</LiquidButton>
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-lg border border-white/10 text-white hover:border-white/20 transition-all text-center"
            >
              Sign In
            </Link>
          </div>

          <div
            className="grid grid-cols-3 gap-8 max-w-lg mx-auto"
            style={{ animation: 'fadeUp 0.8s ease-out 0.4s both' }}
          >
            {[
              { value: 500, suffix: '+', label: 'Photographers' },
              { value: 15000, suffix: '+', label: 'Galleries Shared' },
              { value: 99, suffix: '%', label: 'Uptime' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-black" style={{ color: '#D4AF37' }}>
                  <CountUp target={stat.value} />{stat.suffix}
                </div>
                <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-gold/60 animate-pulse" />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              How It Works
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Three steps to
              <br />
              <span style={{ color: '#D4AF37' }}>professional galleries</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.num} className="text-center relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px" style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.3), rgba(212,175,55,0.05))' }} />
                )}
                <div
                  className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center text-2xl font-black"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
                    border: '1px solid rgba(212,175,55,0.2)',
                    color: '#D4AF37',
                  }}
                >
                  {s.num}
                </div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              Features
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Everything you need to
              <br />
              <span style={{ color: '#D4AF37' }}>run your studio</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Stop juggling spreadsheets, WhatsApp, and M-Pesa confirmations. One platform does it all.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group relative p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.05), transparent)' }}
                />
                <div className="relative z-10">
                  <div className="text-4xl mb-5">{f.icon}</div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/[0.02] to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              Pricing
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Simple, honest
              <br />
              <span style={{ color: '#D4AF37' }}>pricing</span>
            </h2>
            <p className="text-gray-400">One plan. No hidden fees. Cancel anytime.</p>
          </div>

          <div className="max-w-md mx-auto">
            <div
              className="relative rounded-3xl p-8 sm:p-10"
              style={{
                background: 'rgba(212,175,55,0.04)',
                border: '2px solid rgba(212,175,55,0.3)',
                boxShadow: '0 0 80px rgba(212,175,55,0.08)',
              }}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                style={{ background: '#D4AF37', color: '#080810' }}>
                MOST POPULAR
              </div>

              <div className="text-center mb-8">
                <h3 className="text-2xl font-black mb-2">Photographer Pro</h3>
                <p className="text-gray-400 text-sm">Everything you need, one price</p>
              </div>

              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-black" style={{ color: '#D4AF37' }}>
                    {price !== null ? `${currency} ${price}` : '...'}
                  </span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-10">
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
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(212,175,55,0.15)' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-gray-300 text-sm">{item}</span>
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
            <span
              className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase mb-6"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              Testimonials
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Loved by photographers
              <br />
              <span style={{ color: '#D4AF37' }}>across Kenya</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <svg key={j} width="16" height="16" viewBox="0 0 16 16" fill="#D4AF37">
                      <path d="M8 1l2.2 4.5L15 6.3l-3.5 3.4.8 4.8L8 12.2 3.7 14.5l.8-4.8L1 6.3l4.8-.8L8 1z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
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
          <div
            className="rounded-3xl p-12 sm:p-16"
            style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))',
              border: '1px solid rgba(212,175,55,0.2)',
            }}
          >
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Ready to transform
              <br />
              <span style={{ color: '#D4AF37' }}>your photography business?</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto mb-10">
              Join hundreds of Kenyan photographers who trust Epix Visuals to power their studios.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <LiquidButton size="xl" className="w-full">Start Free Trial →</LiquidButton>
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-lg border border-white/10 text-white hover:border-white/20 transition-all text-center"
              >
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
              <span style={{ color: '#D4AF37' }}>Epix</span>
              <span className="text-white"> Visuals</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-500 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-gray-500 hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm text-gray-500 hover:text-white transition-colors">Reviews</a>
              <a href="mailto:epixshots002@gmail.com" className="text-sm text-gray-500 hover:text-white transition-colors">Support</a>
            </div>
            <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} Epix Visuals. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(5deg); }
        }
      `}</style>
    </main>
  );
}
