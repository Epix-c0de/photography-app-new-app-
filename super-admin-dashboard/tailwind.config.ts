import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4AF37',
        background: '#0A0A0E',
        card: '#111118',
        border: 'rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
};
export default config;
