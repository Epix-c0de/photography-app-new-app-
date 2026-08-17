'use client';

import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

const ParticleBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Generate particles with useMemo to prevent recreation
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.1
    }));
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-mesh opacity-50" />
      
      {/* Radial gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, hsl(270 50% 60% / 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(185 60% 50% / 0.06) 0%, transparent 50%)'
        }}
      />

      {/* Floating particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            width: particle.size,
            height: particle.size,
            background: `radial-gradient(circle, hsl(var(--primary) / ${particle.opacity}), transparent)`,
            boxShadow: `0 0 ${particle.size * 2}px hsl(var(--primary) / ${particle.opacity * 0.5})`
          }}
          initial={{ 
            y: '100vh',
            opacity: 0 
          }}
          animate={{ 
            y: '-10vh',
            opacity: [0, particle.opacity, particle.opacity, 0]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}

      {/* Subtle noise overlay */}
      <div className="absolute inset-0 noise-overlay" />
    </div>
  );
};

export default ParticleBackground;
