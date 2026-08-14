/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ece8ff',
          200: '#d9d2ff',
          300: '#beb3ff',
          400: '#9b8cff',
          500: '#7965f6',
          600: '#624ddf',
          700: '#4d3abb',
          800: '#3c2e91',
          900: '#2f256d',
          950: '#1b163e',
        },
      },
      fontFamily: {
        sans: [
          'InterVariable',
          'Inter',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI Variable',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        'soft-xs': '0 1px 2px rgb(15 23 42 / 0.04)',
        'soft-sm': '0 1px 2px rgb(15 23 42 / 0.05), 0 8px 24px rgb(15 23 42 / 0.05)',
        'soft-md': '0 2px 5px rgb(15 23 42 / 0.06), 0 18px 45px rgb(15 23 42 / 0.08)',
        'soft-lg': '0 4px 12px rgb(15 23 42 / 0.08), 0 28px 70px rgb(15 23 42 / 0.12)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'soft-pop': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '70%': { transform: 'scale(1.015)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        'soft-pop': 'soft-pop 320ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
