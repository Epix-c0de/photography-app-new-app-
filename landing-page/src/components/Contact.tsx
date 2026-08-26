'use client';

import { MessageCircle, Download, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

const WhatsAppChannel = () => {
  const router = useRouter();

  return (
    <section id="updates" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center glass-card px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-primary mr-2" />
            <span className="text-sm font-medium">Stay Updated</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-serif font-bold mb-6">
            Get <span className="text-gradient">Updates</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join our WhatsApp channel for app updates, new features, and photography tips
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="glass-card p-8 text-center hover-lift">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-green-500" />
            </div>
            
            <h3 className="text-2xl font-serif font-bold mb-3">WhatsApp Channel</h3>
            <p className="text-muted-foreground mb-6">
              Get notified about new app versions, features, and improvements. 
              Join our channel for the latest updates.
            </p>
            
            <a
              href="https://whatsapp.com/channel/0029VbCq7w5KGGGKVXjSfm2a"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-lg transition-all shadow-lg shadow-green-600/20 hover:shadow-green-600/40"
            >
              <MessageCircle size={20} />
              Join WhatsApp Channel
              <ExternalLink size={16} />
            </a>
            
            <p className="text-sm text-muted-foreground mt-4">
              Free to join • No spam • Updates only
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="glass-card p-6">
              <h4 className="font-semibold mb-2">App Downloads</h4>
              <p className="text-muted-foreground text-sm mb-4">
                Get the latest version of Epix Shots
              </p>
              <Button 
                className="w-full golden-gradient"
                onClick={() => router.push('/download')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download App
              </Button>
            </div>
            
            <div className="glass-card p-6">
              <h4 className="font-semibold mb-2">Need Help?</h4>
              <p className="text-muted-foreground text-sm mb-4">
                Check our FAQ or reach out through the app
              </p>
              <Button 
                variant="outline"
                className="w-full glass-button border-border hover:border-primary/50"
                onClick={() => window.open('https://whatsapp.com/channel/0029VbCq7w5KGGGKVXjSfm2a', '_blank')}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Get Support
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhatsAppChannel;
