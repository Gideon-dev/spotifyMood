/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: { roboto: ['var(--font-roboto)', 'sans-serif'], }, 
      colors: { 
        moodHappy: '#FFD166',
        moodSad: '#118AB2', 
        moodChill: '#06D6A0', 
        moodFocus: '#073B4C',
        primaryGreen: '#1DB954',
        primaryGreenHover: '#1ED760'
      },
    },
  },
  plugins: [],
}

