'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

// ─── Constants ───

const APP_STORE_URL = 'https://apps.apple.com/app/epix-visuals-studios-co/id6478863262';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co';
const PHOTOGRAPHER_PORTAL_URL = 'https://app.epixvisuals.co.ke/login';

// ─── Components ───

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
          className="inline-block"
          style={{
            animation: `fadeInUp 0.6s ease-out forwards`,
            animationDelay: `${delay + i * 0.1}s`,
            opacity: 0,
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
    <div className="grid grid-cols-3 gap-4 mt-16 max-w-3xl mx-auto">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="text-center py-6 border border-zinc-800/50 rounded-2xl bg-zinc-900/30"
          style={{ animationDelay: `${index * 0.2}s` }}
        >
          <div className="text-3xl md:text-4xl font-bold text-gold-text">
            {stat.value}
          </div>
          <div className="text-zinc-400 text-sm mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'py-3 bg-background/70 backdrop-blur-xl border-b border-border'
          : 'py-5'
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="text-2xl font-black tracking-tight">
          <span className="text-gold">EP</span>IX VISUALS
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="#features"
            className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
          >
            How It Works
          </Link>
          <Link
            href="#testimonials"
            className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
          >
            Reviews
          </Link>
          <Link
            href="#contact"
            className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block"
          >
            Contact
          </Link>
          <Link href={PHOTOGRAPHER_PORTAL_URL}>
            <button className="text-sm font-medium text-zinc-200 hover:text-white transition-colors hidden sm:block">
              Photographer Login
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  const handleDownload = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      window.open(PLAY_STORE_URL, '_blank');
    } else {
      window.open(APP_STORE_URL, '_blank');
    }
  };

  const handleViewDemo = () => {
    const el = document.getElementById('showcase');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
    >
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1531637527419-3a0a2d5f8732?q=80&w=2100&auto=format&fit=crop"
          alt="Professional Photography"
          className="w-full h-full object-cover animate-subtleZoom"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/70" />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-br from-gold/15 via-gold/5 to-transparent blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-20 right-20 w-[300px] h-[300px] bg-gradient-to-br from-gold/20 to-transparent blur-[100px] rounded-full" />
      </div>

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full mb-8 bg-white/5 border border-white/10">
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-sm font-medium text-zinc-200">
              Professional Photography Portal
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold mb-6 leading-tight">
            <AnimatedText
              text="Unlock Your Memories"
              className="justify-center text-white"
              delay={0.4}
            />
            <span
              className="block text-gold-text mt-2"
              style={{ animation: 'fadeInUp 0.8s ease-out 1s forwards', opacity: 0 }}
            >
              One Click at a Time
            </span>
          </h1>

          <p
            className="text-lg md:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.8s forwards', opacity: 0 }}
          >
            Secure, personalized photography experience with instant access to
            your beautiful moments
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            style={{ animation: 'fadeInUp 0.8s ease-out 1s forwards', opacity: 0 }}
          >
            <button
              onClick={handleDownload}
              className="group relative overflow-hidden py-4 px-8 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
              }}
            >
              <Smartphone className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Download the App</span>
              <ArrowRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>

            <button
              onClick={handleViewDemo}
              className="py-4 px-8 rounded-xl font-bold text-lg text-zinc-200 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-600"
            >
              <Play className="w-5 h-5" />
              <span>Watch Demo</span>
            </button>
          </div>

          <StatsSection />
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2"
        style={{ animationDelay: '2s' }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-zinc-600 flex justify-center pt-2 animate-bounce">
          <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: <Camera className="w-6 h-6 text-gold" />,
      title: 'Private Galleries',
      description: 'Access your photos in beautifully presented, password-protected galleries.',
    },
    {
      icon: <Smartphone className="w-6 h-6 text-gold" />,
      title: 'Mobile First',
      description: 'Everything optimized for your phone — browse, share, and order on the go.',
    },
    {
      icon: <Lock className="w-6 h-6 text-gold" />,
      title: 'Secure Access',
      description: 'Your privacy matters. Every gallery is encrypted and access-controlled.',
    },
    {
      icon: <Zap className="w-6 h-6 text-gold" />,
      title: 'Instant Delivery',
      description: 'Photos uploaded by your photographer appear instantly in your gallery.',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-gold" />,
      title: 'Order Prints',
      description: 'Select favorites and order professional prints delivered to your door.',
    },
    {
      icon: <Music className="w-6 h-6 text-gold" />,
      title: 'Slideshow Mode',
      description: 'View your memories with music and transitions in full-screen slideshows.',
    },
  ];

  return (
    <section
      id="features"
      className="relative py-32 border-t border-zinc-800"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-gold bg-gold/10 border border-gold/20 mb-6">
            <Camera size={12} />
            Features
          </div>
          <h2 className="text-4xl sm:text-5xl font-black mb-4">
            Everything you need for your <br />
            <span className="text-gold-text">photography experience</span>
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto mt-4">
            Our platform combines security, beauty, and convenience for the
            modern photography experience.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-gold/30 hover:bg-zinc-800/30 transition-all duration-300 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: '1',
      title: 'Get Your Code',
      description:
        'Your photographer shares a unique invite code or link with you.',
    },
    {
      number: '2',
      title: 'Download the App',
      description:
        'Tap the button below to download the Epix Visuals app on your phone.',
    },
    {
      number: '3',
      title: 'Enter Your Code',
      description:
        'Enter your photographer\'s code in the app to access your gallery.',
    },
    {
      number: '4',
      title: 'View & Share',
      description:
        'Browse your photos, share favorites, and order prints.',
    },
  ];

  const handleDownload = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      window.open(PLAY_STORE_URL, '_blank');
    } else {
      window.open(APP_STORE_URL, '_blank');
    }
  };

  return (
    <section
      id="how-it-works"
      className="relative py-32 border-t border-zinc-800 bg-zinc-900/20"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-gold bg-gold/10 border border-gold/20 mb-6">
            <Check size={12} />
            How It Works
          </div>
          <h2 className="text-4xl sm:text-5xl font-black mb-4">
            Simple 3-step process <br />
            <span className="text-gold-text">to access your photos</span>
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex gap-4 p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/50"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
                  <span className="text-2xl font-black text-gold">{step.number}</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={handleDownload}
              className="group relative overflow-hidden py-4 px-10 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 mx-auto"
              style={{
                background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
              }}
            >
              <Smartphone className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Download Epix Visuals App</span>
            </button>
            <p className="text-xs text-zinc-500 mt-3">
              Available on iOS and Android
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Sarah Wanjiru',
      role: 'Mother of 2',
      text: 'I can finally see all my daughter\'s first-year photos in one beautiful place. The app is so easy to use!',
      rating: 5,
    },
    {
      name: 'James Ochieng',
      role: 'Wedding Client',
      text: 'The gallery was ready within hours after our event. I could easily share photos with family right away.',
      rating: 5,
    },
    {
      name: 'Amina Hassan',
      role: 'Birthday Mom',
      text: 'Ordering prints was simple and they arrived beautifully packaged. Will definitely use again!',
      rating: 5,
    },
  ];

  return (
    <section
      id="testimonials"
      className="relative py-32 border-t border-zinc-800"
    >
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-gold bg-gold/10 border border-gold/20 mb-6">
            <Star size={12} className="fill-current" />
            Testimonials
          </div>
          <h2 className="text-4xl sm:text-5xl font-black mb-4">
            What our clients say <br />
            <span className="text-gold-text">about us</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/50"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className="text-gold fill-current"
                  />
                ))}
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                "{testimonial.text}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-gold font-bold">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm">{testimonial.name}</div>
                  <div className="text-xs text-zinc-500">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  return (
    <section
      id="contact"
      className="relative py-20 border-t border-zinc-800"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            Have questions? Get in touch.
          </h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
            We're here to help. Contact us for support, partnership
            inquiries, or to request a demo.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:epixshots002@gmail.com"
              className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-zinc-800/50 border border-zinc-700 hover:border-gold/50 transition-all text-sm font-medium"
            >
              <Mail size={16} className="text-gold" />
              <span>epixshots002@gmail.com</span>
            </a>
            <a
              href="https://wa.me/254712345678"
              className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-zinc-800/50 border border-zinc-700 hover:border-gold/50 transition-all text-sm font-medium"
            >
              <Smartphone size={16} className="text-gold" />
              <span>WhatsApp Us</span>
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
            <p className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} Epix Visuals. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/254712345678"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D36F] text-white shadow-lg hover:scale-110 transition-transform group"
      aria-label="Chat on WhatsApp"
    >
      <Smartphone className="w-7 h-7 group-hover:scale-110 transition-transform" />
    </a>
  );
}

// ─── Page ───

export default function HomePage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <ContactSection />
      <WhatsAppFloat />
    </>
  );
}
