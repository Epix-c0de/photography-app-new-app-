'use client';

import { Button } from "../ui/button";
import { ArrowRight, Download, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AnimatedText from "./AnimatedText";

const heroImageUrl = 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?q=80&w=2000&auto=format&fit=crop';

const PremiumHero = () => {
  const router = useRouter();

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image with overlays */}
      <div className="absolute inset-0">
        <motion.img 
          src={heroImageUrl} 
          alt="Professional Photography Studio" 
          className="w-full h-full object-cover"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/70" />
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, hsl(270 50% 60% / 0.15), transparent 60%)'
          }}
        />
      </div>

      {/* Floating decorative elements */}
      <motion.div 
        className="absolute top-32 left-[10%] w-3 h-3 rounded-full bg-primary/60"
        animate={{ y: [-10, 10, -10], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div 
        className="absolute top-1/4 right-[15%] w-4 h-4 rounded-full bg-accent/50"
        animate={{ y: [10, -10, 10], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div 
        className="absolute bottom-1/3 left-[20%]"
        animate={{ y: [-5, 15, -5], rotate: [0, 180, 360] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      >
        <Sparkles className="w-6 h-6 text-primary/40" />
      </motion.div>

      {/* Main content */}
      <div className="container mx-auto px-4 text-center relative z-10 pt-20">
        <motion.div 
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div 
            className="inline-flex items-center glass-card px-5 py-2.5 rounded-full mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
          >
            <Sparkles className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium text-foreground/90">Professional Photography Portal</span>
          </motion.div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold mb-6 leading-tight">
            <AnimatedText 
              text="Unlock Your" 
              className="justify-center text-foreground"
              delay={0.4}
            />
            <motion.span 
              className="block text-gradient mt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              Memories
            </motion.span>
            <AnimatedText 
              text="One Click at a Time" 
              className="justify-center text-foreground/80 text-4xl md:text-5xl lg:text-6xl mt-4"
              delay={1}
            />
          </h1>

          {/* Subheading */}
          <motion.p 
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2 }}
          >
            Access your photo galleries, view and download high-resolution images, and share your beautiful moments with family and friends.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.4 }}
          >
            <Button 
              size="lg" 
              className="golden-gradient hover-scale shadow-golden text-lg px-8 py-6 ripple group"
              onClick={() => router.push('/download')}
            >
              <Download className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Download App
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <Button 
              size="lg" 
              variant="outline" 
              className="glass-button text-foreground border-border hover:border-primary/50 text-lg px-8 py-6"
              onClick={() => router.push('https://wa.me/254717894431')}
            >
              Contact Us
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div 
            className="flex flex-wrap justify-center gap-8 md:gap-12 mt-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.6 }}
          >
            {[
              { value: '500+', label: 'Happy Clients' },
              { value: '1000+', label: 'Photos Delivered' },
              { value: '50+', label: 'Events Covered' }
            ].map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.8 + index * 0.1 }}
              >
                <motion.div 
                  className="text-3xl md:text-4xl font-bold text-gradient"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  {stat.value}
                </motion.div>
                <div className="text-muted-foreground text-sm mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div 
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 10, 0] }}
        transition={{ 
          opacity: { delay: 2, duration: 0.5 },
          y: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
          <motion.div 
            className="w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
};

export default PremiumHero;
