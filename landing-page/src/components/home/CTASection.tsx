'use client';

import { motion } from 'framer-motion';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { Button } from '../ui/button';
import { ArrowRight, Download, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

const CTASection = () => {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
  const router = useRouter();

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 hero-gradient" />
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, hsl(270 50% 60% / 0.1), transparent 60%), radial-gradient(ellipse at 80% 20%, hsl(185 60% 50% / 0.08), transparent 40%)'
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isVisible ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto"
        >
          <div className="glass-premium p-12 md:p-16 text-center relative overflow-hidden">
            <motion.div 
              className="absolute top-8 left-8"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-6 h-6 text-primary/30" />
            </motion.div>
            <motion.div 
              className="absolute bottom-8 right-8"
              animate={{ rotate: -360 }}
              transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-8 h-8 text-accent/30" />
            </motion.div>

            <div className="absolute inset-0 rounded-2xl animate-pulse-glow opacity-30 pointer-events-none" />

            <motion.span 
              className="inline-block text-primary text-sm font-medium tracking-widest uppercase mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 }}
            >
              Get Started Today
            </motion.span>

            <motion.h2 
              className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3 }}
            >
              Ready to Access Your <span className="text-gradient">Beautiful Moments</span>?
            </motion.h2>

            <motion.p 
              className="text-muted-foreground mb-8 max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4 }}
            >
              Download the Epix Shots app and get instant access to your photo galleries. View, download, and share your memories.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.5 }}
            >
              <Button 
                size="lg" 
                className="golden-gradient hover-scale shadow-golden text-lg px-10 py-6 ripple group"
                onClick={() => router.push('/download')}
              >
                <Download className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Download Now
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
