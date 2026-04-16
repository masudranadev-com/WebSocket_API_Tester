/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        base: "#f3f1e7",
        ink: "#12261f",
        accent: "#0f766e",
        accentSoft: "#d4f0ea",
        ember: "#f97316",
        panel: "#fffdf8"
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"]
      },
      boxShadow: {
        card: "0 24px 60px rgba(15, 23, 42, 0.08)",
        shell: "0 24px 70px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
