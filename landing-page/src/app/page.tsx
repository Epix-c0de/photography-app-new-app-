import ParticleBackground from '@/components/ParticleBackground';
import Navbar from '@/components/Navbar';
import PremiumHero from '@/components/PremiumHero';
import ShowcaseSection from '@/components/ShowcaseSection';
import ServicesSection from '@/components/ServicesSection';
import HowItWorks from '@/components/HowItWorks';
import TestimonialsSection from '@/components/TestimonialsSection';
import Pricing from '@/components/Pricing';
import CTASection from '@/components/CTASection';
import ContactSection from '@/components/ContactSection';
import PremiumFooter from '@/components/PremiumFooter';
import WhatsAppFloat from '@/components/WhatsAppFloat';

export default function HomePage() {
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
        <ContactSection />
        <PremiumFooter />
      </main>
      <WhatsAppFloat />
    </div>
  );
}
