'use client';

import { useState, useEffect } from 'react';
import { Menu, X, Camera, LogIn, Sparkles, Zap, Download } from 'lucide-react';

const PHOTOGRAPHER_PORTAL = 'https://app.epixvisuals.co.ke/login';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigationItems = [
    { name: 'Home', href: '#home' },
    { name: 'Showcase', href: '#showcase' },
    { name: 'Services', href: '#services' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled
          ? 'bg-white/90 border-b border-primary/15 backdrop-blur-2xl shadow-lg shadow-black/5'
          : 'bg-transparent'
      }`}
    >
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-40" />

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="relative">
              <Camera className="relative h-10 w-10 text-primary transition-all duration-500 group-hover:scale-125 group-hover:rotate-12" />
              <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary animate-pulse opacity-0 group-hover:opacity-100 transition-all duration-500" />
            </div>
            <div className="relative">
              <span className="text-2xl font-serif font-bold text-gold-text">
                Epix Shots
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            {navigationItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="relative group py-3 px-6 transition-all duration-500 text-foreground/70 font-semibold text-lg hover:text-primary"
              >
                <span className="relative z-10 font-bold tracking-wide">{item.name}</span>
                <div className="absolute bottom-0 left-1/2 w-0 h-[3px] bg-gradient-to-r from-primary to-primary-glow group-hover:w-full group-hover:left-0 transition-all duration-500 rounded-full" />
              </a>
            ))}
          </div>

          {/* Auth Section */}
          <div className="hidden lg:flex items-center space-x-4">
            <a href="/download">
              <button className="flex items-center gap-2 px-6 py-3 rounded-xl golden-gradient text-primary-foreground transition-all duration-500 hover:shadow-lg hover:shadow-primary/20 font-semibold">
                <Download className="h-4 w-4 transition-transform duration-500" />
                Download App
              </button>
            </a>
            <a href={PHOTOGRAPHER_PORTAL}>
              <button className="flex items-center gap-2 px-6 py-3 rounded-xl text-foreground border border-primary/30 hover:border-primary/60 transition-all duration-500 hover:shadow-lg hover:shadow-primary/10 font-semibold">
                <LogIn className="h-4 w-4 transition-transform duration-500" />
                Login
              </button>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-3 rounded-xl border border-primary/30 hover:border-primary/60 transition-all duration-500"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6 text-foreground" /> : <Menu className="h-6 w-6 text-foreground" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden pb-6 animate-fade-in">
            <div className="flex flex-col space-y-3 mt-4 p-6 rounded-2xl bg-white/95 border border-primary/20 backdrop-blur-2xl shadow-xl">
              {navigationItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-foreground font-semibold text-lg hover:text-primary transition-all duration-500 py-3 px-4 rounded-xl hover:bg-primary/5 border border-transparent hover:border-primary/15"
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="pt-6 border-t border-primary/15">
                <a href="/download" className="block mb-3">
                  <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl golden-gradient text-primary-foreground transition-all duration-500 font-semibold">
                    <Download className="h-4 w-4" />
                    Download App
                  </button>
                </a>
                <a href={PHOTOGRAPHER_PORTAL}>
                  <button className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-primary/30 hover:border-primary/60 transition-all duration-500 font-semibold text-foreground">
                    <LogIn className="h-4 w-4" />
                    Login
                  </button>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
