'use client';

import { motion } from 'framer-motion';
import { Camera, Image, Download, Users, Sparkles, Star, ArrowLeft, Check, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const servicesData: Record<string, {
  icon: any;
  title: string;
  description: string;
  longDescription: string;
  color: string;
  features: string[];
  benefits: string[];
}> = {
  'portrait-photography': {
    icon: Camera,
    title: 'Portrait Photography',
    description: 'Professional portraits that capture your unique personality and style.',
    longDescription: 'Our portrait photography sessions are designed to bring out your best self. Whether it\'s a personal branding shoot, family portrait, or creative session, our expert photographers use professional lighting and composition to create stunning images that you\'ll treasure forever.',
    color: 'primary',
    features: ['Studio & Outdoor Sessions', 'Professional Lighting', 'Multiple Outfits', 'Same-Day Previews', 'Online Gallery Access', 'High-Resolution Files'],
    benefits: ['Boost your professional presence', 'Create lasting family memories', 'Perfect for social media profiles', 'Print-ready images']
  },
  'event-coverage': {
    icon: Image,
    title: 'Event Coverage',
    description: 'Complete documentation of your special moments and celebrations.',
    longDescription: 'From intimate gatherings to grand celebrations, we capture every precious moment of your special event. Our experienced team ensures no moment is missed, providing a comprehensive visual story of your day.',
    color: 'accent',
    features: ['Full Day Coverage', 'Second Photographer Available', 'Candid & Posed Shots', 'Quick Turnaround', 'Online Gallery', 'Print Release'],
    benefits: ['Relive your special day', 'Share with guests instantly', 'Professional quality throughout', 'Peace of mind']
  },
  'online-gallery': {
    icon: Download,
    title: 'Online Gallery Access',
    description: 'View your photos anytime, anywhere through our secure gallery.',
    longDescription: 'Access your complete photo collection through our secure, easy-to-use online gallery. View, download, and share your high-resolution photos from any device, anytime, anywhere.',
    color: 'purple',
    features: ['Password Protected', 'High-Resolution Downloads', 'Share with Family', 'Unlimited Access', 'Mobile Friendly', 'Print Ordering'],
    benefits: ['Access photos anytime', 'Share easily with loved ones', 'Download in multiple sizes', 'Never lose your memories']
  },
  'family-sharing': {
    icon: Users,
    title: 'Family Sharing',
    description: 'Share your beautiful moments with family and friends.',
    longDescription: 'Our family sharing feature through the Epix Shots app makes it easy to share your photo galleries with loved ones. Everyone can view, download, and enjoy your precious moments.',
    color: 'primary',
    features: ['App-Based Sharing', 'Private Galleries', 'Instant Notifications', 'Easy Downloads', 'Family Albums', 'Comment Feature'],
    benefits: ['Keep family connected', 'Share moments instantly', 'Create shared memories', 'Easy for all ages']
  },
  'photo-editing': {
    icon: Sparkles,
    title: 'Photo Editing',
    description: 'Expert retouching and color grading for flawless results.',
    longDescription: 'Every photo we deliver goes through professional editing. From color correction to skin retouching, we ensure each image meets our high standards of quality.',
    color: 'accent',
    features: ['Color Correction', 'Skin Retouching', 'Background Enhancement', 'Creative Effects', 'Black & White Options', 'HDR Processing'],
    benefits: ['Magazine-quality results', 'Consistent look across photos', 'Enhanced natural beauty', 'Professional finish']
  },
  'premium-prints': {
    icon: Star,
    title: 'Premium Prints',
    description: 'Gallery-quality prints and albums to preserve your memories.',
    longDescription: 'Transform your digital photos into tangible treasures with our premium print services. From canvas prints to custom albums, we offer gallery-quality products that last a lifetime.',
    color: 'purple',
    features: ['Canvas Prints', 'Photo Albums', 'Framed Prints', 'Custom Layouts', 'Multiple Sizes', 'Premium Materials'],
    benefits: ['Tangible memories', 'Wall-worthy art', 'Heirloom quality', 'Perfect gifts']
  }
};

const ServiceDetailPage = () => {
  const params = useParams();
  const id = params.id as string;
  const service = servicesData[id];

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold mb-4">Service Not Found</h1>
          <p className="text-muted-foreground mb-8">The service you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/services" className="inline-flex items-center gap-2 golden-gradient px-6 py-3 rounded-lg text-white font-semibold">
            <ArrowLeft className="w-4 h-4" /> Back to Services
          </Link>
        </div>
      </div>
    );
  }

  const Icon = service.icon;
  const colorClass = service.color === 'accent' ? 'text-accent' : service.color === 'purple' ? 'text-purple' : 'text-primary';

  return (
    <div className="min-h-screen bg-background relative">
      {/* Header */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 hero-gradient opacity-50" />
        <div className="container mx-auto px-4 relative z-10">
          <Link href="/services" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Services
          </Link>
          
          <motion.div 
            className="max-w-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className={`w-16 h-16 rounded-xl glass-card flex items-center justify-center mb-6 ${colorClass}`}>
              <Icon className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6">
              {service.title}
            </h1>
            <p className="text-xl text-muted-foreground">
              {service.description}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-2xl font-serif font-bold mb-6">About This Service</h2>
                <p className="text-muted-foreground leading-relaxed text-lg mb-8">
                  {service.longDescription}
                </p>

                <h3 className="text-xl font-serif font-bold mb-4">What&apos;s Included</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {service.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 glass-card p-4 rounded-lg">
                      <div className="w-8 h-8 rounded-full golden-gradient flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-medium">{feature}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-xl font-serif font-bold mb-4">Benefits</h3>
                <ul className="space-y-3">
                  {service.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="glass-premium p-8 sticky top-32"
              >
                <h3 className="text-xl font-serif font-bold mb-4">Ready to Get Started?</h3>
                <p className="text-muted-foreground mb-6">
                  Contact us today to book this service or ask any questions.
                </p>
                <div className="space-y-4">
                  <a 
                    href="https://wa.me/254717894431?text=Hello! I'm interested in your photography services."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg golden-gradient text-white font-semibold hover-scale shadow-golden"
                  >
                    <MessageCircle className="w-5 h-5" />
                    WhatsApp Us
                  </a>
                  <a 
                    href="mailto:info@epixshots.co.ke"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg glass-button border-border hover:border-primary/50 font-semibold"
                  >
                    Send Email
                  </a>
                </div>
                <div className="mt-6 pt-6 border-t border-border/30">
                  <p className="text-sm text-muted-foreground mb-2">Quick Contact</p>
                  <p className="font-semibold">+254 717 894 431</p>
                  <p className="text-sm text-muted-foreground mt-1">info@epixshots.co.ke</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServiceDetailPage;
