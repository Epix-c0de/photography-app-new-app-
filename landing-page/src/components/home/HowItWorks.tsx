'use client';

import { motion } from 'framer-motion';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Calendar, Camera, Image, Download } from 'lucide-react';

const steps = [
  {
    icon: Camera,
    number: '01',
    title: 'Book a Session',
    description: 'Contact us to schedule your photography session at a time that works for you'
  },
  {
    icon: Image,
    number: '02',
    title: 'Get Your Photos',
    description: 'Your photos are professionally edited and uploaded to your personal gallery'
  },
  {
    icon: Download,
    number: '03',
    title: 'Download the App',
    description: 'Download the Epix Shots app to access your gallery on any device'
  },
  {
    icon: Calendar,
    number: '04',
    title: 'View & Share',
    description: 'Browse, download, and share your beautiful moments with family and friends'
  }
];

const HowItWorks = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  return (
    <section id="how-it-works" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 hero-gradient opacity-50" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-medium tracking-widest uppercase mb-4 block">
            Simple Process
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From booking to viewing your photos, it&apos;s as easy as 1-2-3-4
          </p>
        </motion.div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className="relative"
              >
                <div className="glass-premium p-8 text-center group hover-lift">
                  <motion.div 
                    className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full golden-gradient flex items-center justify-center text-sm font-bold text-primary-foreground shadow-golden"
                    whileHover={{ scale: 1.2 }}
                  >
                    {index + 1}
                  </motion.div>

                  <motion.div 
                    className="w-16 h-16 mx-auto rounded-full glass-card flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_hsl(var(--primary)/0.3)] transition-shadow"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.8 }}
                  >
                    <step.icon className="w-8 h-8 text-primary" />
                  </motion.div>

                  <h3 className="font-serif text-xl font-semibold mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {index < steps.length - 1 && (
                  <motion.div 
                    className="hidden lg:block absolute top-1/2 -right-4 text-primary/50"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    →
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
