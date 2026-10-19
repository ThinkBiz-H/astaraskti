/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: { 950: '#0B0F1E', 900: '#111730', 800: '#1A2140', 700: '#242C52' },
        gold: { 50: '#FBF6E9', 300: '#E4C878', 400: '#D4AF52', 500: '#BF9536', 600: '#9C7A2B' },
        maroon: { 600: '#7A1F2B', 700: '#5E1620' },
        surface: '#F6F5F2',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
