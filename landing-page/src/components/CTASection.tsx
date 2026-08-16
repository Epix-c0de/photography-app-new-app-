'use client';

import { ArrowRight, Sparkles } from 'lucide-react';

const BOOK_URL = 'https://app.epixvisuals.co.ke/book';

export default function CTASection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 hero-gradient" />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, hsl(270 50% 60% / 0.1), transparent 60%), radial-gradient(ellipse at 80% 20%, hsl(185 60% 50% / 0.08), transparent 40%)',
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="glass-premium p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute top-8 left-8" style={{ animation: 'spin 20s linear infinite' }}>
              <Sparkles className="w-6 h-6 text-primary/30" />
            </div>
            <div className="absolute bottom-8 right-8" style={{ animation: 'spin 25s linear infinite reverse' }}>
              <Sparkles className="w-8 h-8 text-accent/30" />
            </div>

            <span className="inline-block text-primary text-sm font-medium tracking-widest uppercase mb-4">
              Start Your Journey
            </span>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-6">
              Ready to Capture Your <span className="text-gold-text">Perfect Moments</span>?
            </h2>

            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Book your session today and let us create timeless memories together
            </p>

            <a href={BOOK_URL} target="_blank" rel="noopener noreferrer">
              <button className="golden-gradient hover-scale shadow-golden text-lg px-10 py-6 ripple group flex items-center gap-2 mx-auto font-bold text-primary-foreground rounded-xl transition-all duration-300">
                Book Now
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
