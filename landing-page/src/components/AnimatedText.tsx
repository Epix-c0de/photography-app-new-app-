'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export default function AnimatedText({ text, className = '', delay = 0 }: AnimatedTextProps) {
  const words = text.split(' ');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className={`flex flex-wrap ${className}`}>
      {words.map((word, i) => (
        <span
          key={i}
          className="mr-[0.25em] inline-block"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity 0.5s ease ${delay + i * 0.03}s, transform 0.5s ease ${delay + i * 0.03}s`,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
