'use client';

import { ArrowRight, Play, Sparkles } from 'lucide-react';
import AnimatedText from './AnimatedText';
import { useEffect, useState } from 'react';

const APP_STORE_URL = 'https://apps.apple.com/app/epix-visuals-studios-co/id6478863262';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co';
const PORTFOLIO_URL = '#showcase';

const heroImage = 'https://images.unsplash.com/photo-1531637527419-3a0a2d5f8732?q=80&w=2100&auto=format&fit=crop';

export default function PremiumHero() {
  const [heroData] = useState({
    headline: 'Unlock Your',
    subheadline: 'Memories',
    primaryCtaText: 'View Portfolio',
    secondaryCtaText: 'Download App',
    stats: [
      { value: '500+', label: 'Happy Clients' },
      { value: '1000+', label: 'Photos Delivered' },
      { value: '50+', label: 'Events Covered' },
    ],
  });

  const handleDownload = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      window.open(PLAY_STORE_URL, '_blank');
    } else {
      window.open(APP_STORE_URL, '_blank');
    }
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image with overlays */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Professional Photography Studio"
          className="w-full h-full object-cover"
          style={{ animation: 'heroZoom 1.5s ease-out forwards' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/70" />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, hsl(270 50% 60% / 0.15), transparent 60%)',
          }}
        />
      </div>

      {/* Floating decorative elements */}
      <div className="absolute top-32 left-[10%] w-3 h-3 rounded-full bg-primary/60" style={{ animation: 'floatY 4s ease-in-out infinite' }} />
      <div className="absolute top-1/4 right-[15%] w-4 h-4 rounded-full bg-accent/50" style={{ animation: 'floatY 5s ease-in-out 1s infinite' }} />
      <div className="absolute bottom-1/3 left-[20%]" style={{ animation: 'floatSpin 8s ease-in-out 2s infinite' }}>
        <Sparkles className="w-6 h-6 text-primary/40" />
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 text-center relative z-10 pt-20">
        <div className="max-w-4xl mx-auto" style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
          {/* Badge */}
          <div
            className="inline-flex items-center glass-card px-5 py-2.5 rounded-full mb-8"
            style={{ animation: 'fadeUp 0.6s ease-out 0.2s forwards', opacity: 0 }}
          >
            <Sparkles className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium text-foreground/90">Professional Photography Portal</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold mb-6 leading-tight">
            <AnimatedText text={heroData.headline} className="justify-center text-foreground" delay={0.4} />
            <span
              className="block text-gold-text mt-2"
              style={{ animation: 'fadeUp 0.8s ease-out 0.8s forwards', opacity: 0 }}
            >
              {heroData.subheadline}
            </span>
            <AnimatedText text="One Click at a Time" className="justify-center text-foreground/80 text-4xl md:text-5xl lg:text-6xl mt-4" delay={1} />
          </h1>

          {/* Subheading */}
          <p
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ animation: 'fadeUp 0.8s ease-out 1.2s forwards', opacity: 0 }}
          >
            Secure, personalized photography experience with instant access to your beautiful moments
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            style={{ animation: 'fadeUp 0.8s ease-out 1.4s forwards', opacity: 0 }}
          >
            <a href={PORTFOLIO_URL}>
              <button className="group relative overflow-hidden golden-gradient hover-scale shadow-golden text-lg px-8 py-6 ripple flex items-center gap-2 font-bold text-primary-foreground rounded-xl transition-all duration-300">
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                {heroData.primaryCtaText}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </a>
            <button
              onClick={handleDownload}
              className="glass-button text-foreground border-border hover:border-primary/50 text-lg px-8 py-6 flex items-center gap-2 font-bold rounded-xl transition-all duration-300"
            >
              {heroData.secondaryCtaText}
            </button>
          </div>

          {/* Stats */}
          <div
            className="flex flex-wrap justify-center gap-8 md:gap-12 mt-20"
            style={{ animation: 'fadeIn 0.8s ease-out 1.6s forwards', opacity: 0 }}
          >
            {heroData.stats.map((stat, index) => (
              <div
                key={stat.label}
                className="text-center"
                style={{ animation: `fadeUp 0.5s ease-out ${1.8 + index * 0.1}s forwards`, opacity: 0 }}
              >
                <div className="text-3xl md:text-4xl font-bold text-gold-text">{stat.value}</div>
                <div className="text-muted-foreground text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        style={{ animation: 'fadeIn 0.5s ease-out 2s forwards', opacity: 0 }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2 animate-bounce">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      </div>
    </section>
  );
}
