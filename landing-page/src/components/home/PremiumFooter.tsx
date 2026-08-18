'use client';

import { motion } from 'framer-motion';
import { Camera, AtSign, Globe, Share2, Mail, Phone, MapPin } from 'lucide-react';

const PremiumFooter = () => {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    { icon: AtSign, href: 'https://instagram.com/epixshots_ke', label: 'Instagram' },
    { icon: Globe, href: '#', label: 'Twitter' },
    { icon: Share2, href: '#', label: 'Facebook' }
  ];

  const quickLinks = [
    { label: 'Services', href: '#services' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Download App', href: '/download' },
    { label: 'Contact', href: '#contact' }
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
              Professional photography services delivering timeless memories with modern convenience.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full glass-card flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
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

          {/* Contact */}
          <div>
            <h4 className="font-serif font-semibold mb-6">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm">info@epixshots.co.ke</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm">+254 717 894 431</span>
              </li>
              <li className="flex items-start gap-3 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary mt-0.5" />
                <span className="text-sm">Nairobi, Kenya</span>
              </li>
            </ul>
          </div>

          {/* Download CTA */}
          <div>
            <h4 className="font-serif font-semibold mb-6">Get the App</h4>
            <p className="text-muted-foreground text-sm mb-4">
              Download the Epix Shots app to access your photo galleries on the go.
            </p>
            <a
              href="/download"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg golden-gradient text-white font-semibold hover-scale shadow-golden transition-all"
            >
              Download Now
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/30">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© {currentYear} Epix Shots. All rights reserved.</p>
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
