/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'compact': '600px',
        'regular': '900px',
        'expanded': '1200px',
      },
      // We'll use the design tokens from our CSS file
      // but can extend with additional values if needed
    },
  },
  plugins: [],
}