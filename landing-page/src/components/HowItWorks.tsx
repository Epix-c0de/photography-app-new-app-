'use client';

import { Calendar, Camera, Image, Download } from 'lucide-react';

const steps = [
  { icon: Calendar, number: '01', title: 'Book Your Session', description: 'Choose your preferred date and photography package' },
  { icon: Camera, number: '02', title: 'Capture the Moment', description: 'Enjoy a professional photography session' },
  { icon: Image, number: '03', title: 'Review & Select', description: 'Browse your gallery and select your favorites' },
  { icon: Download, number: '04', title: 'Download & Share', description: 'Get instant access to your beautiful photos' },
];

export default function HowItWorks() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 hero-gradient opacity-50" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-widest uppercase mb-4 block">
            Simple Process
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            How It <span className="text-gold-text">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">A seamless experience from booking to delivery</p>
        </div>

        <div className="relative">
          {/* Connecting line - desktop only */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative"
                style={{ animation: `fadeUp 0.6s ease-out ${index * 0.15}s forwards`, opacity: 0 }}
              >
                <div className="glass-premium p-8 text-center group hover-lift relative">
                  {/* Number badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full golden-gradient flex items-center justify-center text-sm font-bold text-primary-foreground shadow-golden">
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 mx-auto rounded-full glass-card flex items-center justify-center mb-6 group-hover:shadow-[0_0_30px_hsl(var(--primary)/0.3)] transition-shadow">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>

                  <h3 className="font-serif text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>

                {/* Arrow to next - desktop only */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 text-primary/50" style={{ animation: 'floatX 2s ease-in-out infinite' }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
