/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        base: "#edf2ec",
        ink: "#143328",
        accent: "#2f7a60",
        accentDeep: "#225843",
        accentSoft: "#dcefe5",
        ember: "#d79b56",
        panel: "#fcfdf9"
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"]
      },
      boxShadow: {
        card: "0 24px 60px rgba(20, 51, 40, 0.12)",
        shell: "0 28px 80px rgba(20, 51, 40, 0.12)"
      }
    }
  },
  plugins: []
};
