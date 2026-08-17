'use client';

import Navbar from '@/components/Navbar';
import PremiumHero from '@/components/home/PremiumHero';
import ShowcaseSection from '@/components/home/ShowcaseSection';
import ServicesSection from '@/components/home/ServicesSection';
import HowItWorks from '@/components/home/HowItWorks';
import TestimonialsSection from '@/components/home/TestimonialsSection';
import Pricing from '@/components/Pricing';
import Contact from '@/components/Contact';
import CTASection from '@/components/home/CTASection';
import PremiumFooter from '@/components/home/PremiumFooter';
import ParticleBackground from '@/components/home/ParticleBackground';
import SoundToggle from '@/components/home/SoundToggle';
import WhatsAppFloat from '@/components/WhatsAppFloat';
import useSound from '@/hooks/useSound';

const Index = () => {
  const { isMuted, toggleMute } = useSound();

  return (
    <div className="min-h-screen bg-background relative">
      <ParticleBackground />
      <Navbar />
      <main>
        <PremiumHero />
        <ShowcaseSection />
        <ServicesSection />
        <HowItWorks />
        <TestimonialsSection />
        <Pricing />
        <CTASection />
        <Contact />
        <PremiumFooter />
      </main>
      <SoundToggle isMuted={isMuted} onToggle={toggleMute} />
      <WhatsAppFloat />
    </div>
  );
};

export default Index;
