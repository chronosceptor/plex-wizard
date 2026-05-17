/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        plex: {
          orange: '#E5A00D',
          dark: '#1F1F1F',
          card: '#2A2A2A',
          border: '#3A3A3A',
          muted: '#8A8A8A',
        },
      },
    },
  },
  plugins: [],
}
