'use client';

import Link from 'next/link';

const features = [
  {
    icon: '📸',
    title: 'Gallery Delivery',
    desc: 'Upload and deliver high-res photos to clients with watermark protection and access codes.',
  },
  {
    icon: '💳',
    title: 'M-Pesa Payments',
    desc: 'Clients pay directly via M-Pesa STK push. Galleries unlock automatically on payment.',
  },
  {
    icon: '💬',
    title: 'Client Chat',
    desc: 'Built-in messaging between you and each client. No WhatsApp needed.',
  },
  {
    icon: '📅',
    title: 'Booking Management',
    desc: 'Manage shoot bookings, confirm sessions, and send reminders via SMS.',
  },
  {
    icon: '🔒',
    title: 'Watermark Protection',
    desc: 'Unpaid galleries show watermarked previews. Clean photos unlock after payment.',
  },
  {
    icon: '📊',
    title: 'Business Analytics',
    desc: 'Track revenue, client activity, gallery views, and conversion rates.',
  },
];

const steps = [
  { num: '01', title: 'Sign up', desc: 'Fill in your studio details and phone number.' },
  { num: '02', title: 'Pay KES 500', desc: 'Complete the M-Pesa payment to activate your account.' },
  { num: '03', title: 'Download the app', desc: 'Get the Epix Visuals admin app and start uploading.' },
  { num: '04', title: 'Share with clients', desc: 'Send access codes. Clients download the free client app.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="text-xl font-black tracking-tight text-gold">Epix Visuals</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="bg-gold text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 text-gold text-sm font-semibold mb-8">
          🇰🇪 Built for Kenyan Photographers
        </div>
        <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
          Deliver photos.<br />
          <span className="text-gold">Get paid instantly.</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          The professional photography platform that handles gallery delivery, M-Pesa payments,
          client communication, and bookings — all in one app.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-gold text-black font-bold text-lg px-8 py-4 rounded-2xl hover:opacity-90 transition-opacity"
          >
            Start for KES 500/month →
          </Link>
          <a
            href="#how-it-works"
            className="border border-white/10 text-white font-semibold text-lg px-8 py-4 rounded-2xl hover:bg-white/5 transition-colors"
          >
            See how it works
          </a>
        </div>
        <p className="text-gray-500 text-sm mt-6">No setup fees. Cancel anytime. First month includes 30-day grace period.</p>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <h2 className="text-3xl font-black text-center mb-4">Everything you need</h2>
        <p className="text-gray-400 text-center mb-14 max-w-xl mx-auto">
          One subscription. Full platform. No extra tools needed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-card border border-white/5 rounded-2xl p-6 hover:border-gold/20 transition-colors"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-black text-center mb-4">How it works</h2>
        <p className="text-gray-400 text-center mb-14">Up and running in under 5 minutes.</p>
        <div className="space-y-6">
          {steps.map((s) => (
            <div key={s.num} className="flex items-start gap-6 bg-card border border-white/5 rounded-2xl p-6">
              <span className="text-4xl font-black text-gold/30 leading-none">{s.num}</span>
              <div>
                <h3 className="text-lg font-bold mb-1">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-black mb-4">Simple pricing</h2>
        <p className="text-gray-400 mb-10">One plan. Everything included.</p>
        <div className="bg-card border border-gold/20 rounded-3xl p-10">
          <p className="text-gold text-sm font-bold uppercase tracking-widest mb-4">Monthly Plan</p>
          <p className="text-7xl font-black mb-2">
            <span className="text-3xl font-bold text-gray-400 align-top mt-4 mr-1">KES</span>
            500
          </p>
          <p className="text-gray-400 mb-8">per month · cancel anytime</p>
          <ul className="text-left space-y-3 mb-10">
            {[
              'Unlimited gallery uploads',
              'Unlimited clients',
              'M-Pesa payment integration',
              'Client chat & messaging',
              'Booking management',
              'SMS notifications',
              'Watermark protection',
              'Business analytics',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm">
                <span className="text-gold">✓</span>
                <span className="text-gray-300">{item}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="block w-full bg-gold text-black font-bold text-lg py-4 rounded-2xl hover:opacity-90 transition-opacity text-center"
          >
            Get started now →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-10 text-center text-gray-500 text-sm">
        <p className="font-bold text-white mb-2">Epix Visuals Studios</p>
        <p>© {new Date().getFullYear()} Epix Visuals Studios. All rights reserved.</p>
        <p className="mt-2">
          <a href="mailto:epixshots002@gmail.com" className="hover:text-gold transition-colors">
            epixshots002@gmail.com
          </a>
        </p>
      </footer>
    </main>
  );
}
