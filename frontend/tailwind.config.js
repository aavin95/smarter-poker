/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark': '#121212',  // A very dark base color
        'primary': '#f43f5e',  // A vibrant primary color
        'accent': '#10b981',  // A cool accent color
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],  // A clean, modern sans-serif font
      }
    },
  },
  plugins: [],

};
