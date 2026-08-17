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
        background: '#FFFFFF',
        foreground: '#1A1A1A',
        card: { DEFAULT: '#F8F9FA', foreground: '#1A1A1A' },
        primary: { DEFAULT: '#D4AF37', foreground: '#FFFFFF', glow: '#F0D060' },
        accent: '#38BDF8',
        purple: { 500: '#A855F7' },
        border: 'rgba(0,0,0,0.08)',
        muted: { DEFAULT: 'rgba(0,0,0,0.04)', foreground: 'rgba(0,0,0,0.5)' },
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
