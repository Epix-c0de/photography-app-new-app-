'use client';

import { Camera, Video, Palette, Users, Sparkles, Star } from 'lucide-react';

const servicesData = {
  eyebrow: 'What We Offer',
  heading: 'Our Services',
  subheading: 'Comprehensive photography solutions tailored to capture your most precious moments',
  items: [
    { icon: 'Camera', title: 'Portrait Photography', description: 'Professional portraits that capture your unique personality and style', color: 'primary' },
    { icon: 'Video', title: 'Event Coverage', description: 'Complete documentation of your special moments and celebrations', color: 'accent' },
    { icon: 'Palette', title: 'Creative Direction', description: 'Artistic vision and styling to bring your concepts to life', color: 'purple' },
    { icon: 'Users', title: 'Corporate Sessions', description: 'Professional headshots and team photography for businesses', color: 'primary' },
    { icon: 'Sparkles', title: 'Photo Editing', description: 'Expert retouching and color grading for flawless results', color: 'accent' },
    { icon: 'Star', title: 'Premium Prints', description: 'Gallery-quality prints and albums to preserve your memories', color: 'purple' },
  ],
};

const iconMap: Record<string, any> = {
  Camera, Video, Palette, Users, Sparkles, Star,
};

const colorMap: Record<string, string> = {
  accent: 'text-accent',
  purple: 'text-purple-500',
  primary: 'text-primary',
};

const glowMap: Record<string, string> = {
  accent: 'group-hover:shadow-[0_0_30px_hsl(185_60%_50%/0.3)]',
  purple: 'group-hover:shadow-[0_0_30px_hsl(270_50%_60%/0.3)]',
  primary: 'group-hover:shadow-[0_0_30px_hsl(43_70%_55%/0.3)]',
};

export default function ServicesSection() {
  return (
    <section id="services" className="relative py-24 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 30% 50%, hsl(270 50% 60% / 0.05), transparent 50%)' }}
      />

      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-widest uppercase mb-4 block">
            {servicesData.eyebrow}
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            {servicesData.heading} <span className="text-gold-text">Services</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{servicesData.subheading}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicesData.items.map((service, index) => {
            const IconComponent = iconMap[service.icon] || Camera;
            return (
              <div
                key={service.title}
                className={`glass-premium p-6 group transition-shadow duration-500 ${glowMap[service.color] || ''} hover:scale-105 cursor-pointer`}
                style={{ animation: `fadeUp 0.6s ease-out ${index * 0.1}s forwards`, opacity: 0 }}
              >
                <div className={`w-14 h-14 rounded-xl glass-card flex items-center justify-center mb-5 ${colorMap[service.color] || 'text-primary'}`}>
                  <IconComponent className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{service.description}</p>
                <div className="mt-5 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Learn more</span>
                  <span className="ml-2" style={{ animation: 'floatX 1s ease-in-out infinite' }}>→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
