'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import GlassCard from './GlassCard';
import { Camera, Image, Users, Download, Sparkles, Star } from 'lucide-react';

const services = [
  {
    icon: Camera,
    title: 'Professional Photography',
    description: 'Expert photographers capturing your special moments with precision and artistry',
    color: 'primary'
  },
  {
    icon: Image,
    title: 'Online Gallery Access',
    description: 'View your photos anytime, anywhere through our secure online gallery system',
    color: 'accent'
  },
  {
    icon: Download,
    title: 'Instant Downloads',
    description: 'Download high-resolution photos directly from your gallery to any device',
    color: 'purple'
  },
  {
    icon: Users,
    title: 'Family Sharing',
    description: 'Share your beautiful moments with family and friends through the app',
    color: 'primary'
  },
  {
    icon: Sparkles,
    title: 'Professional Editing',
    description: 'Every photo is expertly retouched and color-graded for flawless results',
    color: 'accent'
  },
  {
    icon: Star,
    title: 'Premium Quality',
    description: 'Gallery-quality prints and albums available to preserve your memories',
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

const ServicesSection = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });  

  return (
    <section id="services" className="relative py-24 overflow-hidden">
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
            What We Offer
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            Our <span className="text-gradient">Services</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Professional photography solutions designed to capture and deliver your most precious moments
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <GlassCard 
                className={`h-full group transition-shadow duration-500 ${getGlowClass(service.color)} hover:scale-105`}
              >
                <motion.div 
                  className={`w-14 h-14 rounded-xl glass-card flex items-center justify-center mb-5 ${getColorClass(service.color)}`}
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <service.icon className="w-7 h-7" />
                </motion.div>

                <h3 className="font-serif text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {service.description}
                </p>

                <motion.div 
                  className="mt-5 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span>Learn more</span>
                  <motion.span
                    className="ml-2"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </motion.div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
