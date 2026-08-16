'use client';

import { useMemo } from 'react';

export default function ParticleBackground() {
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 4 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.1,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 opacity-50" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.03) 0%, transparent 50%)' }} />

      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, hsl(270 50% 60% / 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(185 60% 50% / 0.06) 0%, transparent 50%)',
        }}
      />

      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            width: particle.size,
            height: particle.size,
            background: `radial-gradient(circle, rgba(212,175,55,${particle.opacity}), transparent)`,
            boxShadow: `0 0 ${particle.size * 2}px rgba(212,175,55,${particle.opacity * 0.5})`,
            animation: `floatUp ${particle.duration}s linear ${particle.delay}s infinite`,
          }}
        />
      ))}

      {/* Subtle noise overlay */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
    </div>
  );
}
