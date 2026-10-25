/** @type {import('tailwindcss').Config} */
export default {
  content: ['./options.html', './popup.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      keyframes: {
        'rt-fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'rt-fade-in': 'rt-fade-in 120ms ease-out' },
    },
  },
  plugins: [],
};
