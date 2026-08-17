'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import GlassCard from './GlassCard';
import { Camera, Video, Palette, Users, Sparkles, Star } from 'lucide-react';
import { useWebsiteContent } from '../../hooks/useWebsiteContent';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ServicesSection = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });  
  
  const { data: content, isLoading } = useWebsiteContent<any>('services');
  
  const router = useRouter();
  
  const [servicesData, setServicesData] = useState({
    eyebrow: 'What We Offer',
    heading: 'Our Services',
    subheading: 'Comprehensive photography solutions tailored to capture your most precious moments',
    items: [
      {
        icon: 'Camera',
        title: 'Portrait Photography',
        description: 'Professional portraits that capture your unique personality and style',
        color: 'primary',
        id: 1
      },
      {
        icon: 'Video',
        title: 'Event Coverage',
        description: 'Complete documentation of your special moments and celebrations',
        color: 'accent',
        id: 2
      },
      {
        icon: 'Palette',
        title: 'Creative Direction',
        description: 'Artistic vision and styling to bring your concepts to life',
        color: 'purple',
        id: 3
      },
      {
        icon: 'Users',
        title: 'Corporate Sessions',
        description: 'Professional headshots and team photography for businesses',
        color: 'primary',
        id: 4
      },
      {
        icon: 'Sparkles',
        title: 'Photo Editing',
        description: 'Expert retouching and color grading for flawless results',
        color: 'accent',
        id: 5
      },
      {
        icon: 'Star',
        title: 'Premium Prints',
        description: 'Gallery-quality prints and albums to preserve your memories',
        color: 'purple',
        id: 6
      }
    ]
  });

  useEffect(() => {
    if (content?.content) {
      setServicesData(prev => ({
        ...prev,
        eyebrow: content.content.eyebrow || prev.eyebrow,
        heading: content.content.heading || prev.heading,
        subheading: content.content.subheading || prev.subheading,
        items: content.content.items || prev.items
      }));
    }
  }, [content]);
  
  const getIconComponent = (iconName: string) => {
    switch(iconName) {
      case 'Camera': return Camera;
      case 'Video': return Video;
      case 'Palette': return Palette;
      case 'Users': return Users;
      case 'Sparkles': return Sparkles;
      case 'Star': return Star;
      default: return Camera; // fallback to Camera icon
    }
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'accent':
        return 'text-accent';
      case 'purple':
        return 'text-purple';
      default:
        return 'text-primary';
    }
  };

  const getGlowClass = (color: string) => {
    switch (color) {
      case 'accent':
        return 'group-hover:shadow-[0_0_30px_hsl(185_60%_50%/0.3)]';
      case 'purple':
        return 'group-hover:shadow-[0_0_30px_hsl(270_50%_60%/0.3)]';
      default:
        return 'group-hover:shadow-[0_0_30px_hsl(43_70%_55%/0.3)]';
    }
  };

  return (
    <section id="services" className="relative py-24 overflow-hidden">
      {/* Background gradient */}
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
            {servicesData.eyebrow}
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            {servicesData.heading} <span className="text-gradient">Services</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {servicesData.subheading}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicesData.items.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="cursor-pointer"
              onClick={() => router.push(`/service/${service.id}`)}
            >
              <GlassCard 
                className={`h-full group transition-shadow duration-500 ${getGlowClass(service.color)} hover:scale-105`}
              >
                {/* Icon */}
                <motion.div 
                  className={`w-14 h-14 rounded-xl glass-card flex items-center justify-center mb-5 ${getColorClass(service.color)}`}
                  whileHover={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  {React.createElement(getIconComponent(service.icon), { className: "w-7 h-7" })}
                </motion.div>

                {/* Content */}
                <h3 className="font-serif text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {service.description}
                </p>

                {/* Hover indicator */}
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
