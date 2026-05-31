import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
        'gold-light': '#F0D060',
        'gold-muted': 'rgba(212,175,55,0.15)',
        background: '#080810',
        surface: '#0F0F1A',
        card: '#13131F',
        'card-hover': '#1A1A2A',
        border: 'rgba(255,255,255,0.06)',
        'border-gold': 'rgba(212,175,55,0.2)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #D4AF37 0%, #F0D060 50%, #D4AF37 100%)',
        'dark-gradient': 'linear-gradient(180deg, #0F0F1A 0%, #080810 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(212,175,55,0.05) 0%, transparent 100%)',
      },
      boxShadow: {
        'gold': '0 0 30px rgba(212,175,55,0.15)',
        'gold-sm': '0 0 15px rgba(212,175,55,0.1)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
