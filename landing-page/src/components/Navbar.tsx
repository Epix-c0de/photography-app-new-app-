'use client';

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Menu, X, Camera, LogIn, UserPlus, Sparkles, Zap } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSmoothScroll } from "../hooks/useSmoothScroll";
import UserDropdown from "./UserDropdown";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  useSmoothScroll();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAuthClick = (type: 'login' | 'signup') => {
    router.push('/auth');
  };

  const navigationItems = [
    { name: 'Home', href: '#home' },
    { name: 'Showcase', href: '/showcase' },
    { name: 'Services', href: '/services' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Contact', href: '#contact' }
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
      scrolled 
        ? 'glass-card border-0 border-b border-primary/20 backdrop-blur-2xl shadow-2xl shadow-primary/10' 
        : 'bg-transparent'
    }`}>
      {/* Futuristic animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse opacity-40"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent animate-glow"></div>
      
      {/* Floating particles with enhanced animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i}
            className={`absolute w-1 h-1 bg-primary rounded-full animate-float opacity-60`}
            style={{ 
              top: `${Math.random() * 20 + 10}%`,
              left: `${Math.random() * 80 + 10}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${4 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Scanning line effect */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse opacity-60"></div>

      <div className="container mx-auto px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-20">
          {/* Enhanced Logo */}
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => router.push('/')}>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-md group-hover:blur-lg transition-all duration-500"></div>
              <Camera className="relative h-10 w-10 text-primary transition-all duration-500 group-hover:scale-125 group-hover:rotate-12 group-hover:text-primary-glow" />
              <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary-glow animate-pulse opacity-0 group-hover:opacity-100 transition-all duration-500" />
              <Zap className="absolute -bottom-1 -left-1 h-3 w-3 text-primary animate-bounce opacity-0 group-hover:opacity-80 transition-all duration-700" />
            </div>
            <div className="relative">
              <span className="text-2xl font-serif font-bold text-gradient hover:scale relative z-10">
                Epix Shots
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 blur-sm opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-lg"></div>
            </div>
          </div>

          {/* Enhanced Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            {navigationItems.map((item, index) => (
              (item.name === 'Services' || item.name === 'Showcase') ? (
                <Link 
                  key={item.name}
                  href={item.href} 
                  className="relative group py-3 px-6 transition-all duration-500 text-white font-semibold text-lg hover:text-primary story-link animate-fade-in hover:scale-105"
                >
                  <span className="relative z-10 font-bold tracking-wide drop-shadow-md">{item.name}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-all duration-500 rounded-xl"></div>
                  <div className="absolute bottom-0 left-1/2 w-0 h-[3px] bg-gradient-to-r from-primary to-primary-glow group-hover:w-full group-hover:left-0 transition-all duration-500 rounded-full"></div>
                </Link>
              ) : (
                <a 
                  key={item.name}
                  href={item.href} 
                  className="relative group py-3 px-6 transition-all duration-500 text-white font-semibold text-lg hover:text-primary story-link animate-fade-in hover:scale-105"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <span className="relative z-10 font-bold tracking-wide drop-shadow-md">{item.name}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-all duration-500 rounded-xl"></div>
                  <div className="absolute bottom-0 left-1/2 w-0 h-[3px] bg-gradient-to-r from-primary to-primary-glow group-hover:w-full group-hover:left-0 transition-all duration-500 rounded-full"></div>
                </a>
              )
            ))}
          </div>

          {/* Enhanced Auth Section */}
          <div className="hidden lg:flex items-center space-x-4">
            {user || isAdmin ? (
              <div className="animate-scale-in">
                <UserDropdown />
              </div>
            ) : (
              <div className="flex items-center space-x-4 animate-fade-in">
                <Button 
                  variant="ghost" 
                  size="lg"
                  className="glass-button group relative overflow-hidden border border-primary/30 hover:border-primary/60 transition-all duration-500 hover:shadow-lg hover:shadow-primary/20" 
                  onClick={() => handleAuthClick('login')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/15 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <LogIn className="h-4 w-4 mr-2 relative z-10 group-hover:rotate-12 transition-transform duration-500" />
                  <span className="relative z-10 font-semibold tracking-wide">Login</span>
                </Button>
                <Button 
                  size="lg"
                  className="golden-gradient hover-scale group relative overflow-hidden shadow-golden hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500" 
                  onClick={() => handleAuthClick('signup')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <UserPlus className="h-4 w-4 mr-2 relative z-10 group-hover:scale-125 transition-transform duration-500" />
                  <span className="relative z-10 font-semibold tracking-wide">Sign Up</span>
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </Button>
              </div>
            )}
          </div>

          {/* Enhanced Mobile Menu Button */}
          <Button
            variant="ghost"
            size="lg"
            className="lg:hidden glass-button group relative overflow-hidden border border-primary/30 hover:border-primary/60 transition-all duration-500"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
            <div className="relative z-10 transition-all duration-500">
              {isOpen ? 
                <X className={`h-6 w-6 transition-all duration-500 ${isOpen ? 'rotate-180 scale-110' : ''}`} /> : 
                <Menu className={`h-6 w-6 transition-all duration-500 ${!isOpen ? 'group-hover:scale-110' : ''}`} />
              }
            </div>
          </Button>
        </div>

        {/* Enhanced Mobile Navigation */}
        {isOpen && (
          <div className="lg:hidden pb-6 animate-slide-in-right">
            <div className="flex flex-col space-y-3 mt-4 p-6 rounded-2xl glass-card border border-primary/30 backdrop-blur-2xl">
              {navigationItems.map((item, index) => (
                (item.name === 'Services' || item.name === 'Showcase') ? (
                  <Link 
                    key={item.name}
                    href={item.href} 
                    className="text-white font-semibold text-lg hover:text-primary transition-all duration-500 story-link py-3 px-4 rounded-xl hover:bg-primary/10 animate-fade-in border border-transparent hover:border-primary/20"
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="font-bold tracking-wide drop-shadow-md">{item.name}</span>
                  </Link>
                ) : (
                  <a 
                    key={item.name}
                    href={item.href} 
                    className="text-white font-semibold text-lg hover:text-primary transition-all duration-500 story-link py-3 px-4 rounded-xl hover:bg-primary/10 animate-fade-in border border-transparent hover:border-primary/20"
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="font-bold tracking-wide drop-shadow-md">{item.name}</span>
                  </a>
                )
              ))}
              
              <div className="flex flex-col space-y-3 pt-6 border-t border-primary/20">
                {user || isAdmin ? (
                  <div className="flex justify-center animate-scale-in">
                    <UserDropdown />
                  </div>
                ) : (
                  <div className="space-y-3 animate-fade-in" style={{ animationDelay: '500ms' }}>
                    <Button 
                      variant="ghost" 
                      size="lg"
                      className="glass-button justify-start w-full group relative overflow-hidden border border-primary/30 hover:border-primary/60" 
                      onClick={() => handleAuthClick('login')}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/15 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <LogIn className="h-4 w-4 mr-3 relative z-10 group-hover:rotate-12 transition-transform duration-500" />
                      <span className="relative z-10 font-semibold">Login</span>
                    </Button>
                    <Button 
                      size="lg"
                      className="golden-gradient justify-start w-full group relative overflow-hidden shadow-golden hover:shadow-xl hover:shadow-primary/30" 
                      onClick={() => handleAuthClick('signup')}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <UserPlus className="h-4 w-4 mr-3 relative z-10 group-hover:scale-125 transition-transform duration-500" />
                      <span className="relative z-10 font-semibold">Sign Up</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
