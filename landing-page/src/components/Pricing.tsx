'use client';

import { Check, Crown, Star, Sparkles, ArrowRight } from 'lucide-react';

const pricingPlans = [
  {
    name: 'Standard Shoot',
    price: 'KSh 8,000',
    description: 'Perfect for individual portraits and small sessions',
    features: ['1-2 hour session', '20 edited photos', 'Online gallery access', 'Basic retouching included', 'Digital download', 'Personal usage rights'],
    isPopular: false,
    icon: Star,
    gradient: 'from-blue-500 to-purple-600',
  },
  {
    name: 'Premium Session',
    price: 'KSh 15,000',
    description: 'Comprehensive package for special occasions',
    features: ['3-4 hour session', '50 edited photos', 'Premium online gallery', 'Advanced retouching', 'High-resolution downloads', 'Print release included', 'Rush delivery option', 'Personal consultation'],
    isPopular: true,
    icon: Crown,
    gradient: 'golden-gradient',
  },
  {
    name: 'Wedding Package',
    price: 'KSh 35,000',
    description: 'Complete wedding day coverage with premium service',
    features: ['Full day coverage (8+ hours)', '100+ edited photos', 'Luxury online gallery', 'Professional retouching', '4K resolution downloads', 'Custom photo album', 'Engagement session included', 'Second photographer', 'Same-day preview', 'Commercial usage rights'],
    isPopular: false,
    icon: Sparkles,
    gradient: 'from-pink-500 to-rose-600',
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center glass-card px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium">Transparent Pricing</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6">
            Choose Your <span className="text-gold-text">Package</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Professional photography packages designed to fit your needs and budget
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <div
              key={index}
              className={`relative glass-card p-8 hover-lift group ${plan.isPopular ? 'ring-2 ring-primary shadow-golden' : ''}`}
              style={{ animation: `fadeUp 0.6s ease-out ${index * 0.1}s forwards`, opacity: 0 }}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="golden-gradient px-6 py-2 rounded-full text-white text-sm font-medium shadow-lg">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center group-hover:animate-glow ${plan.isPopular ? 'golden-gradient' : `bg-gradient-to-br ${plan.gradient}`}`}>
                  <plan.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-serif font-bold mb-2 group-hover:text-primary transition-colors">{plan.name}</h3>
                <div className="text-4xl font-bold text-gold-text mb-2">{plan.price}</div>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, fi) => (
                  <li key={fi} className="flex items-start">
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center mt-0.5 mr-3 flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <button className={`w-full group/btn flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all duration-300 ${plan.isPopular ? 'golden-gradient shadow-golden text-primary-foreground' : 'glass-button border-border hover:border-primary/50 text-foreground'}`}>
                Book This Package
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="glass-card p-8 max-w-3xl mx-auto">
            <h3 className="text-2xl font-serif font-semibold mb-4">Need Something Custom?</h3>
            <p className="text-muted-foreground mb-6">
              Every event is unique. Contact us to create a personalized package that perfectly fits your vision and budget.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://wa.me/254717894431?text=Hello! I'm interested in a custom photography package." target="_blank" rel="noopener noreferrer">
                <button className="glass-button border-border hover:border-primary/50 py-3 px-6 rounded-xl font-semibold transition-all duration-300">
                  WhatsApp: 0717894431
                </button>
              </a>
              <button className="golden-gradient hover-scale py-3 px-6 rounded-xl font-semibold text-primary-foreground transition-all duration-300">
                Schedule Consultation
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
