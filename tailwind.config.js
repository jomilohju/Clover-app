/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      zIndex: { 500: '500', 1000: '1000', 2000: '2000' },
    },
  },
  plugins: [],
};
