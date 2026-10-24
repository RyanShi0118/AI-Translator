/** @type {import('tailwindcss').Config} */
export default {
  content: ['./options.html', './popup.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
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
