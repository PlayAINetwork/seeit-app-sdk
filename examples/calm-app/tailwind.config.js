/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/frontend/index.html", "./src/frontend/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro"',
          "system-ui",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        accent: {
          DEFAULT: "#5EE7D0",
          soft: "rgba(94,231,208,0.16)",
        },
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        sheet: "0 -8px 40px rgba(0,0,0,0.55)",
        float: "0 8px 30px rgba(0,0,0,0.45)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(6%, -4%, 0) scale(1.08)" },
          "66%": { transform: "translate3d(-5%, 5%, 0) scale(0.96)" },
        },
        aurora: {
          "0%, 100%": { transform: "rotate(0deg) scale(1)", opacity: "0.55" },
          "50%": { transform: "rotate(180deg) scale(1.15)", opacity: "0.8" },
        },
      },
      animation: {
        breathe: "breathe 1.8s ease-in-out infinite",
        drift: "drift 18s ease-in-out infinite",
        aurora: "aurora 26s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
