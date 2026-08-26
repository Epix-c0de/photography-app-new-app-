'use client';

import { MessageCircle } from "lucide-react";

const WhatsAppFloat = () => {
  const handleWhatsAppClick = () => {
    window.open('https://whatsapp.com/channel/0029VbCq7w5KGGGKVXjSfm2a', '_blank');
  };

  return (
    <button
      onClick={handleWhatsAppClick}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 golden-gradient rounded-full shadow-golden hover-scale animate-float flex items-center justify-center group"
      aria-label="Join WhatsApp Channel"
    >
      <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
      
      <div className="absolute bottom-16 right-0 bg-foreground text-background px-3 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Join WhatsApp Channel
        <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground"></div>
      </div>
    </button>
  );
};

export default WhatsAppFloat;
