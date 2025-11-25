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
        brand:{
          DEFAULT: "#1DB954",  // Spotify green
          dark: "#1AA34A",     // Darker green shade
          light: "#1ED760",  // lighter green shade
        }
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

