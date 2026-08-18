'use client';

import { ArrowRight, Play, Sparkles, Download } from 'lucide-react';
import AnimatedText from './AnimatedText';
import { useEffect, useState } from 'react';

const PORTFOLIO_URL = '#showcase';

const heroImage = 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=2100&auto=format&fit=crop';

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

  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [apkVersion, setApkVersion] = useState('');

  useEffect(() => {
    fetch('/api/apk/download?type=client')
      .then(r => r.json())
      .then(data => {
        if (data.download_url) {
          setApkUrl(data.download_url);
          setApkVersion(data.version ? `v${data.version}` : '');
        }
      })
      .catch(() => {});
  }, []);

  const handleDownload = () => {
    if (apkUrl) {
      const a = document.createElement('a');
      a.href = apkUrl;
      a.download = 'epix-client.apk';
      a.click();
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
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.95))' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.8), transparent 30%, transparent 70%, rgba(255,255,255,0.8))' }} />
      </div>

      {/* Floating decorative elements */}
      <div className="absolute top-32 left-[10%] w-3 h-3 rounded-full bg-primary/40" style={{ animation: 'floatY 4s ease-in-out infinite' }} />
      <div className="absolute top-1/4 right-[15%] w-4 h-4 rounded-full bg-accent/30" style={{ animation: 'floatY 5s ease-in-out 1s infinite' }} />
      <div className="absolute bottom-1/3 left-[20%]" style={{ animation: 'floatSpin 8s ease-in-out 2s infinite' }}>
        <Sparkles className="w-6 h-6 text-primary/30" />
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
            <span className="text-sm font-medium text-foreground/70">Professional Photography Portal</span>
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
            <AnimatedText text="One Click at a Time" className="justify-center text-foreground/60 text-4xl md:text-5xl lg:text-6xl mt-4" delay={1} />
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
            {apkUrl ? (
              <a href="/download">
                <button className="glass-button text-foreground border-border hover:border-primary/50 text-lg px-8 py-6 flex items-center gap-2 font-bold rounded-xl transition-all duration-300">
                  <Download className="w-5 h-5" />
                  {heroData.secondaryCtaText}
                  {apkVersion && <span className="text-xs text-muted-foreground ml-1">{apkVersion}</span>}
                </button>
              </a>
            ) : (
              <a href="/download">
                <button className="glass-button text-foreground border-border hover:border-primary/50 text-lg px-8 py-6 flex items-center gap-2 font-bold rounded-xl transition-all duration-300">
                  {heroData.secondaryCtaText}
                </button>
              </a>
            )}
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

      </div>
    </section>
  );
}
