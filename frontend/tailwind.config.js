/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep indigo-night + antique gold — luxury astrology palette,
        // distinct from generic SaaS blue/purple defaults.
        night: {
          950: '#0B0F1E',
          900: '#111730',
          800: '#1A2140',
          700: '#242C52',
        },
        gold: {
          50: '#FBF6E9',
          100: '#F5E9C6',
          300: '#E4C878',
          400: '#D4AF52',
          500: '#BF9536',
          600: '#9C7A2B',
        },
        maroon: {
          600: '#7A1F2B',
          700: '#5E1620',
        },
        ivory: '#FAF7F0',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        deva: ['"Noto Sans Devanagari"', 'sans-serif'],
      },
      backgroundImage: {
        'star-field': "radial-gradient(circle at 20% 20%, rgba(228,200,120,0.08) 0, transparent 40%), radial-gradient(circle at 80% 60%, rgba(228,200,120,0.06) 0, transparent 45%)",
      },
      boxShadow: {
        gold: '0 8px 30px -8px rgba(212,175,82,0.35)',
      },
    },
  },
  plugins: [],
};
