import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        accenture: {
          DEFAULT: '#A100FF',
          50: '#F7EDFF',
          100: '#EAD2FF',
          200: '#D4A4FF',
          300: '#BE76FF',
          400: '#A848FF',
          500: '#A100FF',
          600: '#8000CC',
          700: '#600099',
          800: '#400066',
          900: '#200033',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
export default config;
