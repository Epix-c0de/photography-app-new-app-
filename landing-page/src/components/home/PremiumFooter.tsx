'use client';

import { motion } from 'framer-motion';
import { Camera, MessageCircle, Download, ExternalLink } from 'lucide-react';

const PremiumFooter = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Download App', href: '/download' },
    { label: 'Updates', href: '#updates' }
  ];

  return (
    <footer className="relative pt-20 pb-8 overflow-hidden">
      <div className="absolute inset-0 hero-gradient opacity-50" />
      <div className="absolute inset-0 border-t border-border/50" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div>
            <motion.div 
              className="flex items-center gap-2 mb-6"
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-10 h-10 rounded-xl golden-gradient flex items-center justify-center">
                <Camera className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-serif text-xl font-bold">Epix Shots</span>
            </motion.div>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Access your professional photo galleries. View, download, and share your memories in high resolution.
            </p>
            <a
              href="https://whatsapp.com/channel/0029VbCq7w5KGGGKVXjSfm2a"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-500 hover:text-green-400 text-sm font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Join our WhatsApp Channel
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif font-semibold mb-6">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors story-link"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* App Info */}
          <div>
            <h4 className="font-serif font-semibold mb-6">Get the App</h4>
            <p className="text-muted-foreground text-sm mb-4">
              Download Epix Shots to access your photo galleries on the go.
            </p>
            <div className="space-y-3">
              <a
                href="https://play.google.com/store/apps/details?id=app.rork.epix_visuals_studios_co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302L15.393 12l2.305-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z"/>
                </svg>
                Google Play
              </a>
              <a
                href="https://apps.apple.com/app/epix-visuals-studios-co/id6478863262"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                App Store
              </a>
            </div>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-serif font-semibold mb-6">Support</h4>
            <p className="text-muted-foreground text-sm mb-4">
              Need help with the app? Join our WhatsApp channel for support and updates.
            </p>
            <a
              href="https://whatsapp.com/channel/0029VbCq7w5KGGGKVXjSfm2a"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold hover-scale transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Get Support
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/30">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>&copy; {currentYear} Epix Shots. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)'
        }}
      />
    </footer>
  );
};

export default PremiumFooter;
