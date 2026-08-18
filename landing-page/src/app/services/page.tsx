'use client';

import { motion } from 'framer-motion';
import { Camera, Image, Download, Users, Sparkles, Star, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import GlassCard from '@/components/home/GlassCard';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const services = [
  {
    id: 'portrait-photography',
    icon: Camera,
    title: 'Portrait Photography',
    description: 'Professional portraits that capture your unique personality and style with expert lighting and composition.',
    color: 'primary',
    features: ['Studio & Outdoor Sessions', 'Professional Lighting', 'Multiple Outfits', 'Same-Day Previews']
  },
  {
    id: 'event-coverage',
    icon: Image,
    title: 'Event Coverage',
    description: 'Complete documentation of your special moments, from weddings to corporate events.',
    color: 'accent',
    features: ['Full Day Coverage', 'Second Photographer Available', 'Candid & Posed Shots', 'Quick Turnaround']
  },
  {
    id: 'online-gallery',
    icon: Download,
    title: 'Online Gallery Access',
    description: 'View your photos anytime, anywhere through our secure online gallery system.',
    color: 'purple',
    features: ['Password Protected', 'High-Resolution Downloads', 'Share with Family', 'Unlimited Access']
  },
  {
    id: 'family-sharing',
    icon: Users,
    title: 'Family Sharing',
    description: 'Share your beautiful moments with family and friends through the Epix Shots app.',
    color: 'primary',
    features: ['App-Based Sharing', 'Private Galleries', 'Instant Notifications', 'Easy Downloads']
  },
  {
    id: 'photo-editing',
    icon: Sparkles,
    title: 'Photo Editing',
    description: 'Expert retouching and color grading for flawless, magazine-quality results.',
    color: 'accent',
    features: ['Color Correction', 'Skin Retouching', 'Background Enhancement', 'Creative Effects']
  },
  {
    id: 'premium-prints',
    icon: Star,
    title: 'Premium Prints',
    description: 'Gallery-quality prints and albums to preserve your memories for generations.',
    color: 'purple',
    features: ['Canvas Prints', 'Photo Albums', 'Framed Prints', 'Custom Layouts']
  }
];

const getColorClass = (color: string) => {
  switch (color) {
    case 'accent': return 'text-accent';
    case 'purple': return 'text-purple';
    default: return 'text-primary';
  }
};

const ServicesPage = () => {
  return (
    <div className="min-h-screen bg-background relative">
      {/* Header */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 hero-gradient opacity-50" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-primary text-sm font-medium tracking-widest uppercase mb-4 block">
              Our Services
            </span>
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6">
              Professional <span className="text-gradient">Photography</span> Services
            </h1>
            <p className="text-xl text-muted-foreground">
              From portrait sessions to event coverage, we offer comprehensive photography solutions tailored to your needs
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link href={`/services/${service.id}`}>
                  <GlassCard className="h-full group hover:scale-105 cursor-pointer">
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
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      {service.description}
                    </p>

                    <ul className="space-y-2 mb-4">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex items-center text-sm text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center text-sm font-medium text-primary group-hover:translate-x-1 transition-transform">
                      Learn more <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="glass-premium p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-serif font-bold mb-4">Ready to Book?</h2>
            <p className="text-muted-foreground mb-8">
              Contact us today to discuss your photography needs and get a custom quote.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="https://wa.me/254717894431?text=Hello! I'm interested in your photography services."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 rounded-lg golden-gradient text-white font-semibold hover-scale shadow-golden"
              >
                WhatsApp Us
              </a>
              <a 
                href="mailto:info@epixshots.co.ke"
                className="inline-flex items-center justify-center px-8 py-3 rounded-lg glass-button border-border hover:border-primary/50 font-semibold"
              >
                Send Email
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage;
