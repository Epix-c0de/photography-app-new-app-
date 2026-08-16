'use client';

import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    id: '1',
    name: 'Sarah Johnson',
    role: 'Wedding Client',
    content: 'The photos captured every emotion perfectly. We couldn\'t be happier with the results!',
    rating: 5,
    avatar: 'SJ',
  },
  {
    id: '2',
    name: 'Michael Chen',
    role: 'Corporate Client',
    content: 'Professional, creative, and incredibly easy to work with. Highly recommended!',
    rating: 5,
    avatar: 'MC',
  },
  {
    id: '3',
    name: 'Emily Davis',
    role: 'Portrait Client',
    content: 'An amazing experience from start to finish. The gallery access system is so convenient!',
    rating: 5,
    avatar: 'ED',
  },
];

export default function TestimonialsSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 80%, hsl(43 70% 55% / 0.05), transparent 60%)' }}
      />

      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-widest uppercase mb-4 block">
            Testimonials
          </span>
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            What Our <span className="text-gold-text">Clients</span> Say
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">Real stories from our valued clients</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className="glass-premium p-6 h-full relative group hover-lift"
              style={{ animation: `fadeUp 0.6s ease-out ${index * 0.15}s forwards`, opacity: 0 }}
            >
              <Quote className="absolute top-6 right-6 w-8 h-8 text-primary/20" />

              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>

              <p className="text-foreground/80 leading-relaxed mb-6 italic">
                &quot;{testimonial.content}&quot;
              </p>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full golden-gradient flex items-center justify-center font-semibold text-primary-foreground">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
