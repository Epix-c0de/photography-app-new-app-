'use client';

import { MessageCircle } from 'lucide-react';

export default function WhatsAppFloat() {
  const handleWhatsAppClick = () => {
    const message = "Hello! I'm interested in your photography services at Epix Shots. Can we discuss my requirements?";
    const whatsappUrl = `https://wa.me/254717894431?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <button
      onClick={handleWhatsAppClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 golden-gradient rounded-full shadow-golden hover-scale animate-float flex items-center justify-center group"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />

      <div className="absolute bottom-16 right-0 bg-foreground text-background px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Chat on WhatsApp
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground" />
      </div>
    </button>
  );
}
