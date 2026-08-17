import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./src/pages/**/*.{ts,tsx}",
		"./src/components/**/*.{ts,tsx}",
		"./src/app/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))',
    				glow: 'hsl(var(--primary-glow))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			purple: {
    				DEFAULT: 'hsl(var(--purple))',
    				glow: 'hsl(var(--purple-glow))'
    			}
    		},
    		fontFamily: {
    			sans: [
    				'Roboto',
    				'ui-sans-serif',
    				'system-ui',
    				'-apple-system',
    				'BlinkMacSystemFont',
    				'Segoe UI',
    				'Helvetica Neue',
    				'Arial',
    				'Noto Sans',
    				'sans-serif'
    			],
    			serif: [
    				'Libre Caslon Text',
    				'ui-serif',
    				'Georgia',
    				'Cambria',
    				'Times New Roman',
    				'Times',
    				'serif'
    			],
    			mono: [
    				'Roboto Mono',
    				'ui-monospace',
    				'SFMono-Regular',
    				'Menlo',
    				'Monaco',
    				'Consolas',
    				'Liberation Mono',
    				'Courier New',
    				'monospace'
    			]
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)',
    			xl: 'calc(var(--radius) + 4px)',
    			'2xl': 'calc(var(--radius) + 8px)'
    		},
    		keyframes: {
    			float: {
    				'0%, 100%': {
    					transform: 'translateY(0px) rotate(0deg)'
    				},
    				'25%': {
    					transform: 'translateY(-10px) rotate(1deg)'
    				},
    				'50%': {
    					transform: 'translateY(-20px) rotate(0deg)'
    				},
    				'75%': {
    					transform: 'translateY(-10px) rotate(-1deg)'
    				}
    			},
    			glow: {
    				'0%': {
    					boxShadow: '0 0 20px hsl(43 70% 55% / 0.2)'
    				},
    				'100%': {
    					boxShadow: '0 0 40px hsl(43 70% 55% / 0.4), 0 0 60px hsl(43 70% 55% / 0.2)'
    				}
    			},
    			'fade-in': {
    				'0%': {
    					opacity: '0',
    					transform: 'translateY(10px)'
    				},
    				'100%': {
    					opacity: '1',
    					transform: 'translateY(0)'
    				}
    			},
    			'fade-in-up': {
    				'0%': {
    					opacity: '0',
    					transform: 'translateY(40px)'
    				},
    				'100%': {
    					opacity: '1',
    					transform: 'translateY(0)'
    				}
    			},
    			'pulse-glow': {
    				'0%, 100%': {
    					boxShadow: '0 0 15px hsl(43 70% 55% / 0.4)',
    					transform: 'scale(1)'
    				},
    				'50%': {
    					boxShadow: '0 0 30px hsl(43 70% 55% / 0.6), 0 0 50px hsl(43 70% 55% / 0.3)',
    					transform: 'scale(1.02)'
    				}
    			},
    			shimmer: {
    				'0%': {
    					backgroundPosition: '-1000px 0'
    				},
    				'100%': {
    					backgroundPosition: '1000px 0'
    				}
    			}
    		},
    		animation: {
    			float: 'float 8s ease-in-out infinite',
    			glow: 'glow 3s ease-in-out infinite alternate',
    			'fade-in': 'fade-in 0.8s ease-out',
    			'fade-in-up': 'fade-in-up 1s ease-out',
    			'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
    			shimmer: 'shimmer 2s linear infinite'
    		},
    		backdropBlur: {
    			xs: '2px'
    		},
    		transitionTimingFunction: {
    			premium: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    		},
    		boxShadow: {
    			'2xs': 'var(--shadow-2xs)',
    			xs: 'var(--shadow-xs)',
    			sm: 'var(--shadow-sm)',
    			md: 'var(--shadow-md)',
    			lg: 'var(--shadow-lg)',
    			xl: 'var(--shadow-xl)',
    			'2xl': 'var(--shadow-2xl)'
    		}
    	}
    },
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
