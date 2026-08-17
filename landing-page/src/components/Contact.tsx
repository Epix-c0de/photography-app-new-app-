'use client';

import { MessageCircle, Phone, Mail, MapPin, AtSign, Clock, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { ContactForm } from "./ContactForm";

const Contact = () => {
  const contactMethods = [
    {
      icon: Phone,
      title: "Call or WhatsApp",
      detail: "0717894431",
      description: "Available 9 AM - 6 PM daily",
      action: "Call Now",
      href: "tel:+254717894431"
    },
    {
      icon: MessageCircle,
      title: "WhatsApp Chat",
      detail: "Instant Response",
      description: "Get quick answers to your questions",
      action: "Chat Now",
      href: "https://wa.me/254717894431?text=Hello! I'm interested in your photography services."
    },
    {
      icon: Mail,
      title: "Email Us",
      detail: "info@epixshots.co.ke",
      description: "We'll respond within 24 hours",
      action: "Send Email",
      href: "mailto:info@epixshots.co.ke"
    },
    {
      icon: AtSign,
      title: "Follow Us",
      detail: "@epixshots_ke",
      description: "See our latest work and behind-the-scenes",
      action: "Follow",
      href: "https://instagram.com/epixshots_ke"
    }
  ];

  const workingHours = [
    { day: "Monday - Friday", hours: "9:00 AM - 6:00 PM" },
    { day: "Saturday", hours: "10:00 AM - 4:00 PM" },
    { day: "Sunday", hours: "By Appointment" }
  ];

  return (
    <section id="contact" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center glass-card px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium">Get In Touch</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6">
            Let&apos;s Create <span className="text-gradient">Together</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Ready to capture your special moments? Contact us today to discuss your photography needs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Contact Methods */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contactMethods.map((method, index) => (
                <div 
                  key={index}
                  className="glass-card p-6 hover-lift group"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 golden-gradient rounded-xl flex items-center justify-center mr-4 group-hover:animate-glow">
                      <method.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                        {method.title}
                      </h3>
                      <p className="text-primary font-medium">{method.detail}</p>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground text-sm mb-4">
                    {method.description}
                  </p>
                  
                  <Button 
                    className="w-full glass-button border-border hover:border-primary/50"
                    onClick={() => window.open(method.href, '_blank')}
                  >
                    {method.action}
                  </Button>
                </div>
              ))}
            </div>

            {/* Quick Contact Form */}
            <div className="glass-card p-8 mt-8">
              <h3 className="text-2xl font-serif font-semibold mb-6">Quick Inquiry</h3>
              <ContactForm />
            </div>
          </div>

          {/* Business Info Sidebar */}
          <div className="space-y-6">
            {/* Working Hours */}
            <div className="glass-card p-6">
              <div className="flex items-center mb-4">
                <Clock className="w-6 h-6 text-primary mr-3" />
                <h3 className="text-xl font-semibold">Working Hours</h3>
              </div>
              <div className="space-y-3">
                {workingHours.map((schedule, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{schedule.day}</span>
                    <span className="font-medium">{schedule.hours}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="glass-card p-6">
              <div className="flex items-center mb-4">
                <MapPin className="w-6 h-6 text-primary mr-3" />
                <h3 className="text-xl font-semibold">Studio Location</h3>
              </div>
              <p className="text-muted-foreground mb-4">
                Nairobi, Kenya<br />
                Available for shoots nationwide
              </p>
              <Button variant="outline" className="w-full glass-button">
                View on Map
              </Button>
            </div>

            {/* Emergency Contact */}
            <div className="glass-card p-6 bg-primary/5 border-primary/20">
              <h3 className="text-xl font-semibold mb-2 text-primary">24/7 Emergency</h3>
              <p className="text-sm text-muted-foreground mb-4">
                For urgent photography needs or last-minute bookings
              </p>
              <Button className="w-full golden-gradient">
                WhatsApp: 0717894431
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
