import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
        'gold-muted': 'rgba(212,175,55,0.15)',
        background: '#0A0A0E',
        card: '#111118',
        border: 'rgba(255,255,255,0.08)',
        primary: {
          DEFAULT: '#D4AF37',
          foreground: '#080810',
        },
        secondary: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          foreground: 'rgba(255,255,255,0.5)',
        },
        accent: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          foreground: '#ffffff',
        },
        input: 'rgba(255,255,255,0.08)',
        ring: '#D4AF37',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '1rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
