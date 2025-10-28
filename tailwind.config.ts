import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#DA734E',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f1f5f9',
          foreground: '#0f172a',
        },
        muted: {
          DEFAULT: '#f8fafc',
          foreground: '#64748b',
        },
        accent: {
          DEFAULT: '#DA734E',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        border: '#e2e8f0',
        input: '#e2e8f0',
        ring: '#DA734E',
        background: '#ffffff',
        foreground: '#171717',
      },
    },
  },
  plugins: [],
};
export default config;
