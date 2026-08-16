/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        foreground: '#FFFFFF',
        card: { DEFAULT: '#111111', foreground: '#FFFFFF' },
        primary: { DEFAULT: '#D4AF37', foreground: '#080810', glow: '#F0D060' },
        accent: '#38BDF8',
        purple: { 500: '#A855F7' },
        border: 'rgba(255,255,255,0.08)',
        muted: { DEFAULT: 'rgba(255,255,255,0.06)', foreground: 'rgba(255,255,255,0.5)' },
        gold: '#D4AF37',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
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
