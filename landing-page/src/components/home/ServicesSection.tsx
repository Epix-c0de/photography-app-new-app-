'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import GlassCard from './GlassCard';
import { Eye, Download, Share2, Lock, Bell, Smartphone } from 'lucide-react';

const features = [
  {
    icon: Lock,
    title: 'Access Code Unlock',
    description: 'Enter the code from your photographer to instantly unlock your personal photo gallery',
    color: 'primary'
  },
  {
    icon: Eye,
    title: 'HD Gallery View',
    description: 'Browse your photos in stunning high resolution with smooth swiping and zoom',
    color: 'accent'
  },
  {
    icon: Download,
    title: 'Download Photos',
    description: 'Save full-resolution images directly to your phone — no compression, no watermarks',
    color: 'purple'
  },
  {
    icon: Share2,
    title: 'Share Instantly',
    description: 'Share your favorite shots to WhatsApp, Instagram, or any social platform with one tap',
    color: 'primary'
  },
  {
    icon: Bell,
    title: 'Instant Notifications',
    description: 'Get notified the moment your photographer uploads new photos or behind-the-scenes content',
    color: 'accent'
  },
  {
    icon: Smartphone,
    title: 'Works Everywhere',
    description: 'Available on Android and iOS. Access your galleries from any device, anytime',
    color: 'purple'
  }
];

const getColorClass = (color: string) => {
  switch (color) {
    case 'accent': return 'text-accent';
    case 'purple': return 'text-purple';
    default: return 'text-primary';
  }
};

const getGlowClass = (color: string) => {
  switch (color) {
    case 'accent': return 'group-hover:shadow-[0_0_30px_hsl(185_60%_50%/0.3)]';
    case 'purple': return 'group-hover:shadow-[0_0_30px_hsl(270_50%_60%/0.3)]';
    default: return 'group-hover:shadow-[0_0_30px_hsl(43_70%_55%/0.3)]';
  }
};

const FeaturesSection = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });  

  return (
    <section id="features" className="relative py-24 overflow-hidden">
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, hsl(270 50% 60% / 0.05), transparent 50%)'
        }}
      />

      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-medium tracking-widest uppercase mb-4 block">
            App Features
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            Everything You <span className="text-gradient">Need</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The Epix Shots app makes it easy to access, view, and share your professional photos
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <GlassCard 
                className={`h-full group transition-shadow duration-500 ${getGlowClass(feature.color)} hover:scale-105 cursor-pointer`}
              >
                <motion.div 
                  className={`w-14 h-14 rounded-xl glass-card flex items-center justify-center mb-5 ${getColorClass(feature.color)}`}
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <feature.icon className="w-7 h-7" />
                </motion.div>

                <h3 className="font-serif text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
